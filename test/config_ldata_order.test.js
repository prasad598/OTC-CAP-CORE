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
  })

  it('orders results by SEQUENCE ascending by default', async () => {
    const { CONFIG_LDATA: CONFIG_LDATA_DB } = cds.entities('BTP')
    const { CONFIG_LDATA } = cds.entities('RestService')

    await INSERT.into(CONFIG_LDATA_DB).entries([
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
      }
    ])

    const results = await SELECT.from(CONFIG_LDATA)
    assert.strictEqual(results.length, 2)
    assert.deepStrictEqual(results.map(r => r.CODE), ['001', '002'])
  })
})
