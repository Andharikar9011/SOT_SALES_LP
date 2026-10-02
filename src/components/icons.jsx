// Inline SVG icons (use currentColor, decorative by default)
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' };
export const ChevronUp = (p) => <svg {...base} {...p}><path d="M6 15l6-6 6 6" /></svg>;
export const ChevronDown = (p) => <svg {...base} {...p}><path d="M6 9l6 6 6-6" /></svg>;
export const CloseIcon = (p) => <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const MenuIcon = (p) => <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const CheckIcon = (p) => <svg {...base} strokeWidth={3} {...p}><path d="M5 12l5 5 9-10" /></svg>;
export const ErrorIcon = (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.01" /></svg>;
export const RotateLeft = (p) => <svg {...base} {...p}><path d="M4 12a8 8 0 1 0 3-6.2" /><path d="M4 4v5h5" /></svg>;
export const RotateRight = (p) => <svg {...base} {...p}><path d="M20 12a8 8 0 1 1-3-6.2" /><path d="M20 4v5h-5" /></svg>;
export const PauseIcon = (p) => <svg {...base} {...p}><path d="M9 6v12M15 6v12" /></svg>;
export const PlayIcon = (p) => <svg {...base} {...p}><path d="M8 5l11 7-11 7z" /></svg>;
export const InfoIcon = (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></svg>;
export const RejectionLetter = (p) => <svg {...base} strokeWidth={1.75} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /><path d="M15 15l4 4M19 15l-4 4" /></svg>;

const named = { 'rejection-letter': RejectionLetter, info: InfoIcon };
export const NamedIcon = ({ name, ...p }) => { const C = named[name] || InfoIcon; return <C {...p} />; };
