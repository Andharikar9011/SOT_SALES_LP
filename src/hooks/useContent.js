import { useEffect, useState } from 'react';

// Fetches /data/content.json at runtime (single source of copy, colors, images, URLs)
export function useContent() {
  const [state, setState] = useState({ content: null, error: null });
  useEffect(() => {
    const ac = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/content.json`, { signal: ac.signal, cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      // Prefix root-relative asset paths ("/images/...") with the deploy base (e.g. GitHub Pages subpath)
      .then((text) => JSON.parse(text, (_k, v) => (typeof v === 'string' && v.startsWith('/images/') ? import.meta.env.BASE_URL + v.slice(1) : v)))
      .then((content) => setState({ content, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ content: null, error }); });
    return () => ac.abort();
  }, []);
  return state;
}
