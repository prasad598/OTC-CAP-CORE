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
  return handler
}

describe('TE_REPORT_VIEW OPEN_CASES variant', () => {
  it('filters by TASK_PROCESSOR and STATUS PRT when only email provided', async () => {
    const handler = initHandler([], [{ value: 'user@example.com', primary: true }])
    const req = {
      data: { 'user-scim-id': '123', VARIENT: 'OPEN_CASES' },
      req: { query: { 'user-scim-id': '123', VARIENT: 'OPEN_CASES' } },
      query: { SELECT: {} }
    }
    await handler(req)
    assert.deepStrictEqual(req.query.SELECT.where, [
      '(',
      { ref: ['TASK_PROCESSOR'] }, '=', { val: 'user@example.com' },
      'and',
      { ref: ['STATUS_CD'] }, '=', { val: 'PRT' },
      ')'
    ])
  })

  it('filters by ASSIGNED_GROUP and email, each with STATUS PRT', async () => {
    const handler = initHandler(
      ['STE_TE_RESO_TEAM_G1'],
      [{ value: 'user@example.com', primary: true }]
    )
    const req = {
      data: { 'user-scim-id': '123', VARIENT: 'OPEN_CASES' },
      req: { query: { 'user-scim-id': '123', VARIENT: 'OPEN_CASES' } },
      query: { SELECT: {} }
    }
    await handler(req)
    assert.deepStrictEqual(req.query.SELECT.where, [
      '(',
      { ref: ['ASSIGNED_GROUP'] }, 'in', { list: [{ val: 'STE_TE_RESO_TEAM_G1' }] },
      'and',
      { ref: ['STATUS_CD'] }, '=', { val: 'PRT' },
      ')',
      'or',
      '(',
      { ref: ['TASK_PROCESSOR'] }, '=', { val: 'user@example.com' },
      'and',
      { ref: ['STATUS_CD'] }, '=', { val: 'PRT' },
      ')'
    ])
  })
})
