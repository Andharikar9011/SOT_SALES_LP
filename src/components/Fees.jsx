import Ph from './Ph.jsx';

export default function Fees({ data, onTalk }) {
  return (
    <section className="section fees" id="fees" aria-labelledby="fees-h">
      <h2 id="fees-h">{data.heading}</h2>
      <Ph as="p" className="fees__amount" v={data.amount} />
      <Ph as="p" className="fees__note" v={data.note} />
      <button type="button" className="btn btn--secondary" onClick={onTalk}>{data.cta}</button>
    </section>
  );
}
