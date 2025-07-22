import { NextFunction, Request, Response } from 'express'
import AppError from '~/utils/appError'
const jwt = require('jsonwebtoken')
import { generateCode, UserRole } from '~/utils'
import { publicPaths } from '~/utils/paths/publicPath'
import { sendMail } from '~/services/nodemailer'
const { admin, db } = require('../services/firebase')
const { sendSMS } = require('../services/twilio')
const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid')

exports.createInstructor = async (req: Request, res: Response, next: NextFunction) => {
  const { phone, name, email } = req.body
  if (!phone || !name || !email) {
    return next(new AppError(400, 'fail', 'Phone number, name and email are required'))
  }
  try {
    const phoneQuery = await db.collection('users').where('phone', '==', phone).get()
    if (!phoneQuery.empty) {
      return next(new AppError(400, 'fail', 'User already exists with this phone number'))
    }
    const emailQuery = await db.collection('users').where('email', '==', email).get()
    if (!emailQuery.empty) {
      return next(new AppError(400, 'fail', 'User already exists with this email'))
    }
    // Create a new user document
    const userRef = db.collection('users').doc(uuidv4())
    await userRef.set({
      id: userRef.id,
      phone: phone,
      name: name,
      email: email,
      accessCode: '',
      role: UserRole.INSTRUCTOR,
      isVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    // Create a classroom for the instructor
    const classRoomId = uuidv4()
    const classRoomRef = db.collection('classrooms').doc(classRoomId)
    await classRoomRef.set({
      id: classRoomId,
      name: 'Default Classroom',
      description: 'This is your default classroom',
      owner: userRef.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    return res.status(200).json({
      message: 'Instructor created successfully.'
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

// POST /createAccessCode
exports.createAccessCode = async (req: Request, res: Response, next: NextFunction) => {
  const { phoneNumber } = req.body
  if (!phoneNumber) {
    return next(new AppError(400, 'fail', 'Phone number is required'))
  }
  const accessCode = generateCode()
  try {
    const query = await db
      .collection('users')
      .where('phone', '==', phoneNumber)
      .where('role', '==', UserRole.INSTRUCTOR)
      .get()
    if (query.empty) {
      return next(new AppError(400, 'fail', 'Instructor not found with this phone number'))
    }
    const userRef = query.docs[0].ref

    // update the access code
    await userRef.update({
      accessCode: accessCode,
      updatedAt: new Date().toISOString()
    })

    // Send SMS with the access code
    await sendSMS(phoneNumber, `Your access code is: ${accessCode}`)
    return res.status(200).json({
      message: 'Access code sent successfully.'
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

exports.loginEmail = async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body
  if (!email) {
    return next(new AppError(400, 'fail', 'Email is required'))
  }
  const accessCode = generateCode()
  try {
    const userQuery = await db
      .collection('users')
      .where('email', '==', email)
      .where('role', '==', UserRole.STUDENT)
      .get()
    const userDoc = userQuery.docs[0]
    if (userQuery.empty) {
      return next(new AppError(404, 'fail', 'User not found'))
    } else {
      // Existing user: just update the code
      await userDoc.ref.update({
        accessCode: accessCode,
        updatedAt: new Date().toISOString()
      })
    }
    await sendMail(email, 'Your Access Code', `Your access code is: ${accessCode}`)
    return res.status(200).json({
      message: 'Please check your email for the access code.'
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

exports.loginByAccount = async (req: Request, res: Response, next: NextFunction) => {
  const { password, username } = req.body
  if (!password || !username) {
    return next(new AppError(400, 'fail', 'Username and password are required'))
  }
  try {
    // get doc by email and role
    const userQuery = await db
      .collection('users')
      .where('username', '==', username)
      .where('role', '==', UserRole.STUDENT)
      .get()
    if (userQuery.empty) {
      return next(new AppError(404, 'fail', 'User not found'))
    }
    const userDoc = userQuery.docs[0]
    const userData = userDoc.data()
    // Check password
    const isPasswordValid = await bcrypt.compare(password, userData.password)
    if (!isPasswordValid) {
      return next(new AppError(401, 'fail', 'Invalid password'))
    }
    // Generate JWT token
    const token = jwt.sign(
      { phone: userData.phone, email: userData.email, role: userData.role, id: userData.id },
      process.env.ACCESS_TOKEN_SIGN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRATION || '1h'
      }
    )
    const refreshToken = jwt.sign(
      { phone: userData.phone, email: userData.email, role: userData.role, id: userData.id },
      process.env.REFRESH_TOKEN_SIGN_SECRET,
      {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '7d'
      }
    )
    return res.status(200).json({
      ...userData,
      accessToken: token,
      refreshToken: refreshToken
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

exports.setupAccount = async (req: Request, res: Response, next: NextFunction) => {
  const { token, username, password } = req.body
  if (!token || !username || !password) {
    return next(new AppError(400, 'fail', 'Token, username and password are required'))
  }

  try {
    // Verify the token
    const decoded: any = jwt.verify(token, process.env.NEW_STUDENT_TOKEN_SIGN_SECRET)
    const { phone, email } = decoded
    if (!phone || !email) {
      return next(new AppError(400, 'fail', 'Invalid token'))
    }

    // get doc by email and role
    const userQuery = await db
      .collection('users')
      .where('email', '==', email)
      .where('role', '==', UserRole.STUDENT)
      .get()
    if (userQuery.empty) {
      return next(new AppError(404, 'fail', 'User not found'))
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    // Update user with username and hashed password
    const userDoc = userQuery.docs[0]
    await userDoc.ref.update({
      isVerified: true,
      username,
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    })
    return res.status(200).json({
      message: 'Account setup successful. You can now log in.'
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

exports.checkStudentNotSetup = async (req: Request, res: Response, next: NextFunction) => {
  const { token } = req.body
  if (!token) {
    return next(new AppError(400, 'fail', 'Token is required'))
  }
  try {
    // Verify the token
    const decoded: any = jwt.verify(token, process.env.NEW_STUDENT_TOKEN_SIGN_SECRET)
    const { phone, email } = decoded
    if (!phone || !email) {
      return next(new AppError(400, 'fail', 'Invalid token'))
    }

    // get doc by email and role
    const userQuery = await db
      .collection('users')
      .where('email', '==', email)
      .where('role', '==', UserRole.STUDENT)
      .where('isVerified', '==', false)
      .get()
    return res.status(200).json({
      isNotSetup: !userQuery.empty,
      message: !userQuery.empty ? 'User has not set up their account yet.' : 'User has already set up their account.'
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

//POST /validateAccessCode
exports.validateAccessCode = async (req: Request, res: Response, next: NextFunction) => {
  const { phoneNumber, email, accessCode } = req.body
  if ((!phoneNumber && !email) || !accessCode) {
    return next(new AppError(400, 'fail', 'Please provide phone number or email and access code'))
  }
  try {
    let userRef
    if (phoneNumber) {
      const phoneQuery = await db.collection('users').where('phone', '==', phoneNumber).get()
      if (phoneQuery.empty) {
        return next(new AppError(400, 'fail', 'User not found with this phone number'))
      }
      userRef = phoneQuery.docs[0].ref
    } else {
      const emailQuery = await db.collection('users').where('email', '==', email).get()
      if (emailQuery.empty) {
        return next(new AppError(400, 'fail', 'User not found with this email'))
      }
      userRef = emailQuery.docs[0].ref
    }
    const userDoc = await userRef.get()
    if (!userDoc.exists) {
      return next(new AppError(404, 'fail', 'User not found'))
    }
    const userData = userDoc.data()
    if (userData.accessCode !== accessCode) {
      return next(new AppError(401, 'fail', 'Invalid access code'))
    }
    // Generate JWT token
    const token = jwt.sign(
      { phone: phoneNumber, email: email || userData.email, role: userData.role, id: userData.id },
      process.env.ACCESS_TOKEN_SIGN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRATION || '1h'
      }
    )
    const refreshToken = jwt.sign(
      { phone: phoneNumber, email: email || userData.email, role: userData.role, id: userData.id },
      process.env.REFRESH_TOKEN_SIGN_SECRET,
      {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '7d'
      }
    )
    // clear access code after validation
    await userRef.update({
      accessCode: '',
      updatedAt: new Date().toISOString()
    })
    return res.status(200).json({
      ...userData,
      accessToken: token,
      refreshToken: refreshToken
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}

exports.protect = async (req: Request, res: Response, next: NextFunction) => {
  // Skip authentication for public routes
  // ignore socket.io paths
  if (publicPaths.includes(req.path) || req.path.startsWith('/socket.io')) {
    return next()
  }

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

exports.restrictTo = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes((req as any).user.role)) {
      return next(new AppError(403, 'fail', 'You are not allowed to do this action'))
    }
    next()
  }
}

// refresh token
exports.refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body
  if (!refreshToken) {
    return next(new AppError(400, 'fail', 'Refresh token is required'))
  }
  try {
    const decoded: any = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SIGN_SECRET)
    const { phone, email, role, id } = decoded
    // Check if the user exists
    const userQuery = await db.collection('users').doc(id).get()
    if (!userQuery.exists) {
      return next(new AppError(404, 'fail', 'User not found'))
    }
    // Generate new access token
    const newAccessToken = jwt.sign({ phone, email, role, id }, process.env.ACCESS_TOKEN_SIGN_SECRET, {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRATION || '1h'
    })
    const newRefreshToken = jwt.sign({ phone, email, role, id }, process.env.REFRESH_TOKEN_SIGN_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '7d'
    })
    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    })
  } catch (error: any) {
    return next(new AppError(500, 'fail', error.message))
  }
}
