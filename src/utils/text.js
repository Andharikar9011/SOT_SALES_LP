// Substitute {token} placeholders in interface strings from content.json
export function fill(template = '', vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}
export const isPlaceholder = (v) => typeof v === 'string' && v.includes('[PLACEHOLDER]');
export function initials(name = '') {
  const clean = name.replace(/\[PLACEHOLDER\]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
export function isMobileDevice() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
}

// Allow-list for hrefs that come from content.json: only http(s), mailto, tel, same-page "#x" and site-relative paths.
// Anything else (javascript:, data:, vbscript:, protocol-relative "//host") returns '#'.
export function safeHref(raw) {
  if (typeof raw !== 'string') return '#';
  const s = raw.trim();
  if (!s) return '#';
  // browsers strip tabs/newlines/control chars inside schemes, so test against the stripped form
  // eslint-disable-next-line no-control-regex
  const flat = s.replace(/[\u0000-\u001f\u007f\s]/g, '');
  if (/^(https?:|mailto:|tel:)/i.test(flat)) return s;
  if (flat.startsWith('#') || (flat.startsWith('/') && !flat.startsWith('//') && !flat.startsWith('/\\'))) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(flat) || flat.startsWith('//') || flat.startsWith('\\') || flat.startsWith('/\\')) return '#';
  return s; // relative path like "privacy.html"
}
