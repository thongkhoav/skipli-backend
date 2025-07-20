import { UserRole } from '~/utils'
import { instructorPaths } from '~/utils/paths/instructorPaths'
import { studentPaths } from '~/utils/paths/studentPaths'
import { userPaths } from '~/utils/paths/userPath'

const express = require('express')
const router = express.Router()
const studentController = require('../controllers/studentController')

module.exports = router
