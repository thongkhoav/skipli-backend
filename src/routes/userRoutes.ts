import { userPaths } from '~/utils/paths/userPath'

const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')

router.post(userPaths.createAccessCode, authController.createAccessCode)
router.post(userPaths.validateAccessCode, authController.validateAccessCode)

module.exports = router
