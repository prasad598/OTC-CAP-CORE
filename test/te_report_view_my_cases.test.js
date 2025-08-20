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

describe('TE_REPORT_VIEW MY_CASES variant', () => {
  it('filters by CREATED_BY when email provided', async () => {
    const handler = initHandler([], [{ value: 'user@example.com', primary: true }])
    const req = {
      data: { 'user-scim-id': '123', VARIENT: 'MY_CASES' },
      req: { query: { 'user-scim-id': '123', VARIENT: 'MY_CASES' } },
      query: { SELECT: {} }
    }
    await handler(req)
    assert.deepStrictEqual(req.query.SELECT.where, [
      { ref: ['CREATED_BY'] }, '=', { val: 'user@example.com' }
    ])
  })

  it('returns no records when email missing', async () => {
    const handler = initHandler([], [])
    const req = {
      data: { 'user-scim-id': '123', VARIENT: 'MY_CASES' },
      req: { query: { 'user-scim-id': '123', VARIENT: 'MY_CASES' } },
      query: { SELECT: {} }
    }
    await handler(req)
    assert.deepStrictEqual(req.query.SELECT.where, ['1', '=', '0'])
  })
})
