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

module.exports = router
