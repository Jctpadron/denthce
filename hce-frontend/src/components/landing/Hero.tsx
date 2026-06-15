import React from 'react';
import { ArrowRight, ChevronDown, Sparkles, MapPin, ShieldCheck, Network, CheckCircle2 } from 'lucide-react';
import { ProductMockup } from './mockups';

interface HeroProps {
  onDemo: () => void;
}

/**
 * Hero premium: fondo con profundidad (glows azul/menta), badge de contexto,
 * H1 grande con palabra clave resaltada, franja de confianza, y el PRODUCTO real
 * dentro de un marco de navegador como visual protagonista.
 */
export const Hero: React.FC<HeroProps> = ({ onDemo }) => {
  const goComoFunciona = () => document.querySelector('#como-funciona')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section id="top" className="hero">
      <div className="hero__glow hero__glow--a" aria-hidden="true" />
      <div className="hero__glow hero__glow--b" aria-hidden="true" />

      <div className="landing-container hero__inner">
        <div className="hero-2col">
          <div className="hero-text animate-fade-in-up">
            <span className="hero-badge">
              <Sparkles size={15} aria-hidden="true" /> Turnos por WhatsApp con IA · novedad
            </span>

            <h1 className="hero-h1">
              Tu clínica odontológica, ordenada y <span className="hero-highlight">en la nube</span>.
            </h1>

            <p className="hero-sub">
              Historia clínica, odontograma interactivo, turnos y obras sociales en una sola
              plataforma. Accedé desde la compu o el celular, sin instalar nada.
            </p>

            <div className="hero-cta-row">
              <button type="button" className="landing-btn-primary landing-btn-lg" onClick={onDemo}>
                Solicitar demo <ArrowRight size={18} aria-hidden="true" />
              </button>
              <button type="button" className="landing-btn-ghost" onClick={goComoFunciona}>
                Ver cómo funciona <ChevronDown size={18} aria-hidden="true" />
              </button>
            </div>

            <ul className="hero-trust">
              <li><MapPin size={16} aria-hidden="true" /> Hecho en Argentina</li>
              <li><ShieldCheck size={16} aria-hidden="true" /> Datos seguros</li>
              <li><Network size={16} aria-hidden="true" /> HL7 FHIR R4</li>
            </ul>
          </div>

          <div className="hero-visual">
            <div className="hero-visual__glow" aria-hidden="true" />
            <div className="browser-frame">
              <div className="browser-frame__bar" aria-hidden="true">
                <span className="browser-dot" /><span className="browser-dot" /><span className="browser-dot" />
                <span className="browser-frame__url">app.dentacloud.ar</span>
              </div>
              <div className="browser-frame__body">
                <ProductMockup />
              </div>
            </div>
            <div className="hero-float-card" aria-hidden="true">
              <CheckCircle2 size={18} /> Agenda sincronizada
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
