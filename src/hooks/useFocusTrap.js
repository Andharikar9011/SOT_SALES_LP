import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Focus trap for dialogs/menus: moves focus in, cycles Tab, handles Escape, restores focus on close.
export function useFocusTrap(ref, active, { onEscape, initialFocus } = {}) {
  const escRef = useRef(onEscape);
  useEffect(() => { escRef.current = onEscape; });

  useEffect(() => {
    if (!active) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    const opener = document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : document.querySelector('[data-focus-home]');

    const focusables = () => [...node.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[inert]') && !el.closest('[hidden]'));
    const target = (initialFocus && node.querySelector(initialFocus)) || focusables()[0] || node;
    if (target === node) node.tabIndex = -1;
    target.focus({ preventScroll: true });

    function onKey(e) {
      if (e.key === 'Escape') { escRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0];
      const last = f[f.length - 1];
      const inside = node.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (!inside || document.activeElement === last)) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, [active, ref, initialFocus]);
}
