const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')

describe('TE_SR REQ_TXN_ID generation', () => {
  let srv
  before(async () => {
    cds.SELECT = cds.ql.SELECT
    await cds.deploy(__dirname + '/../db').to('sqlite::memory:')
    const db = cds.db
    const entities = cds.entities('BTP')
    srv = {
      entities,
      transaction: () => db,
      before: (event, entity, handler) => {
        if (event === 'CREATE' && entity === 'TE_SR') srv._beforeCreate = handler
      },
      on: () => {},
      after: () => {},
    }
    require('../srv/core-service')(srv)
  })

  it('assigns REQ_TXN_ID when missing', async () => {
    const req = { data: { DECISION: 'Draft' }, user: { id: 'tester' } }
    const tx = cds.transaction(req)
    await srv._beforeCreate(req)
    await tx.commit()
    assert.ok(req.data.REQ_TXN_ID)
  })
})
