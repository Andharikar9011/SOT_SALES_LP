import { useEffect, useRef, useState } from 'react';

// Once-only IntersectionObserver. Returns [ref, seen].
export function useInView({ threshold = 0.5, rootMargin = '0px' } = {}) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); }
    }, { threshold, rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold, rootMargin]);
  return [ref, seen];
}
