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

describe('REST service endpoints', () => {
  before(async () => {
    srv = spawn('node', ['node_modules/.bin/cds-serve'], {
      cwd: __dirname + '/..',
      env: { ...process.env, PORT: 4005 },
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

  it('responds with 200 for all entities', async () => {
    const endpoints = [
      'attachments',
      'comments',
      'workflow-process',
      'workflow-task',
      'te-servicerequest',
    ];
    for (const ep of endpoints) {
      const res = await fetch(`http://localhost:4005/rest/btp/core/${ep}`);
      assert.strictEqual(res.status, 200, `${ep} did not return 200`);
    }
  });
});
