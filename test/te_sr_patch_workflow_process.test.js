const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { INSERT, UPDATE, SELECT } = cds.ql

describe('TE_SR PATCH workflow trigger', () => {
  let srv
  let httpCallCount
  let lastRequestData
  const wfResponse = {
    subject: 'Test Workflow',
    status: 'RUNNING',
  }

  before(async () => {
    cds.SELECT = cds.ql.SELECT
    httpCallCount = 0
    require.cache[require.resolve('@sap-cloud-sdk/http-client')] = {
      exports: {
        executeHttpRequest: async (_, { data }) => {
          httpCallCount++
          lastRequestData = data
          return { data: { ...wfResponse, id: `wf-${httpCallCount}` } }
        },
      },
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

  it('triggers workflow when REQUEST_ID missing', async () => {
    const { TE_SR, MON_WF_PROCESS } = srv.entities
    await INSERT.into(TE_SR).entries({
      REQ_TXN_ID: '123',
      language: 'EN',
      CREATED_BY: 'creator@example.com',
      REQUESTER_ID: 'requester@example.com',
      SRV_CAT_CD: 'REQEXM',
    })

    const req = { data: { REQ_TXN_ID: '123', DECISION: 'SUB' }, user: { id: 'tester' }, warn: () => {} }

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

  it('triggers workflow even when REQUEST_ID provided and DECISION is APR', async () => {
    const { TE_SR, MON_WF_PROCESS } = srv.entities
    await INSERT.into(TE_SR).entries({
      REQ_TXN_ID: '124',
      language: 'EN',
      CREATED_BY: 'creator@example.com',
      REQUESTER_ID: 'requester@example.com',
      SRV_CAT_CD: 'REQEXM',
    })

    const req = {
      data: { REQ_TXN_ID: '124', DECISION: 'APR', REQUEST_ID: 'CASE-001' },
      user: { id: 'tester' },
      warn: () => {},
    }

    const tx = cds.transaction(req)
    await srv._beforePatch(req)
    await tx.run(UPDATE(TE_SR).set(req.data).where({ REQ_TXN_ID: '124' }))
    await tx.commit()

    const prevCalls = httpCallCount
    await srv._afterPatch(null, req)

    assert.strictEqual(httpCallCount, prevCalls + 1)
  })

  it('triggers workflow when REQ_TXN_ID supplied via params only', async () => {
    const { TE_SR, MON_WF_PROCESS } = srv.entities
    await INSERT.into(TE_SR).entries({
      REQ_TXN_ID: '125',
      language: 'EN',
      CREATED_BY: 'creator@example.com',
      REQUESTER_ID: 'requester@example.com',
      SRV_CAT_CD: 'REQEXM',
    })

    const req = {
      data: { DECISION: 'SUB' },
      params: [{ REQ_TXN_ID: '125' }],
      user: { id: 'tester' },
      warn: () => {},
    }

    const tx = cds.transaction(req)
    await srv._beforePatch(req)
    await tx.run(UPDATE(TE_SR).set(req.data).where({ REQ_TXN_ID: '125' }))
    await tx.commit()
    await srv._afterPatch(null, req)

    const record = await SELECT.one.from(MON_WF_PROCESS).where({ REQ_TXN_ID: '125' })
    assert.ok(record)
  })

  it('includes DueCompletion derived from EC_DATE', async () => {
    const { TE_SR } = srv.entities
    await INSERT.into(TE_SR).entries({
      REQ_TXN_ID: '126',
      language: 'EN',
      CREATED_BY: 'creator@example.com',
      REQUESTER_ID: 'requester@example.com',
      SRV_CAT_CD: 'REQEXM',
    })

    const req = {
      data: { REQ_TXN_ID: '126', DECISION: 'APR', EC_DATE: '2024-01-15' },
      user: { id: 'tester' },
      warn: () => {},
    }

    const tx = cds.transaction(req)
    await srv._beforePatch(req)
    await tx.run(UPDATE(TE_SR).set(req.data).where({ REQ_TXN_ID: '126' }))
    await tx.commit()
    await srv._afterPatch(null, req)

    assert.strictEqual(
      lastRequestData.context.caseDetails.DueCompletion,
      new Date('2024-01-15T23:59:59.999+08:00').toISOString()
    )
  })
})

