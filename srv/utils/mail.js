let xsenv
let nodemailer
let getDestination

try {
  xsenv = require('@sap/xsenv')
  nodemailer = require('nodemailer')
  ;({ getDestination } = require('@sap-cloud-sdk/connectivity'))
} catch (err) {
  // modules might be missing locally; handled in sendEmail
}

let transporter
let from

async function init() {
  if (transporter) return
  if (!xsenv || !nodemailer || !getDestination) {
    throw new Error('Mail dependencies not installed')
  }

  xsenv.loadEnv()
  let destination
  try {
    destination = await getDestination({
      destinationName: 'sap_process_automation_mail',
    })
  } catch (err) {
    throw new Error('Mail destination sap_process_automation_mail not found')
  }
  const props = destination?.originalProperties || {}
  if (!Object.keys(props).length) {
    throw new Error('Mail destination sap_process_automation_mail not found')
  }

  from = props['mail.smtp.from'] || props['mail.user']
  transporter = nodemailer.createTransport({
    host: props['mail.smtp.host'],
    port: Number(props['mail.smtp.port']),
    secure: props['mail.smtp.ssl.enable'] === 'true',
    auth: {
      user: props['mail.user'],
      pass: props['mail.password'],
    },
    tls: { rejectUnauthorized: false },
  })
}

async function sendEmail(subject, to, cc, body, attachments = []) {
  try {
    await init()
  } catch (err) {
    return { error: err.message }
  }

  const mailOptions = {
    from,
    to: Array.isArray(to) ? to.join(',') : to,
    subject,
    text: body,
  }
  if (cc && (Array.isArray(cc) ? cc.length : true)) {
    mailOptions.cc = Array.isArray(cc) ? cc.join(',') : cc
  }
  if (attachments.length) {
    mailOptions.attachments = attachments.map((a) => ({
      filename: a.fileName || a.filename,
      content: Buffer.from(a.content, 'base64'),
    }))
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    return { messageId: info.messageId }
  } catch (err) {
    return { error: err.message }
  }
}

module.exports = { sendEmail }

