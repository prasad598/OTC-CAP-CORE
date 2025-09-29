const assert = require('assert')
const Module = require('module')
const { describe, it } = require('node:test')

function initAfterHandler() {
  let afterHandler
  const originalRequire = Module.prototype.require
  Module.prototype.require = function (path) {
    if (path === '@sap-cloud-sdk/http-client') {
      return {
        executeHttpRequest: async () => ({}),
      }
    }
    if (path === '@sap-cloud-sdk/connectivity') {
      return { retrieveJwt: () => 'jwt' }
    }
    return originalRequire.apply(this, arguments)
  }

  const srvMock = {
    entities: {
      CORE_COMMENTS: {},
      CORE_ATTACHMENTS: {},
      MON_WF_TASK: {},
      MON_WF_PROCESS: {},
      CORE_USERS: {},
      AUTH_MATRIX: {},
      CONFIG_LDATA: {},
      CONFIG_PHDATA: {},
      TE_SR: {},
    },
    before: () => {},
    on: () => {},
    after: (event, entity, fn) => {
      if (event === 'READ' && entity === 'TE_REPORT_VIEW') afterHandler = fn
    },
  }

  delete require.cache[require.resolve('../srv/core-service.js')]
  require('../srv/core-service.js')(srvMock)
  Module.prototype.require = originalRequire
  delete require.cache[require.resolve('@sap-cloud-sdk/http-client')]
  delete require.cache[require.resolve('@sap-cloud-sdk/connectivity')]
  return afterHandler
}

describe('TE_REPORT_VIEW timezone conversion', () => {
  it('converts timestamps to requested timezone from request payload', async () => {
    const handler = initAfterHandler()
    const rows = [
      { CREATED_DATETIME: '2024-01-01T00:00:00Z' },
    ]
    await handler(rows, { data: { TIMEZONE: 'UTC' } })
    assert.strictEqual(rows[0].CREATED_DATETIME, '2024-01-01T00:00:00+00:00')
  })

  it('falls back to default timezone when none provided', async () => {
    const handler = initAfterHandler()
    const row = { CREATED_DATETIME: '2024-01-01T00:00:00Z' }
    await handler(row, {})
    assert.match(row.CREATED_DATETIME, /\+08:00$/)
  })
})

