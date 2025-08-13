function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildCell(value) {
  return `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`
}

function buildRow(values) {
  return `<Row>${values.map(buildCell).join('')}</Row>`
}

function buildExcel(data, columns) {
  const header = buildRow(columns.map((c) => c.COLUMN_TITLE))
  const rows = data
    .map((r) => buildRow(columns.map((c) => r[c.COLUMN_ID] ?? '')))
    .join('')
  const table = `<Table>${header}${rows}</Table>`
  const worksheet = `<Worksheet ss:Name="Sheet1">${table}</Worksheet>`
  const workbook =
    `<?xml version="1.0"?>` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheet}</Workbook>`
  return Buffer.from(workbook, 'utf8')
}

module.exports = { buildExcel, buildRow, buildCell }
