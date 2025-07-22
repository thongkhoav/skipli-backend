import express, { Request, Response, NextFunction } from 'express'
const { Server } = require('socket.io')
const http = require('http')
import AppError from './utils/appError'
const helmet = require('helmet')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { admin, db } = require('./services/firebase')
// require('dotenv').config()
const { globalErrHandler } = require('./controllers/errorController')
const userRoutes = require('./routes/userRoutes')
const instructorRoutes = require('./routes/instructorRoutes')
const studentRoutes = require('./routes/studentRoutes')
const chatRoutes = require('./routes/chatRoutes')
const authController = require('./controllers/authController')
const { v4: uuidv4 } = require('uuid')

const app = express()

// Allow Cross-Origin requests
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }))

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
app.use('/', studentRoutes)
app.use('/', chatRoutes)

app.use(globalErrHandler)

// handle undefined Routes
app.use(/(.*)/, (req: Request, res: Response, next: NextFunction) => {
  const err = new AppError(404, 'fail', 'undefined route')
  next(err)
})

// Setup socket.io
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
})
// store connected sockets by userId
const connectedUsers: { [key: string]: string } = {}

io.on('connection', (socket: any) => {
  console.log('User connected:', socket.id)

  //  Identify the user
  socket.on('register', (userId: string) => {
    connectedUsers[userId] = socket.id
  })

  // Receive private messages
  socket.on(
    'private_message',
    async ({
      conversationId,
      to,
      from,
      content
    }: {
      conversationId: string
      to: string
      from: string
      content: string
    }) => {
      console.log(`Private message from ${from} to ${to}: ${content}`)
      const conversationQuery = await db.collection('conversations').doc(conversationId).get()
      const message = {
        content,
        from,
        to,
        timestamp: new Date().toISOString()
      }
      if (!conversationQuery.exists) {
        return console.error('Conversation does not exist')
      }

      // add last message to conversation
      await db.collection('conversations').doc(conversationId).update({
        lastMessage: content,
        updatedAt: new Date().toISOString()
      })

      //add to collection messages of collection conversations
      await db.collection('conversations').doc(conversationId).collection('messages').add(message)

      // // emit the message to the recipient
      console.log('users', connectedUsers)
      const recipientSocketId = connectedUsers[to]
      if (recipientSocketId) {
        console.log(`Emitting message to recipient ${to} with socket ${recipientSocketId}`)
        io.to(recipientSocketId).emit('private_message', {
          content,
          from,
          to,
          timestamp: message.timestamp,
          conversationId
        })
      }
    }
  )

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    for (const userId in connectedUsers) {
      if (connectedUsers[userId] === socket.id) {
        delete connectedUsers[userId]
        break
      }
    }
    console.log('User disconnected:', socket.id)
  })
})

module.exports = httpServer
