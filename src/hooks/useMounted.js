import { useEffect, useState } from 'react';

// Keeps a component mounted while its exit animation runs.
// mounted: render it; visible: apply the "open" class (enter/exit transitions).
export function useMounted(open, exitMs = 200) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);
  return { mounted: mounted || open, visible };
}
