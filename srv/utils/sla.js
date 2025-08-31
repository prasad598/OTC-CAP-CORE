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
    // use string path to avoid model lookups failing for service-bound transactions
    const rows = await db.run(
      SELECT.from('BTP.CONFIG_PHDATA').columns('HOLIDAY_DT')
    )
    return new Set(
      rows
        .map((r) => {
          const dt = r.HOLIDAY_DT
          if (!dt) return null
          const d = dt instanceof Date ? dt : new Date(dt)
          return isNaN(d) ? null : d.toISOString().slice(0, 10)
        })
        .filter(Boolean)
    )
  } catch {
    // ignore lookup errors
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
  const isBusinessDay = (date) => {
    const day = date.getDay()
    const key = date.toISOString().slice(0, 10)
    return day !== 0 && day !== 6 && !holidays.has(key)
  }

  const start = new Date(created)
  const offset = created.getHours() >= 12 ? 2 : 1
  start.setDate(start.getDate() + offset)
  start.setHours(0, 0, 0, 0)

  while (!isBusinessDay(start)) {
    start.setDate(start.getDate() + 1)
  }

  const slaDays = 3
  let count = 1 // start already represents the first business day
  while (count < slaDays) {
    start.setDate(start.getDate() + 1)
    if (isBusinessDay(start)) count++
  }
  return start
}

module.exports = { calculateSLA }
