import { NextFunction, Request, Response } from 'express'
import AppError from '~/utils/appError'
const jwt = require('jsonwebtoken')
import { UserRole } from '~/utils'
import { publicPaths } from '~/utils/paths/publicPath'
import { sendMail } from '~/services/nodemailer'
const { admin, db } = require('../services/firebase')
const bcrypt = require('bcrypt')
