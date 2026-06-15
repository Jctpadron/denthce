import React, { useEffect, useState } from 'react';
import { Menu, X, LogIn } from 'lucide-react';
import { DentaCloudLogo, NAV_LINKS } from './content';

interface LandingNavProps {
  onLogin: () => void;
}

/** Barra superior sticky: logo + anclas + "Iniciar sesión". Drawer en mobile.
 *  El CTA "Solicitar demo" NO va acá (vive en hero, sección final y footer). */
export const LandingNav: React.FC<LandingNavProps> = ({ onLogin }) => {
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goAnchor = (href: string) => {
    setDrawer(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className={`landing-nav${scrolled ? ' is-scrolled' : ''}`} aria-label="Navegación principal">
      <div className="landing-container landing-nav__inner">
        <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="Denta Cloud — inicio">
          <DentaCloudLogo iconSize="2.4rem" />
        </a>

        <div className="landing-nav__links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} className="landing-nav__link" href={l.href} onClick={(e) => { e.preventDefault(); goAnchor(l.href); }}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="landing-nav__actions">
          <button type="button" className="landing-btn-secondary landing-nav__login-text" onClick={onLogin}>
            <LogIn size={18} aria-hidden="true" /> Iniciar sesión
          </button>
          <button
            type="button"
            className="landing-nav__burger"
            aria-label={drawer ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={drawer}
            onClick={() => setDrawer((d) => !d)}
          >
            {drawer ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {drawer && (
        <div className="landing-drawer">
          {NAV_LINKS.map((l) => (
            <a key={l.href} className="landing-nav__link" href={l.href} onClick={(e) => { e.preventDefault(); goAnchor(l.href); }}>
              {l.label}
            </a>
          ))}
          <button type="button" className="landing-btn-secondary" onClick={() => { setDrawer(false); onLogin(); }}>
            <LogIn size={18} aria-hidden="true" /> Iniciar sesión
          </button>
        </div>
      )}
    </nav>
  );
};
