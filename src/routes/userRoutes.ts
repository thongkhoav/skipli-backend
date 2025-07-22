import { userPaths } from '~/utils/paths/userPath'

const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')

router.post(userPaths.createAccessCode, authController.createAccessCode)
router.post(userPaths.validateAccessCode, authController.validateAccessCode)
router.post(userPaths.loginEmail, authController.loginEmail)
router.post(userPaths.loginByAccount, authController.loginByAccount)
router.post(userPaths.createInstructor, authController.createInstructor)
router.post(userPaths.setupAccount, authController.setupAccount)
router.post(userPaths.checkStudentNotSetup, authController.checkStudentNotSetup)
router.put(userPaths.editProfile, authController.editProfile)
router.get(userPaths.getProfile, authController.getProfile)

// Refresh token route
router.post(userPaths.refreshToken, authController.refreshToken)

module.exports = router
