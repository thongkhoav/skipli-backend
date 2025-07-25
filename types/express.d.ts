// types/express.d.ts
import { Request } from 'express'

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string
      role: string
      email: string
      phone?: string
    }
  }
}
