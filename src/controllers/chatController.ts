import { NextFunction, Request, Response } from 'express'
import AppError from '~/utils/appError'
const jwt = require('jsonwebtoken')
const { admin, db } = require('../services/firebase')
const { v4: uuidv4 } = require('uuid')

// Chat
exports.getMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return next(new AppError(401, 'fail', 'Unauthorized access'))
    }
    const chatId = req?.query?.chatId as string
    if (!chatId) {
      return next(new AppError(400, 'fail', 'Chat ID is required'))
    }
    const messageQuery = await db
      .collection('conversations')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get()

    if (messageQuery.empty) {
      return res.status(200).json({
        status: 'success',
        data: []
      })
    }
    const messages = messageQuery.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }))
    return res.status(200).json({
      status: 'success',
      data: messages
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}
