const cds = require('@sap/cds')
const { SELECT } = cds.ql
const { generateCustomRequestId } = require('./utils/sequence')

module.exports = (srv) => {
  const { CORE_COMMENTS, CORE_ATTACHMENTS } = srv.entities

  if (typeof srv.on === 'function') {
    srv.on('error', (err) => {
      if (err.code === 'SQLITE_CONSTRAINT' || /unique constraint/i.test(err.message)) {
        err.statusCode = 409
        err.message = 'Record already exists'
      } else {
        err.statusCode = err.statusCode || 500
        err.message = err.message || 'Unexpected error'
      }
    })
  }

  srv.before('CREATE', 'TE_SR', async (req) => {
    const tx = cds.transaction(req)
    try {
      req.data.REQUEST_TYPE = 'TE'
      req.data.DRAFT_ID = await generateCustomRequestId(tx, {
        prefix: 'CASE',
        requestType: req.data.REQUEST_TYPE,
        isDraft: true,
      })
    } catch (error) {
      req.error(500, `Failed to prepare TE_SR: ${error.message}`)
    }
  })

  srv.before('CREATE', 'MON_WF_PROCESS', async (req) => {
    const tx = cds.transaction(req)
    try {
      req.data.REQUEST_ID = await generateCustomRequestId(tx, {
        prefix: 'CASE',
        requestType: req.data.REQUEST_TYPE,
      })
    } catch (error) {
      req.error(500, `Failed to create workflow: ${error.message}`)
    }
  })

  srv.after('READ', 'TE_SR', async (results, req) => {
    if (results == null) return
    const db = srv.transaction(req)
    const list = Array.isArray(results) ? results : [results]
    await Promise.all(
      list.map(async (item) => {
        if (!item) return
        const key = item.REQ_TXN_ID
        if (!key) return
        try {
          item.CORE_COMMENTS = await db.run(
            SELECT.from(CORE_COMMENTS).where({ REQ_TXN_ID: key })
          )
        } catch (error) {
          req.warn(
            `Error fetching CORE_COMMENTS for REQ_TXN_ID ${key}: ${error.message}`
          )
          item.CORE_COMMENTS = []
        }
        try {
          item.CORE_ATTACHMENTS = await db.run(
            SELECT.from(CORE_ATTACHMENTS).where({ REQ_TXN_ID: key })
          )
        } catch (error) {
          req.warn(
            `Error fetching CORE_ATTACHMENTS for REQ_TXN_ID ${key}: ${error.message}`
          )
          item.CORE_ATTACHMENTS = []
        }
      })
    )
  })
}
