const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { INSERT } = cds.ql

describe('TE_SR enrichment', () => {
  let srv
  before(async () => {
    cds.SELECT = cds.ql.SELECT
    await cds.deploy(__dirname + '/../db').to('sqlite::memory:')
    const db = cds.db
    const entities = cds.entities('BTP')
    srv = {
      entities,
      transaction: () => db,
      after: (event, entity, handler) => {
        if (event === 'READ' && entity === 'TE_SR') srv._afterRead = handler
      },
      before: () => {},
    }
    require('../srv/core-service')(srv)
  })

  it('enriches TE_SR with CORE_COMMENTS and CORE_ATTACHMENTS', async () => {
    const { TE_SR, CORE_COMMENTS, CORE_ATTACHMENTS } = srv.entities
    const id = '11111111-1111-1111-1111-111111111111'

    await INSERT.into(TE_SR).entries({ REQ_TXN_ID: id, language: 'EN' })
    await INSERT.into(CORE_COMMENTS).entries({
      REQ_TXN_ID: id,
      language: 'EN',
      COMMENTS: 'test comment',
      CREATED_BY: 'tester',
    })
    await INSERT.into(CORE_ATTACHMENTS).entries({
      REQ_TXN_ID: id,
      language: 'EN',
      FILE_NAME: 'file.txt',
      FILE_PATH: '/tmp/file.txt',
      MIME_TYPE: 'text/plain',
      PROJECT_TYPE: 'demo',
      CREATED_BY: 'tester',
    })

    const item = { REQ_TXN_ID: id }
    await srv._afterRead(item, {})

    assert.ok(Array.isArray(item.CORE_COMMENTS))
    assert.strictEqual(item.CORE_COMMENTS.length, 1)
    assert.strictEqual(item.CORE_COMMENTS[0].COMMENTS, 'test comment')

    assert.ok(Array.isArray(item.CORE_ATTACHMENTS))
    assert.strictEqual(item.CORE_ATTACHMENTS.length, 1)
    assert.strictEqual(item.CORE_ATTACHMENTS[0].FILE_NAME, 'file.txt')
  })
})

