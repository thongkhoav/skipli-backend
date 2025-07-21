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
// app.use(/(.*)/, (req: Request, res: Response, next: NextFunction) => {
//   const err = new AppError(404, 'fail', 'undefined route')
//   next(err)
// })

// Setup socket.io
const httpServer = http.createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
})
// store connected sockets by userId
const connectedUsers = new Map<string, string>()

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // Step 1: Identify the user
  socket.on('register', (userId: string) => {
    console.log(`User ${userId} is registering with socket ${socket.id}`)
    connectedUsers.set(userId, socket.id)
    console.log(`User ${userId} registered with socket ${socket.id}`)
    console.log('Connected users:', Array.from(connectedUsers.entries()))
  })

  // Step 2: Send a message
  socket.on('private_message', async ({ to, from, content }) => {
    const conversationQuery = db
      .collection('conversations')
      .where('owner', '==', from)
      .where('student', '==', to)
      .limit(1)
      .get()
    const conversationDoc = await conversationQuery.docs[0]
    const conversationRef = conversationDoc.ref

    const messageRef = conversationRef.collection('messages').doc()

    const timestamp = admin.firestore.FieldValue.serverTimestamp()

    //  Save the message
    await messageRef.set({
      from,
      to,
      content,
      timestamp
    })

    //  Update conversation metadata
    await conversationRef.set(
      {
        lastMessage: content,
        updatedAt: timestamp
      },
      { merge: true }
    )

    //  Emit message to recipient
    const targetSocketId = connectedUsers.get(to)
    if (targetSocketId) {
      io.to(targetSocketId).emit('private_message', {
        to,
        from,
        content,
        timestamp: Date.now()
      })
    }
  })

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId)
        break
      }
    }
    console.log('User disconnected:', socket.id)
  })
})

module.exports = httpServer
