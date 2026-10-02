import { ChevronUp } from './icons.jsx';

// "Know More" floating action button; toggles the drawer.
export default function Fab({ label, open, onToggle, openLabel, closeLabel }) {
  return (
    <button type="button" data-fab="" className={`fab${open ? ' fab--open' : ''}`} onClick={onToggle}
      aria-expanded={open} aria-controls="drawer" aria-label={`${label}. ${open ? closeLabel : openLabel}`}>
      <span className="fab__label" aria-hidden="true">{label}</span>
      <ChevronUp className="fab__icon" />
    </button>
  );
}
