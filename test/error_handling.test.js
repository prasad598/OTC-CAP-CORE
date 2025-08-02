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

describe('Error handling', () => {
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

  it('returns 409 for duplicate CORE_COMMENTS', async () => {
    const url = 'http://localhost:4006/rest/btp/core/comments';
    const payload = {
      UUID: '11111111-1111-1111-1111-111111111111',
      REQ_TXN_ID: '00000000-0000-0000-0000-000000000001',
      COMMENTS: 'test',
      CREATED_BY: 'tester'
    };

    let res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(res.status, 201);

    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    assert.strictEqual(res.status, 409);
    assert.match(body.error.message, /already exists/i);
  });
});
