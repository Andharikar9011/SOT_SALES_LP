// applyTheme: writes content.theme to :root CSS variables (see design-system/css-variables-guide.md)
const camel2kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

export function applyTheme({ colors, scene }) {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(colors)) root.setProperty(`--color-${camel2kebab(k)}`, v);
  root.setProperty('--color-focus-ring', colors.primaryText);
  root.setProperty('--color-scene-background', scene.sceneBackground);
  if (import.meta.env.DEV) warnOnLowContrast(colors);
}

// Dev-only WCAG check (mirrors design-system/contrast-check.mjs); tree-shaken from production.
function warnOnLowContrast(c) {
  const lum = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255]
      .map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pairs = [['text', 'background', 4.5], ['text', 'surface', 4.5], ['textMuted', 'background', 4.5], ['textMuted', 'surface', 4.5],
    ['onPrimary', 'primary', 4.5], ['onAccent', 'accent', 4.5], ['accent', 'background', 3], ['primaryText', 'background', 4.5],
    ['error', 'surface', 4.5], ['success', 'surface', 4.5], ['border', 'background', 3]];
  for (const [fg, bg, min] of pairs) {
    if (!/^#[0-9a-f]{6}$/i.test(c[fg] || '') || !/^#[0-9a-f]{6}$/i.test(c[bg] || '')) continue;
    const r = ratio(c[fg], c[bg]);
    if (r < min) console.warn(`[theme] contrast ${fg} on ${bg} is ${r.toFixed(2)} (needs ${min})`);
  }
}

// Runtime <head> metadata from content.json
export function applyMeta(content) {
  const { site } = content;
  if (site.language) document.documentElement.lang = site.language;
  if (site.title) document.title = site.title;
  const set = (sel, attr, val, create) => {
    if (!val) return;
    let el = document.head.querySelector(sel);
    if (!el && create) { el = document.createElement(create.tag); Object.entries(create.attrs).forEach(([k, v]) => el.setAttribute(k, v)); document.head.appendChild(el); }
    if (el) el.setAttribute(attr, val);
  };
  set('meta[name="description"]', 'content', site.description);
  set('meta[property="og:title"]', 'content', site.title);
  set('meta[property="og:description"]', 'content', site.description);
  set('meta[property="og:image"]', 'content', site.ogImage);
}
