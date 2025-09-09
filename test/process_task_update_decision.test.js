const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before, after } = require('node:test')
const { SELECT, INSERT } = cds.ql

let originalConnectTo
let capturedDecision
let processTaskUpdateHandler
let db

describe('processTaskUpdate decision handling', { concurrency: false }, () => {
  before(async () => {
    await cds.deploy(__dirname + '/../db').to('sqlite::memory:')
    db = cds.db
    const entities = cds.entities('BTP')

    await db.run(
      INSERT.into('BTP.MON_WF_TASK').entries({
        TASK_INSTANCE_ID: 'task456',
        REQ_TXN_ID: 'req456',
        TASK_TYPE: 'TE_RESO_TEAM',
        TASK_STATUS: 'READY',
        CREATED_BY: 'init',
        UPDATED_BY: 'init'
      })
    )

    // stub mail utility to avoid external calls
    require.cache[require.resolve('../srv/utils/mail')] = {
      exports: { sendEmail: async () => ({}) }
    }

    // stub remote workflow service
    originalConnectTo = cds.connect.to
    cds.connect.to = async () => ({
      tx: () => ({
        send: async ({ data }) => {
          capturedDecision = data.decision
          return { status: 202 }
        }
      })
    })

    const srv = {
      entities,
      transaction: () => db,
      on: (event, handler) => {
        if (event === 'processTaskUpdate') processTaskUpdateHandler = handler
      },
      before: () => {},
      after: () => {}
    }

    require('../srv/core-service')(srv)
  })

  after(() => {
    cds.connect.to = originalConnectTo
  })

  it('passes decision to workflow service without altering case', async () => {
    const req = {
      data: {
        TASK_INSTANCE_ID: 'task123',
        TASK_TYPE: 'TE_RESO_TEAM',
        DECISION: 'Escalate',
        REQ_TXN_ID: 'req123',
        UPDATED_BY: 'tester2'
      },
      user: { id: 'tester' },
      error: (code, msg) => {
        throw new Error(`${code} ${msg}`)
      }
    }

    const result = await processTaskUpdateHandler(req)
    assert.strictEqual(result.status, 'success')
    assert.strictEqual(result['wf-response-code'], 202)
    assert.strictEqual(result['db-response-code'], 200)
    assert.strictEqual(capturedDecision, 'Escalate')
  })

  it('updates MON_WF_TASK with completion details', async () => {
    const req = {
      data: {
        TASK_INSTANCE_ID: 'task456',
        TASK_TYPE: 'TE_RESO_TEAM',
        DECISION: 'Escalate',
        REQ_TXN_ID: 'req456',
        UPDATED_BY: 'tester2'
      },
      user: { id: 'tester' },
      error: (code, msg) => {
        throw new Error(`${code} ${msg}`)
      }
    }

    const result = await processTaskUpdateHandler(req)
    assert.strictEqual(result['wf-response-code'], 202)
    assert.strictEqual(result['db-response-code'], 200)
    const task = await db.run(
      SELECT.one.from('BTP.MON_WF_TASK').where({ TASK_INSTANCE_ID: 'task456' })
    )
    assert.strictEqual(task.TASK_STATUS, 'COMPLETED')
    assert.strictEqual(task.PROCESSOR, 'tester2')
    assert.strictEqual(task.UPDATED_BY, 'tester2')
    assert.ok(task.COMPLETED_DATE)
  })

  it('returns failed status with stacktrace when workflow update fails', async () => {
    const failingStub = async () => ({
      tx: () => ({
        send: async () => {
          const err = new Error('WF update error')
          err.response = {
            status: 500,
            data: { error: { message: 'WF update error' } }
          }
          throw err
        }
      })
    })
    const originalStub = cds.connect.to
    cds.connect.to = failingStub

    const req = {
      data: {
        TASK_INSTANCE_ID: 'task789',
        TASK_TYPE: 'TE_RESO_TEAM',
        DECISION: 'Escalate',
        REQ_TXN_ID: 'req789',
        UPDATED_BY: 'tester2'
      },
      user: { id: 'tester' },
      error: (code, msg) => {
        throw new Error(`${code} ${msg}`)
      }
    }

    const result = await processTaskUpdateHandler(req)
    assert.strictEqual(result.status, 'failed')
    assert.strictEqual(result['wf-response-code'], 500)
    assert.ok(result.stacktrace.includes('WF update error'))
    assert.ok(!('db-response-code' in result))

    cds.connect.to = originalStub
  })

  it('returns db-response-code when db transaction fails', async () => {
    const originalTx = cds.transaction
    cds.transaction = () => ({
      run: async () => {
        const err = new Error('DB failure')
        err.status = 500
        throw err
      },
      rollback: async () => {},
      commit: async () => {}
    })

    const req = {
      data: {
        TASK_INSTANCE_ID: 'task999',
        TASK_TYPE: 'TE_RESO_TEAM',
        DECISION: 'Escalate',
        REQ_TXN_ID: 'req999',
        UPDATED_BY: 'tester2'
      },
      user: { id: 'tester' },
      error: (code, msg) => {
        throw new Error(`${code} ${msg}`)
      }
    }

    const result = await processTaskUpdateHandler(req)
    assert.strictEqual(result.status, 'failed')
    assert.strictEqual(result['wf-response-code'], 202)
    assert.strictEqual(result['db-response-code'], 500)

    cds.transaction = originalTx
  })
})
