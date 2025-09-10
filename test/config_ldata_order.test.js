const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { INSERT, SELECT } = cds.ql

describe('CONFIG_LDATA default ordering', () => {
  before(async () => {
    cds.SELECT = cds.ql.SELECT
    await cds.deploy([
      __dirname + '/../db',
      __dirname + '/../srv'
    ]).to('sqlite::memory:')
    await cds.serve('RestService').from(__dirname + '/../srv/core-service.cds')
  })

  it('orders results by SEQUENCE ascending by default', async () => {
    const { CONFIG_LDATA: CONFIG_LDATA_DB } = cds.entities('BTP')
    const srv = await cds.connect.to('RestService')
    const { CONFIG_LDATA } = srv.entities

    await INSERT.into(CONFIG_LDATA_DB).entries([
      {
        REQUEST_TYPE: 'RT',
        OBJECT: 'OBJ',
        CODE: '010',
        DESC: 'ten',
        SEQUENCE: 10,
        CREATED_BY: 'tester',
        UPDATED_BY: 'tester'
      },
      {
        REQUEST_TYPE: 'RT',
        OBJECT: 'OBJ',
        CODE: '002',
        DESC: 'two',
        SEQUENCE: 2,
        CREATED_BY: 'tester',
        UPDATED_BY: 'tester'
      },
      {
        REQUEST_TYPE: 'RT',
        OBJECT: 'OBJ',
        CODE: '001',
        DESC: 'one',
        SEQUENCE: 1,
        CREATED_BY: 'tester',
        UPDATED_BY: 'tester'
      },
      {
        REQUEST_TYPE: 'RT',
        OBJECT: 'OTHER',
        CODE: '999',
        DESC: 'other',
        SEQUENCE: 5,
        CREATED_BY: 'tester',
        UPDATED_BY: 'tester'
      }
    ])

    const results = await srv.run(SELECT.from(CONFIG_LDATA).where({ OBJECT: 'OBJ' }))
    assert.strictEqual(results.length, 3)
    assert.deepStrictEqual(results.map(r => r.CODE), ['001', '002', '010'])
  })
})
