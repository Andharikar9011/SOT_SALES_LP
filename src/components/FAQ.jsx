import { useId, useState } from 'react';
import Ph from './Ph.jsx';
import { track } from '../integrations/analytics.js';
import { ChevronDown } from './icons.jsx';

// WAI-ARIA accordion; multiple items may be open. Height animates via grid-template-rows 0fr -> 1fr.
export default function FAQ({ heading, items }) {
  const base = useId();
  const [open, setOpen] = useState(() => new Set());
  if (!items?.length) return null;
  const toggle = (i) => {
    track('faq_toggle', { index: i, open: !open.has(i) });
    setOpen((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  };
  return (
    <section className="section faq" id="faq" aria-labelledby="faq-h">
      <h2 id="faq-h">{heading}</h2>
      <div className="faq__list">
        {items.map((it, i) => {
          const isOpen = open.has(i);
          const bid = `${base}-b${i}`;
          const pid = `${base}-p${i}`;
          return (
            <div key={it.question} className={`faq__item${isOpen ? ' faq__item--open' : ''}`}>
              <h3 className="faq__q">
                <button type="button" id={bid} className="faq__btn" aria-expanded={isOpen} aria-controls={pid} onClick={() => toggle(i)}>
                  <span>{it.question}</span>
                  <ChevronDown className="faq__chevron" />
                </button>
              </h3>
              <div className="faq__panel" id={pid} role="region" aria-labelledby={bid} inert={!isOpen || undefined}>
                <div className="faq__panel-inner">
                  <Ph as="p" className="faq__a" v={it.answer} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
