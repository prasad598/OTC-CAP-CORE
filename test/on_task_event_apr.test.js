const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { SELECT, INSERT } = cds.ql

let onTaskEventHandler, db

describe('onTaskEvent APR patch handling', () => {
  before(async () => {
    require.cache[require.resolve('@sap-cloud-sdk/http-client')] = {
      exports: {
        executeHttpRequest: async () => ({
          data: {
            value: [
              {
                id: 'task2',
                taskDefinitionId: 'TE_RESO_TEAM',
                status: 'COMPLETED',
                subject: 'Resolve Request',
                assignedTo: ['BTP_SPA_ADMIN']
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
        TASK_INSTANCE_ID: 'task2',
        REQ_TXN_ID: '5678',
        TASK_TYPE: 'TE_RESO_TEAM',
        TASK_STATUS: 'READY',
        CREATED_BY: 'init',
        UPDATED_BY: 'init'
      })
    )

    await db.run(
      INSERT.into('BTP.TE_SR').entries({
        REQ_TXN_ID: '5678',
        STATUS_CD: 'PRT',
        CREATED_BY: 'init',
        UPDATED_BY: 'init',
        PROCESSOR: 'init'
      })
    )

    await db.run(
      INSERT.into('BTP.MON_WF_PROCESS').entries({
        WF_INSTANCE_ID: 'wf2',
        REQ_TXN_ID: '5678',
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

  it('approves task and updates request and process', async () => {
    const req = {
      data: {
        DECISION: 'APR',
        HTTP_CALL: 'PATCH',
        PROCESSOR: 'BTP_SPA_ADMIN',
        SWF_INSTANCE_ID: 'wf2',
        TASK_TYPE: 'TE_RESO_TEAM',
        REQ_TXN_ID: '5678',
        COMPLETED_AT: '2024-01-01T00:00:00.000Z'
      },
      res: { status: () => {} }
    }

    const result = await onTaskEventHandler(req)
    assert.strictEqual(result.status, 200)

    const task = await SELECT.one.from('BTP.MON_WF_TASK').where({ TASK_INSTANCE_ID: 'task2' })
    assert.strictEqual(task.TASK_STATUS, 'COMPLETED')
    assert.strictEqual(task.PROCESSOR, 'BTP_SPA_ADMIN')
    assert.strictEqual(task.DECISION, 'APR')

    const sr = await SELECT.one.from('BTP.TE_SR').where({ REQ_TXN_ID: '5678' })
    assert.strictEqual(sr.STATUS_CD, 'RSL')
    assert.strictEqual(sr.PROCESSOR, 'BTP_SPA_ADMIN')
    assert.strictEqual(sr.UPDATED_BY, 'BTP_SPA_ADMIN')

    const wf = await SELECT.one.from('BTP.MON_WF_PROCESS').where({ WF_INSTANCE_ID: 'wf2' })
    assert.strictEqual(wf.WF_STATUS, 'COMPLETED')
    assert.strictEqual(wf.UPDATED_BY, 'BTP_SPA_ADMIN')
    assert.ok(wf.ACTUAL_COMPLETION)
  })
})
