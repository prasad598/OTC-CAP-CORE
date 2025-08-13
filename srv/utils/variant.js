function normalizeVariant(value) {
  return typeof value === 'string' ? value.replace(/^'|'$/g, '') : value
}

module.exports = { normalizeVariant }
