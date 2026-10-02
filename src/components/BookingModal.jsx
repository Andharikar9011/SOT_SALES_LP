import { useEffect, useRef, useState } from 'react';
import { fill } from '../utils/text.js';
import {
  validateCalendlyUrl, buildEmbedUrl, loadCalendly, parseCalendlyMessage, peekPrefill, clearPrefill, LOAD_TIMEOUT_MS, AUTO_CLOSE_SECONDS
} from '../integrations/calendly.js';
import { track } from '../integrations/analytics.js';
import Modal from './Modal.jsx';
import { CheckIcon, ErrorIcon } from './icons.jsx';

function BookingBody({ content, onClose: closeModal }) {
  const { booking, ui } = content;
  const b = ui.booking;
  const valid = validateCalendlyUrl(booking.calendlyUrl);
  // 'unconfigured' = placeholder/empty; 'error' (also for non-calendly URLs) shows the generic error
  const initial = valid.ok ? 'loading' : (valid.reason === 'placeholder' || valid.reason === 'empty' ? 'unconfigured' : 'error');
  const hostRef = useRef(null);
  const [status, setStatus] = useState(initial); // loading | ready | error | unconfigured
  const [confirmed, setConfirmed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_CLOSE_SECONDS);
  const [keepOpen, setKeepOpen] = useState(false);
  const url = valid.ok ? valid.url.href : null;

  const onClose = () => { clearPrefill(); closeModal(); };

  useEffect(() => { track('booking_open'); }, []);

  useEffect(() => {
    if (!url) return undefined;
    let cancelled = false;
    const host = hostRef.current;
    const embed = buildEmbedUrl(url, content.theme?.colors, { prefill: booking.prefill === true, values: peekPrefill() });
    loadCalendly(LOAD_TIMEOUT_MS)
      .then((Calendly) => {
        if (cancelled || !host) return;
        Calendly.initInlineWidget({ url: embed, parentElement: host });
        const mo = new MutationObserver(() => {
          const frame = host.querySelector('iframe');
          if (frame) {
            frame.setAttribute('title', b.frameLabel);
            frame.addEventListener('load', () => !cancelled && setStatus((s) => (s === 'loading' ? 'ready' : s)), { once: true });
            mo.disconnect();
          }
        });
        mo.observe(host, { childList: true, subtree: true });
        host.__mo = mo;
      })
      .catch(() => { if (!cancelled) setStatus((s) => (s === 'loading' ? 'error' : s)); });
    // iframe load can be slow even when the script loaded: hard cap at the same timeout
    const timeout = setTimeout(() => { if (!cancelled) setStatus((s) => (s === 'loading' ? 'error' : s)); }, LOAD_TIMEOUT_MS);
    return () => { cancelled = true; clearTimeout(timeout); host?.__mo?.disconnect(); host?.replaceChildren(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, b.frameLabel]);

  // Calendly postMessage events (origin verified in parseCalendlyMessage)
  useEffect(() => {
    if (!url) return undefined;
    const onMsg = (e) => {
      const ev = parseCalendlyMessage(e);
      if (!ev) return;
      setStatus((s) => (s === 'loading' ? 'ready' : s));
      if (ev === 'calendly.event_scheduled') { setConfirmed(true); track('booking_complete'); }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [url]);

  // After confirmation: visible countdown, then close. Any interaction cancels the auto-close.
  useEffect(() => {
    if (!confirmed || keepOpen) return undefined;
    const t = setInterval(() => setSecondsLeft((n) => n - 1), 1000);
    const cancel = () => setKeepOpen(true);
    const panel = hostRef.current?.closest('.modal__panel') || document;
    panel.addEventListener('pointerdown', cancel);
    panel.addEventListener('keydown', cancel);
    return () => { clearInterval(t); panel.removeEventListener('pointerdown', cancel); panel.removeEventListener('keydown', cancel); };
  }, [confirmed, keepOpen]);
  useEffect(() => { if (confirmed && !keepOpen && secondsLeft <= 0) onClose(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [confirmed, keepOpen, secondsLeft]);
  useEffect(() => () => clearPrefill(), []);

  const mailto = booking.fallbackEmail ? `mailto:${booking.fallbackEmail}` : null;
  const problem = status === 'unconfigured' || status === 'error';

  return (
    <div className="booking">
      <h2 id="booking-title" className="modal__title">{booking.title}</h2>
      <p className="modal__subtitle">{booking.subtitle}</p>

      <div className="booking__live" role="status" aria-live="polite">
        {confirmed && (
          <div className="booking__confirm">
            <CheckIcon width={24} height={24} />
            <div>
              <p className="booking__confirm-title">{b.confirmed}</p>
              <p>{keepOpen ? (b.keepOpen || 'This window will stay open until you close it.') : b.confirmedNote}</p>
              {!keepOpen && (
                <p className="booking__countdown" aria-hidden="true">
                  {fill(b.closingIn || 'Closing in {n}s. Tap or press a key to keep this open.', { n: Math.max(secondsLeft, 0) })}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {problem && (
        <div className="booking__problem" role="alert">
          <ErrorIcon width={24} height={24} />
          <div>
            <p>{status === 'unconfigured' ? b.notConfigured : b.error}</p>
            {mailto && <p><a className="btn btn--secondary booking__mail" href={mailto}>{b.emailUs}</a></p>}
          </div>
        </div>
      )}

      {!problem && (
        <div className={`booking__stage${confirmed ? ' booking__stage--done' : ''}`}>
          {status === 'loading' && (
            <div className="skeleton booking__skeleton" role="status" aria-label={b.loading}>
              <span className="visually-hidden">{b.loading}</span>
            </div>
          )}
          <div ref={hostRef} className="booking__widget" />
        </div>
      )}

      {status !== 'error' && status !== 'unconfigured' && <p className="booking__foot">{booking.footnote}</p>}
      <div className="form__actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>{b.close}</button>
      </div>
    </div>
  );
}

export default function BookingModal({ open, onClose, content }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="booking-title" closeLabel={content.ui.close} variant="booking" closeOnBackdrop>
      <BookingBody content={content} onClose={onClose} />
    </Modal>
  );
}
