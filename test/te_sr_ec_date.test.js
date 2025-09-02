const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { calculateSLA } = require('../srv/utils/sla')

describe('TE_SR EC_DATE handling', () => {
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
        if (event === 'PATCH' && entity === 'TE_SR') srv._beforePatch = handler
      },
      on: () => {},
      after: () => {},
    }
    require('../srv/core-service')(srv)
  })

  it('sets EC_DATE on create when submitted', async () => {
    const req = { data: { DECISION: 'submit', TASK_TYPE: 'TE_REQUESTER' }, user: { id: 'tester' } }
    const tx = cds.transaction(req)
    await srv._beforeCreate(req)
    await tx.commit()
    const expected = await calculateSLA('TE', 'TE_RESO_TEAM', req.data.CREATED_DATETIME)
    assert.ok(req.data.EC_DATE)
    assert.strictEqual(req.data.EC_DATE, expected)
  })

  it('sets EC_DATE on patch when submitted', async () => {
    const { TE_SR } = srv.entities
    await cds.run(cds.ql.INSERT.into(TE_SR).entries({ REQ_TXN_ID: '123', language: 'EN' }))
    const req = { data: { REQ_TXN_ID: '123', DECISION: 'submit' } }
    const tx = cds.transaction(req)
    await srv._beforePatch(req)
    await tx.commit()
    const expected = await calculateSLA('TE', 'TE_RESO_TEAM', req.data.UPDATED_DATETIME)
    assert.ok(req.data.EC_DATE)
    assert.strictEqual(req.data.EC_DATE, expected)
  })
})
