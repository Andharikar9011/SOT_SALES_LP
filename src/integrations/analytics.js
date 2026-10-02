// Analytics facade. track(name, props) and initAnalytics(config) are the public contract; neither ever throws.
// Providers (content.analytics.provider): 'none' (default) | 'ga4' | 'plausible' | 'custom'. See docs/ANALYTICS.md.
import { isMobileDevice } from '../utils/text.js';

const PII_KEY = /e-?mail|phone|(^|[_-])(name|fullname|mobile|tel|message|address|token|password|ip)($|[_-])/i;
const EMAIL_VAL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_VAL = /(?:\+?\d[\s\-().]?){10,}/;
const MAX_QUEUE = 50;

// Keep only short primitives; drop PII-looking keys/values. Exported for tests.
export function sanitizeProps(props) {
  const out = {};
  if (!props || typeof props !== 'object') return out;
  for (const [k, v] of Object.entries(props)) {
    if (PII_KEY.test(k)) continue;
    if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) { out[k] = v; continue; }
    if (typeof v === 'string' && v.length <= 80 && !EMAIL_VAL.test(v) && !PHONE_VAL.test(v)) out[k] = v;
  }
  return out;
}

export function dntEnabled(nav = typeof navigator !== 'undefined' ? navigator : undefined, win = typeof window !== 'undefined' ? window : undefined) {
  const v = nav?.doNotTrack ?? win?.doNotTrack ?? nav?.msDoNotTrack;
  return v === '1' || v === 'yes' || nav?.globalPrivacyControl === true;
}

// Decide provider from config. Returns { provider, reason? } where provider is 'none' when disabled/invalid.
export function resolveProvider(config = {}, env = {}) {
  const wanted = String(config.provider || 'none').toLowerCase();
  if (wanted === 'none') return { provider: 'none' };
  if (config.respectDnt !== false && (env.dnt ?? dntEnabled())) return { provider: 'none', reason: 'dnt' };
  if (wanted === 'ga4') return /^G-[A-Z0-9]{4,}$/.test(config.id || '') ? { provider: 'ga4' } : { provider: 'none', reason: 'bad-id' };
  if (wanted === 'plausible') return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(config.domain || '') ? { provider: 'plausible' } : { provider: 'none', reason: 'bad-domain' };
  if (wanted === 'custom') return /^(https:\/\/|\/)[^\s]+$/.test(config.endpoint || '') ? { provider: 'custom' } : { provider: 'none', reason: 'bad-endpoint' };
  return { provider: 'none', reason: 'unknown' };
}

let state = { ready: false, provider: 'none', config: {}, consent: true, queue: [] };
export const _resetForTests = () => { state = { ready: false, provider: 'none', config: {}, consent: true, queue: [] }; };
export const _getState = () => state;

function loadScript(src, attrs = {}) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement('script');
  s.src = src; s.async = true;
  Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
  document.head.appendChild(s);
}

function setupProvider(provider, config) {
  if (provider === 'ga4') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', config.id, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.id)}`);
  } else if (provider === 'plausible') {
    window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    loadScript('https://plausible.io/js/script.js', { defer: '', 'data-domain': config.domain });
  }
}

function send(name, props) {
  const { provider, config } = state;
  if (provider === 'ga4') window.gtag?.('event', name, props);
  else if (provider === 'plausible') window.plausible?.(name, { props });
  else if (provider === 'custom') {
    const body = JSON.stringify({ event: name, props, path: location.pathname });
    const ok = navigator.sendBeacon?.(config.endpoint, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
    if (!ok) fetch(config.endpoint, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(() => {});
  }
}

function dispatch(name, props) {
  const full = { ...sanitizeProps(props), device: isMobileDevice() ? 'mobile' : 'desktop' };
  if (typeof console !== 'undefined' && import.meta.env?.DEV) console.debug('[track]', name, full);
  if (state.provider !== 'none' && state.consent) send(name, full);
}

export function track(name, props = {}) {
  try {
    if (typeof name !== 'string' || !name) return;
    if (!state.ready) { if (state.queue.length < MAX_QUEUE) state.queue.push([name, props]); return; }
    dispatch(name, props);
  } catch { /* analytics must never break the page */ }
}

// Call once with content.analytics. Safe to call again (ignored after first success).
export function initAnalytics(config) {
  try {
    if (state.ready) return;
    const cfg = config && typeof config === 'object' ? config : {};
    const { provider, reason } = resolveProvider(cfg);
    state = { ...state, ready: true, provider, config: cfg, consent: cfg.requireConsent === true ? false : true };
    if (provider !== 'none' && typeof window !== 'undefined') {
      if (state.consent) setupProvider(provider, cfg);
    }
    if (import.meta.env?.DEV && reason) console.debug('[analytics] disabled:', reason);
    const q = state.queue; state.queue = [];
    q.forEach(([n, p]) => dispatch(n, p));
    if (provider !== 'none' && typeof window !== 'undefined') import('./webvitals.js').then((m) => m.startWebVitals((n, p) => track(n, p))).catch(() => {});
  } catch { /* never throw */ }
}

// For sites that show a consent banner: content.analytics.requireConsent = true, then call this on accept.
export function setAnalyticsConsent(granted) {
  try {
    if (granted && !state.consent) {
      state.consent = true;
      if (state.provider !== 'none') setupProvider(state.provider, state.config);
    } else if (!granted) state.consent = false;
  } catch { /* never throw */ }
}
