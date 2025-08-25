const cds = require('@sap/cds')
const { DELETE } = cds.ql

module.exports = async function () {
  const db = await cds.connect.to('db')
  const {
    CORE_ATTACHMENTS,
    CORE_COMMENTS,
    CORE_USERS,
    AUTH_MATRIX,
    CONFIG_LDATA,
    MON_WF_PROCESS,
    MON_WF_TASK,
    TE_SR,
  } = db.entities

  this.on('purgeAllData', async (req) => {
    const tx = cds.tx(req)
    await Promise.all([
      tx.run(DELETE.from(CORE_ATTACHMENTS)),
      tx.run(DELETE.from(CORE_COMMENTS)),
      tx.run(DELETE.from(CORE_USERS)),
      tx.run(DELETE.from(AUTH_MATRIX)),
      tx.run(DELETE.from(CONFIG_LDATA)),
      tx.run(DELETE.from(MON_WF_PROCESS)),
      tx.run(DELETE.from(MON_WF_TASK)),
      tx.run(DELETE.from(TE_SR)),
    ])
    return { status: 'OK' }
  })
}
