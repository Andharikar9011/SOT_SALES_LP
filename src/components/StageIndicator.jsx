import { fill } from '../utils/text.js';
import { CheckIcon } from './icons.jsx';

// Three steps (Apply / Learn / Placed). Each is a real button that jumps to that stage.
export default function StageIndicator({ stages, stage, onSelect, ui }) {
  return (
    <nav className="stages" aria-label={ui.stageIndicatorLabel}>
      <ol className="stages__list">
        {stages.map((s, i) => {
          const state = i < stage ? 'done' : i === stage ? 'current' : 'upcoming';
          return (
            <li key={s.id} className="stages__item">
              <button type="button" className={`stages__btn stages__btn--${state}`}
                aria-current={i === stage ? 'step' : undefined}
                aria-label={fill(ui.stageButton, { n: i + 1, label: s.label })}
                onClick={() => onSelect(i)}>
                <span className="stages__num" aria-hidden="true">
                  {state === 'done' ? <CheckIcon width={16} height={16} /> : i + 1}
                </span>
                <span className="stages__label" aria-hidden="true">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
