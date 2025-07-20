import { studentPaths } from './studentPaths'
import { userPaths } from './userPath'

export const publicPaths = [
  userPaths.createAccessCode,
  userPaths.validateAccessCode,
  userPaths.loginEmail,
  userPaths.loginByAccount,
  userPaths.setupAccount,
  userPaths.checkStudentNotSetup
]
