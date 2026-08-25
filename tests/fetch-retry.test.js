'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPanel } = require('./helpers/load-panel');

function fakeResponse(status) {
  return { ok: status >= 200 && status < 300, status, text: async () => '' };
}

test('fetchWithRetry', async (t) => {
  await t.test('success on first attempt: a single fetch, no retry', async () => {
    const { panel } = loadPanel();
    let calls = 0;
    global.fetch = async () => { calls++; return fakeResponse(200); };

    const res = await panel.fetchWithRetry('https://example.test');
    assert.equal(res.ok, true);
    assert.equal(calls, 1);
  });

  await t.test('transient network error: retries once and then succeeds', async () => {
    const { panel } = loadPanel();
    let calls = 0;
    global.fetch = async () => {
      calls++;
      if (calls === 1) throw new TypeError('Failed to fetch');
      return fakeResponse(200);
    };

    const res = await panel.fetchWithRetry('https://example.test', undefined, 1, 1);
    assert.equal(res.ok, true);
    assert.equal(calls, 2, 'must have retried exactly once');
  });

  await t.test('persistent error beyond the retry count: propagates the exception', async () => {
    const { panel } = loadPanel();
    let calls = 0;
    global.fetch = async () => { calls++; throw new TypeError('Failed to fetch'); };

    await assert.rejects(() => panel.fetchWithRetry('https://example.test', undefined, 1, 1));
    assert.equal(calls, 2, 'initial attempt + 1 retry, then it gives up');
  });

  await t.test('HTTP 5xx: retries (server error, transient)', async () => {
    const { panel } = loadPanel();
    let calls = 0;
    global.fetch = async () => {
      calls++;
      return calls === 1 ? fakeResponse(503) : fakeResponse(200);
    };

    const res = await panel.fetchWithRetry('https://example.test', undefined, 1, 1);
    assert.equal(res.ok, true);
    assert.equal(calls, 2);
  });

  await t.test('HTTP 404: does NOT retry (not a transient error)', async () => {
    const { panel } = loadPanel();
    let calls = 0;
    global.fetch = async () => { calls++; return fakeResponse(404); };

    const res = await panel.fetchWithRetry('https://example.test', undefined, 1, 1);
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
    assert.equal(calls, 1, 'a 404 must not trigger useless retries');
  });
});
