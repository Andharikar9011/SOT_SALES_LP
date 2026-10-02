import { useEffect, useState } from 'react';
import { useInView } from '../hooks/useInView.js';

const NUMERIC = /^(\d+)(\+?)$/;
const easeOut = (t) => 1 - (1 - t) ** 3;

// Stat tile: numeric values count up once when 50% in view; text values fade in.
export default function StatTile({ stat, reducedMotion, duration = 1000 }) {
  const { value, unit, label } = stat;
  const match = NUMERIC.exec(String(value).trim());
  const target = match ? parseInt(match[1], 10) : null;
  const suffix = match ? match[2] : '';
  const [ref, seen] = useInView({ threshold: 0.5 });
  const [shown, setShown] = useState(target);

  useEffect(() => {
    if (target === null || !seen || reducedMotion) { setShown(target); return undefined; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      setShown(Math.round(easeOut(p) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, target, reducedMotion, duration]);

  const finalText = `${value}${unit ? ` ${unit}` : ''} ${label}`;
  const text = target === null ? value : `${shown ?? target}${suffix}`;
  const visible = target !== null || seen || reducedMotion;

  return (
    <li className={`stat${visible ? ' stat--in' : ''}${target === null ? ' stat--text' : ''}`} ref={ref}>
      <p className="stat__value" aria-hidden="true">
        <span className="stat__num">{text}</span>
        {unit && <span className="stat__unit">{unit}</span>}
      </p>
      <p className="stat__label" aria-hidden="true">{label}</p>
      <span className="visually-hidden">{finalText}</span>
    </li>
  );
}
