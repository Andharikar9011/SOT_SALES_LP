import SafeImage from './SafeImage.jsx';
import Ph from './Ph.jsx';

export default function Outcomes({ data, companies = [], mentors = [], ui, onSelectMentor, activeMentorId }) {
  const logos = data.showCompanyLogos ? companies.filter((c) => c && c.src) : [];
  return (
    <section className="section outcomes" id="outcomes" aria-labelledby="outcomes-h">
      <h2 id="outcomes-h">{data.heading}</h2>
      <Ph as="p" className="outcomes__note" v={data.note} />

      {logos.length > 0 && (
        <div className="companies">
          <Ph as="h3" className="companies__heading" v={ui.companiesHeading} />
          <ul className="companies__list">
            {logos.map((c) => (
              <li key={c.name} className="companies__item">
                <SafeImage className="companies__logo" src={c.src} alt={c.alt} fallback="text" label={c.name} width={160} height={48} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {mentors.length > 0 && (
        <div className="mentors">
          <h3 className="mentors__heading">{ui.mentorsHeading}</h3>
          <p className="mentors__hint">{ui.mentorsHint}</p>
          <ul className="mentors__list">
            {mentors.map((m) => (
              <li key={m.id}>
                <button type="button" className="mentor-chip" aria-haspopup="true" aria-expanded={activeMentorId === m.id}
                  onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSelectMentor(m.id, { x: r.left + r.width / 2, y: r.bottom }); }}>
                  <SafeImage className="mentor-chip__img" src={m.image} alt="" fallback="initials" label={m.name} width={40} height={40} />
                  <span className="mentor-chip__text">
                    <Ph className="mentor-chip__name" v={m.name} />
                    <span className="mentor-chip__title">{m.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
