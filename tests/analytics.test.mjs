import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProps, resolveProvider, dntEnabled, track, initAnalytics, _resetForTests, _getState } from '../src/integrations/analytics.js';

test('sanitizeProps strips PII keys and values, keeps primitives', () => {
  const out = sanitizeProps({ email: 'a@b.co', name: 'Asha', phone: '9876543210', user_email: 'x', note: 'mail me a@b.co', tel_no: '1', digits: '+91 98765 43210', stage: 2, success: true, label: 'Apply', obj: { a: 1 }, nan: NaN, long: 'x'.repeat(200) });
  assert.deepEqual(out, { stage: 2, success: true, label: 'Apply' });
});
test('dntEnabled', () => {
  assert.equal(dntEnabled({ doNotTrack: '1' }, {}), true);
  assert.equal(dntEnabled({ globalPrivacyControl: true }, {}), true);
  assert.equal(dntEnabled({ doNotTrack: '0' }, {}), false);
  assert.equal(dntEnabled({}, {}), false);
});
test('resolveProvider selection and validation', () => {
  const env = { dnt: false };
  assert.equal(resolveProvider({}, env).provider, 'none');
  assert.equal(resolveProvider({ provider: 'none' }, env).provider, 'none');
  assert.equal(resolveProvider({ provider: 'ga4', id: 'G-ABC1234' }, env).provider, 'ga4');
  assert.equal(resolveProvider({ provider: 'ga4', id: 'UA-1' }, env).reason, 'bad-id');
  assert.equal(resolveProvider({ provider: 'plausible', domain: 'example.com' }, env).provider, 'plausible');
  assert.equal(resolveProvider({ provider: 'plausible', domain: '' }, env).reason, 'bad-domain');
  assert.equal(resolveProvider({ provider: 'custom', endpoint: 'https://a.test/e' }, env).provider, 'custom');
  assert.equal(resolveProvider({ provider: 'custom', endpoint: 'http://a.test/e' }, env).reason, 'bad-endpoint');
  assert.equal(resolveProvider({ provider: 'mystery' }, env).reason, 'unknown');
});
test('DNT disables unless respectDnt false', () => {
  assert.equal(resolveProvider({ provider: 'ga4', id: 'G-ABC1234' }, { dnt: true }).reason, 'dnt');
  assert.equal(resolveProvider({ provider: 'ga4', id: 'G-ABC1234', respectDnt: false }, { dnt: true }).provider, 'ga4');
});
test('track never throws, queues before init, is a no-op with provider none', () => {
  _resetForTests();
  assert.doesNotThrow(() => track(undefined));
  assert.doesNotThrow(() => track('x', null));
  track('page_load');
  assert.equal(_getState().queue.length, 2);
  assert.doesNotThrow(() => initAnalytics(undefined));
  assert.equal(_getState().ready, true); assert.equal(_getState().queue.length, 0); assert.equal(_getState().provider, 'none');
});
test('custom provider: sendBeacon gets sanitized props + device, nothing else', async () => {
  _resetForTests();
  const sent = [];
  Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon: (u, b) => { sent.push([u, b]); return true; } }, configurable: true });
  Object.defineProperty(globalThis, 'location', { value: { pathname: '/' }, configurable: true });
  initAnalytics({ provider: 'custom', endpoint: 'https://a.test/e' });
  track('form_submit', { success: true, email: 'a@b.co' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], 'https://a.test/e');
  const body = JSON.parse(await sent[0][1].text());
  assert.deepEqual(body, { event: 'form_submit', props: { success: true, device: 'desktop' }, path: '/' });
});
