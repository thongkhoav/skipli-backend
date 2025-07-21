import { NextFunction, Request, Response } from 'express'
import AppError from '~/utils/appError'
const jwt = require('jsonwebtoken')
import { UserRole } from '~/utils'
import { publicPaths } from '~/utils/paths/publicPath'
import { sendMail } from '~/services/nodemailer'
const { db } = require('../services/firebase')

exports.getMyLessons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return next(new AppError(401, 'fail', 'Unauthorized access'))
    }

    const lessonStatusQuery = await db.collection('lessonStatus').where('userId', '==', userId).get()
    if (lessonStatusQuery.empty) {
      return res.status(200).json({
        status: 'success',
        data: []
      })
    }
    const lessons = await Promise.all(
      lessonStatusQuery.docs.map(async (doc: any) => {
        const lessonData = doc.data()
        const lessonRef = db.collection('lessons').doc(lessonData?.lessonId)
        const lessonDoc = await lessonRef.get()
        if (!lessonDoc.exists) {
          return null
        }
        return {
          id: lessonDoc.id,
          ...lessonDoc.data(),
          isDone: lessonData.isDone
        }
      })
    )
    const filteredLessons = lessons.filter((lesson) => lesson !== null)
    return res.status(200).json({
      status: 'success',
      data: filteredLessons
    })
  } catch (error) {
    next(new AppError(500, 'fail', 'An error occurred while fetching lessons'))
  }
}

exports.studentChatRoom = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return next(new AppError(401, 'fail', 'Unauthorized access'))
    }

    const conversationsQuery = await db.collection('conversations').where('student', '==', userId).get()
    if (conversationsQuery.empty) {
      return res.status(200).json({
        status: 'success',
        data: {}
      })
    }
    return res.status(200).json({
      status: 'success',
      data: conversationsQuery.docs[0]?.data() || {}
    })
  } catch (error) {
    next(new AppError(500, 'fail', 'An error occurred while fetching lessons'))
  }
}

exports.markLessonDone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lessonId } = req.body
    const userId = req.user?.id
    if (!lessonId || !userId) {
      return next(new AppError(400, 'fail', 'Invalid request parameters'))
    }

    const lessonRef = db.collection('lessons').doc(lessonId)
    const lessonDoc = await lessonRef.get()
    if (!lessonDoc.exists) {
      return next(new AppError(404, 'fail', 'Lesson not found'))
    }

    const statusRef = db
      .collection('lessonStatus')
      .where('userId', '==', userId)
      .where('lessonId', '==', lessonId)
      .where('isDone', '==', false)
    const statusQuery = await statusRef.get()
    if (statusQuery.empty) {
      return next(new AppError(404, 'fail', 'Lesson status not found for this user'))
    }
    const statusDoc = statusQuery.docs[0]
    await statusDoc.ref.update({
      isDone: true,
      updatedAt: new Date().toISOString()
    })

    return res.status(200).json({
      status: 'success',
      message: 'Lesson marked as done'
    })
  } catch (error) {
    next(new AppError(500, 'fail', 'An error occurred while marking the lesson as done'))
  }
}
