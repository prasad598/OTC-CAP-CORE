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
      'auth-matrix',
      'comments',
      'users',
      'workflow-process',
      'workflow-task',
      'te-servicerequest',
    ];
    for (const ep of endpoints) {
      const res = await fetch(`http://localhost:4005/rest/btp/core/${ep}`);
      assert.strictEqual(res.status, 200, `${ep} did not return 200`);
    }
  });

  it('executes calculateSLA action', async () => {
    const res = await fetch('http://localhost:4005/rest/btp/core/calculateSLA', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        taskType: 'TYPE',
        projectType: 'PROJ',
        createdAt: '2024-01-01T00:00:00Z',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(/\d{4}-\d{2}-\d{2}/.test(data.estimatedCompletionDate));
  });

  it('accounts for public holidays when calculating SLA', async () => {
    // insert a holiday on 2024-01-02
    let res = await fetch('http://localhost:4005/rest/btp/core/CONFIG_PHDATA', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        HOLIDAY_DT: '2024-01-02',
        DESCRIPTION: 'New Year',
        CREATED_BY: 'tester@example.com',
        UPDATED_BY: 'tester@example.com',
      }),
    });
    assert.ok(res.ok, 'failed to insert public holiday');

    res = await fetch('http://localhost:4005/rest/btp/core/calculateSLA', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        taskType: 'TYPE',
        projectType: 'PROJ',
        createdAt: '2024-01-01T00:00:00Z',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // With Jan 2 marked as holiday the SLA should extend by one extra day
    assert.strictEqual(data.estimatedCompletionDate, '2024-01-05');
  });
});
