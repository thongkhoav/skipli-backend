import express, { Request, Response, NextFunction } from 'express'
import AppError from './utils/appError'
const helmet = require('helmet')
const cors = require('cors')
const cookieParser = require('cookie-parser')
// require('dotenv').config()
const { globalErrHandler } = require('./controllers/errorController')

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
app.use(globalErrHandler)

// handle undefined Routes
app.use(/(.*)/, (req: Request, res: Response, next: NextFunction) => {
  const err = new AppError(404, 'fail', 'undefined route')
  next(err)
})

module.exports = app
