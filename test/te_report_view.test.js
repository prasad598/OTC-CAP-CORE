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
    const { TE_SR } = cds.entities('BTP')
    const { TE_REPORT_VIEW } = cds.entities('ReportService')
    const id = '11111111-1111-1111-1111-222222222222'
    await INSERT.into(TE_SR).entries({
      REQ_TXN_ID: id,
      language: 'EN',
      DRAFT_ID: 'TE-DRFT-00001',
      REQUEST_ID: 'REQ-0001',
      CASE_REQ_ID: 'REP-0001'
    })
    const result = await SELECT.one.from(TE_REPORT_VIEW).where({ REQ_TXN_ID: id })
    assert.ok(result)
    assert.strictEqual(result.DRAFT_ID, 'TE-DRFT-00001')
    assert.strictEqual(result.REQUEST_ID, 'REQ-0001')
    assert.strictEqual(result.REQ_REP_NO, 'REP-0001')
  })
})
