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
  const { CONFIG_PHDATA } = cds.entities('BTP')
  const rows = await db.run(SELECT.from(CONFIG_PHDATA).columns('HOLIDAY_DT'))
  const holidays = new Set(
    rows.map((r) => r.HOLIDAY_DT && r.HOLIDAY_DT.toISOString().slice(0, 10))
  )

  const created = new Date(createdAt)
  if (isNaN(created)) throw new Error('Invalid creation date')

  const start = new Date(created)
  if (created.getHours() >= 12) {
    start.setDate(start.getDate() + 2)
  } else {
    start.setDate(start.getDate() + 1)
  }
  start.setHours(0, 0, 0, 0)

  const slaDays = 3
  let count = 0
  while (true) {
    const day = start.getDay()
    const key = start.toISOString().slice(0, 10)
    if (day !== 0 && day !== 6 && !holidays.has(key)) {
      count++
      if (count === slaDays) break
    }
    start.setDate(start.getDate() + 1)
  }
  return start
}

module.exports = { calculateSLA }
