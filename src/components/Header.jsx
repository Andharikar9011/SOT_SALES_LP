import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { useMounted } from '../hooks/useMounted.js';
import Logo from './Logo.jsx';
import { safeHref } from '../utils/text.js';
import { CloseIcon, MenuIcon } from './icons.jsx';

function NavItems({ items, onNavigate, className }) {
  return items.map((item) => (
    <li key={item.label}>
      {item.target ? (
        <a className={className} href={`#${item.target}`} onClick={(e) => { e.preventDefault(); onNavigate(item.target); }}>{item.label}</a>
      ) : (
        <a className={className} href={safeHref(item.href)}>{item.label}</a>
      )}
    </li>
  ));
}

export default function Header({ content, menuOpen, onMenu, onApply, onNavigate }) {
  const { header, images, site, ui } = content;
  const headerRef = useRef(null);
  const { mounted, visible } = useMounted(menuOpen, 300);
  useFocusTrap(headerRef, menuOpen, { onEscape: () => onMenu(false), initialFocus: '.menu a, .menu button' });

  const navigate = (target) => { onMenu(false); onNavigate(target); };

  return (
    <header className="header" ref={headerRef}>
      <div className="header__bar">
        <a className="header__logo" href="#main" aria-label={site.name}>
          <Logo className="header__logo-img" src={images.logo} label={site.name} />
        </a>
        <nav className="header__nav" aria-label={ui.navLabel}>
          <ul>
            <NavItems items={header.nav} onNavigate={onNavigate} className="header__link" />
          </ul>
        </nav>
        <div className="header__actions">
          <button type="button" className="btn btn--primary btn--compact" onClick={onApply} data-focus-home>{header.cta.label}</button>
          <button type="button" className="header__burger" aria-expanded={menuOpen} aria-controls="mobile-menu"
            aria-label={menuOpen ? ui.menuClose : ui.menuOpen} onClick={() => onMenu(!menuOpen)}>
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      {mounted && (
        <div id="mobile-menu" className={`menu${visible ? ' menu--open' : ''}`}>
          <nav aria-label={ui.mobileNavLabel}>
            <ul className="menu__list">
              <NavItems items={header.nav} onNavigate={navigate} className="menu__link" />
            </ul>
          </nav>
          <button type="button" className="btn btn--primary menu__cta" onClick={onApply}>{header.cta.label}</button>
        </div>
      )}
    </header>
  );
}
