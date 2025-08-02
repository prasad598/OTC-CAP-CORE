const cds = require('@sap/cds')
const { SELECT, INSERT, UPDATE } = cds.ql

async function generateCustomRequestId(tx, { prefix, requestType, isDraft = false }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  const entity = 'BTP.CORE_REQ_SEQ'
  const idType = isDraft ? 'DRAFT' : 'REQUEST'
  const key = { SEQ_YEAR: year, REQUEST_TYPE: requestType, ID_TYPE: idType }

  const row = await tx.run(
    SELECT.one.from(entity).where(key).forUpdate()
  )

  const user = tx.user && tx.user.id
  let seq
  if (!row) {
    seq = 1
    await tx.run(
      INSERT.into(entity).entries({
        SEQ_YEAR: year,
        REQUEST_TYPE: requestType,
        ID_TYPE: idType,
        LAST_SEQ_NO: seq,
        CREATED_BY: user
      })
    )
  } else {
    seq = row.LAST_SEQ_NO + 1
    await tx.run(
      UPDATE(entity)
        .set({ LAST_SEQ_NO: seq, UPDATED_BY: user, UPDATED_DATETIME: now })
        .where(key)
    )
  }

  const base = `${prefix}${year}${month}${requestType}`
  const formatted = String(seq).padStart(5, '0')
  const draft = isDraft ? '-DRFT' : ''
  return `${base}${draft}${formatted}`
}

module.exports = { generateCustomRequestId }

