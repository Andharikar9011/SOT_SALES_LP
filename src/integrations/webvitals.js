// Minimal Core Web Vitals (LCP, CLS, INP) via PerformanceObserver, no dependency (~1KB gz).
// Approximations: INP = worst interaction (fine for a low-interaction page), CLS = max session window.
const RATE = { LCP: [2500, 4000], CLS: [0.1, 0.25], INP: [200, 500] };
const rate = (n, v) => (v <= RATE[n][0] ? 'good' : v <= RATE[n][1] ? 'needs-improvement' : 'poor');

export function startWebVitals(report) {
  if (typeof PerformanceObserver === 'undefined' || typeof document === 'undefined') return;
  let lcp = 0, cls = 0, sessionValue = 0, sessionEntries = [], inp = 0, sent = false;
  const observe = (type, cb, extra = {}) => {
    try { new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra }); } catch { /* unsupported */ }
  };
  observe('largest-contentful-paint', (e) => { lcp = e.startTime; });
  observe('layout-shift', (e) => {
    if (e.hadRecentInput) return;
    const first = sessionEntries[0], last = sessionEntries[sessionEntries.length - 1];
    if (last && e.startTime - last.startTime < 1000 && e.startTime - first.startTime < 5000) { sessionValue += e.value; sessionEntries.push(e); }
    else { sessionValue = e.value; sessionEntries = [e]; }
    cls = Math.max(cls, sessionValue);
  });
  observe('event', (e) => { if (e.interactionId) inp = Math.max(inp, e.duration); }, { durationThreshold: 40 });
  const flush = () => {
    if (document.visibilityState !== 'hidden' || sent) return;
    sent = true;
    const out = { LCP: lcp, CLS: cls, INP: inp };
    Object.entries(out).forEach(([n, v]) => { if (v > 0 || n === 'CLS') report('web_vital', { metric: n, value: n === 'CLS' ? +v.toFixed(3) : Math.round(v), rating: rate(n, v) }); });
  };
  document.addEventListener('visibilitychange', flush);
}
