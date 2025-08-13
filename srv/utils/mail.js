const cds = require('@sap/cds');

async function sendEmail(subject, to, cc, body, attachments = []) {
  const service = await cds.connect.to('sap_process_automation_mail');
  const payload = {
    to: Array.isArray(to) ? to : [to],
    cc: cc ? (Array.isArray(cc) ? cc : [cc]) : [],
    subject,
    body,
  }
  if (attachments.length) {
    payload.attachments = attachments
  }
  try {
    await service.send({
      method: 'POST',
      path: '/mail/send',
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(`Failed to send email: ${err.message}`)
  }
}

module.exports = { sendEmail };
