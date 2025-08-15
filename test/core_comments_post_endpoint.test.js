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
      CREATED_BY: 'tester',
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
    const [comment] = body;
    assert.strictEqual(comment.REQ_TXN_ID, payload.REQ_TXN_ID);
    assert.strictEqual(comment.COMMENTS, payload.COMMENTS);
    assert.strictEqual(comment.CREATED_BY, payload.CREATED_BY);
  });
});

