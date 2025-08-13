const cds = require('@sap/cds');
const assert = require('assert');
const { describe, it, before, after } = require('node:test');

let originalConnectTo;
let capturedDecision;
let processTaskUpdateHandler;

describe('processTaskUpdate decision handling', () => {
  before(async () => {
    await cds.deploy(__dirname + '/../db').to('sqlite::memory:');
    const db = cds.db;
    const entities = cds.entities('BTP');

    // stub remote workflow service
    originalConnectTo = cds.connect.to;
    cds.connect.to = async () => ({
      tx: () => ({
        send: async ({ data }) => {
          capturedDecision = data.decision;
        },
      }),
    });

    const srv = {
      entities,
      transaction: () => db,
      on: (event, handler) => {
        if (event === 'processTaskUpdate') processTaskUpdateHandler = handler;
      },
      before: () => {},
      after: () => {},
    };

    require('../srv/core-service')(srv);
  });

  after(() => {
    cds.connect.to = originalConnectTo;
  });

  it('passes decision to workflow service without altering case', async () => {
    const req = {
      data: {
        TASK_INSTANCE_ID: 'task123',
        TASK_TYPE: 'TE_RESO_TEAM',
        DECISION: 'Escalate',
        REQ_TXN_ID: 'req123',
      },
      user: { id: 'tester' },
      error: (code, msg) => { throw new Error(`${code} ${msg}`); },
    };

    const result = await processTaskUpdateHandler(req);
    assert.strictEqual(result.status, 'success');
    assert.strictEqual(capturedDecision, 'Escalate');
  });
});
