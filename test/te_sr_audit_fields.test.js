const assert = require('assert');
const { describe, it, before, after } = require('node:test');
const { spawn } = require('child_process');

let srv;
const PORT = 4011;
const base = `http://localhost:${PORT}/rest/btp/core/te-servicerequest`;

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

describe('OTC_SR audit timestamps', () => {
  before(async () => {
    srv = spawn('node', ['node_modules/.bin/cds-serve'], {
      cwd: __dirname + '/..',
      env: { ...process.env, PORT },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitFor(srv, /server listening/);
  });

  after(() => {
    if (srv) {
      srv.kill();
      return new Promise((resolve) => srv.on('exit', resolve));
    }
  });

  it('sets CREATED_DATETIME and UPDATED_DATETIME on create and update', async () => {
    let res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        DECISION: 'draft',
        SRV_CAT_CD: 'REQEXM',
        SR_DETAILS: 'Initial request',
        CASE_REQ_ID: 'REQ0003',
        REQ_FOR_NAME: 'Audit User',
        REQ_FOR_EMAIL: 'audit.user@example.com',
        CASE_PRIO: 'H',
        CREATED_BY: 'audit.user@example.com',
        REQUESTER_ID: 'audit.user@example.com',
        ENTITY_CD: '803',
      }),
    });
    assert.strictEqual(res.status, 201);
    const created = await res.json();
    assert.ok(created.CREATED_DATETIME, 'CREATED_DATETIME missing');
    assert.ok(created.UPDATED_DATETIME, 'UPDATED_DATETIME missing');

    const initialUpdated = created.UPDATED_DATETIME;
    await new Promise((r) => setTimeout(r, 100));

    res = await fetch(base, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        REQ_TXN_ID: created.REQ_TXN_ID,
        SR_DETAILS: 'Updated request',
        DECISION: 'draft',
      }),
    });
    assert.strictEqual(res.status, 200);
    const patched = await res.json();
    assert.ok(new Date(patched.UPDATED_DATETIME) > new Date(initialUpdated));
  });
});

