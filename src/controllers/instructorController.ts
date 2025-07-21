import { NextFunction, Request, Response } from 'express'
import AppError from '~/utils/appError'
const jwt = require('jsonwebtoken')
import { UserRole } from '~/utils'
import { publicPaths } from '~/utils/paths/publicPath'
import { sendMail } from '~/services/nodemailer'
const { admin, db } = require('../services/firebase')
const { v4: uuidv4 } = require('uuid')

exports.addStudent = async (req: Request, res: Response, next: NextFunction) => {
  const { name, phone, email, address } = req.body
  if (!phone || !name || !email) {
    return next(new AppError(400, 'fail', 'Phone number, name and email are required'))
  }
  try {
    const emailQuery = await db.collection('users').where('email', '==', email).get()
    if (!emailQuery.empty) {
      return next(new AppError(400, 'fail', 'User already exists with this email'))
    }

    const phoneQuery = await db.collection('users').where('phone', '==', phone).get()
    if (!phoneQuery.empty) {
      return next(new AppError(400, 'fail', 'User already exists with this phone number'))
    }
    const newUserId = uuidv4()
    const userRef = db.collection('users').doc(newUserId)

    // create new user document
    await userRef.set({
      id: newUserId,
      phone: phone,
      accessCode: '',
      name: name,
      email: email,
      username: '',
      role: UserRole.STUDENT,
      address: address,
      isVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    const roomQuery = await db.collection('classrooms').where('owner', '==', req.user?.id).get()
    const roomRef = roomQuery.docs[0].ref
    // add student to the classroom
    await roomRef.update({
      students: admin.firestore.FieldValue.arrayUnion(newUserId)
    })

    // create conversation for the new student
    const conversationId = uuidv4()

    const conversationRef = db.collection('conversations').doc(conversationId)
    await conversationRef.set({
      owner: req.user?.id,
      student: newUserId,
      lastMessage: '',
      updatedAt: new Date().toISOString()
    })

    //Add a welcome message
    await conversationRef.collection('messages').add({
      from: req.user?.id,
      to: newUserId,
      content: `Hi ${name}, welcome to Skipli Classroom!`,
      timestamp: new Date().toISOString()
    })

    //create a JWT token for the new student to setup their account
    const newStudentToken = jwt.sign({ phone, email }, process.env.NEW_STUDENT_TOKEN_SIGN_SECRET, {
      expiresIn: process.env.NEW_STUDENT_TOKEN_EXPIRATION || '1d'
    })

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    const setupUrl = `${frontendUrl}/student-setup?token=${newStudentToken}`

    await sendMail(
      email,
      'Welcome to Skipli Classroom',
      `Hello ${name},\n\nYou have been added as a student in Skipli Classroom.
      The link will be valid for 7 days.\n\n
      Please complete your setup by clicking the link below:\n\n${setupUrl}\n\nThank you!`
    )
    return res.status(200).json({
      message: 'Student added successfully.'
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

exports.editStudentById = async (req: Request, res: Response, next: NextFunction) => {
  const { name, address } = req.body
  const studentId = req.params.id
  if (!studentId) {
    return next(new AppError(400, 'fail', 'Student ID is required'))
  }
  if (!name) {
    return next(new AppError(400, 'fail', 'Name is required'))
  }
  try {
    const studentRef = await db.collection('users').doc(studentId)
    const studentDoc = await studentRef.get()
    if (!studentDoc.exists) {
      return next(new AppError(404, 'fail', 'Student not found'))
    }
    await studentRef.update({
      name: name,
      address: address,
      updatedAt: new Date().toISOString()
    })
    return res.status(200).json({
      message: 'Student updated successfully.'
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

exports.getStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roomQuery = await db.collection('classrooms').where('owner', '==', req?.user?.id).get()
    const roomRef = roomQuery.docs[0].ref
    const roomDoc = await roomRef.get()
    if (!roomDoc.exists) {
      return next(new AppError(404, 'fail', 'Classroom not found'))
    }
    const students = roomDoc.data()?.students || []
    // Fetch user details for each student
    const studentDetails = await Promise.all(
      students.map(async (email: string) => {
        const userRef = db.collection('users').doc(email)
        const userDoc = await userRef.get()
        if (userDoc.exists) {
          return {
            email: userDoc.id,
            ...userDoc.data()
          }
        }
        return null
      })
    )
    return res.status(200).json({
      status: 'success',
      data: studentDetails
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

exports.assignLesson = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, studentIds } = req.body
    const newLessonId = uuidv4()
    const lessonRef = db.collection('lessons').doc(newLessonId)

    const classQuery = await db.collection('classrooms').where('owner', '==', req.user?.id).get()
    if (classQuery.empty) {
      return next(new AppError(404, 'fail', 'No classroom found'))
    }
    const classDoc = classQuery.docs[0]

    await lessonRef.set({
      id: newLessonId,
      classId: classDoc.id,
      creator: req.user?.id,
      title: title,
      description: description,
      students: studentIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })

    // Initialize lesson status for each student
    const batch = db.batch()
    studentIds.forEach((userId: string) => {
      const docId = `${userId}_${lessonRef.id}`
      const statusRef = db.collection('lessonStatus').doc(docId)
      batch.set(statusRef, {
        userId,
        lessonId: lessonRef.id,
        isDone: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    })

    await batch.commit()
    return res.status(201).json({
      status: 'success',
      message: 'Lesson assigned successfully',
      lessonId: newLessonId
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

exports.getLessons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lessonsQuery = await db.collection('lessons').where('creator', '==', req.user?.id).get()
    if (lessonsQuery.empty) {
      return res.status(404).json({
        status: 'fail',
        message: 'No lessons found for this instructor'
      })
    }

    const lessons = await Promise.all(
      lessonsQuery.docs.map(async (doc: any) => {
        const lessonData = doc.data()
        const studentDetails = await Promise.all(
          lessonData.students.map(async (studentId: string) => {
            const studentRef = db.collection('users').doc(studentId)
            const studentDoc = await studentRef.get()
            const lessonStatusRef = db
              .collection('lessonStatus')
              .where('userId', '==', studentId)
              .where('lessonId', '==', doc.id)
            const lessonStatusQuery = await lessonStatusRef.get()
            if (studentDoc.exists) {
              return {
                id: studentDoc.id,
                ...studentDoc.data(),
                isDone: lessonStatusQuery?.docs[0]?.data()?.isDone || false
              }
            }
            return null
          })
        )
        return {
          id: doc.id,
          ...lessonData,
          students: studentDetails.filter((s) => s !== null)
        }
      })
    )
    return res.status(200).json({
      status: 'success',
      data: lessons.map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        students: doc.students,
        createdAt: doc.createdAt
      }))
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

// Chat
exports.getChats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return next(new AppError(401, 'fail', 'Unauthorized access'))
    }
    const conversationsQuery = await db.collection('conversations').where('owner', '==', userId).get()
    if (conversationsQuery.empty) {
      return res.status(200).json({
        status: 'success',
        data: []
      })
    }
    // from each conversation, get student details
    const conversations = await Promise.all(
      conversationsQuery.docs.map(async (doc: any) => {
        const conversationData = doc.data()
        const studentRef = db.collection('users').doc(conversationData.student)
        const studentDoc = await studentRef.get()
        if (!studentDoc.exists) {
          return null
        }
        return {
          id: doc.id,
          ...conversationData,
          student: {
            id: studentDoc.id,
            ...studentDoc.data()
          }
        }
      })
    )
    const filteredConversations = conversations.filter((c) => c !== null)
    return res.status(200).json({
      status: 'success',
      data: filteredConversations
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}
