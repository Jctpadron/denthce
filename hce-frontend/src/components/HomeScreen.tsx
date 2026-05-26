import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface HomeScreenProps {
  onNavigate: (to: 'patients' | 'form' | 'settings' | 'dashboard') => void;
}

const StatCard: React.FC<{ icon: string; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
  <div style={{
    background: `${color}08`,
    border: `1px solid ${color}22`,
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  }}>
    <span style={{ fontSize: '1.5rem' }}>{icon}</span>
    <div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 500 }}>{label}</div>
    </div>
  </div>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { config, isAdmin } = useTheme();

  const NAV_CARDS = [
    {
      key: 'patients' as const,
      icon: '🏥',
      title: 'Historia Clínica',
      description: 'Buscá, registrá y gestioná pacientes. Odontograma, alergias, signos vitales y documentos clínicos.',
      color: '#10b981',
      bgColor: 'rgba(16,185,129,0.06)',
      borderColor: 'rgba(16,185,129,0.2)',
      badge: null,
    },
    {
      key: 'form' as const,
      icon: '➕',
      title: 'Admisión de Pacientes',
      description: 'Registrá un nuevo paciente con sus datos demográficos completos según estándar FHIR R4.',
      color: '#0284c7',
      bgColor: 'rgba(2,132,199,0.06)',
      borderColor: 'rgba(2,132,199,0.2)',
      badge: null,
    },
    ...(isAdmin ? [{
      key: 'settings' as const,
      icon: '🎨',
      title: 'Personalización',
      description: 'Configurá el logo, colores, datos del profesional, horarios y firma digital del consultorio.',
      color: '#7c3aed',
      bgColor: 'rgba(124,58,237,0.06)',
      borderColor: 'rgba(124,58,237,0.2)',
      badge: 'Admin',
    }] : []),
  ];

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const dayStr = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease' }}>

      {/* Bienvenida personalizada */}
      <div style={{
        background: `linear-gradient(135deg, ${config.primaryColor}12, rgba(16,185,129,0.08))`,
        border: `1px solid ${config.primaryColor}20`,
        borderRadius: '16px',
        padding: '1.75rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>
            {dayStr.charAt(0).toUpperCase() + dayStr.slice(1)}
          </p>
          <h2 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
            {greeting}, {config.doctorTitle || 'Dr.'} {config.doctorName?.split(' ')[0] || 'Profesional'} 👋
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--color-muted)' }}>
            {config.clinicName} · {config.specialty}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <StatCard icon="🦷" label="Sistema HCE" value="Activo" color={config.primaryColor || '#0284c7'} />
          <StatCard icon="🔒" label="Seguridad" value="JWT + FHIR" color="#10b981" />
        </div>
      </div>

      {/* Título de navegación */}
      <div>
        <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Módulos del Sistema
        </h3>
      </div>

      {/* Cards de navegación */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${NAV_CARDS.length}, 1fr)`,
        gap: '1.25rem',
      }}>
        {NAV_CARDS.map(card => (
          <button
            key={card.key}
            onClick={() => onNavigate(card.key)}
            style={{
              background: card.bgColor,
              border: `1.5px solid ${card.borderColor}`,
              borderRadius: '16px',
              padding: '1.75rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 12px 32px ${card.color}18`;
              (e.currentTarget as HTMLButtonElement).style.borderColor = `${card.color}55`;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLButtonElement).style.borderColor = card.borderColor;
            }}
          >
            {/* Badge Admin */}
            {card.badge && (
              <span style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: `${card.color}18`,
                color: card.color,
                border: `1px solid ${card.color}33`,
                borderRadius: '20px',
                padding: '0.15rem 0.55rem',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}>
                {card.badge}
              </span>
            )}

            {/* Ícono */}
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '12px',
              background: `${card.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
            }}>
              {card.icon}
            </div>

            {/* Texto */}
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {card.title}
              </h3>
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.83rem', color: 'var(--color-muted)', lineHeight: 1.5 }}>
                {card.description}
              </p>
            </div>

            {/* Arrow */}
            <div style={{
              marginTop: 'auto',
              fontSize: '0.82rem',
              fontWeight: 700,
              color: card.color,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}>
              Abrir módulo →
            </div>
          </button>
        ))}
      </div>

      {/* Footer Powered by */}
      <div style={{ textAlign: 'center', padding: '1rem 0 0', borderTop: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          Powered by <strong style={{ color: config.primaryColor || 'var(--color-cyan)' }}>DentHCE</strong> · Sistema de Historia Clínica Electrónica Odontológica · HL7 FHIR R4
        </span>
      </div>

    </div>
  );
};
