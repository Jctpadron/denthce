import React from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { Section, SectionHeading, InfoCard, LandingImage, StepCard } from './primitives';
import { OdontogramMockup, WhatsappMockup } from './mockups';
import {
  TRUST_ITEMS, BENEFICIOS, MODULOS, PASOS, SEGURIDAD, AUDIENCIA, STATS, TESTIMONIOS,
  HIGHLIGHT_ODONTOGRAMA, HIGHLIGHT_WHATSAPP, type HighlightData,
} from './content';

// === Sección 2 — Trust bar ===================================================
export const TrustBar: React.FC = () => (
  <Section bg="base" tight labelledBy="trust-h">
    <h2 id="trust-h" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
      Por qué Denta Cloud
    </h2>
    <div className="landing-grid landing-grid--narrow" style={{ marginTop: 0 }}>
      {TRUST_ITEMS.map((t) => (
        <div key={t.title} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <t.icon size={26} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--accent)' }} />
          <strong style={{ fontSize: '0.95rem', color: 'var(--color-text)' }}>{t.title}</strong>
          <span style={{ fontSize: '0.83rem', color: 'var(--color-muted)', lineHeight: 1.45 }}>{t.body}</span>
        </div>
      ))}
    </div>
  </Section>
);

// === Sección 3 — Beneficios ==================================================
export const Beneficios: React.FC = () => (
  <Section id="beneficios" bg="surface" labelledBy="beneficios-h">
    <SectionHeading
      id="beneficios-h"
      center
      title="Todo lo que tu consultorio necesita, en un solo lugar"
      subtitle="Menos papeles, menos sistemas sueltos, más tiempo para tus pacientes."
    />
    <div className="landing-grid">
      {BENEFICIOS.map((b) => (
        <InfoCard key={b.title} icon={b.icon} title={b.title} body={b.body} variant="feature" />
      ))}
    </div>
  </Section>
);

// === Banda de estadísticas (confianza) =======================================
export const StatsBand: React.FC = () => (
  <Section bg="tint" tight labelledBy="stats-h">
    <h2 id="stats-h" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
      Denta Cloud en números
    </h2>
    <div className="stats-band">
      {STATS.map((s) => (
        <div key={s.label} className="stat">
          <span className="stat__value">{s.value}</span>
          <span className="stat__label">{s.label}</span>
        </div>
      ))}
    </div>
  </Section>
);

