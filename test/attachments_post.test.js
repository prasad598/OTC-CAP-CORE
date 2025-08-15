const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { INSERT } = cds.ql

describe('CORE_ATTACHMENTS create handler', () => {
  let srv
  before(async () => {
    cds.SELECT = cds.ql.SELECT
    await cds.deploy(__dirname + '/../db').to('sqlite::memory:')
    const db = cds.db
    const entities = cds.entities('BTP')
    srv = {
      entities,
      transaction: () => db,
      on: (event, entity, handler) => {
        if (event === 'CREATE' && entity === 'CORE_ATTACHMENTS')
          srv._createAttachment = handler
      },
      before: () => {},
      after: () => {},
    }
    require('../srv/core-service')(srv)
  })

  it('returns all attachments for REQ_TXN_ID', async () => {
    const { CORE_ATTACHMENTS } = srv.entities
    const id = '33333333-3333-3333-3333-333333333333'
    await INSERT.into(CORE_ATTACHMENTS).entries({
      REQ_TXN_ID: id,
      language: 'EN',
      FILE_NAME: 'a.txt',
      FILE_PATH: '/a.txt',
      MIME_TYPE: 'text/plain',
      PROJECT_TYPE: 'demo',
      CREATED_BY: 'tester'
    })
    const req = {
      data: {
        REQ_TXN_ID: id,
        language: 'EN',
        FILE_NAME: 'b.txt',
        FILE_PATH: '/b.txt',
        MIME_TYPE: 'text/plain',
        PROJECT_TYPE: 'demo',
        CREATED_BY: 'tester'
      }
    }
    const res = await srv._createAttachment(req, () =>
      INSERT.into(CORE_ATTACHMENTS).entries(req.data)
    )
    assert.strictEqual(res.length, 2)
    assert.ok(res.some((r) => r.FILE_NAME === 'a.txt'))
    assert.ok(res.some((r) => r.FILE_NAME === 'b.txt'))
  })
})
