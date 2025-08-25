const cds = require('@sap/cds')
const { DELETE } = cds.ql

module.exports = async function () {
  const db = await cds.connect.to('db')
  const {
    'BTP.CORE_ATTACHMENTS': CORE_ATTACHMENTS,
    'BTP.CORE_COMMENTS': CORE_COMMENTS,
    'BTP.CORE_USERS': CORE_USERS,
    'BTP.AUTH_MATRIX': AUTH_MATRIX,
    'BTP.CONFIG_LDATA': CONFIG_LDATA,
    'BTP.MON_WF_PROCESS': MON_WF_PROCESS,
    'BTP.MON_WF_TASK': MON_WF_TASK,
    'BTP.TE_SR': TE_SR,
  } = db.entities

  this.on('purgeAllData', async (req) => {
    const tx = cds.tx(req)
    const entities = [
      CORE_ATTACHMENTS,
      CORE_COMMENTS,
      CORE_USERS,
      AUTH_MATRIX,
      CONFIG_LDATA,
      MON_WF_PROCESS,
      MON_WF_TASK,
      TE_SR,
    ].filter(Boolean)

    for (const entity of entities) {
      await tx.run(DELETE.from(entity))
    }

    return { status: 'OK' }
  })
}
