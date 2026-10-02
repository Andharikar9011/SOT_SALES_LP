import { useEffect, useRef } from 'react';
import { CloseIcon } from './icons.jsx';
import ProblemFraming from './ProblemFraming.jsx';
import ValueProps from './ValueProps.jsx';
import Timeline from './Timeline.jsx';
import Outcomes from './Outcomes.jsx';
import Fees from './Fees.jsx';
import FAQ from './FAQ.jsx';
import Footer from './Footer.jsx';

const SWIPE_CLOSE_PX = 80;

// Bottom sheet holding the proof content. Closed = inert + translated off-screen.
export default function Drawer({ content, open, onClose, onApply, onBook, onNavigate, onSelectMentor, activeMentorId, reducedMotion }) {
  const { ui } = content;
  const panelRef = useRef(null);
  const drag = useRef(null);

  // Focus the panel when it opens (App moves focus back to the FAB before closing)
  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('button')) return;
    drag.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    panelRef.current.style.transition = 'none';
  };
  const onMove = (e) => {
    if (drag.current === null) return;
    const dy = Math.max(0, e.clientY - drag.current);
    panelRef.current.style.transform = `translateY(${dy}px)`;
  };
  const end = (e) => {
    if (drag.current === null) return;
    const dy = e.clientY - drag.current;
    drag.current = null;
    const panel = panelRef.current;
    panel.style.transition = '';
    panel.style.transform = '';
    // A cancelled gesture (system took the touch) snaps back; only a finished swipe past the threshold closes.
    if (e.type === 'pointerup' && dy > SWIPE_CLOSE_PX) onClose();
  };

  return (
    <section id="drawer" ref={panelRef} tabIndex={-1} className={`drawer${open ? ' drawer--open' : ''}`}
      aria-label={ui.drawerLabel} inert={!open || undefined}>
      <div className="drawer__top" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end}>
        <span className="drawer__handle" aria-hidden="true" title={ui.drawerHandle} />
        <button type="button" className="icon-btn drawer__close" onClick={onClose} aria-label={ui.close}><CloseIcon /></button>
      </div>
      <div className="drawer__scroll">
        <div className="drawer__content">
          <ProblemFraming data={content.problemFraming} onApply={onApply} ctaLabel={content.header.cta.label} />
          <ValueProps items={content.valueProps} label={ui.statsLabel} reducedMotion={reducedMotion} />
          <Timeline data={content.timeline} cohortColors={content.theme.scene.cohortColors} ui={ui} reducedMotion={reducedMotion} />
          <Outcomes data={content.outcomes} companies={content.images.companies} mentors={content.mentors} ui={ui}
            onSelectMentor={onSelectMentor} activeMentorId={activeMentorId} />
          <Fees data={content.fees} onTalk={onBook} />
          <FAQ heading={content.faqHeading} items={content.faq} />
          <Footer data={content.footer} ui={ui} onNavigate={onNavigate} />
        </div>
      </div>
    </section>
  );
}
