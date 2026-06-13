import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useRoles } from '../hooks/useRoles';
import { getVisibleModules } from '../config/dashboard-modules';
import keycloak from '../utils/keycloak-config';

interface HomeScreenProps {
  onNavigate: (to: 'patients' | 'odonto-hc' | 'form' | 'settings' | 'users' | 'dashboard') => void;
}

interface PendingPrescription {
  id: string;
  patientId: string;
  patientName: string;
  medicationName: string;
  authoredOn: string;
}

const StatCard: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '0.75rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.02))',
  }}>
    <span style={{ fontSize: '1.5rem' }} aria-hidden="true">{icon}</span>
    <div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 500 }}>{label}</div>
    </div>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => (
  <h3 id={id} style={{
    margin: 0,
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  }}>
    {children}
  </h3>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { config } = useTheme();
  const { isMedico, canConfigure, roles } = useRoles();

  const modules = getVisibleModules(roles);

  // Widget W3 — Recetas pendientes de firma (solo médico)
  const [pending, setPending] = useState<PendingPrescription[] | null>(null);
  const [pendingError, setPendingError] = useState(false);

  useEffect(() => {
    if (!isMedico || !keycloak.token) return;
    let cancelled = false;
    axios
      .get(import.meta.env.VITE_API_URL + '/fhir/r4/MedicationRequest?status=draft', {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      })
      .then(res => { if (!cancelled) setPending(res.data as PendingPrescription[]); })
      .catch(() => { if (!cancelled) setPendingError(true); });
    return () => { cancelled = true; };
  }, [isMedico]);

  // Widget W5 — Estado de configuración del consultorio (médico/admin)
  const configChecklist = [
    { label: 'Firma digital', done: !!config.signatureUrl },
    { label: 'Logo del consultorio', done: !!config.logoUrl },
    { label: 'Matrícula profesional', done: !!config.doctorLicense },
  ];
  const configPending = configChecklist.filter(c => !c.done).length;

  const showWidgets = isMedico || canConfigure;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const dayStr = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease' }}>

      {/* ZONA A — Bienvenida personalizada */}
      <section aria-label="Bienvenida" style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: 'clamp(1.25rem, 4vw, 1.75rem) clamp(1.25rem, 4vw, 2rem)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem',
        boxShadow: 'var(--shadow-card, 0 4px 6px -1px rgba(0,0,0,0.02))',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>
            {dayStr.charAt(0).toUpperCase() + dayStr.slice(1)}
          </p>
          <h2 style={{ margin: '0.25rem 0 0', fontSize: 'clamp(1.3rem, 4vw, 1.6rem)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
            {greeting}, {config.doctorTitle || 'Dr.'} {config.doctorName?.split(' ')[0] || 'Profesional'} 👋
          </h2>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--color-muted)', fontWeight: 500 }}>
            {config.clinicName} · <span style={{ color: config.primaryColor }}>{config.specialty}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <StatCard icon="🏥" label="Sistema HCE" value="Activo" />
          <StatCard icon="🛡️" label="Seguridad" value="Keycloak" />
        </div>
      </section>

      {/* ZONA B — Widgets dinámicos según rol */}
      {showWidgets && (
        <section aria-labelledby="widgets-title" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionTitle id="widgets-title">Resumen de tu jornada</SectionTitle>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: '1.25rem',
          }}>
            {/* W3 — Recetas pendientes de firma (médico) */}
            {isMedico && (
              <button
                onClick={() => onNavigate('patients')}
                disabled={pendingError}
                style={widgetCardStyle}
                aria-label="Recetas pendientes de firma"
              >
                <div style={widgetHeaderStyle}>
                  <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>💊</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    Recetas pendientes de firma
                  </span>
                </div>
                {pendingError ? (
                  <p style={widgetMutedStyle}>No se pudo cargar.</p>
                ) : pending === null ? (
                  <p style={widgetMutedStyle}>Cargando…</p>
                ) : pending.length === 0 ? (
                  <p style={widgetMutedStyle}>No tenés recetas pendientes de firma. ✓</p>
                ) : (
                  <>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-amber)' }}>
                      {pending.length}
                    </div>
                    <p style={widgetMutedStyle}>
                      {pending[0].patientName} · {pending[0].medicationName}
                      {pending.length > 1 ? ` y ${pending.length - 1} más` : ''}
                    </p>
                  </>
                )}
              </button>
            )}

            {/* W5 — Estado de configuración del consultorio (médico/admin) */}
            {canConfigure && (
              <button
                onClick={() => onNavigate('settings')}
                style={widgetCardStyle}
                aria-label="Estado de configuración del consultorio"
              >
                <div style={widgetHeaderStyle}>
                  <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>⚙️</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                    Configuración del consultorio
                  </span>
                </div>
                {configPending === 0 ? (
                  <p style={{ ...widgetMutedStyle, color: 'var(--color-emerald)' }}>Configuración completa ✓</p>
                ) : (
                  <ul style={{ margin: '0.25rem 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {configChecklist.map(c => (
                      <li key={c.label} style={{ fontSize: '0.8rem', color: c.done ? 'var(--color-muted)' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span aria-hidden="true">{c.done ? '✅' : '⬜'}</span> {c.label}
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            )}
          </div>
        </section>
      )}

      {/* ZONA C — Accesos a módulos según rol */}
      <section aria-labelledby="modules-title" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <SectionTitle id="modules-title">Servicios y Módulos Contratados</SectionTitle>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: '1.25rem',
        }}>
          {modules.map(card => (
            <button
              key={card.key}
              onClick={() => onNavigate(card.key)}
              aria-label={`Acceder al módulo ${card.title}`}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: 'clamp(1.25rem, 4vw, 1.75rem)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                boxShadow: 'var(--shadow-card, 0 4px 6px -1px rgba(15, 23, 42, 0.01))',
                minHeight: 'clamp(180px, 24vh, 220px)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 20px -8px rgba(0,0,0,0.06)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = card.color;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-card, 0 4px 6px -1px rgba(15, 23, 42, 0.01))';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)';
              }}
            >
              {card.badge && (
                <span style={{
                  position: 'absolute',
                  top: '1.25rem',
                  right: '1.25rem',
                  background: 'var(--bg-card)',
                  color: '#475569',
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

              <div style={{
                width: '2.8rem',
                height: '2.8rem',
                borderRadius: '10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
              }} aria-hidden="true">
                {card.icon}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {card.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--color-muted)', lineHeight: 1.45, overflowWrap: 'break-word' }}>
                  {card.description}
                </p>
              </div>

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
      </section>

      {/* ZONA D — Footer */}
      <div style={{ textAlign: 'center', padding: '1.5rem 0 0', borderTop: '1px solid var(--border-color)', marginTop: '2rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          Powered by <strong style={{ color: config.primaryColor || 'var(--color-cyan)' }}>DentHCE</strong> · Sistema de Historia Clínica Electrónica Odontológica · HL7 FHIR R4
        </span>
      </div>

    </div>
  );
};

// Estilos compartidos de los widgets de la Zona B
const widgetCardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '14px',
  padding: '1.25rem',
  cursor: 'pointer',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.02))',
  minHeight: '120px',
};

const widgetHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const widgetMutedStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.82rem',
  color: 'var(--color-muted)',
  lineHeight: 1.4,
};
