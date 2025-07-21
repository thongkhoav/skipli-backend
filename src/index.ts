require('dotenv').config()

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION!!! shutting down...')
  console.log(err.name, err.message)
  process.exit(1)
})

const httpServer = require('./app')
const port = process.env.PORT || 4000

// Start the server
httpServer.listen(port, () => {
  console.log(`Application is running on port ${port}`)
})
