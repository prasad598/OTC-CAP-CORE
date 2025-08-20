const assert = require('assert')
const Module = require('module')
const { describe, it } = require('node:test')

function initHandler(groups, emails) {
  let handler
  const originalRequire = Module.prototype.require
  Module.prototype.require = function (path) {
    if (path === '@sap-cloud-sdk/http-client') {
      return {
        executeHttpRequest: async () => ({
          data: { groups, emails }
        })
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
      CONFIG_LDATA: {}
    },
    before: (event, entity, fn) => {
      if (event === 'READ' && entity === 'TE_REPORT_VIEW') handler = fn
    },
    after: () => {},
    on: () => {}
  }
  delete require.cache[require.resolve('../srv/core-service.js')]
  require('../srv/core-service.js')(srvMock)
  Module.prototype.require = originalRequire
  delete require.cache[require.resolve('@sap-cloud-sdk/http-client')]
  delete require.cache[require.resolve('@sap-cloud-sdk/connectivity')]
  return handler
}

describe('TE_REPORT_VIEW default variant', () => {
  it('leaves query unchanged for unknown variant', async () => {
    const handler = initHandler(
      ['STE_TE_RESO_TEAM_G1'],
      [{ value: 'user@example.com', primary: true }]
    )
    const req = {
      data: { 'user-scim-id': '123', VARIENT: 'UNKNOWN_VARIANT' },
      req: { query: { 'user-scim-id': '123', VARIENT: 'UNKNOWN_VARIANT' } },
      query: { SELECT: {} }
    }
    await handler(req)
    assert.strictEqual(req.query.SELECT.where, undefined)
  })
})
