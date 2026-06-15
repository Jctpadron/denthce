import React, { useState } from 'react';
import { Image as ImageIcon, type LucideIcon } from 'lucide-react';

/**
 * Primitivos reutilizables de la landing "Denta Cloud".
 * Layout y tipografía salen de landing.css (solo tokens del design-system).
 */

// === SectionContainer ========================================================
interface SectionProps {
  id?: string;
  bg?: 'surface' | 'base' | 'tint';
  tight?: boolean;
  labelledBy?: string;
  children: React.ReactNode;
}
export const Section: React.FC<SectionProps> = ({ id, bg = 'surface', tight, labelledBy, children }) => (
  <section
    id={id}
    aria-labelledby={labelledBy}
    className={`landing-section landing-section--${bg}${tight ? ' landing-section--tight' : ''}`}
  >
    <div className="landing-container">{children}</div>
  </section>
);

// === SectionHeading ==========================================================
interface HeadingProps {
  kicker?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  id?: string;
  icon?: LucideIcon;
  as?: 'h2' | 'h3';
}
export const SectionHeading: React.FC<HeadingProps> = ({ kicker, title, subtitle, center, id, icon: Icon, as = 'h2' }) => {
  const HeadingTag = as;
  return (
    <div className={`landing-heading${center ? ' landing-heading--center' : ''}`}>
      {kicker && (
        <span className="landing-kicker">
          {Icon && <Icon size={15} strokeWidth={2} aria-hidden="true" />}
          {kicker}
        </span>
      )}
      <HeadingTag id={id} className={as === 'h2' ? 'landing-h2' : 'landing-h3'}>{title}</HeadingTag>
      {subtitle && <p className="landing-subtitle">{subtitle}</p>}
    </div>
  );
};

// === InfoCard ================================================================
interface InfoCardProps {
  icon: LucideIcon;
  title: string;
  body: string;
  variant?: 'feature' | 'module' | 'security' | 'audience';
  badge?: string;
}
export const InfoCard: React.FC<InfoCardProps> = ({ icon: Icon, title, body, variant = 'feature', badge }) => {
  const cls = `info-card info-card--interactive${variant === 'security' ? ' info-card--security' : ''}${variant === 'audience' ? ' info-card--audience' : ''}`;
  const iconSize = variant === 'audience' ? 26 : 22;
  return (
    <article className={cls}>
      {badge && <span className="info-card__badge">{badge}</span>}
      <span className="info-card__chip" aria-hidden="true"><Icon size={iconSize} strokeWidth={1.75} /></span>
      <h3 className="info-card__title">{title}</h3>
      <p className="info-card__body">{body}</p>
    </article>
  );
};

// === LandingImage (con placeholder elegante si el asset no existe) ============
interface LandingImageProps {
  src: string;
  alt: string;
  aspect?: string; // ej. "4 / 3"
  eager?: boolean;
}
export const LandingImage: React.FC<LandingImageProps> = ({ src, alt, aspect = '4 / 3', eager }) => {
  const [failed, setFailed] = useState(false);
  const fileName = src.split('/').pop();
  if (failed) {
    return (
      <div className="landing-image-placeholder" style={{ aspectRatio: aspect }} role="img" aria-label={alt}>
        <ImageIcon size={40} strokeWidth={1.5} aria-hidden="true" />
        <span>Ilustración: {fileName}</span>
      </div>
    );
  }
  return (
    <div className="landing-image-wrap" style={{ aspectRatio: aspect }}>
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
      />
    </div>
  );
};

// === StepCard ================================================================
interface StepCardProps {
  num: number;
  icon: LucideIcon;
  title: string;
  body: string;
}
export const StepCard: React.FC<StepCardProps> = ({ num, icon: Icon, title, body }) => (
  <article className="step-card">
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span className="step-card__num" aria-hidden="true">{num}</span>
      <Icon className="step-card__icon" size={24} strokeWidth={1.75} aria-hidden="true" />
    </div>
    <h3 className="info-card__title">{title}</h3>
    <p className="info-card__body">{body}</p>
  </article>
);
