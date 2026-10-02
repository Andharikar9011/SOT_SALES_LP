import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useMounted } from '../hooks/useMounted.js';
import { CloseIcon } from './icons.jsx';

// Shared dialog shell (WAI-ARIA dialog pattern): backdrop, focus trap, Escape, return focus, exit animation.
export default function Modal({ open, onClose, labelledBy, closeLabel, variant = 'form', closeOnBackdrop = false, initialFocus, children }) {
  const { mounted, visible } = useMounted(open, 150);
  const panelRef = useRef(null);
  useFocusTrap(panelRef, open, { onEscape: onClose, initialFocus });
  if (!mounted) return null;
  return (
    <div className={`modal modal--${variant}${visible ? ' modal--open' : ''}`}>
      <div className="modal__backdrop" onClick={closeOnBackdrop ? onClose : undefined} aria-hidden="true" />
      <div className="modal__panel" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panelRef}>
        <button type="button" className="icon-btn modal__close" onClick={onClose} aria-label={closeLabel}><CloseIcon /></button>
        {children}
      </div>
    </div>
  );
}
