const cds = require('@sap/cds');
const assert = require('assert');
const { describe, it, before } = require('node:test');
const { generateCustomRequestId } = require('../srv/utils/sequence');

describe('Request ID sequence generation', () => {
  let tx;
  before(async () => {
    cds.SELECT = cds.ql.SELECT;
    await cds.deploy(__dirname + '/../db').to('sqlite::memory:');
    tx = { run: cds.db.run.bind(cds.db), user: { id: 'tester' } };
  });

  it('maintains separate sequences per request type and draft flag', async () => {
    const id1 = await generateCustomRequestId(tx, {
      prefix: 'CASE',
      requestType: 'A',
      isDraft: true,
    });
    const id2 = await generateCustomRequestId(tx, {
      prefix: 'CASE',
      requestType: 'A',
      isDraft: true,
    });
    const id3 = await generateCustomRequestId(tx, {
      prefix: 'CASE',
      requestType: 'A',
      isDraft: false,
    });
    const id4 = await generateCustomRequestId(tx, {
      prefix: 'CASE',
      requestType: 'B',
      isDraft: false,
    });

    assert.ok(id1.endsWith('DRFT00001'));
    assert.ok(id2.endsWith('DRFT00002'));
    assert.ok(!id3.includes('DRFT'));
    assert.ok(id3.endsWith('00001'));
    assert.ok(id4.endsWith('00001'));
  });
});

