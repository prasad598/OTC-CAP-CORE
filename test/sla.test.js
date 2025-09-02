const assert = require('assert')
const { describe, it, beforeEach } = require('node:test')
const cds = require('@sap/cds')
const { calculateSLA } = require('../srv/utils/sla')

function createTx(dates = []) {
  return {
    model: { definitions: {} },
    run: async () => dates.map((d) => ({ HOLIDAY_DT: d }))
  }
}

describe('calculateSLA', () => {
  let tx
  beforeEach(() => {
    tx = createTx()
    cds.db = tx
  })

  it('skips weekends and holidays', async () => {
    tx.run = async () => [
      { HOLIDAY_DT: '2025-09-02' },
      { HOLIDAY_DT: '2025-09-04' }
    ]
    const result = await calculateSLA(
      'APPROVAL',
      'STANDARD',
      '2025-09-01T01:45:00Z'
    )
    assert.strictEqual(result.toISOString(), '2025-09-07T16:00:00.000Z')
  })

  it('starts from the second business day for afternoon tickets', async () => {
    tx.run = async () => []
    const result = await calculateSLA(
      'APPROVAL',
      'STANDARD',
      '2025-09-05T13:00:00Z'
    )
    assert.strictEqual(result.toISOString(), '2025-09-10T16:00:00.000Z')
  })

  it('loads holidays when a transaction is provided', async () => {
    const customTx = createTx(['2025-09-02', '2025-09-04'])
    const result = await calculateSLA(
      'APPROVAL',
      'STANDARD',
      '2025-09-01T01:45:00Z',
      customTx
    )
    assert.strictEqual(result.toISOString(), '2025-09-07T16:00:00.000Z')
  })

  it('handles afternoon tickets when the next day is a holiday', async () => {
    tx.run = async () => [{ HOLIDAY_DT: '2025-09-02' }]
    const result = await calculateSLA(
      'APPROVAL',
      'STANDARD',
      '2025-09-01T13:00:00Z'
    )
    assert.strictEqual(result.toISOString(), '2025-09-07T16:00:00.000Z')
  })

  it('handles afternoon tickets when the second day is a holiday', async () => {
    tx.run = async () => [{ HOLIDAY_DT: '2025-09-04' }]
    const result = await calculateSLA(
      'APPROVAL',
      'STANDARD',
      '2025-09-02T13:00:00Z'
    )
    assert.strictEqual(result.toISOString(), '2025-09-08T16:00:00.000Z')
  })
})
