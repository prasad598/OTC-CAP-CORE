const { v4: uuidv4 } = require('uuid')

function detectDbError(err) {
  const msg = (err.message || '').toLowerCase()
  if (/unique constraint|duplicate/i.test(msg)) return 'UNIQUE_CONSTRAINT'
  if (/foreign key/i.test(msg)) return 'FOREIGN_KEY_VIOLATION'
  if (/not null/i.test(msg)) return 'NOT_NULL'
  if (/check constraint/i.test(msg)) return 'CHECK_CONSTRAINT'
  if (/value too long|string data right truncation/i.test(msg)) return 'VALUE_TOO_LONG'
  if (/numeric value out of range/i.test(msg)) return 'NUMERIC_OUT_OF_RANGE'
  return null
}

module.exports = function mapError(err = {}) {
  const logId = uuidv4()

  const response = {
    error: {
      code: 'TECHNICAL_ERROR',
      message: err.message || 'Unexpected error',
      logId,
      details: [],
    },
  }

  const dbCode = detectDbError(err)
  if (dbCode) {
    response.error.code = dbCode
    response.error.message = 'Database error'
    response.error.details.push({ severity: 'ERROR', message: err.message })
    return response
  }

  if (err.name === 'ValidationError' || err.code === 'VALIDATION_ERROR') {
    response.error.code = 'VALIDATION_FAILED'
    response.error.message = 'Validation failed'
    const validationErrors = err.details || err.errors || []
    if (Array.isArray(validationErrors)) {
      response.error.details = validationErrors.map((d) => ({
        severity: (d.severity || 'ERROR').toUpperCase(),
        message: d.message || d,
      }))
    } else if (err.message) {
      response.error.details.push({ severity: 'ERROR', message: err.message })
    }
    return response
  }

  if (err.name === 'OptimisticLockError') {
    response.error.code = 'ETAG_MISMATCH'
    response.error.message = 'Resource was modified'
    response.error.details.push({ severity: 'ERROR', message: err.message })
    return response
  }

  if (err.status === 404 || err.statusCode === 404 || err.code === 'NOT_FOUND' || err.name === 'NotFoundError') {
    response.error.code = 'NOT_FOUND'
    response.error.message = err.message || 'Resource not found'
    return response
  }

  if (err.status === 403 || err.statusCode === 403 || err.code === 'FORBIDDEN') {
    response.error.code = 'FORBIDDEN'
    response.error.message = err.message || 'Forbidden'
    return response
  }

  if (/deadlock/i.test(err.message)) {
    response.error.code = 'DEADLOCK'
    response.error.message = err.message || 'Deadlock detected'
    return response
  }

  if (/timeout/i.test(err.message) || err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
    response.error.code = 'DB_TIMEOUT'
    response.error.message = err.message || 'Database timeout'
    return response
  }

  if (
    /(econnrefused|econnreset|no connection|connection.*failed|connection.*lost)/i.test(err.code) ||
    /(econnrefused|econnreset|no connection|connection.*failed|connection.*lost)/i.test(err.message)
  ) {
    response.error.code = 'DB_CONNECTION'
    response.error.message = err.message || 'Database connection error'
    return response
  }

  response.error.details.push({
    severity: 'ERROR',
    message: err.stack || err.message || 'Unexpected error',
  })
  return response
}

