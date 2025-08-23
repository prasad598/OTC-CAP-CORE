const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before, after } = require('node:test')
const { SELECT, INSERT } = cds.ql

let onTaskEventHandler, db, originalHttpClient

describe('onTaskEvent CLDA patch handling', () => {
  before(async () => {
    originalHttpClient = require.cache[require.resolve('@sap-cloud-sdk/http-client')]
    require.cache[require.resolve('@sap-cloud-sdk/http-client')] = {
      exports: {
        executeHttpRequest: async () => ({
          data: {
            value: [
              {
                id: 'task1',
                taskDefinitionId: 'TE_REQUESTER',
                status: 'COMPLETED'
              }
            ]
          }
        })
      }
    }

    await cds.deploy(__dirname + '/../db').to('sqlite::memory:')
    db = cds.db
    const entities = cds.entities('BTP')

    await db.run(
      INSERT.into('BTP.MON_WF_TASK').entries({
        TASK_INSTANCE_ID: 'task1',
        REQ_TXN_ID: '1234',
        TASK_TYPE: 'TE_REQUESTER',
        TASK_STATUS: 'READY',
        CREATED_BY: 'init',
        UPDATED_BY: 'init'
      })
    )

    await db.run(
      INSERT.into('BTP.TE_SR').entries({
        REQ_TXN_ID: '1234',
        STATUS_CD: 'PRT',
        CREATED_BY: 'init',
        UPDATED_BY: 'init',
        PROCESSOR: 'init'
      })
    )

    await db.run(
      INSERT.into('BTP.MON_WF_PROCESS').entries({
        WF_INSTANCE_ID: '6745367f-800b-11f0-ac06-eeee0a97c6df',
        REQ_TXN_ID: '1234',
        WF_STATUS: 'RUNNING',
        CREATED_BY: 'init',
        UPDATED_BY: 'init'
      })
    )

    const srv = {
      entities,
      transaction: () => db,
      on: (event, handler) => {
        if (event === 'onTaskEvent') onTaskEventHandler = handler
      },
      before: () => {},
      after: () => {}
    }
    require('../srv/core-service')(srv)
  })

  after(() => {
    if (originalHttpClient) {
      require.cache[require.resolve('@sap-cloud-sdk/http-client')] = originalHttpClient
    } else {
      delete require.cache[require.resolve('@sap-cloud-sdk/http-client')]
    }
  })

  it('closes task and service request in one transaction', async () => {
    const req = {
      data: {
        DECISION: ' CLDA ',
        HTTP_CALL: ' PATCH ',
        PROCESSOR: ' BTP_SPA_ADMIN ',
        SWF_INSTANCE_ID: ' 6745367f-800b-11f0-ac06-eeee0a97c6df ',
        TASK_TYPE: ' TE_REQUESTER ',
        REQ_TXN_ID: ' 1234 ',
        COMPLETED_AT: '2024-01-01T00:00:00.000Z'
      },
      res: { status: () => {} }
    }

    const result = await onTaskEventHandler(req)
    assert.strictEqual(result.status, 200)

    const task = await SELECT.one.from('BTP.MON_WF_TASK').where({ TASK_INSTANCE_ID: 'task1' })
    assert.strictEqual(task.TASK_STATUS, 'COMPLETED')
    assert.strictEqual(task.PROCESSOR, 'BTP_SPA_ADMIN')
    assert.strictEqual(task.DECISION, 'CLDA')

    const sr = await SELECT.one.from('BTP.TE_SR').where({ REQ_TXN_ID: '1234' })
    assert.strictEqual(sr.STATUS_CD, 'CLD')
    assert.strictEqual(sr.PROCESSOR, 'BTP_SPA_ADMIN')
    assert.strictEqual(sr.UPDATED_BY, 'BTP_SPA_ADMIN')
    assert.ok(sr.CLOSED_DATETIME)

    const wf = await SELECT.one.from('BTP.MON_WF_PROCESS').where({ WF_INSTANCE_ID: '6745367f-800b-11f0-ac06-eeee0a97c6df' })
    assert.strictEqual(wf.WF_STATUS, 'COMPLETED')
    assert.strictEqual(wf.UPDATED_BY, 'BTP_SPA_ADMIN')
    assert.ok(wf.ACTUAL_COMPLETION)
  })
})
