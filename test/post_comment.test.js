const cds = require('@sap/cds');
const assert = require('assert');
const { describe, it, before } = require('node:test');
const { INSERT } = cds.ql;
const { postComment } = require('../srv/utils/comments');
const { TaskType, Decision, CommentEvent, UserType, EventStatus, CommentType } = require('../srv/utils/enums');

describe('postComment utility', () => {
  before(async () => {
    cds.SELECT = cds.ql.SELECT;
    await cds.deploy(__dirname + '/../db').to('sqlite::memory:');
    await INSERT.into('BTP.TE_SR').entries({
      REQ_TXN_ID: '11111111-1111-1111-1111-111111111111',
      REQUEST_ID: 'CASE1',
      STATUS_CD: 'DRF',
      CREATED_BY: 'tester'
    });
  });

  it('creates resolved comment for resolution team', async () => {
    const payload = await postComment(
      'resolved',
      '11111111-1111-1111-1111-111111111111',
      'tester',
      TaskType.TE_RESO_TEAM,
      Decision.APR,
      cds.db
    );
    assert.strictEqual(payload.COMMENT_EVENT, CommentEvent.SERVICE_REQUEST_RESOLVED);
    assert.strictEqual(payload.USER_TYPE, UserType.RESOLUTION_TEAM);
    assert.strictEqual(payload.EVENT_STATUS_CD, EventStatus.COMPLETED);
    assert.strictEqual(payload.COMMENT_TYPE, CommentType.MILESTONE);
  });
});
