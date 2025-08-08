const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { SELECT } = cds.ql

describe('TE_SR workflow process logging', () => {
  let srv
  const wfResponse = {
    id: 'd297522a-7416-11f0-9c99-eeee0a88d3d0',
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
      after: (event, entity, handler) => {
        if (event === 'CREATE' && entity === 'TE_SR') srv._afterCreate = handler
      },
      before: () => {},
      on: () => {},
    }
    require('../srv/core-service')(srv)
  })

  it('creates MON_WF_PROCESS entry when workflow triggered', async () => {
    const data = {
      REQUEST_ID: 'REQ123',
      REQ_TXN_ID: '00000000-0000-0000-0000-000000000123',
      CREATED_BY: 'creator@example.com',
    }
    const req = { user: { id: 'tester' }, warn: () => {} }
    await srv._afterCreate(data, req)
    const record = await SELECT.one.from('BTP.MON_WF_PROCESS')
    assert.strictEqual(record.WF_INSTANCE_ID, wfResponse.id)
    assert.strictEqual(record.WF_STATUS, wfResponse.status)
    assert.strictEqual(record.REQUEST_ID, 'REQ123')
    assert.strictEqual(record.REQ_TXN_ID, '00000000-0000-0000-0000-000000000123')
    assert.strictEqual(record.CREATED_BY, 'tester')
  })
})
