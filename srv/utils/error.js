module.exports = function handleError(error, wfResponseCode, dbResponseCode) {
  const wfCode =
    wfResponseCode ||
    (error && error.response && error.response.status) ||
    error.status ||
    500

  const responseData =
    (error && error.response && error.response.data) || {
      error: { message: error.message }
    }

  const result = {
    status: 'failed',
    'wf-response-code': wfCode,
    ...responseData,
    stacktrace: JSON.stringify(error, Object.getOwnPropertyNames(error))
  }

  if (dbResponseCode !== undefined) {
    result['db-response-code'] = dbResponseCode
  }

  return result
}
