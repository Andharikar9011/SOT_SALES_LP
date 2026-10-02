import { useEffect, useState } from 'react';
import { fill } from '../utils/text.js';
import Ph from './Ph.jsx';
import StageIndicator from './StageIndicator.jsx';
import { PauseIcon, PlayIcon, RotateLeft, RotateRight } from './icons.jsx';

const HINT_DELAY = 2000;

export default function HeroOverlay({ content, stage, drawerOpen, hasScene, paused, walking, onApply, onSelectStage, onRotate, onTogglePause }) {
  const { hero, header, ui } = content;
  const stages = hero.stages;
  const current = stages[stage];
  const [hintOn, setHintOn] = useState(false);

  // Hint appears after 2s idle at a stage and hides on any interaction
  useEffect(() => {
    setHintOn(false);
    if (drawerOpen || walking || stage >= stages.length - 1) return undefined;
    const t = setTimeout(() => setHintOn(true), HINT_DELAY);
    const hide = () => { clearTimeout(t); setHintOn(false); };
    document.addEventListener('pointerdown', hide, { once: true });
    document.addEventListener('keydown', hide, { once: true });
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', hide); document.removeEventListener('keydown', hide); };
  }, [stage, drawerOpen, walking, stages.length]);

  const hintAction = () => (stage === 0 ? onApply() : onSelectStage(stage + 1));

  return (
    <div className={`hero${drawerOpen ? ' hero--dim' : ''}`} inert={drawerOpen || undefined} aria-busy={walking || undefined}>
      <div className="hero__copy">
        <h1 className="hero__title">
          <span className="hero__line">{hero.headline}</span>{' '}
          <span className="hero__line hero__line--accent">{hero.subheadline}</span>
        </h1>
        <p className="hero__desc">{hero.description}</p>
        <button type="button" className="btn btn--primary hero__cta" onClick={onApply}>{header.cta.label}</button>
      </div>

      <div className="hero__controls" role="group" aria-label={ui.controlsLabel}>
        {hasScene && (
          <>
            <button type="button" className="icon-btn" aria-label={ui.rotateLeft} onClick={() => onRotate(-0.3)}><RotateLeft /></button>
            <button type="button" className="icon-btn" aria-label={ui.rotateRight} onClick={() => onRotate(0.3)}><RotateRight /></button>
            <button type="button" className="icon-btn" aria-pressed={paused} aria-label={paused ? ui.resumeMotion : ui.pauseMotion} onClick={onTogglePause}>
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
          </>
        )}
      </div>

      <div className="hero__bottom">
        {stage === stages.length - 1 && (
          <div className="placed-card" role="group" aria-label={ui.placedCardLabel}>
            <Ph as="p" className="placed-card__title" v={hero.placedCard.jobTitle} />
            <Ph as="p" className="placed-card__company" v={hero.placedCard.company} />
            <Ph as="p" className="placed-card__salary" v={hero.placedCard.salaryRange} />
          </div>
        )}
        <button type="button" className={`hint${hintOn ? ' hint--on' : ''}`} onClick={hintAction} hidden={stage >= stages.length - 1}>
          {stage === 0 ? ui.hintApply : ui.hintAdvance}
        </button>
        <p className="caption" aria-live="polite" aria-atomic="true">
          <span className="visually-hidden">{fill(ui.stageAnnounce, { n: stage + 1, total: stages.length, label: current.label })} </span>
          {current.caption}
        </p>
        <StageIndicator stages={stages} stage={stage} onSelect={onSelectStage} ui={ui} />
      </div>

    </div>
  );
}
