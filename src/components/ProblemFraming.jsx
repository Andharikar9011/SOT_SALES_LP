import { NamedIcon } from './icons.jsx';

export default function ProblemFraming({ data, onApply, ctaLabel }) {
  return (
    <section className="section problem" id="program" aria-labelledby="problem-h">
      <NamedIcon name={data.icon} className="problem__icon" width={48} height={48} />
      <h2 id="problem-h" className="problem__title">
        {data.heading} <span className="problem__sub">{data.subheading}</span>
      </h2>
      <p className="problem__narrative">{data.narrative}</p>
      <p className="problem__stat">{data.stat}</p>
      <button type="button" className="btn btn--primary problem__cta" onClick={onApply} aria-label={`${data.cta} ${ctaLabel}`}>{data.cta}</button>
    </section>
  );
}
