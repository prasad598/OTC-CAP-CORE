const assert = require('assert');
const { describe, it, before, after } = require('node:test');
const { spawn } = require('child_process');

let srv;

const waitFor = (proc, matcher) =>
  new Promise((resolve, reject) => {
    const onData = (data) => {
      if (matcher.test(data.toString())) {
        proc.stdout.off('data', onData);
        resolve();
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('error', reject);
  });

describe('CORE_COMMENTS REST POST', () => {
  before(async () => {
    srv = spawn('node', ['node_modules/.bin/cds-serve'], {
      cwd: __dirname + '/..',
      env: { ...process.env, PORT: 4007 },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitFor(srv, /server listening/);
    const userPayload = {
      USER_EMAIL: 'tester@example.com',
      TITLE: 'Mr',
      USER_ID: '1',
      USER_HP: '123',
      USER_FNAME: 'Test',
      USER_LNAME: 'User',
      IS_ACTIVE: 'Y',
      CREATED_BY: 'seed',
      UPDATED_BY: 'seed',
      language: 'EN',
    };
    await fetch('http://localhost:4007/rest/btp/core/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userPayload),
    });
  });

  after(() => {
    if (srv) {
      srv.kill();
      return new Promise((resolve) => srv.on('exit', resolve));
    }
  });

  it('accepts minimal payload', async () => {
    const url = 'http://localhost:4007/rest/btp/core/comments';
    const payload = {
      REQ_TXN_ID: '77777777-7777-7777-7777-777777777777',
      COMMENTS: 'minimal comment',
      CREATED_BY: 'tester@example.com',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(res.status, 201)
    const body = await res.json()
    assert.ok(Array.isArray(body))
    assert.strictEqual(body.length, 1)
    const item = body[0]
    assert.strictEqual(item.REQ_TXN_ID, payload.REQ_TXN_ID)
    assert.strictEqual(item.COMMENTS, payload.COMMENTS)
    assert.strictEqual(item.CREATED_BY, payload.CREATED_BY)
    assert.strictEqual(item.CREATED_BY_MASKED, payload.CREATED_BY)
    assert.strictEqual(item.CREATED_BY_NAME, 'Mr Test User')
  });

  it('handles TASK_TYPE and DECISION transient fields', async () => {
    const url = 'http://localhost:4007/rest/btp/core/comments';
    const payload = {
      REQ_TXN_ID: '77777777-7777-7777-7777-777777777778',
      COMMENTS: 'comment with task and decision',
      CREATED_BY: 'tester@example.com',
      TASK_TYPE: 'TE_RESO_TEAM',
      DECISION: 'APR',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(res.status, 201)
    const body = await res.json()
    assert.ok(Array.isArray(body))
    assert.strictEqual(body.length, 1)
    const item = body[0]
    assert.strictEqual(item.USER_TYPE, 'Resolution Team')
    assert.strictEqual(item.COMMENT_TYPE, 'milestone')
    assert.strictEqual(item.COMMENT_EVENT, 'Service Request Resolved')
    assert.strictEqual(item.EVENT_STATUS_CD, 'Completed')
    assert.ok(!('TASK_TYPE' in item))
    assert.ok(!('DECISION' in item))
      assert.strictEqual(item.CREATED_BY_NAME, 'Mr Test User')
      assert.strictEqual(item.CREATED_BY_MASKED, payload.CREATED_BY)
    });

  it('populates additional fields for requester comments case-insensitively', async () => {
    const url = 'http://localhost:4007/rest/btp/core/comments';
    const payload = {
      REQ_TXN_ID: '77777777-7777-7777-7777-777777777779',
      COMMENTS: 'requester comment',
      CREATED_BY: 'tester@example.com',
      TASK_TYPE: 'te_requester',
      DECISION: 'sub',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.strictEqual(body.length, 1);
    const item = body[0];
    assert.strictEqual(item.USER_TYPE, 'TE Requester');
    assert.strictEqual(item.COMMENT_TYPE, 'document');
    assert.strictEqual(item.COMMENT_EVENT, 'Service Request Created');
    assert.strictEqual(item.EVENT_STATUS_CD, 'In Progress');
  });

  it('normalizes mixed-case taskType and decision values', async () => {
    const url = 'http://localhost:4007/rest/btp/core/comments';
    const payload = {
      REQ_TXN_ID: '77777777-7777-7777-7777-777777777780',
      COMMENTS: 'mixed case comment',
      CREATED_BY: 'tester@example.com',
      TASK_TYPE: 'teResoTeam',
      DECISION: 'Approve',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.strictEqual(body.length, 1);
    const item = body[0];
    assert.strictEqual(item.USER_TYPE, 'Resolution Team');
    assert.strictEqual(item.COMMENT_TYPE, 'milestone');
    assert.strictEqual(item.COMMENT_EVENT, 'Service Request Resolved');
    assert.strictEqual(item.EVENT_STATUS_CD, 'Completed');
  });
});

