import test from 'node:test';
import assert from 'node:assert/strict';
import { submitForm, buildRequest, buildPayload, errorMessage, isBot } from '../src/integrations/submit.js';

const values = { name: ' Asha ', email: 'a@b.co', phone: '9876543210', degree: 'BBA', status: 'Job seeker', message: '', website: 'x', extra: 'y' };
const opts = (o = {}) => ({ retryDelayMs: 1, demoDelayMs: 1, elapsedMs: 60000, isOnline: () => true, ...o });
const res = (status) => ({ ok: status >= 200 && status < 300, status });

test('demo mode: no fetch when endpoint empty', async () => {
  let called = 0;
  const r = await submitForm(values, { submitEndpoint: '' }, opts({ fetchImpl: () => { called++; } }));
  assert.deepEqual(r, { ok: true, demo: true }); assert.equal(called, 0);
});
test('payload only has known fields, trimmed', () => {
  assert.deepEqual(Object.keys(buildPayload(values)), ['name', 'email', 'phone', 'degree', 'status', 'message']);
  assert.equal(buildPayload(values).name, 'Asha');
});
test('formats', () => {
  const p = buildPayload(values);
  assert.equal(buildRequest(p, 'json').headers['Content-Type'], 'application/json');
  assert.equal(buildRequest(p, 'json').headers.Accept, undefined);
  assert.equal(buildRequest(p, 'formspree').headers.Accept, 'application/json');
  assert.equal(buildRequest(p, 'form-urlencoded').headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.match(buildRequest(p, 'form-urlencoded').body, /name=Asha&email=a%40b\.co/);
  const g = buildRequest(p, 'google-apps-script');
  assert.equal(g.mode, 'no-cors'); assert.equal(g.headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.equal(buildRequest(p, 'bogus').headers['Content-Type'], 'application/json');
});
test('success 200', async () => {
  const r = await submitForm(values, { submitEndpoint: 'https://x.test/f' }, opts({ fetchImpl: async () => res(200) }));
  assert.equal(r.ok, true);
});
test('4xx -> client, no retry', async () => {
  let n = 0;
  const r = await submitForm(values, { submitEndpoint: 'https://x.test/f' }, opts({ fetchImpl: async () => { n++; return res(422); } }));
  assert.deepEqual(r, { ok: false, kind: 'client', status: 422 }); assert.equal(n, 1);
});
test('5xx -> server, no retry', async () => {
  let n = 0;
  const r = await submitForm(values, { submitEndpoint: 'https://x.test/f' }, opts({ fetchImpl: async () => { n++; return res(500); } }));
  assert.equal(r.kind, 'server'); assert.equal(n, 1);
});
test('network error retried once then succeeds', async () => {
  let n = 0;
  const r = await submitForm(values, { submitEndpoint: 'https://x.test/f' }, opts({ fetchImpl: async () => { if (++n === 1) throw new TypeError('fail'); return res(200); } }));
  assert.equal(r.ok, true); assert.equal(n, 2);
});
test('network error twice -> network, exactly 2 attempts', async () => {
  let n = 0;
  const r = await submitForm(values, { submitEndpoint: 'https://x.test/f' }, opts({ fetchImpl: async () => { n++; throw new TypeError('fail'); } }));
  assert.equal(r.kind, 'network'); assert.equal(n, 2);
});
test('timeout aborts, maps to timeout, no retry', async () => {
  let n = 0;
  const fetchImpl = (u, { signal }) => { n++; return new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' })))); };
  const r = await submitForm(values, { submitEndpoint: 'https://x.test/f' }, opts({ fetchImpl, timeoutMs: 20 }));
  assert.equal(r.kind, 'timeout'); assert.equal(n, 1);
});
test('offline -> offline without fetching', async () => {
  let n = 0;
  const r = await submitForm(values, { submitEndpoint: 'https://x.test/f' }, opts({ isOnline: () => false, fetchImpl: async () => { n++; } }));
  assert.equal(r.kind, 'offline'); assert.equal(n, 0);
});
test('google-apps-script: opaque response counts as success', async () => {
  const r = await submitForm(values, { submitEndpoint: 'https://script.google.com/x', submitFormat: 'google-apps-script' }, opts({ fetchImpl: async (u, req) => { assert.equal(req.mode, 'no-cors'); return { type: 'opaque', ok: false, status: 0 }; } }));
  assert.deepEqual(r, { ok: true, opaque: true });
});
test('honeypot and too-fast submissions silently succeed without sending', async () => {
  let n = 0; const fetchImpl = async () => { n++; return res(200); };
  const a = await submitForm(values, { submitEndpoint: 'https://x.test/f' }, opts({ fetchImpl, honeypot: 'spam' }));
  const b = await submitForm(values, { submitEndpoint: 'https://x.test/f' }, opts({ fetchImpl, elapsedMs: 500 }));
  assert.equal(a.bot, true); assert.equal(b.bot, true); assert.equal(n, 0);
  assert.equal(isBot({ elapsedMs: 3500, minSeconds: 3 }), false);
});
test('non-http endpoint rejected', async () => {
  const r = await submitForm(values, { submitEndpoint: 'javascript:alert(1)' }, opts());
  assert.equal(r.ok, false);
});
test('errorMessage maps kinds with fallback', () => {
  const ui = { submitError: 'generic', submitErrorTimeout: 'slow' };
  assert.equal(errorMessage('timeout', ui), 'slow');
  assert.equal(errorMessage('offline', ui), 'generic');
});
