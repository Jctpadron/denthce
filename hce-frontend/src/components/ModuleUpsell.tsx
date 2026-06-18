import React from 'react';
import { Lock, Sparkles } from 'lucide-react';

/**
 * Estado mostrado cuando un módulo NO está contratado por el tenant (entitlement off).
 * En vez de ocultar la feature, se ofrece activarla (upsell) — decisión de producto.
 * variant 'suspended' = el módulo estaba activo y venció/se dio de baja (ej. portal de laboratorio).
 */
interface Props {
  title: string;
  description: string;
  priceMonthly?: number;
  variant?: 'upsell' | 'suspended';
}

export const ModuleUpsell: React.FC<Props> = ({ title, description, priceMonthly, variant = 'upsell' }) => {
  const suspended = variant === 'suspended';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', gap: '1rem', padding: 'clamp(2rem, 6vw, 3.5rem)',
      background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px',
      minHeight: '320px',
    }}>
      <div style={{
        width: '4rem', height: '4rem', borderRadius: '50%',
        background: 'color-mix(in srgb, var(--color-primary, var(--color-cyan)) 10%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {suspended
          ? <Lock style={{ width: '1.8rem', height: '1.8rem', color: 'var(--accent-text)' }} />
          : <Sparkles style={{ width: '1.8rem', height: '1.8rem', color: 'var(--accent-text)' }} />}
      </div>

      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
        {suspended ? `${title} — suscripción suspendida` : `Activá ${title}`}
      </h3>

      <p style={{ margin: 0, maxWidth: '460px', fontSize: '0.95rem', color: 'var(--color-muted)', lineHeight: 1.5 }}>
        {suspended
          ? `Tu acceso a ${title} está pausado. Reactivá la suscripción para volver a usar el módulo y tus datos.`
          : description}
      </p>

      {typeof priceMonthly === 'number' && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem', color: 'var(--accent-text)' }}>
          <span style={{ fontSize: '2rem', fontWeight: 800 }}>${priceMonthly}</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>/mes</span>
        </div>
      )}

      <button
        className="btn btn-primary"
        style={{ padding: '0.7rem 1.6rem', fontSize: '0.9rem', fontWeight: 700, marginTop: '0.25rem' }}
        onClick={() => {
          const wa = 'https://wa.me/5493884000000?text=' + encodeURIComponent(`Hola, quiero ${suspended ? 'reactivar' : 'activar'} el módulo "${title}" en mi cuenta de Denta Cloud.`);
          window.open(wa, '_blank', 'noopener');
        }}
      >
        {suspended ? 'Reactivar suscripción' : `Activar ${title}`}
      </button>

      <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
        {suspended ? 'Escribinos y lo reactivamos al instante.' : 'Se activa al instante una vez confirmada la contratación.'}
      </span>
    </div>
  );
};
