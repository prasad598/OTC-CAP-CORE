const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { INSERT, SELECT } = cds.ql

describe('OTC_REPORT_VIEW default ordering', () => {
  before(async () => {
    cds.SELECT = cds.ql.SELECT
    await cds.deploy([
      __dirname + '/../db',
      __dirname + '/../srv'
    ]).to('sqlite::memory:')
  })

  it('orders results by UPDATED_DATETIME descending by default', async () => {
    const { OTC_SR, CONFIG_LDATA, CORE_USERS } = cds.entities('BTP')
    const { OTC_REPORT_VIEW } = cds.entities('ReportService')

    await INSERT.into(CORE_USERS).entries({
      USER_EMAIL: 'user@example.com',
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
      SEQUENCE: '1',
      CREATED_BY: 'tester',
      UPDATED_BY: 'tester'
    })

    const id1 = '11111111-1111-1111-1111-222222222223'
    const id2 = '11111111-1111-1111-1111-222222222224'

    await INSERT.into(OTC_SR).entries([
      {
        REQ_TXN_ID: id1,
        language: 'EN',
        DRAFT_ID: 'TE-DRFT-00001',
        REQUEST_ID: 'REQ-0001',
        CASE_REQ_ID: 'REP-0001',
        SRV_CAT_CD: 'CAT1',
        CREATED_BY: 'user@example.com',
        UPDATED_DATETIME: new Date('2024-01-01T00:00:00Z')
      },
      {
        REQ_TXN_ID: id2,
        language: 'EN',
        DRAFT_ID: 'TE-DRFT-00002',
        REQUEST_ID: 'REQ-0002',
        CASE_REQ_ID: 'REP-0002',
        SRV_CAT_CD: 'CAT1',
        CREATED_BY: 'user@example.com',
        UPDATED_DATETIME: new Date('2024-02-01T00:00:00Z')
      }
    ])

    const results = await SELECT.from(OTC_REPORT_VIEW)
    assert.strictEqual(results.length, 2)
    assert.strictEqual(results[0].REQ_TXN_ID, id2)
    assert.strictEqual(results[1].REQ_TXN_ID, id1)
  })
})
