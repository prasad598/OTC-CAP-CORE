const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')

describe('TE_SR draft id generation', () => {
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
      after: () => {},
    }
    require('../srv/core-service')(srv)
  })

  it('hard codes REQUEST_TYPE as TE and generates draft id', async () => {
    const req = { data: {}, user: { id: 'tester' } }
    await srv._beforeCreate(req)
    assert.strictEqual(req.data.REQUEST_TYPE, 'TE')
    assert.ok(req.data.DRAFT_ID)
    assert.ok(req.data.DRAFT_ID.includes('TE-DRFT'))
  })
})
