const twilio = require('twilio')
require('dotenv').config()
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER

const client = twilio(accountSid, authToken)

async function sendSMS(to: string, body: string) {
  return client.messages.create({
    body,
    from: fromNumber,
    to
  })
}

module.exports = { sendSMS }
