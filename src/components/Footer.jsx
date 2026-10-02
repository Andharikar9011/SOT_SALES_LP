import { safeHref } from '../utils/text.js';
import { useId } from 'react';

function FooterLinks({ items = [], onNavigate }) {
  return items.map((l) => (
    <li key={l.label}>
      {l.target ? (
        <a className="footer__link" href={`#${l.target}`} onClick={(e) => { e.preventDefault(); onNavigate(l.target); }}>{l.label}</a>
      ) : (
        <a className="footer__link" href={safeHref(l.href)}>{l.label}</a>
      )}
    </li>
  ));
}

export default function Footer({ data, ui, onNavigate }) {
  const id = useId();
  const social = (data.social || []).filter((s) => s.href);
  const { contact } = data;
  return (
    <footer className="footer">
      <div className="footer__cols">
        <nav aria-labelledby={`${id}-c`}>
          <h2 className="footer__h" id={`${id}-c`}>{ui.footerCompany}</h2>
          <ul><FooterLinks items={data.links.company} onNavigate={onNavigate} /></ul>
        </nav>
        <nav aria-labelledby={`${id}-l`}>
          <h2 className="footer__h" id={`${id}-l`}>{ui.footerLegal}</h2>
          <ul><FooterLinks items={data.links.legal} onNavigate={onNavigate} /></ul>
        </nav>
        <div>
          <h2 className="footer__h">{ui.footerContact}</h2>
          <ul>
            {contact.email && <li><a className="footer__link" href={safeHref(`mailto:${contact.email}`)}>{contact.email}</a></li>}
            {contact.hireEmail && <li><a className="footer__link" href={safeHref(`mailto:${contact.hireEmail}`)}>{contact.hireEmail}</a></li>}
          </ul>
          {social.length > 0 && (
            <ul className="footer__social" aria-label={ui.footerSocial}>
              {social.map((s) => <li key={s.label}><a className="footer__link" href={safeHref(s.href)} rel="noopener noreferrer" target="_blank">{s.label}</a></li>)}
            </ul>
          )}
        </div>
      </div>
      <p className="footer__copy">{data.copyright}</p>
    </footer>
  );
}
