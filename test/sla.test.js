const assert = require('assert')
const { describe, it } = require('node:test')
const cds = require('@sap/cds')
const { INSERT } = cds.ql || cds
const { calculateSLA } = require('../srv/utils/sla')

describe('calculateSLA', () => {
  it('skips weekends and holidays', async () => {
    await cds.connect.to('db')
    await cds.deploy('db/schema.cds')
    const db = cds.db
    await db.run(
      INSERT.into('BTP.CONFIG_PHDATA').entries([
        { HOLIDAY_DT: '2025-09-02' },
        { HOLIDAY_DT: '2025-09-04' }
      ])
    )
    const result = await calculateSLA(
      'APPROVAL',
      'STANDARD',
      '2025-09-01T01:45:00Z'
    )
    assert.strictEqual(result.toISOString(), '2025-09-08T00:00:00.000Z')
  })
})
