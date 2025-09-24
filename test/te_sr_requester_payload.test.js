const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before, beforeEach } = require('node:test')
const { SELECT } = cds.ql

describe('TE_SR requester payload handling', () => {
  let srv
  let scimCallCount

  before(async () => {
    cds.SELECT = cds.ql.SELECT
    scimCallCount = 0
    require.cache[require.resolve('@sap-cloud-sdk/http-client')] = {
      exports: {
        executeHttpRequest: async () => {
          scimCallCount++
          return { data: {} }
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
        if (event === 'CREATE' && entity === 'TE_SR') srv._beforeCreate = handler
      },
      after: () => {},
      on: () => {},
    }
    require('../srv/core-service')(srv)
  })

  beforeEach(() => {
    scimCallCount = 0
  })

  it('populates requester data from payload without invoking SCIM', async () => {
    const req = {
      data: {
        DECISION: 'draft',
        SRV_CAT_CD: 'REQEXM',
        logged_user_email: 'payload.user@example.com',
        logged_user_id: 'EMP1001',
        logged_user_name: 'Payload User',
      },
      user: { id: 'tester' },
      warn: (msg) => {
        throw new Error(`Unexpected warning: ${msg}`)
      },
    }

    const tx = cds.transaction(req)
    await srv._beforeCreate(req)
    await tx.commit()

    assert.strictEqual(scimCallCount, 0)
    assert.strictEqual(req.data.CREATED_BY, 'payload.user@example.com')
    assert.strictEqual(req.data.REQUESTER_ID, 'payload.user@example.com')
    assert.strictEqual(req.data.REQ_FOR_EMAIL, 'payload.user@example.com')
    assert.strictEqual(req.data.REQ_FOR_NAME, 'Payload User')

    const record = await SELECT.one
      .from('BTP.CORE_USERS')
      .where({ USER_EMAIL: 'payload.user@example.com', language: 'EN' })

    assert.ok(record)
    assert.strictEqual(record.USER_ID, 'EMP1001')
    assert.strictEqual(record.USER_FNAME, 'Payload')
    assert.strictEqual(record.USER_LNAME, 'User')
  })
})
