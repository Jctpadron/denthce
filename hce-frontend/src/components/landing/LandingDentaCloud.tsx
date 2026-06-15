import React, { useState } from 'react';
import keycloak from '../../utils/keycloak-config';
import { LandingNav } from './LandingNav';
import { Hero } from './Hero';
import { DemoModal } from './DemoModal';
import { LandingFooter } from './LandingFooter';
import {
  TrustBar, Beneficios, Transformacion, Modulos, Odontograma, WhatsAppIA,
  ComoFunciona, Confianza, ParaQuien, FinalCTA,
} from './sections';
// NOTA: StatsBand y Testimonios quedan OCULTOS hasta tener datos reales
// (hoy son placeholders). Los componentes siguen en ./sections para reactivarlos.
import './landing.css';
import './landing-pro.css';

type Variant = 'modern' | 'pro';

/**
 * Landing pública de marketing "Denta Cloud" (pre-login).
 * Reemplaza a LandingLogin como primera impresión de marca.
 * Diseño: docs/design/landing_denta_cloud_{estrategia,ux}.md.
 */
export const LandingDentaCloud: React.FC = () => {
  const [demoOpen, setDemoOpen] = useState(false);
  // Variante por URL (?v=pro) para comparar; el skin por defecto es el híbrido.
  const variant: Variant =
    new URLSearchParams(window.location.search).get('v') === 'pro' ? 'pro' : 'modern';
  const openDemo = () => setDemoOpen(true);
  const login = () => keycloak.login();

  return (
    <div className={`landing-root${variant === 'pro' ? ' landing--pro' : ''}`}>
      <LandingNav onDemo={openDemo} onLogin={login} />
      <main>
        <Hero onDemo={openDemo} />
        <Transformacion />
        <Modulos onDemo={openDemo} />
        <Odontograma onDemo={openDemo} />
        <WhatsAppIA onDemo={openDemo} />
        <ComoFunciona />
        <ParaQuien />
        <FinalCTA onDemo={openDemo} onLogin={login} />
        <TrustBar />
        <Beneficios />
        <Confianza />
      </main>
      <LandingFooter onDemo={openDemo} onLogin={login} />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
};
