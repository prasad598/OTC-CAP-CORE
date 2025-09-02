let xsenv
let nodemailer

try {
  xsenv = require('@sap/xsenv')
  nodemailer = require('nodemailer')
} catch (err) {
  // modules might be missing locally; handled in sendEmail
}

let transporter
let from

function init() {
  if (transporter) return
  if (!xsenv || !nodemailer) {
    throw new Error('Mail dependencies not installed')
  }

  xsenv.loadEnv()
  const services = xsenv.getServices({ dest: { tag: 'destination' } })
  const destinations = services.dest?.destinations || []
  const mailDest = destinations.find(
    (d) => d.Name === 'sap_process_automation_mail'
  )
  if (!mailDest) {
    throw new Error('Mail destination sap_process_automation_mail not found')
  }

  from = mailDest.user
  transporter = nodemailer.createTransport({
    host: mailDest.host,
    port: mailDest.port,
    secure: false,
    auth: {
      user: mailDest.user,
      pass: mailDest.password,
    },
    tls: { rejectUnauthorized: false },
  })
}

async function sendEmail(subject, to, cc, body, attachments = []) {
  try {
    init()
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

