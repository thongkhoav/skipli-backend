import { UserRole } from '~/utils'
import { instructorPaths } from '~/utils/paths/instructorPaths'
import { userPaths } from '~/utils/paths/userPath'

const express = require('express')
const router = express.Router()
const instructorController = require('./../controllers/instructorController')
const authController = require('../controllers/authController')
router.post(
  instructorPaths.addStudent,
  authController.restrictTo([UserRole.INSTRUCTOR]),
  instructorController.addStudent
)
router.put(
  instructorPaths.editStudentById,
  authController.restrictTo([UserRole.INSTRUCTOR]),
  instructorController.editStudentById
)
router.get(
  instructorPaths.getStudents,
  authController.restrictTo([UserRole.INSTRUCTOR]),
  instructorController.getStudents
)
router.get(
  instructorPaths.getLessons,
  authController.restrictTo([UserRole.INSTRUCTOR]),
  instructorController.getLessons
)
router.post(
  instructorPaths.assignLesson,
  authController.restrictTo([UserRole.INSTRUCTOR]),
  instructorController.assignLesson
)

// Chat
router.get(instructorPaths.getChats, authController.restrictTo([UserRole.INSTRUCTOR]), instructorController.getChats)

module.exports = router
