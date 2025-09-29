const DEFAULT_TIME_ZONE = 'Asia/Singapore'

const TIMEZONE_ALIASES = {
  SGT: DEFAULT_TIME_ZONE,
  'ASIA/SINGAPORE': DEFAULT_TIME_ZONE,
  UTC: 'UTC',
  GMT: 'UTC',
}

const TIMESTAMP_FIELDS = [
  'CREATED_DATETIME',
  'UPDATED_DATETIME',
  'IS_CLAR_REQ_DATETIME',
  'ESCALATED_DATETIME',
  'RESOLVED_DATETIME',
  'CLOSED_DATETIME',
]

const intlOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
}

const pad = (value) => String(value).padStart(2, '0')

function normalizeTimeZone(input) {
  if (!input || typeof input !== 'string') {
    return DEFAULT_TIME_ZONE
  }

  const trimmed = input.trim()
  if (!trimmed) return DEFAULT_TIME_ZONE

  const alias = TIMEZONE_ALIASES[trimmed.toUpperCase()]
  const candidate = alias || trimmed

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date())
    return candidate
  } catch (err) {
    return DEFAULT_TIME_ZONE
  }
}

function toTimeZoneString(value, timeZone) {
  if (value == null) return value

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) return value

  const formatter = new Intl.DateTimeFormat('en-GB', {
    ...intlOptions,
    timeZone,
  })
  const parts = formatter.formatToParts(date)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  let year = Number(map.year)
  let month = Number(map.month)
  let day = Number(map.day)
  let hour = Number(map.hour)
  const minute = Number(map.minute)
  const second = Number(map.second)

  if (hour === 24) {
    hour = 0
    const adjusted = new Date(Date.UTC(year, month - 1, day))
    adjusted.setUTCDate(adjusted.getUTCDate() + 1)
    year = adjusted.getUTCFullYear()
    month = adjusted.getUTCMonth() + 1
    day = adjusted.getUTCDate()
  }

  const base = `${pad(year)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`
  const zonedUtcMillis = Date.UTC(year, month - 1, day, hour, minute, second)
  const diffMinutes = Math.round((zonedUtcMillis - date.getTime()) / 60000)
  const sign = diffMinutes >= 0 ? '+' : '-'
  const absMinutes = Math.abs(diffMinutes)
  const offset = `${sign}${pad(Math.trunc(absMinutes / 60))}:${pad(absMinutes % 60)}`
  return `${base}${offset}`
}

function applyTimeZone(record, fields, timeZone, skipNormalization = false) {
  if (!record || typeof record !== 'object') return record
  const zone = skipNormalization ? timeZone : normalizeTimeZone(timeZone)
  fields.forEach((field) => {
    if (field in record) {
      record[field] = toTimeZoneString(record[field], zone)
    }
  })
  return record
}

function applyTimeZoneToResults(results, fields, timeZone) {
  const zone = normalizeTimeZone(timeZone)
  if (Array.isArray(results)) {
    results.forEach((row) => applyTimeZone(row, fields, zone, true))
    return results
  }
  return applyTimeZone(results, fields, zone, true)
}

module.exports = {
  DEFAULT_TIME_ZONE,
  TIMESTAMP_FIELDS,
  normalizeTimeZone,
  toTimeZoneString,
  applyTimeZone,
  applyTimeZoneToResults,
}

