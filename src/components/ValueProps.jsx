import StatTile from './StatTile.jsx';

export default function ValueProps({ items, label, reducedMotion }) {
  if (!items?.length) return null;
  return (
    <section className="section" aria-label={label}>
      <ul className="stats">
        {items.map((s) => <StatTile key={`${s.value}-${s.label}`} stat={s} reducedMotion={reducedMotion} />)}
      </ul>
    </section>
  );
}
