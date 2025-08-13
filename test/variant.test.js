const assert = require('assert')
const { describe, it } = require('node:test')
const { normalizeVariant } = require('../srv/utils/variant')

describe('normalizeVariant', () => {
  it('removes surrounding quotes from variant parameter', () => {
    assert.strictEqual(normalizeVariant("'MY_CASES'"), 'MY_CASES')
    assert.strictEqual(normalizeVariant('OPEN_CASES'), 'OPEN_CASES')
  })
})
