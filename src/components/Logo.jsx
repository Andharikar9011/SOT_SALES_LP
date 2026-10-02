import { useEffect, useState } from 'react';
import SafeImage from './SafeImage.jsx';

// Theme-aware logo. An <img> cannot inherit currentColor or CSS variables, so for same-origin .svg URLs
// the markup is fetched once, sanitised and inlined (colors in the file may use currentColor / var(--color-*)).
// Anything else (external URL, PNG, fetch failure, unsafe markup) falls back to a plain <img>, then to the site-name text.
const cache = new Map(); // url -> Promise<string | null>

function isSameOriginSvg(src) {
  try {
    const u = new URL(src, window.location.href);
    return u.origin === window.location.origin && /\.svg$/i.test(u.pathname);
  } catch { return false; }
}

function sanitize(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;
  svg.querySelectorAll('script, foreignObject, iframe, object, embed, style[media], animate, set').forEach((n) => n.remove());
  svg.querySelectorAll('style').forEach((n) => { if (/@import|url\(/i.test(n.textContent)) n.remove(); });
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const at of [...el.attributes]) {
      const name = at.name.toLowerCase();
      const val = at.value.trim().toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(at.name);
      else if ((name === 'href' || name === 'xlink:href') && !val.startsWith('#')) el.removeAttribute(at.name);
      else if (val.includes('javascript:') || /url\(\s*['"]?\s*(https?:|data:)/.test(val)) el.removeAttribute(at.name);
    }
  }
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('role');
  svg.removeAttribute('aria-label');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg.outerHTML;
}

function loadSvg(src) {
  if (!cache.has(src)) {
    cache.set(src, fetch(src).then((r) => (r.ok ? r.text() : null)).then((t) => (t ? sanitize(t) : null)).catch(() => null));
  }
  return cache.get(src);
}

// Decorative (aria-hidden): the parent link/heading provides the accessible name.
export default function Logo({ src, className = '', label = '', loading = 'eager' }) {
  const inline = !!src && isSameOriginSvg(src);
  const [markup, setMarkup] = useState(undefined); // undefined = pending, null = failed
  useEffect(() => {
    if (!inline) return undefined;
    let live = true;
    setMarkup(undefined);
    loadSvg(src).then((m) => { if (live) setMarkup(m); });
    return () => { live = false; };
  }, [src, inline]);

  if (inline && markup) {
    return <span className={`${className} logo-inline`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
  }
  if (inline && markup === undefined) return <span className={`${className} logo-inline logo-inline--pending`} aria-hidden="true" />;
  return <SafeImage className={className} src={src} alt="" fallback="text" label={label} loading={loading} />;
}
