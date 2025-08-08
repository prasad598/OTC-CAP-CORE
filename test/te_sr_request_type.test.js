const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')

describe('TE_SR id generation based on decision', () => {
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
      on: (event, entity, handler) => {
        if (event === 'PATCH' && entity === 'TE_SR') srv._onPatch = handler
      },
      after: () => {},
    }
    require('../srv/core-service')(srv)
  })

  it('hard codes REQUEST_TYPE as TE and generates draft id', async () => {
    const req = {
      data: { DECISION: 'Draft', TASK_TYPE: 'TE_REQUESTER' },
      user: { id: 'tester' },
    }
    const tx = cds.transaction(req)
    await srv._beforeCreate(req)
    await tx.commit()
    assert.strictEqual(req.data.REQUEST_TYPE, 'TE')
    assert.ok(req.data.DRAFT_ID)
    assert.ok(req.data.DRAFT_ID.includes('TE-DRFT'))
  })

  it('generates request id when decision is SUB', async () => {
    const req = {
      data: { DECISION: 'submit', TASK_TYPE: 'TE_REQUESTER' },
      user: { id: 'tester' },
    }
    const tx = cds.transaction(req)
    await srv._beforeCreate(req)
    await tx.commit()
    assert.strictEqual(req.data.REQUEST_TYPE, 'TE')
    assert.ok(req.data.REQUEST_ID)
    assert.ok(!req.data.REQUEST_ID.includes('DRFT'))
    assert.ok(!req.data.DRAFT_ID)
  })
})
