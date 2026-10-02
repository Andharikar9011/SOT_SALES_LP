import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import SafeImage from './SafeImage.jsx';
import Ph from './Ph.jsx';
import { CloseIcon } from './icons.jsx';

// 2D overlay near a mentor in the scene (or beneath the list button). Opens on tap/click, closes on tap-out or Escape.
export default function MentorCard({ mentor, pos, ui, onClose }) {
  const ref = useRef(null);
  const [place, setPlace] = useState({ left: 0, top: 0, ready: false });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !mentor) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth; const vh = window.innerHeight;
    const m = 8;
    const x = pos?.x ?? vw / 2;
    const y = pos?.y ?? vh / 2;
    const left = Math.min(Math.max(x - width / 2, m), vw - width - m);
    let top = y + 16;
    if (top + height > vh - m) top = Math.max(m, y - height - 16);
    setPlace({ left, top, ready: true });
  }, [mentor, pos]);

  useEffect(() => {
    if (!mentor) return undefined;
    const onDown = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (e.target.closest?.('.mentor-chip')) return;
      onClose();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [mentor, onClose]);

  if (!mentor) return null;
  return (
    <div className={`mentor-card${place.ready ? ' mentor-card--in' : ''}`} ref={ref} role="group" aria-label={`${ui.mentorCardLabel}: ${mentor.name}`}
      style={{ left: place.left, top: place.top }}>
      <button type="button" className="icon-btn mentor-card__close" onClick={onClose} aria-label={ui.close}><CloseIcon width={20} height={20} /></button>
      <SafeImage className="mentor-card__photo" src={mentor.image} alt={mentor.imageAlt || ''} fallback="initials" label={mentor.name} width={96} height={96} loading="eager" />
      <div className="mentor-card__body">
        <Ph as="h3" className="mentor-card__name" v={mentor.name} />
        <p className="mentor-card__role">{mentor.title} <Ph v={`@ ${mentor.company}`} /></p>
        <Ph as="p" className="mentor-card__bio" v={mentor.bio} />
        {mentor.teaches?.length > 0 && <p className="mentor-card__meta"><strong>{ui.teachesLabel}:</strong> {mentor.teaches.join(', ')}</p>}
        {mentor.schedule && <p className="mentor-card__meta"><strong>{ui.scheduleLabel}:</strong> <Ph v={mentor.schedule} /></p>}
      </div>
    </div>
  );
}
