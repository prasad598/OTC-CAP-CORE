const assert = require('assert')
const Module = require('module')
const { describe, it, before } = require('node:test')

describe('TE_REPORT_VIEW STE_TE_RESO_ADMN variant', () => {
  let handler
  before(() => {
    const originalRequire = Module.prototype.require
    Module.prototype.require = function (path) {
      if (path === '@sap-cloud-sdk/http-client') {
        return {
          executeHttpRequest: async () => ({
            data: {
              groups: ['STE_TE_RESO_ADMN'],
              emails: [{ value: 'admin@example.com', primary: true }]
            }
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
    require('../srv/core-service.js')(srvMock)
    Module.prototype.require = originalRequire
    delete require.cache[require.resolve('@sap-cloud-sdk/http-client')]
    delete require.cache[require.resolve('@sap-cloud-sdk/connectivity')]
  })

  it('adds STATUS_CD != DRF to query', async () => {
    const req = {
      data: { 'user-scim-id': '123', VARIENT: 'STE_TE_RESO_ADMN' },
      req: { query: { 'user-scim-id': '123', VARIENT: 'STE_TE_RESO_ADMN' } },
      query: { SELECT: {} }
    }
    await handler(req)
    assert.deepStrictEqual(req.query.SELECT.where, [
      { ref: ['STATUS_CD'] }, '!=', { val: 'DRF' }
    ])
  })
})

