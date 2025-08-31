const assert = require('assert')
const { describe, it, beforeEach } = require('node:test')
const cds = require('@sap/cds')
const { INSERT } = cds.ql || cds
const { calculateSLA } = require('../srv/utils/sla')

describe('calculateSLA', () => {
  beforeEach(async () => {
    await cds.connect.to('db')
    await cds.deploy('db/schema.cds')
  })

  it('skips weekends and holidays', async () => {
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

  it('starts from the next business day for afternoon tickets', async () => {
    const result = await calculateSLA(
      'APPROVAL',
      'STANDARD',
      '2025-09-05T13:00:00Z'
    )
    assert.strictEqual(result.toISOString(), '2025-09-10T00:00:00.000Z')
  })

  it('loads holidays when a transaction is provided', async () => {
    const db = cds.db
    await db.run(
      INSERT.into('BTP.CONFIG_PHDATA').entries([
        { HOLIDAY_DT: '2025-09-02' },
        { HOLIDAY_DT: '2025-09-04' }
      ])
    )
    const tx = db.transaction()
    const result = await calculateSLA(
      'APPROVAL',
      'STANDARD',
      '2025-09-01T01:45:00Z',
      tx
    )
    await tx.rollback()
    assert.strictEqual(result.toISOString(), '2025-09-08T00:00:00.000Z')
  })
})
