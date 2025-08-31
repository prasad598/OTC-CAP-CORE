const cds = require('@sap/cds')
const { SELECT } = cds.ql || cds

/**
 * Calculate estimated completion date based on 3 working-day SLA.
 * @param {string} taskType
 * @param {string} projectType
 * @param {string|Date} createdAt - ticket creation timestamp
 * @param {import('@sap/cds').Transaction} [tx]
 * @returns {Promise<Date>} estimated completion date
 */
async function calculateSLA(taskType, projectType, createdAt, tx) {
  const db = tx || cds.db
  const entities = cds.entities('BTP') || {}
  const { CONFIG_PHDATA } = entities
  let holidays = new Set()
  if (CONFIG_PHDATA && db) {
    try {
      const rows = await db.run(SELECT.from(CONFIG_PHDATA).columns('HOLIDAY_DT'))
      holidays = new Set(
        rows
          .map((r) => {
            const dt = r.HOLIDAY_DT
            if (!dt) return null
            const d = dt instanceof Date ? dt : new Date(dt)
            return isNaN(d) ? null : d.toISOString().slice(0, 10)
          })
          .filter(Boolean)
      )
    } catch (err) {
      // ignore if table is not available
    }
  }

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
