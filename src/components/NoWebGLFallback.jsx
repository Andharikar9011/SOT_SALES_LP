import { fill } from '../utils/text.js';
import Ph from './Ph.jsx';

// Static hero used when WebGL is unavailable or the scene crashes. The conversion path never breaks.
export default function NoWebGLFallback({ content, onApply }) {
  const { hero, header, ui } = content;
  return (
    <div className="static-hero">
      <div className="static-hero__inner">
        <h1 className="hero__title">
          <span className="hero__line">{hero.headline}</span>{' '}
          <span className="hero__line hero__line--accent">{hero.subheadline}</span>
        </h1>
        <p className="hero__desc static-hero__desc">{hero.description}</p>
        <button type="button" className="btn btn--primary" onClick={onApply}>{header.cta.label}</button>
        <section aria-label={ui.fallback.stagesLabel}>
          <ol className="static-hero__stages">
            {hero.stages.map((s, i) => (
              <li key={s.id} className="stage-card">
                <span className="stage-card__num">{fill(ui.fallback.stepLabel, { n: i + 1 })}</span>
                <h2 className="stage-card__title">{s.label}</h2>
                <p className="stage-card__text">{s.caption}</p>
                {i === hero.stages.length - 1 && (
                  <p className="stage-card__placed">
                    <Ph v={hero.placedCard.jobTitle} /> · <Ph v={hero.placedCard.company} />
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
