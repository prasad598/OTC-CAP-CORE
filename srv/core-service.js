const cds = require('@sap/cds')
const { SELECT } = cds.ql

module.exports = (srv) => {
  const { CORE_COMMENTS, CORE_ATTACHMENTS } = srv.entities

  srv.after('READ', 'TE_SR', async (results, req) => {
    if (results == null) return
    const db = srv.transaction(req)
    const list = Array.isArray(results) ? results : [results]
    await Promise.all(
      list.map(async (item) => {
        if (!item) return
        const key = item.REQ_TXN_ID
        if (!key) return
        item.CORE_COMMENTS = await db.run(
          SELECT.from(CORE_COMMENTS).where({ REQ_TXN_ID: key })
        )
        item.CORE_ATTACHMENTS = await db.run(
          SELECT.from(CORE_ATTACHMENTS).where({ REQ_TXN_ID: key })
        )
      })
    )
  })
}
