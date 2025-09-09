module.exports = function handleError(error, wfResponseCode) {
  const statusCode =
    wfResponseCode ||
    (error && error.response && error.response.status) ||
    error.status ||
    500

  const responseData =
    (error && error.response && error.response.data) || {
      error: { message: error.message }
    }

  return {
    status: 'failed',
    'wf-response-code': statusCode,
    ...responseData,
    stacktrace: JSON.stringify(error, Object.getOwnPropertyNames(error))
  }
}
