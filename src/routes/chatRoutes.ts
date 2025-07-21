import { chatPaths } from '~/utils/paths/chatPaths'

const express = require('express')
const router = express.Router()
const chatController = require('./../controllers/chatController')

router.get(chatPaths.getMessages, chatController.getMessages)

module.exports = router
