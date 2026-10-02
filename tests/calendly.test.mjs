import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCalendlyUrl, buildEmbedUrl, parseCalendlyMessage } from '../src/integrations/calendly.js';

test('validateCalendlyUrl accepts/rejects', () => {
  assert.equal(validateCalendlyUrl('https://calendly.com/acme/intro').ok, true);
  assert.equal(validateCalendlyUrl('[PLACEHOLDER] https://calendly.com/YOUR_USERNAME/intro-call').reason, 'placeholder');
  assert.equal(validateCalendlyUrl('https://calendly.com/YOUR_USERNAME/x').reason, 'placeholder');
  assert.equal(validateCalendlyUrl('http://calendly.com/a/b').reason, 'not-https');
  assert.equal(validateCalendlyUrl('https://evil.com/calendly.com/a').reason, 'bad-host');
  assert.equal(validateCalendlyUrl('https://calendly.com.evil.com/a').reason, 'bad-host');
  assert.equal(validateCalendlyUrl('https://user:pw@calendly.com/a').ok, false);
  assert.equal(validateCalendlyUrl('https://calendly.com/').reason, 'no-path');
  assert.equal(validateCalendlyUrl('').reason, 'empty');
  assert.equal(validateCalendlyUrl('javascript:alert(1)').ok, false);
  assert.equal(validateCalendlyUrl(undefined).ok, false);
});
const colors = { background: '#0B1B33', text: '#F4F8FF', primary: '#1A5FBF' };
test('buildEmbedUrl adds theme colors without #', () => {
  const u = new URL(buildEmbedUrl('https://calendly.com/acme/intro', colors));
  assert.equal(u.searchParams.get('background_color'), '0b1b33');
  assert.equal(u.searchParams.get('text_color'), 'f4f8ff');
  assert.equal(u.searchParams.get('primary_color'), '1a5fbf');
  assert.equal(u.searchParams.get('hide_gdpr_banner'), '1');
  assert.equal(u.searchParams.get('name'), null);
});
test('prefill only when exactly true, only name+email', () => {
  const values = { name: 'Asha', email: 'a@b.co', phone: '999' };
  const off = new URL(buildEmbedUrl('https://calendly.com/a/b', colors, { prefill: 'true', values }));
  assert.equal(off.searchParams.get('email'), null);
  const on = new URL(buildEmbedUrl('https://calendly.com/a/b', colors, { prefill: true, values }));
  assert.equal(on.searchParams.get('email'), 'a@b.co'); assert.equal(on.searchParams.get('name'), 'Asha');
  assert.equal(on.searchParams.get('phone'), null);
});
test('bad colors skipped, invalid url -> null', () => {
  const u = new URL(buildEmbedUrl('https://calendly.com/a/b', { background: 'red' }));
  assert.equal(u.searchParams.get('background_color'), null);
  assert.equal(buildEmbedUrl('https://x.com/a', colors), null);
});
test('parseCalendlyMessage checks origin', () => {
  assert.equal(parseCalendlyMessage({ origin: 'https://calendly.com', data: { event: 'calendly.event_scheduled' } }), 'calendly.event_scheduled');
  assert.equal(parseCalendlyMessage({ origin: 'https://evil.com', data: { event: 'calendly.event_scheduled' } }), null);
  assert.equal(parseCalendlyMessage({ origin: 'https://calendly.com', data: { event: 'other' } }), null);
  assert.equal(parseCalendlyMessage({ origin: 'https://calendly.com', data: null }), null);
});
