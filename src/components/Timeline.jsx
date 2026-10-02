import { useEffect, useRef, useState } from 'react';

// Vertical (mobile) / horizontal (desktop) 4-phase timeline. Items reveal on scroll with an 80ms stagger.
export default function Timeline({ data, cohortColors = [], ui, reducedMotion }) {
  const listRef = useRef(null);
  const [revealed, setRevealed] = useState(() => new Set());

  useEffect(() => {
    const items = [...listRef.current.querySelectorAll('[data-phase]')];
    if (reducedMotion || typeof IntersectionObserver === 'undefined') { setRevealed(new Set(items.map((_, i) => i))); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const i = Number(e.target.dataset.phase);
          setRevealed((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [reducedMotion]);

  const total = data.phases.length;
  const progress = revealed.size / total;

  return (
    <section className="section timeline" id="curriculum" aria-labelledby="timeline-h">
      <h2 id="timeline-h">{data.heading}</h2>
      <div className="timeline__body">
      <div className="timeline__track" aria-hidden="true">
        <div className="timeline__fill" style={{ '--progress': progress }} />
      </div>
      <ol className="timeline__list" ref={listRef}>
        {data.phases.map((p, i) => (
          <li key={p.name} data-phase={i} className={`phase${revealed.has(i) ? ' phase--in' : ''}`}
            style={{ '--phase-color': cohortColors[i % (cohortColors.length || 1)], '--i': i }}>
            <span className="phase__num" aria-hidden="true">{i + 1}</span>
            <h3 className="phase__name"><span className="visually-hidden">{ui.phaseLabel} {i + 1}: </span>{p.name}</h3>
            <p className="phase__weeks">{ui.weeksLabel} {p.weeks}</p>
            <ul className="phase__modules" aria-label={ui.modulesLabel}>
              {p.modules.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </li>
        ))}
      </ol>
      </div>
    </section>
  );
}
