const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')

router.post('/createAccessCode', authController.markPublic, authController.createAccessCode)
router.post('/validateAccessCode', authController.markPublic, authController.validateAccessCode)
router.post('/test-twilio', authController.markPublic, authController.testTwilio)

module.exports = router
