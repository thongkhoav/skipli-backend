import { NextFunction, Request, Response } from 'express'
import AppError from '~/utils/appError'
const jwt = require('jsonwebtoken')
import { UserRole } from '~/utils'
import { publicPaths } from '~/utils/paths/publicPath'
import { sendMail } from '~/services/nodemailer'
const { admin, db } = require('../services/firebase')
const { v4: uuidv4 } = require('uuid')

// POST /createAccessCode
exports.addStudent = async (req: Request, res: Response, next: NextFunction) => {
  const { name, phone, email, role } = req.body
  if (!phone || !name || !email || !role) {
    return next(new AppError(400, 'fail', 'Phone number, name, email and role are required'))
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

    await userRef.set({
      // Generate a unique ID for the user
      id: newUserId,
      phone: phone,
      accessCode: '',
      name: name,
      email: email,
      username: '',
      role: UserRole.STUDENT,
      studentRole: role,
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

exports.getStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roomQuery = await db.collection('classrooms').where('owner', '==', req.user?.id).get()
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
    const { title, description, studentPhones } = req.body
    // get student IDs from their phone numbers
    const studentIds: string[] = []
    for (const phone of studentPhones) {
      const userQuery = await db.collection('users').where('phone', '==', phone).get()
      if (userQuery.empty) {
        return next(new AppError(404, 'fail', `No user found with phone number ${phone}`))
      }
      const userDoc = userQuery.docs[0]
      studentIds.push(userDoc.id)
    }
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
    studentIds.forEach((userId) => {
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

    return res.status(200).json({
      status: 'success',
      data: lessonsQuery.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }))
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}
