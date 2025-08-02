const cds = require('@sap/cds')
const { SELECT, INSERT, UPDATE } = cds.ql

async function generateCustomRequestId(tx, { prefix, requestType, isDraft }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  const row = await tx.run(
    SELECT.one.from('CORE_REQ_SEQ').where({ YEAR: year })
  )

  let seq
  if (!row) {
    seq = 1
    await tx.run(
      INSERT.into('CORE_REQ_SEQ').entries({ YEAR: year, LAST_SEQ_NO: seq })
    )
  } else {
    seq = row.LAST_SEQ_NO + 1
    await tx.run(
      UPDATE('CORE_REQ_SEQ').set({ LAST_SEQ_NO: seq }).where({ YEAR: year })
    )
  }

  const base = `${prefix}${year}${month}${requestType}`
  const draft = isDraft ? '-DRFT' : ''
  const formatted = String(seq).padStart(5, '0')
  return `${base}${draft}${formatted}`
}

module.exports = { generateCustomRequestId }

