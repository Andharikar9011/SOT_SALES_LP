import { useEffect, useRef, useState } from 'react';
import { CheckIcon } from './icons.jsx';

// Bottom-center status toast. 4s auto-dismiss, paused on hover/focus.
export default function Toast({ toast, onDismiss, dismissLabel }) {
  const [paused, setPaused] = useState(false);
  const timer = useRef(0);
  useEffect(() => {
    if (!toast || paused) return undefined;
    timer.current = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer.current);
  }, [toast, paused, onDismiss]);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
          <CheckIcon className="toast__icon" width={20} height={20} />
          <span>{toast.message}</span>
          <button type="button" className="toast__close" onClick={onDismiss} aria-label={dismissLabel}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
    </div>
  );
}
