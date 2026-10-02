// Calendly helpers: URL validation, embed-URL builder, idempotent script loader, postMessage parsing.
export const WIDGET_JS = 'https://assets.calendly.com/assets/external/widget.js';
export const WIDGET_CSS = 'https://assets.calendly.com/assets/external/widget.css';
export const CALENDLY_ORIGIN = 'https://calendly.com';
export const LOAD_TIMEOUT_MS = 12000;
export const AUTO_CLOSE_SECONDS = 5;

// Only https://calendly.com/<user>[/<event>] is embeddable. Returns { ok, reason?, url? }.
export function validateCalendlyUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, reason: 'empty' };
  const s = raw.trim();
  if (s.includes('[PLACEHOLDER]') || /YOUR_USERNAME/i.test(s)) return { ok: false, reason: 'placeholder' };
  let u;
  try { u = new URL(s); } catch { return { ok: false, reason: 'invalid' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'not-https' };
  if (u.hostname !== 'calendly.com') return { ok: false, reason: 'bad-host' };
  if (u.username || u.password || (u.port && u.port !== '443')) return { ok: false, reason: 'invalid' };
  if (u.pathname.replace(/\//g, '') === '') return { ok: false, reason: 'no-path' };
  return { ok: true, url: u };
}

const hex = (c) => (typeof c === 'string' && /^#?[0-9a-f]{6}$/i.test(c.trim()) ? c.trim().replace('#', '').toLowerCase() : null);

// Theme colors (no '#'). Prefill (name+email) only when opts.prefill is exactly true.
export function buildEmbedUrl(raw, colors = {}, opts = {}) {
  const v = validateCalendlyUrl(raw);
  if (!v.ok) return null;
  const u = new URL(v.url.href);
  const set = (k, c) => { const h = hex(c); if (h) u.searchParams.set(k, h); };
  set('background_color', colors.background);
  set('text_color', colors.text);
  set('primary_color', colors.primary);
  if (opts.hideGdpr !== false) u.searchParams.set('hide_gdpr_banner', '1');
  if (opts.prefill === true && opts.values) {
    const name = String(opts.values.name || '').trim();
    const email = String(opts.values.email || '').trim();
    if (name) u.searchParams.set('name', name);
    if (email) u.searchParams.set('email', email);
  }
  return u.toString();
}

// Returns the Calendly event name from a window 'message' event, or null if untrusted/irrelevant.
export function parseCalendlyMessage(e) {
  if (!e || e.origin !== CALENDLY_ORIGIN) return null;
  const ev = e.data && e.data.event;
  return typeof ev === 'string' && ev.startsWith('calendly.') ? ev : null;
}

let scriptPromise = null;
// Loads widget.js once (never a duplicate tag), only when called. Rejects after timeoutMs.
export function loadCalendly(timeoutMs = LOAD_TIMEOUT_MS) {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Calendly) return Promise.resolve(window.Calendly);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const fail = (s) => { scriptPromise = null; s?.remove(); reject(new Error('Calendly failed to load')); };
      if (!document.querySelector(`link[href="${WIDGET_CSS}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet'; link.href = WIDGET_CSS;
        document.head.appendChild(link);
      }
      let s = document.querySelector(`script[src="${WIDGET_JS}"]`);
      if (s) s.remove(); // a stale/failed tag from earlier: replace to avoid duplicates
      s = document.createElement('script');
      s.src = WIDGET_JS; s.async = true;
      s.onload = () => (window.Calendly ? resolve(window.Calendly) : fail(s));
      s.onerror = () => fail(s);
      document.body.appendChild(s);
    });
  }
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Calendly load timeout')), timeoutMs);
    scriptPromise.then((c) => { clearTimeout(t); resolve(c); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// In-memory only hand-off of name+email from the form to the booking modal (when booking.prefill === true).
let pending = null;
export const setPrefill = (v) => { pending = v ? { name: v.name, email: v.email } : null; };
export const peekPrefill = () => pending;
export const clearPrefill = () => { pending = null; };
