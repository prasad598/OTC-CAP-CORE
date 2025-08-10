const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { INSERT, SELECT } = cds.ql

describe('TE_REPORT_VIEW includes DRAFT_ID', () => {
  before(async () => {
    cds.SELECT = cds.ql.SELECT
    await cds.deploy([
      __dirname + '/../db',
      __dirname + '/../srv'
    ]).to('sqlite::memory:')
  })

  it('exposes DRAFT_ID field', async () => {
    const { TE_SR } = cds.entities('BTP')
    const { TE_REPORT_VIEW } = cds.entities('ReportService')
    const id = '11111111-1111-1111-1111-222222222222'
    await INSERT.into(TE_SR).entries({
      REQ_TXN_ID: id,
      language: 'EN',
      DRAFT_ID: 'TE-DRFT-00001'
    })
    const result = await SELECT.one.from(TE_REPORT_VIEW).where({ REQ_TXN_ID: id })
    assert.ok(result)
    assert.strictEqual(result.DRAFT_ID, 'TE-DRFT-00001')
  })
})
