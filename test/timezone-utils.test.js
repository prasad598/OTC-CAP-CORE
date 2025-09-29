const assert = require('assert')
const { describe, it } = require('node:test')

const {
  DEFAULT_TIME_ZONE,
  TIMESTAMP_FIELDS,
  normalizeTimeZone,
  applyTimeZoneToResults,
} = require('../srv/utils/timezone')

describe('timezone utilities', () => {
  it('normalizes known aliases and defaults when necessary', () => {
    assert.strictEqual(normalizeTimeZone('SGT'), DEFAULT_TIME_ZONE)
    assert.strictEqual(normalizeTimeZone('Asia/Singapore'), DEFAULT_TIME_ZONE)
    assert.strictEqual(normalizeTimeZone('Invalid/Zone'), DEFAULT_TIME_ZONE)
  })

  it('converts timestamp fields to requested timezone', () => {
    const rows = [
      {
        CREATED_DATETIME: '2024-01-01T00:00:00Z',
        UPDATED_DATETIME: '2024-01-02T00:00:00Z',
      },
    ]
    applyTimeZoneToResults(rows, TIMESTAMP_FIELDS, 'UTC')
    assert.strictEqual(rows[0].CREATED_DATETIME, '2024-01-01T00:00:00+00:00')
    assert.strictEqual(rows[0].UPDATED_DATETIME, '2024-01-02T00:00:00+00:00')
  })

  it('applies default timezone when none provided', () => {
    const record = { CREATED_DATETIME: '2024-01-01T00:00:00Z' }
    applyTimeZoneToResults(record, TIMESTAMP_FIELDS)
    assert.match(record.CREATED_DATETIME, /\+08:00$/)
  })

  it('does not convert EC_DATE values', () => {
    const record = { EC_DATE: '2024-01-01' }
    applyTimeZoneToResults(record, TIMESTAMP_FIELDS, 'UTC')
    assert.strictEqual(record.EC_DATE, '2024-01-01')
  })
})

