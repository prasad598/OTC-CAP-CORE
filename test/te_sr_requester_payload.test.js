const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before, beforeEach } = require('node:test')
const { INSERT, SELECT } = cds.ql

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
    await cds.deploy([
      __dirname + '/../db',
      __dirname + '/../srv',
    ]).to('sqlite::memory:')
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
    assert.strictEqual(req.data.CREATED_BY_EMPID, 'EMP1001')
    assert.strictEqual(req.data.CREATED_BY_NAME, 'Payload User')

    const record = await SELECT.one
      .from('BTP.CORE_USERS')
      .where({ USER_EMAIL: 'payload.user@example.com', language: 'EN' })

    assert.ok(record)
    assert.strictEqual(record.USER_ID, 'EMP1001')
    assert.strictEqual(record.USER_FNAME, 'Payload')
    assert.strictEqual(record.USER_LNAME, 'User')
  })

  it('honors explicit requester names and entity when provided', async () => {
    const req = {
      data: {
        DECISION: 'draft',
        SRV_CAT_CD: 'REQEXM',
        CREATED_BY: 'explicit.user@example.com',
        CREATED_BY_EMPID: 'EMP2002',
        CREATED_BY_FNAME: 'Explicit',
        CREATED_BY_LNAME: 'User',
        CREATED_BY_ENTITY: 'ENTITY01',
      },
      user: { id: 'tester' },
      warn: (msg) => {
        throw new Error(`Unexpected warning: ${msg}`)
      },
    }

    const tx = cds.transaction(req)
    await srv._beforeCreate(req)
    await tx.commit()

    assert.strictEqual(req.data.CREATED_BY, 'explicit.user@example.com')
    assert.strictEqual(req.data.CREATED_BY_EMPID, 'EMP2002')
    assert.strictEqual(req.data.CREATED_BY_FNAME, 'Explicit')
    assert.strictEqual(req.data.CREATED_BY_LNAME, 'User')
    assert.strictEqual(req.data.CREATED_BY_ENTITY, 'ENTITY01')

    const record = await SELECT.one
      .from('BTP.CORE_USERS')
      .where({ USER_EMAIL: 'explicit.user@example.com', language: 'EN' })

    assert.ok(record)
    assert.strictEqual(record.USER_ID, 'EMP2002')
    assert.strictEqual(record.USER_FNAME, 'Explicit')
    assert.strictEqual(record.USER_LNAME, 'User')
    assert.strictEqual(record.ENTITY, 'ENTITY01')
  })

  it('ignores SCIM user identifier when payload contains requester fields', async () => {
    const req = {
      data: {
        DECISION: 'draft',
        SRV_CAT_CD: 'REQEXM',
        logged_user_email: 'payload.user@example.com',
        logged_user_id: 'EMP1001',
        logged_user_name: 'Payload User',
        'user-scim-id': 'some-user-id',
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
    assert.strictEqual(req.data.CREATED_BY_EMPID, 'EMP1001')
    assert.strictEqual(req.data.CREATED_BY_NAME, 'Payload User')
  })

  it('binds logged user fields to TE_REPORT_VIEW audit columns', async () => {
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

    const persisted = {
      ...req.data,
    }
    delete persisted.logged_user_email
    delete persisted.logged_user_id
    delete persisted.logged_user_name
    delete persisted.DECISION

    await tx.run(
      INSERT.into('BTP.TE_SR').entries(persisted)
    )
    await tx.commit()

    const { TE_REPORT_VIEW } = cds.entities('ReportService')
    const result = await SELECT.one
      .from(TE_REPORT_VIEW)
      .where({ CREATED_BY: 'payload.user@example.com' })

    assert.ok(result)
    assert.strictEqual(result.CREATED_BY, 'payload.user@example.com')
    assert.strictEqual(result.CREATED_BY_EMPID, 'EMP1001')
    assert.strictEqual(result.CREATED_BY_NAME, 'Payload User')

    const persistedRecord = await SELECT.one
      .from('BTP.TE_SR')
      .where({ REQ_TXN_ID: req.data.REQ_TXN_ID })

    assert.ok(persistedRecord)
    assert.strictEqual(persistedRecord.CREATED_BY_EMPID, 'EMP1001')
    assert.strictEqual(persistedRecord.CREATED_BY_NAME, 'Payload User')
  })
})
