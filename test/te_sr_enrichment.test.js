const cds = require('@sap/cds')
const assert = require('assert')
const { describe, it, before } = require('node:test')
const { INSERT } = cds.ql

describe('OTC_SR enrichment', () => {
  let srv
  before(async () => {
    cds.SELECT = cds.ql.SELECT
    await cds.deploy(__dirname + '/../db').to('sqlite::memory:')
    const db = cds.db
    const entities = cds.entities('BTP')
    srv = {
      entities,
      transaction: () => db,
      after: (event, entity, handler) => {
        if (event === 'READ' && entity === 'OTC_SR') srv._afterRead = handler
      },
      before: () => {},
    }
    require('../srv/core-service')(srv)
  })

  it('enriches OTC_SR with CORE_COMMENTS, CORE_ATTACHMENTS and MON_WF_PROCESS', async () => {
    const { OTC_SR, CORE_COMMENTS, CORE_ATTACHMENTS, CORE_USERS, MON_WF_PROCESS } = srv.entities
    const id = '11111111-1111-1111-1111-111111111111'

    await INSERT.into(OTC_SR).entries({ REQ_TXN_ID: id, language: 'EN' })
    await INSERT.into(CORE_USERS).entries({
      USER_EMAIL: 'tester',
      TITLE: 'Mr',
      USER_FNAME: 'Test',
      USER_LNAME: 'User',
    })
    await INSERT.into(CORE_COMMENTS).entries({
      REQ_TXN_ID: id,
      language: 'EN',
      COMMENTS: 'test comment',
      CREATED_BY: 'tester',
    })
      await INSERT.into(CORE_ATTACHMENTS).entries({
        REQ_TXN_ID: id,
        language: 'EN',
        FILE_NAME: 'file.txt',
        FILE_PATH: '/tmp/file.txt',
        MIME_TYPE: 'text/plain',
        PROJECT_TYPE: 'demo',
        ONPREMISE_REF: 'OP-123456789012',
        CREATED_BY: 'tester',
      })
    await INSERT.into(MON_WF_PROCESS).entries({
      WF_INSTANCE_ID: '00000000-0000-0000-0000-444444444444',
      REQ_TXN_ID: id,
      REQUEST_ID: 'REQ100',
      REQUEST_TYPE: 'TE',
      WF_STATUS: 'RUNNING',
      CREATED_BY: 'tester',
      UPDATED_BY: 'tester',
    })

    const item = { REQ_TXN_ID: id }
    await srv._afterRead(item, {})

    assert.ok(Array.isArray(item.CORE_COMMENTS))
    assert.strictEqual(item.CORE_COMMENTS.length, 1)
    assert.strictEqual(item.CORE_COMMENTS[0].COMMENTS, 'test comment')
    assert.strictEqual(item.CORE_COMMENTS[0].CREATED_BY_NAME, 'Mr Test')

    assert.ok(Array.isArray(item.CORE_ATTACHMENTS))
    assert.strictEqual(item.CORE_ATTACHMENTS.length, 1)
    assert.strictEqual(item.CORE_ATTACHMENTS[0].FILE_NAME, 'file.txt')
    assert.strictEqual(
      item.CORE_ATTACHMENTS[0].ONPREMISE_REF,
      'OP-123456789012'
    )
    assert.ok(Array.isArray(item.MON_WF_PROCESS))
    assert.strictEqual(item.MON_WF_PROCESS.length, 1)
    assert.strictEqual(
      item.MON_WF_PROCESS[0].WF_INSTANCE_ID,
      '00000000-0000-0000-0000-444444444444'
    )
  })

  it('fetches MON_WF_TASK records ordered by created time', async () => {
    const { OTC_SR, MON_WF_TASK } = srv.entities
    const id = '22222222-2222-2222-2222-222222222222'

    await INSERT.into(OTC_SR).entries({
      REQ_TXN_ID: id,
      language: 'EN',
      STATUS_CD: 'PRT'
    })

    await INSERT.into(MON_WF_TASK).entries([
      {
        TASK_INSTANCE_ID: '00000000-0000-0000-0000-111111111111',
        REQ_TXN_ID: id,
        CREATED_DATETIME: new Date('2024-02-01T00:00:00Z'),
        CREATED_BY: 'tester',
        UPDATED_BY: 'tester'
      },
      {
        TASK_INSTANCE_ID: '00000000-0000-0000-0000-222222222222',
        REQ_TXN_ID: id,
        CREATED_DATETIME: new Date('2024-01-01T00:00:00Z'),
        CREATED_BY: 'tester',
        UPDATED_BY: 'tester'
      }
    ])

    const item = { REQ_TXN_ID: id, STATUS_CD: 'PRT' }
    await srv._afterRead(item, { warn: () => {} })

    assert.ok(Array.isArray(item.MON_WF_TASK))
    assert.strictEqual(item.MON_WF_TASK.length, 2)
    assert.strictEqual(
      item.MON_WF_TASK[0].TASK_INSTANCE_ID,
      '00000000-0000-0000-0000-111111111111'
    )
    assert.strictEqual(
      item.MON_WF_TASK[1].TASK_INSTANCE_ID,
      '00000000-0000-0000-0000-222222222222'
    )
  })

  it('fetches MON_WF_TASK records regardless of status', async () => {
    const { OTC_SR, MON_WF_TASK } = srv.entities
    const id = '33333333-3333-3333-3333-333333333333'

    await INSERT.into(OTC_SR).entries({
      REQ_TXN_ID: id,
      language: 'EN',
      STATUS_CD: 'SUB'
    })

    await INSERT.into(MON_WF_TASK).entries({
      TASK_INSTANCE_ID: '00000000-0000-0000-0000-333333333333',
      REQ_TXN_ID: id,
      CREATED_DATETIME: new Date('2024-03-01T00:00:00Z'),
      CREATED_BY: 'tester',
      UPDATED_BY: 'tester'
    })

    const item = { REQ_TXN_ID: id, STATUS_CD: 'SUB' }
    await srv._afterRead(item, { warn: () => {} })

    assert.ok(Array.isArray(item.MON_WF_TASK))
    assert.strictEqual(item.MON_WF_TASK.length, 1)
    assert.strictEqual(
      item.MON_WF_TASK[0].TASK_INSTANCE_ID,
      '00000000-0000-0000-0000-333333333333'
    )
  })
})

