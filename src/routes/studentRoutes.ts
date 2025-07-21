import { UserRole } from '~/utils'
import { instructorPaths } from '~/utils/paths/instructorPaths'
import { studentPaths } from '~/utils/paths/studentPaths'
import { userPaths } from '~/utils/paths/userPath'

const express = require('express')
const router = express.Router()
const studentController = require('../controllers/studentController')
const authController = require('../controllers/authController')

router.get(studentPaths.myLessons, authController.restrictTo([UserRole.STUDENT]), studentController.getMyLessons)
router.get(
  studentPaths.studentChatRoom,
  authController.restrictTo([UserRole.STUDENT]),
  studentController.studentChatRoom
)
router.post(
  studentPaths.markLessonDone,
  authController.restrictTo([UserRole.STUDENT]),
  studentController.markLessonDone
)

module.exports = router
