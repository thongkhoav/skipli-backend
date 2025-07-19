import express, { Request, Response, NextFunction } from 'express'
import AppError from './utils/appError'
const helmet = require('helmet')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { admin, db } = require('./services/firebase')
// require('dotenv').config()
const { globalErrHandler } = require('./controllers/errorController')
const userRoutes = require('./routes/userRoutes')

const app = express()

// Allow Cross-Origin requests
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))

// Set security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
)

app.use(cookieParser())

app.use(express.json())

// Routes
app.get('/test', (req: Request, res: Response) => {
  res.send('Welcome to the Skipli API')
})
app.post('/test-user', async (req: Request, res: Response) => {
  const { email, password } = req.body
  try {
    const userRecord = await db.collection('users').add({
      email,
      password,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })
    res.status(201).json({
      status: 'success',
      data: {
        user: userRecord
      }
    })
  } catch (error: any) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    })
  }
})
app.use('/', userRoutes)

app.use(globalErrHandler)

// handle undefined Routes
app.use(/(.*)/, (req: Request, res: Response, next: NextFunction) => {
  const err = new AppError(404, 'fail', 'undefined route')
  next(err)
})

module.exports = app
