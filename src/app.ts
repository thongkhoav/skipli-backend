import express, { Request, Response, NextFunction } from 'express'
import AppError from './utils/appError'
const helmet = require('helmet')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { admin, db } = require('./services/firebase')
// require('dotenv').config()
const { globalErrHandler } = require('./controllers/errorController')
const userRoutes = require('./routes/userRoutes')
const instructorRoutes = require('./routes/instructorRoutes')
const authController = require('./controllers/authController')

const app = express()

// Allow Cross-Origin requests
app.use(cors({ origin: 'http://localhost:3000', credentials: true }))

// Set security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
)

app.use(cookieParser())

app.use(express.json())

// Routes
// Require authentication
app.use(authController.protect)
app.use('/', userRoutes)
app.use('/', instructorRoutes)

app.use(globalErrHandler)

// handle undefined Routes
app.use(/(.*)/, (req: Request, res: Response, next: NextFunction) => {
  const err = new AppError(404, 'fail', 'undefined route')
  next(err)
})

module.exports = app
