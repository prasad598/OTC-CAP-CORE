const assert = require('assert');
const { describe, it, before, after } = require('node:test');
const { spawn } = require('child_process');

let srv;
const PORT = 4010;
const base = `http://localhost:${PORT}/rest/btp/core`;

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

describe('Mass create & delete', () => {
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

  it('handles CORE_USERS', async () => {
    const payload = {
      entries: [
        {
          USER_EMAIL: 'user1@example.com',
          USER_ID: '1',
          USER_FNAME: 'A',
          USER_LNAME: 'A',
          IS_ACTIVE: 'Y',
          CREATED_BY: 'tester',
          UPDATED_BY: 'tester',
        },
        {
          USER_EMAIL: 'user2@example.com',
          USER_ID: '2',
          USER_FNAME: 'B',
          USER_LNAME: 'B',
          IS_ACTIVE: 'Y',
          CREATED_BY: 'tester',
          UPDATED_BY: 'tester',
        },
      ],
    };

    let res = await fetch(`${base}/massCreateUsers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.ok(res.status < 300);

    res = await fetch(`${base}/users`);
    const list = await res.json();
    const emails = list.map((u) => u.USER_EMAIL);
    assert.ok(emails.includes('user1@example.com'));
    assert.ok(emails.includes('user2@example.com'));

    res = await fetch(`${base}/massDeleteUsers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: ['user1@example.com', 'user2@example.com'] }),
    });
    assert.ok(res.status < 300);

    res = await fetch(`${base}/users`);
    const after = await res.json();
    const afterEmails = after.map((u) => u.USER_EMAIL);
    assert.ok(!afterEmails.includes('user1@example.com'));
    assert.ok(!afterEmails.includes('user2@example.com'));
  });

  it('handles AUTH_MATRIX', async () => {
    const payload = {
      entries: [
        {
          ASSIGNED_GROUP: 'G1',
          USER_EMAIL: 'user1@example.com',
          FIELD1: 'v1',
          CREATED_BY: 'tester',
          UPDATED_BY: 'tester',
        },
        {
          ASSIGNED_GROUP: 'G2',
          USER_EMAIL: 'user2@example.com',
          FIELD1: 'v2',
          CREATED_BY: 'tester',
          UPDATED_BY: 'tester',
        },
      ],
    };

    let res = await fetch(`${base}/massCreateAuthMatrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.ok(res.status < 300);

    res = await fetch(`${base}/auth-matrix`);
    const list = await res.json();
    const keys = list.map((r) => `${r.ASSIGNED_GROUP}:${r.USER_EMAIL}`);
    assert.ok(keys.includes('G1:user1@example.com'));
    assert.ok(keys.includes('G2:user2@example.com'));

    res = await fetch(`${base}/massDeleteAuthMatrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keys: [
          { ASSIGNED_GROUP: 'G1', USER_EMAIL: 'user1@example.com' },
          { ASSIGNED_GROUP: 'G2', USER_EMAIL: 'user2@example.com' },
        ],
      }),
    });
    assert.ok(res.status < 300);

    res = await fetch(`${base}/auth-matrix`);
    const after = await res.json();
    const afterKeys = after.map((r) => `${r.ASSIGNED_GROUP}:${r.USER_EMAIL}`);
    assert.ok(!afterKeys.includes('G1:user1@example.com'));
    assert.ok(!afterKeys.includes('G2:user2@example.com'));
  });

  it('handles CONFIG_LDATA', async () => {
    const payload = {
      entries: [
        {
          REQUEST_TYPE: 'RT',
          OBJECT: 'OBJ',
          CODE: '001',
          DESC: 'one',
          SEQUENCE: 1,
          CREATED_BY: 'tester',
          UPDATED_BY: 'tester',
        },
        {
          REQUEST_TYPE: 'RT',
          OBJECT: 'OBJ',
          CODE: '002',
          DESC: 'two',
          SEQUENCE: 2,
          CREATED_BY: 'tester',
          UPDATED_BY: 'tester',
        },
      ],
    };

    let res = await fetch(`${base}/massCreateConfigLdata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.ok(res.status < 300);

    res = await fetch(`${base}/CONFIG_LDATA`);
    const list = await res.json();
    const codes = list.map((r) => r.CODE);
    assert.ok(codes.includes('001'));
    assert.ok(codes.includes('002'));
    const seqMap = Object.fromEntries(list.map((r) => [r.CODE, r.SEQUENCE]));
    assert.strictEqual(seqMap['001'], 1);
    assert.strictEqual(seqMap['002'], 2);

    res = await fetch(`${base}/massDeleteConfigLdata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keys: [
          { REQUEST_TYPE: 'RT', OBJECT: 'OBJ', CODE: '001' },
          { REQUEST_TYPE: 'RT', OBJECT: 'OBJ', CODE: '002' },
        ],
      }),
    });
    assert.ok(res.status < 300);

    res = await fetch(`${base}/CONFIG_LDATA`);
    const after = await res.json();
    const afterCodes = after.map((r) => r.CODE);
    assert.ok(!afterCodes.includes('001'));
    assert.ok(!afterCodes.includes('002'));
  });
});
