// Form submission adapter. Never logs or stores form values. See docs/FORM_BACKEND_SETUP.md.
// Result: { ok: true, demo?, opaque?, bot? } | { ok: false, kind: 'offline'|'timeout'|'client'|'server'|'network', status? }

export const FORMATS = ['json', 'formspree', 'form-urlencoded', 'google-apps-script'];
export const FIELDS = ['name', 'email', 'phone', 'degree', 'status', 'message'];
export const HONEYPOT_FIELD = 'website';
export const DEFAULT_TIMEOUT_MS = 10000;
export const DEFAULT_MIN_SECONDS = 3;

// Only the known fields are ever sent (no honeypot, no extras).
export function buildPayload(values) {
  const out = {};
  for (const k of FIELDS) out[k] = String(values[k] ?? '').trim();
  return out;
}

export function buildRequest(payload, format, signal) {
  const fmt = FORMATS.includes(format) ? format : 'json';
  const base = { method: 'POST', signal };
  if (fmt === 'form-urlencoded') {
    return { ...base, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(payload).toString() };
  }
  if (fmt === 'google-apps-script') {
    // no-cors + text/plain is a "simple" request (no preflight); the response is opaque.
    return { ...base, mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) };
  }
  const headers = { 'Content-Type': 'application/json' };
  if (fmt === 'formspree') headers.Accept = 'application/json';
  return { ...base, headers, body: JSON.stringify(payload) };
}

export function statusToKind(status) {
  if (status >= 500) return 'server';
  return 'client';
}

// Maps a failure kind to a key under content.ui.form (falls back to submitError).
export const ERROR_UI_KEY = {
  offline: 'submitErrorOffline', timeout: 'submitErrorTimeout', client: 'submitErrorClient', server: 'submitErrorServer', network: 'submitError'
};
export function errorMessage(kind, uiForm = {}) {
  return uiForm[ERROR_UI_KEY[kind]] || uiForm.submitError || '';
}

// Bots: honeypot filled, or submitted faster than a human could. Caller should show success silently.
export function isBot({ honeypot = '', elapsedMs = Infinity, minSeconds = DEFAULT_MIN_SECONDS }) {
  if (String(honeypot).length > 0) return true;
  return elapsedMs < Math.max(0, Number(minSeconds) || 0) * 1000;
}

const online = () => (typeof navigator !== 'undefined' && navigator.onLine === false ? false : true);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function attempt(fetchImpl, endpoint, payload, format, timeoutMs) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);
  try {
    const req = buildRequest(payload, format, ctrl.signal);
    const res = await fetchImpl(endpoint, req);
    if (req.mode === 'no-cors') return { ok: true, opaque: true }; // opaque: cannot verify, see docs
    if (res.ok) return { ok: true };
    return { ok: false, kind: statusToKind(res.status), status: res.status };
  } catch (err) {
    if (timedOut) return { ok: false, kind: 'timeout' };
    if (err && err.name === 'AbortError') return { ok: false, kind: 'network' };
    return { ok: false, kind: 'network', retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

// opts: { fetchImpl, timeoutMs, retryDelayMs, isOnline, honeypot, elapsedMs, demoDelayMs }
export async function submitForm(values, formConfig = {}, opts = {}) {
  const {
    fetchImpl = (...a) => globalThis.fetch(...a), timeoutMs = DEFAULT_TIMEOUT_MS, retryDelayMs = 800,
    isOnline = online, honeypot = '', elapsedMs = Infinity, demoDelayMs = 600
  } = opts;
  const minSeconds = formConfig.minSubmitSeconds ?? DEFAULT_MIN_SECONDS;
  if (isBot({ honeypot, elapsedMs, minSeconds })) { await wait(Math.min(demoDelayMs, 600)); return { ok: true, bot: true }; }

  const endpoint = String(formConfig.submitEndpoint || '').trim();
  if (!endpoint) { await wait(demoDelayMs); return { ok: true, demo: true }; } // demo mode: no network, no storage
  if (!/^https?:\/\//i.test(endpoint)) return { ok: false, kind: 'client' };
  if (!isOnline()) return { ok: false, kind: 'offline' };

  const payload = buildPayload(values);
  const format = formConfig.submitFormat || 'json';
  let r = await attempt(fetchImpl, endpoint, payload, format, timeoutMs);
  if (!r.ok && r.retryable) {
    await wait(retryDelayMs); // one retry, network errors only
    if (!isOnline()) return { ok: false, kind: 'offline' };
    r = await attempt(fetchImpl, endpoint, payload, format, timeoutMs);
  }
  if (!r.ok) return { ok: false, kind: r.kind, ...(r.status ? { status: r.status } : {}) };
  return r;
}
