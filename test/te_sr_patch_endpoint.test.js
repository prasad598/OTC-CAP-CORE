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

describe('TE_SR PATCH alias', () => {
  before(async () => {
    srv = spawn('node', ['node_modules/.bin/cds-serve'], {
      cwd: __dirname + '/..',
      env: { ...process.env, PORT: 4006 },
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

  it('allows PATCH without key in path', async () => {
    let res = await fetch('http://localhost:4006/rest/btp/core/te-servicerequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        DECISION: 'draft',
        SRV_CAT_CD: 'REQEXM',
        SR_DETAILS: 'Initial request',
        CASE_REQ_ID: 'REQ0001',
        REQ_FOR_NAME: 'Prasad Bandaru',
        REQ_FOR_EMAIL: 'nagavaraprasad.bandaru@stengg.com',
        CASE_PRIO: 'H',
        CREATED_BY: 'nagavaraprasad.bandaru@stengg.com',
        REQUESTER_ID: 'nagavaraprasad.bandaru@stengg.com',
        ENTITY_CD: '803',
      }),
    });
    assert.strictEqual(res.status, 201);
    const created = await res.json();

    res = await fetch('http://localhost:4006/rest/btp/core/te-servicerequest', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        REQ_TXN_ID: created.REQ_TXN_ID,
        DECISION: 'submit',
        SR_DETAILS: 'Need equipment replacement.',
      }),
    });
    assert.strictEqual(res.status, 200);
    const patched = await res.json();
    assert.ok(patched.REQUEST_ID);
  });
});

