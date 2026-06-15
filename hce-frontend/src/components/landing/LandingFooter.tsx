import React from 'react';
import { DentaCloudLogoImage, NAV_LINKS } from './content';

interface FooterProps {
  onDemo: () => void;
  onLogin: () => void;
}

/** Pie oscuro — único bloque oscuro intencional, como cierre de página. */
export const LandingFooter: React.FC<FooterProps> = ({ onDemo, onLogin }) => {
  const goAnchor = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="landing-footer__grid">
          <div className="landing-footer__col">
            <DentaCloudLogoImage height="64px" onDark />
            <p className="landing-footer__tagline">Historia clínica odontológica en la nube, para Argentina.</p>
          </div>

          <div className="landing-footer__col">
            <h4>Producto</h4>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={(e) => goAnchor(e, l.href)}>{l.label}</a>
            ))}
          </div>

          <div className="landing-footer__col">
            <h4>Empresa</h4>
            <a href="#demo" onClick={(e) => { e.preventDefault(); onDemo(); }}>Solicitar demo</a>
            <a href="#demo" onClick={(e) => { e.preventDefault(); onDemo(); }}>Contacto</a>
          </div>

          <div className="landing-footer__col">
            <h4>Cuenta</h4>
            <a href="#login" onClick={(e) => { e.preventDefault(); onLogin(); }}>Iniciar sesión</a>
          </div>
        </div>

        <div className="landing-footer__bottom">
          <span>© 2026 Denta Cloud — systia.ar · Términos · Privacidad</span>
          <span>Powered by Denta Cloud · HL7 FHIR R4</span>
        </div>
      </div>
    </footer>
  );
};
