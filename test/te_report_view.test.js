const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { INSERT, SELECT } = cds.ql

describe('TE_REPORT_VIEW exposes core fields', () => {
  before(async () => {
    cds.SELECT = cds.ql.SELECT
    await cds.deploy([
      __dirname + '/../db',
      __dirname + '/../srv'
    ]).to('sqlite::memory:')
  })

  it('returns DRAFT_ID, REQUEST_ID, and REQ_REP_NO', async () => {
    const { TE_SR, CONFIG_LDATA, CORE_USERS } = cds.entities('BTP')
    const { TE_REPORT_VIEW } = cds.entities('ReportService')
    const id = '11111111-1111-1111-1111-222222222222'

    await INSERT.into(CORE_USERS).entries({
      USER_EMAIL: 'u1@example.com',
      language: 'EN',
      USER_ID: '100',
      USER_FNAME: 'Test',
      USER_LNAME: 'User',
      IS_ACTIVE: 'Y',
      CREATED_BY: 'tester',
      UPDATED_BY: 'tester'
    })

    await INSERT.into(CONFIG_LDATA).entries({
      REQUEST_TYPE: 'RT',
      OBJECT: 'SRV_CAT',
      CODE: 'CAT1',
      language: 'EN',
      DESC: 'Category One',
      CREATED_BY: 'tester',
      UPDATED_BY: 'tester'
    })

    await INSERT.into(TE_SR).entries({
      REQ_TXN_ID: id,
      language: 'EN',
      DRAFT_ID: 'TE-DRFT-00001',
      REQUEST_ID: 'REQ-0001',
      CASE_REQ_ID: 'REP-0001',
      SRV_CAT_CD: 'CAT1',
      CREATED_BY: 'u1@example.com',
      IS_CLAR_REQ: 'Y',
      IS_CLAR_REQ_DATETIME: '2024-01-02T00:00:00Z',
      IS_ESCALATED: 'Y',
      ESCALATED_DATETIME: '2024-01-03T00:00:00Z',
      IS_RESOLVED: 'N',
      RESOLVED_DATETIME: '2024-01-04T00:00:00Z'
    })

    const result = await SELECT.one.from(TE_REPORT_VIEW).where({ REQ_TXN_ID: id })
    assert.ok(result)
    assert.strictEqual(result.IS_CLAR_REQ, 'Y')
    assert.strictEqual(new Date(result.IS_CLAR_REQ_DATETIME).toISOString(), '2024-01-02T00:00:00.000Z')
    assert.strictEqual(result.IS_ESCALATED, 'Y')
    assert.strictEqual(new Date(result.ESCALATED_DATETIME).toISOString(), '2024-01-03T00:00:00.000Z')
    assert.strictEqual(result.IS_RESOLVED, 'N')
    assert.strictEqual(new Date(result.RESOLVED_DATETIME).toISOString(), '2024-01-04T00:00:00.000Z')
    assert.strictEqual(result.DRAFT_ID, 'TE-DRFT-00001')
    assert.strictEqual(result.REQUEST_ID, 'REQ-0001')
    assert.strictEqual(result.REQ_REP_NO, 'REP-0001')
    assert.strictEqual(result.SRV_CAT_CD, 'CAT1')
    assert.strictEqual(result.SRV_CAT, 'Category One')
    assert.strictEqual(result.CREATED_BY, 'u1@example.com')
    assert.strictEqual(result.CREATED_BY_EMPID, '100')
  })
})
