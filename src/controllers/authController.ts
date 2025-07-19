import { NextFunction, Request, Response } from 'express'
import AppError from '~/utils/appError'
const jwt = require('jsonwebtoken')
import { generateCode, UserRole } from '~/utils'
const { admin, db } = require('../services/firebase')
const { sendSMS } = require('../services/twilio')

// POST /createAccessCode
exports.createAccessCode = async (req: Request, res: Response, next: NextFunction) => {
  const { phoneNumber } = req.body
  if (!phoneNumber) {
    return next(new AppError(400, 'fail', 'Phone number is required'))
  }
  const accessCode = generateCode()
  try {
    const userRef = db.collection('users').doc(phoneNumber)
    const userDoc = await userRef.get()
    if (!userDoc.exists) {
      // New user: create record
      await userRef.set({
        phone: phoneNumber,
        accessCode: accessCode,
        name: '',
        email: '',
        role: UserRole.INSTRUCTOR,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    } else {
      // Existing user: just update the code
      await userRef.update({
        accessCode: accessCode,
        updatedAt: new Date().toISOString()
      })
    }
    // Send SMS with the access code
    await sendSMS(phoneNumber, `Your access code is: ${accessCode}`)
    return res.status(200).json({
      message: 'Access code sent successfully.'
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

//POST /validateAccessCode
exports.validateAccessCode = async (req: Request, res: Response, next: NextFunction) => {
  const { phoneNumber, accessCode } = req.body
  if (!phoneNumber || !accessCode) {
    return next(new AppError(400, 'fail', 'Phone number and access code are required'))
  }
  try {
    const userRef = db.collection('users').doc(phoneNumber)
    const userDoc = await userRef.get()
    if (!userDoc.exists) {
      return next(new AppError(404, 'fail', 'User not found'))
    }
    const userData = userDoc.data()
    if (userData.accessCode !== accessCode) {
      return next(new AppError(401, 'fail', 'Invalid access code'))
    }
    // Generate JWT token
    const token = jwt.sign({ phoneNumber }, process.env.ACCESS_TOKEN_SIGN_SECRET, { expiresIn: '1h' })
    return res.status(200).json({
      message: 'Access code validated successfully',
      token
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

exports.testTwilio = async (req: Request, res: Response, next: NextFunction) => {
  const { phoneNumber } = req.body
  if (!phoneNumber) {
    return next(new AppError(400, 'fail', 'Phone number is required'))
  }
  try {
    await sendSMS(phoneNumber, 'This is a test message from Skipli API')
    return res.status(200).json({
      message: 'Test SMS sent successfully.'
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

exports.protect = async (req: Request, res: Response, next: NextFunction) => {
  // Skip authentication for public routes
  if (req.isPublic) return next()

  try {
    // 1) check if the token is there
    let token

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }
    if (!token) {
      return next(new AppError(401, 'fail', 'You are not logged in! Please login in to continue'))
    }

    // 2) Verify token
    const decoded = await jwt.verify(token, process.env.ACCESS_TOKEN_SIGN_SECRET)

    // 3) check if the user is exist (not deleted)
    // const user = await User.findById(decode.id)
    // if (!user) {
    //   return next(new AppError(401, 'fail', 'This user is no longer exist'))
    // }
    ;(req as any).user = decoded
    next()
  } catch (err) {
    console.error(err)
    res.status(401).json({ error: 'Invalid token' })
    // next(err)
  }
}

exports.markPublic = (req: Request, res: Response, next: NextFunction) => {
  req.isPublic = true
  next()
}
