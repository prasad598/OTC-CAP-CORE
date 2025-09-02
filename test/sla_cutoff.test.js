const assert = require('assert')
const { describe, it } = require('node:test')
const { calculateSLA } = require('../srv/utils/sla')

describe('calculateSLA cutoff at noon SGT', () => {
  it('starts counting from next business day before 12pm SGT', async () => {
    const est = await calculateSLA('TYPE', 'PROJ', '2024-09-02T03:59:00Z')
    assert.strictEqual(est, '2024-09-05')
  })

  it('skips an extra day after 12pm SGT', async () => {
    const est = await calculateSLA('TYPE', 'PROJ', '2024-09-02T04:00:00Z')
    assert.strictEqual(est, '2024-09-06')
  })
})
