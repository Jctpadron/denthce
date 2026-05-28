import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface HomeScreenProps {
  onNavigate: (to: 'patients' | 'form' | 'settings' | 'users' | 'dashboard') => void;
}

const StatCard: React.FC<{ icon: string; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
  <div style={{
    background: '#ffffff',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '0.75rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  }}>
    <span style={{ fontSize: '1.5rem' }}>{icon}</span>
    <div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 500 }}>{label}</div>
    </div>
  </div>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { config, canConfigure } = useTheme();

  const NAV_CARDS = [
    {
      key: 'patients' as const,
      icon: '🏥',
      title: 'Historia Clínica',
      description: 'Buscá, registrá y gestioná pacientes. Odontograma, alergias, signos vitales y documentos clínicos.',
      color: 'var(--color-emerald)',
      bgColor: '#ffffff',
      borderColor: 'var(--border-color)',
      badge: null,
    },
    {
      key: 'form' as const,
      icon: '➕',
      title: 'Admisión de Pacientes',
      description: 'Registrá un nuevo paciente con sus datos demográficos completos según estándar FHIR R4.',
      color: 'var(--color-cyan)',
      bgColor: '#ffffff',
      borderColor: 'var(--border-color)',
      badge: null,
    },
    ...(canConfigure ? [
      {
        key: 'users' as const,
        icon: '👥',
        title: 'Gestión de Personal',
        description: 'Registrá y administrá secretarias o enfermeros para que colaboren en tu consultorio clínico.',
        color: 'var(--color-amber)',
        bgColor: '#ffffff',
        borderColor: 'var(--border-color)',
        badge: 'Médico',
      },
      {
        key: 'settings' as const,
        icon: '🎨',
        title: 'Personalización',
        description: 'Configurá el logo, colores, datos del profesional, horarios y firma digital del consultorio.',
        color: 'var(--color-violet)',
        bgColor: '#ffffff',
        borderColor: 'var(--border-color)',
        badge: 'Médico/Admin',
      }
    ] : []),
  ];

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const dayStr = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease' }}>

      {/* Bienvenida personalizada */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '1.75rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>
            {dayStr.charAt(0).toUpperCase() + dayStr.slice(1)}
          </p>
          <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            {greeting}, {config.doctorTitle || 'Dr.'} {config.doctorName?.split(' ')[0] || 'Profesional'} 👋
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--color-muted)', fontWeight: 500 }}>
            {config.clinicName} · <span style={{ color: config.primaryColor }}>{config.specialty}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <StatCard icon="🏥" label="Sistema HCE" value="Activo" color={config.primaryColor || '#0284c7'} />
          <StatCard icon="🛡️" label="Seguridad" value="Keycloak" color="#10b981" />
        </div>
      </div>

      {/* Título de navegación */}
      <div>
        <h3 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Servicios y Módulos Contratados
        </h3>
      </div>

      {/* Cards de navegación */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`,
        gap: '1.25rem',
      }}>
        {NAV_CARDS.map(card => (
          <button
            key={card.key}
            onClick={() => onNavigate(card.key)}
            style={{
              background: card.bgColor,
              border: `1px solid ${card.borderColor}`,
              borderRadius: '16px',
              padding: '1.75rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.01), 0 2px 4px -1px rgba(15, 23, 42, 0.01)',
              minHeight: '220px',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 12px 20px -8px rgba(0,0,0,0.06)`;
              (e.currentTarget as HTMLButtonElement).style.borderColor = card.color;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 6px -1px rgba(15, 23, 42, 0.01), 0 2px 4px -1px rgba(15, 23, 42, 0.01)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = card.borderColor;
            }}
          >
            {/* Badge */}
            {card.badge && (
              <span style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'rgba(241, 245, 249, 0.8)',
                color: 'var(--color-muted)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.15rem 0.5rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.03em',
              }}>
                {card.badge}
              </span>
            )}

            {/* Ícono */}
            <div style={{
              width: '2.8rem',
              height: '2.8rem',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
            }}>
              {card.icon}
            </div>

            {/* Texto */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {card.title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--color-muted)', lineHeight: 1.45 }}>
                {card.description}
              </p>
            </div>

            {/* Arrow */}
            <div style={{
              marginTop: 'auto',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: card.color,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              paddingTop: '0.5rem',
            }}>
              Acceder al módulo →
            </div>
          </button>
        ))}
      </div>

      {/* Footer Powered by */}
      <div style={{ textAlign: 'center', padding: '1.5rem 0 0', borderTop: '1px solid var(--border-color)', marginTop: '2rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          Powered by <strong style={{ color: config.primaryColor || 'var(--color-cyan)' }}>DentHCE</strong> · Sistema de Historia Clínica Electrónica Odontológica · HL7 FHIR R4
        </span>
      </div>

    </div>
  );
};
