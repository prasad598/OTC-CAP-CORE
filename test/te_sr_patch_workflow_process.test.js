const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { INSERT, UPDATE, SELECT } = cds.ql

describe('TE_SR PATCH workflow trigger', () => {
  let srv
  const wfResponse = {
    id: 'c1111111-2222-3333-4444-555555555555',
    subject: 'Test Workflow',
    status: 'RUNNING',
  }

  before(async () => {
    cds.SELECT = cds.ql.SELECT
    require.cache[require.resolve('@sap-cloud-sdk/http-client')] = {
      exports: { executeHttpRequest: async () => ({ data: wfResponse }) },
    }
    await cds.deploy(__dirname + '/../db').to('sqlite::memory:')
    const db = cds.db
    const entities = cds.entities('BTP')
    srv = {
      entities,
      transaction: () => db,
      before: (event, entity, handler) => {
        if (event === 'PATCH' && entity === 'TE_SR') srv._beforePatch = handler
      },
      after: (event, entity, handler) => {
        if (event === 'PATCH' && entity === 'TE_SR') srv._afterPatch = handler
      },
      on: () => {},
    }
    require('../srv/core-service')(srv)
  })

  it('triggers workflow when REQUEST_ID missing and REQ_TXN_ID is 123', async () => {
    const { TE_SR, MON_WF_PROCESS } = srv.entities
    await INSERT.into(TE_SR).entries({
      REQ_TXN_ID: '123',
      language: 'EN',
      CREATED_BY: 'creator@example.com',
      REQUESTER_ID: 'requester@example.com',
      SRV_CAT_CD: 'REQEXM',
    })

    const req = { data: { REQ_TXN_ID: '123', DECISION: 'submit' }, user: { id: 'tester' }, warn: () => {} }

    const tx = cds.transaction(req)
    await srv._beforePatch(req)
    await tx.run(UPDATE(TE_SR).set(req.data).where({ REQ_TXN_ID: '123' }))
    await tx.commit()
    await srv._afterPatch(null, req)

    const record = await SELECT.one.from(MON_WF_PROCESS).where({ REQ_TXN_ID: '123' })
    assert.ok(record)
    assert.strictEqual(record.REQ_TXN_ID, '123')
    assert.ok(record.REQUEST_ID)
  })

  it('skips workflow when REQ_TXN_ID is not 123', async () => {
    const { TE_SR, MON_WF_PROCESS } = srv.entities
    await INSERT.into(TE_SR).entries({
      REQ_TXN_ID: '124',
      language: 'EN',
      CREATED_BY: 'creator@example.com',
      REQUESTER_ID: 'requester@example.com',
      SRV_CAT_CD: 'REQEXM',
    })

    const req = { data: { REQ_TXN_ID: '124', DECISION: 'SUB' }, user: { id: 'tester' }, warn: () => {} }

    const tx = cds.transaction(req)
    await srv._beforePatch(req)
    await tx.run(UPDATE(TE_SR).set(req.data).where({ REQ_TXN_ID: '124' }))
    await tx.commit()
    await srv._afterPatch(null, req)

    const record = await SELECT.one.from(MON_WF_PROCESS).where({ REQ_TXN_ID: '124' })
    assert.ok(!record)
  })
})

