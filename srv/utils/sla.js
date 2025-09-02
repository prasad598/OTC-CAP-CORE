const cds = require('@sap/cds')
const { SELECT } = cds.ql || cds

/**
 * Load public holidays from CONFIG_PHDATA.
 * @param {import('@sap/cds').Transaction} [tx]
 * @returns {Promise<Set<string>>} Set of ISO date strings (yyyy-mm-dd)
 */
async function loadPublicHolidays(tx) {
  const db = tx || cds.db
  if (!db) return new Set()

  try {
    const entity =
      // Prefer entity resolution from service or transaction context
      db.entities?.CONFIG_PHDATA ||
      db.entities?.['BTP.CONFIG_PHDATA'] ||
      db.model?.definitions?.CONFIG_PHDATA ||
      db.model?.definitions?.['BTP.CONFIG_PHDATA'] ||
      'CONFIG_PHDATA'
    const rows = await db.run(SELECT.from(entity).columns('HOLIDAY_DT'))
    return new Set(
      rows
        .map((r) => {
          const dt = r.HOLIDAY_DT || r.holidayDt
          if (!dt) return null
          const d = dt instanceof Date ? dt : new Date(dt)
          return isNaN(d) ? null : d.toISOString().slice(0, 10)
        })
        .filter(Boolean)
    )
  } catch (err) {
    console.error('Failed to load public holidays', err)
    return new Set()
  }
}

/**
 * Calculate estimated completion date based on 3 working-day SLA.
 * @param {string} taskType
 * @param {string} projectType
 * @param {string|Date} createdAt - ticket creation timestamp
 * @param {import('@sap/cds').Transaction} [tx]
 * @returns {Promise<Date>} estimated completion date
 */
async function calculateSLA(taskType, projectType, createdAt, tx) {
  const holidays = await loadPublicHolidays(tx)

  const created = new Date(createdAt)
  if (isNaN(created)) throw new Error('Invalid creation date')

  // All SLA calculations are based on Singapore time (SGT, UTC+8)
  const SGT_OFFSET_MS = 8 * 60 * 60 * 1000
  const sgtDate = new Date(created.getTime() + SGT_OFFSET_MS)

  const isBusinessDay = (date) => {
    const day = date.getUTCDay()
    const key = date.toISOString().slice(0, 10)
    return day !== 0 && day !== 6 && !holidays.has(key)
  }

  const moveToNextBusinessDay = (date) => {
    do {
      date.setUTCDate(date.getUTCDate() + 1)
    } while (!isBusinessDay(date))
  }

  const start = new Date(sgtDate)
  const createdMinutes =
    sgtDate.getUTCHours() * 60 + sgtDate.getUTCMinutes()
  start.setUTCHours(0, 0, 0, 0)
  moveToNextBusinessDay(start)
  if (createdMinutes >= 12 * 60) moveToNextBusinessDay(start)

  const slaDays = 3
  let count = 1 // start already represents the first business day
  while (count < slaDays) {
    start.setUTCDate(start.getUTCDate() + 1)
    if (isBusinessDay(start)) count++
  }

  // Return date in YYYY-MM-DD format (SGT)
  return start.toISOString().slice(0, 10)
}

module.exports = { calculateSLA }