// === Testimonios =============================================================
export const Testimonios: React.FC = () => (
  <Section bg="tint" labelledBy="testi-h">
    <SectionHeading id="testi-h" center title="Lo que dicen los profesionales" subtitle="Clínicas y consultorios que ya trabajan con Denta Cloud." />
    <div className="landing-grid">
      {TESTIMONIOS.map((t) => (
        <figure key={t.name} className="testimonial-card">
          <blockquote className="testimonial-card__quote">“{t.quote}”</blockquote>
          <figcaption className="testimonial-card__author">
            <span className="testimonial-avatar" aria-hidden="true">{t.initials}</span>
            <span>
              <strong>{t.name}</strong>
              <span className="testimonial-card__role">{t.specialty}</span>
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  </Section>
);

// === Sección 4 — Módulos =====================================================
export const Modulos: React.FC<{ onDemo: () => void }> = ({ onDemo }) => (
  <Section id="modulos" bg="base" labelledBy="modulos-h">
    <SectionHeading
      id="modulos-h"
      center
      title="Activá solo lo que tu clínica necesita"
      subtitle="Denta Cloud es modular. Empezás con lo esencial y sumás funciones cuando tu clínica crece."
    />
    <div className="landing-grid">
      {MODULOS.map((m) => (
        <InfoCard key={m.title} icon={m.icon} title={m.title} body={m.body} variant="module" badge="Módulo" />
      ))}
    </div>
    <p style={{ textAlign: 'center', color: 'var(--color-muted)', marginTop: '1.75rem', fontSize: '0.95rem' }}>
      ¿No sabés por dónde empezar?{' '}
      <button type="button" className="landing-btn-ghost" style={{ display: 'inline-flex' }} onClick={onDemo}>
        En la demo armamos el combo justo para tu clínica.
      </button>
    </p>
  </Section>
);

// === Secciones 5 y 6 — Destacadas ============================================
const Highlight: React.FC<{ data: HighlightData; bg: 'surface' | 'base'; reverse?: boolean; onDemo: () => void; id?: string; visual?: React.ReactNode }> = ({ data, bg, reverse, onDemo, id, visual }) => (
  <Section id={id} bg={bg} labelledBy={`${data.title}-h`}>
    <div className={`landing-2col${reverse ? ' landing-2col--reverse' : ''}`}>
      <div className="landing-2col__media">
        {visual ?? <LandingImage src={data.image} alt={data.imageAlt} aspect="4 / 3" />}
      </div>
      <div className="landing-2col__text" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <SectionHeading as="h3" kicker={data.kicker} icon={data.icon} title={data.title} id={`${data.title}-h`} />
        <p className="landing-subtitle">{data.body}</p>
        <ul className="landing-bullets">
          {data.bullets.map((b) => (
            <li key={b}><Check size={18} strokeWidth={2.5} aria-hidden="true" /> {b}</li>
          ))}
        </ul>
        <div>
          <button type="button" className="landing-btn-primary" onClick={onDemo}>{data.cta}</button>
        </div>
      </div>
    </div>
  </Section>
);

export const Odontograma: React.FC<{ onDemo: () => void }> = ({ onDemo }) => (
  <Highlight data={HIGHLIGHT_ODONTOGRAMA} bg="surface" onDemo={onDemo} visual={<OdontogramMockup />} />
);
export const WhatsAppIA: React.FC<{ onDemo: () => void }> = ({ onDemo }) => (
  <Highlight data={HIGHLIGHT_WHATSAPP} bg="base" reverse onDemo={onDemo} visual={<WhatsappMockup />} />
);

// === Sección de transformación (usa tu ilustración "papel → digital") ========
export const Transformacion: React.FC = () => (
  <Section bg="tint" labelledBy="transf-h">
    <div className="landing-2col">
      <div className="landing-2col__media">
        <LandingImage
          src="/img/landing_hero.png"
          alt="Del desorden de papeles a una clínica odontológica digital y ordenada"
          aspect="16 / 10"
        />
      </div>
      <div className="landing-2col__text" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <SectionHeading as="h3" kicker="DEL PAPEL AL DIGITAL" icon={ArrowRight} title="Dejá atrás las fichas de papel" id="transf-h" />
        <p className="landing-subtitle">
          Pasá del desorden de carpetas y planillas sueltas a una clínica ordenada y digital.
          Toda la información de tus pacientes en un solo lugar, accesible desde donde estés.
        </p>
        <ul className="landing-bullets">
          <li><Check size={18} strokeWidth={2.5} aria-hidden="true" /> Nada de papeles que se pierden o se vuelven ilegibles.</li>
          <li><Check size={18} strokeWidth={2.5} aria-hidden="true" /> Toda la historia del paciente en un clic.</li>
          <li><Check size={18} strokeWidth={2.5} aria-hidden="true" /> Accedé desde el consultorio, tu casa o el celular.</li>
        </ul>
      </div>
    </div>
  </Section>
);

// === Sección 7 — Cómo funciona ===============================================
export const ComoFunciona: React.FC = () => (
  <Section id="como-funciona" bg="surface" labelledBy="como-h">
    <SectionHeading id="como-h" center title="Empezar es simple" />
    <div className="landing-grid">
      {PASOS.map((p, i) => (
        <StepCard key={p.title} num={i + 1} icon={p.icon} title={p.title} body={p.body} />
      ))}
    </div>
  </Section>
);

// === Sección 8 — Confianza / seguridad =======================================
export const Confianza: React.FC = () => (
  <Section bg="base" labelledBy="seguridad-h">
    <SectionHeading
      id="seguridad-h"
      center
      title="La información de tus pacientes, protegida en serio"
      subtitle="La seguridad no es un extra: es la base de Denta Cloud."
    />
    <div className="landing-grid">
      {SEGURIDAD.map((s) => (
        <InfoCard key={s.title} icon={s.icon} title={s.title} body={s.body} variant="security" />
      ))}
    </div>
  </Section>
);

// === Sección 9 — Para quién es ===============================================
export const ParaQuien: React.FC = () => (
  <Section bg="base" labelledBy="audiencia-h">
    <SectionHeading id="audiencia-h" center title="Pensada para cómo trabaja la odontología argentina" />
    <div className="landing-grid">
      {AUDIENCIA.map((a) => (
        <InfoCard key={a.title} icon={a.icon} title={a.title} body={a.body} variant="audience" />
      ))}
    </div>
  </Section>
);

// === Sección 10 — CTA final ==================================================
export const FinalCTA: React.FC<{ onDemo: () => void; onLogin: () => void }> = ({ onDemo, onLogin }) => (
  <Section bg="surface" labelledBy="final-h">
    <div className="final-cta-panel">
      <SectionHeading
        id="final-h"
        center
        title="Llevá tu clínica odontológica a la nube"
        subtitle="Te mostramos Denta Cloud funcionando con un caso real de tu especialidad. Sin compromiso."
      />
      <div className="final-cta-row">
        <button type="button" className="landing-btn-primary" onClick={onDemo}>Solicitar demo</button>
        <button type="button" className="landing-btn-secondary" onClick={onLogin}>Ya soy cliente — Iniciar sesión</button>
      </div>
    </div>
  </Section>
);
