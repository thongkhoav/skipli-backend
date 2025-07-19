class AppError extends Error {
  statusCode: number
  status: string
  message: string

  constructor(statusCode: number, status: string, message: string) {
    super(message)
    this.statusCode = statusCode
    this.status = status
    this.message = message
  }
}

export default AppError
