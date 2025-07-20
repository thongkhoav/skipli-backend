import { NextFunction, Request, Response } from 'express'
import AppError from '~/utils/appError'
const jwt = require('jsonwebtoken')
import { UserRole } from '~/utils'
import { publicPaths } from '~/utils/paths/publicPath'
const { admin, db } = require('../services/firebase')
const { sendSMS } = require('../services/twilio')

// POST /createAccessCode
exports.addStudent = async (req: Request, res: Response, next: NextFunction) => {
  const { name, phone, email } = req.body
  if (!phone || !name || !email) {
    return next(new AppError(400, 'fail', 'Phone number, name and email are required'))
  }
  try {
    // error if any user has email or phone
    let userRef = db.collection('users').doc(phone)
    let userDoc = await userRef.get()
    if (userDoc.exists) {
      return next(new AppError(400, 'fail', 'User already exists with this phone number'))
    }
    userRef = db.collection('users').doc(email)
    userDoc = await userRef.get()
    if (userDoc.exists) {
      return next(new AppError(400, 'fail', 'User already exists with this email'))
    }

    await userRef.set({
      phone: phone,
      accessCode: '',
      name: name,
      email: email,
      role: UserRole.STUDENT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    const roomRef = db.collection('rooms').doc(req.user?.phone)
    const roomDoc = await roomRef.get()
    // add student to the classroom
    if (roomDoc.exists) {
      await roomRef.update({
        students: admin.firestore.FieldValue.arrayUnion(email)
      })
    } else {
      await roomRef.set({
        name: 'Default Classroom',
        description: 'This is your default classroom',
        owner: req.user?.phone,
        students: [email],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }

    // Send SMS with the access code
    return res.status(200).json({
      message: 'Student added successfully.'
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}
