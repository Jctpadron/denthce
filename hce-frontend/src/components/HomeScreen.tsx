import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CalendarPlus, UserPlus, Stethoscope, ArrowRight, CalendarDays } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useRoles } from '../hooks/useRoles';
import { getVisibleModules } from '../config/dashboard-modules';
import { formatHora, statusMeta, nombrePacienteDeAppt } from './agenda/agenda-utils';
import keycloak from '../utils/keycloak-config';

interface HomeScreenProps {
  onNavigate: (to: string) => void;
}

interface PendingPrescription {
  id: string;
  patientId: string;
  patientName: string;
  medicationName: string;
  authoredOn: string;
}

const SectionTitle: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => (
  <h3 id={id} style={{
    margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  }}>
    {children}
  </h3>
);

const KpiCard: React.FC<{ value: React.ReactNode; label: string; color: string; loading?: boolean }> = ({ value, label, color, loading }) => (
  <div style={{
    background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
    borderRadius: '14px', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.15rem',
    boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.02))', position: 'relative', overflow: 'hidden',
  }}>
    <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: color }} aria-hidden="true" />
    <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
      {loading ? '…' : value}
    </div>
    <div style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 600 }}>{label}</div>
  </div>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { config } = useTheme();
  const { isMedico, canConfigure, roles } = useRoles();

  const modules = getVisibleModules(roles);
  const has = (key: string) => modules.some(m => m.key === key);
  const canSeeAgenda = has('agenda');

  const accent = config.primaryColor || 'var(--color-cyan)';
  // Variante con contraste AA para usar el acento como TEXTO chico sobre blanco (white-label).
  const accentText = 'var(--accent-text)';
  // Mapea el color de acento del módulo a su variante "texto seguro" (AA). El color puro
  // se sigue usando para bordes/hover; el texto chico usa el derivado oscurecido.
  const moduleTextColor: Record<string, string> = {
    'var(--color-primary)': 'var(--accent-text)',
    'var(--color-cyan)': 'var(--accent-text)',
    'var(--color-amber)': 'var(--color-amber-text)',
    'var(--color-violet)': 'var(--color-violet-text)',
  };

  // --- Recetas pendientes de firma (médico) ---
  const [pending, setPending] = useState<PendingPrescription[] | null>(null);
  const [pendingError, setPendingError] = useState(false);
  useEffect(() => {
    if (!isMedico || !keycloak.token) return;
    let cancelled = false;
    axios.get(import.meta.env.VITE_API_URL + '/fhir/r4/MedicationRequest?status=draft', {
      headers: { Authorization: `Bearer ${keycloak.token}` },
    })
      .then(res => { if (!cancelled) setPending(res.data as PendingPrescription[]); })
      .catch(() => { if (!cancelled) setPendingError(true); });
    return () => { cancelled = true; };
  }, [isMedico]);

  // --- Turnos de hoy (para KPIs + agenda del día) ---
  const [appts, setAppts] = useState<any[]>([]);
  const [apptsLoading, setApptsLoading] = useState(false);
  const [apptsError, setApptsError] = useState(false);
  useEffect(() => {
    if (!canSeeAgenda || !keycloak.token) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    let cancelled = false;
    setApptsLoading(true);
    axios.get(
      `${import.meta.env.VITE_API_URL}/fhir/r4/Appointment?dateFrom=${encodeURIComponent(start.toISOString())}&dateTo=${encodeURIComponent(end.toISOString())}`,
      { headers: { Authorization: `Bearer ${keycloak.token}` } },
    )
      .then(res => { if (!cancelled) setAppts((res.data?.entry || []).map((e: any) => e.resource)); })
      .catch(() => { if (!cancelled) setApptsError(true); })
      .finally(() => { if (!cancelled) setApptsLoading(false); });
    return () => { cancelled = true; };
  }, [canSeeAgenda]);

  const now = new Date();
  const activos = appts.filter(a => a.status !== 'cancelled');
  const enSala = appts.filter(a => a.status === 'arrived').length;
  const atendidos = appts.filter(a => a.status === 'fulfilled').length;
  const proximo = activos
    .filter(a => a.status === 'booked' && a.start && new Date(a.start) >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0] || null;
  const agendaHoy = [...activos].sort((a, b) => new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime());

  // --- Configuración del consultorio (nudge solo si falta algo) ---
  const configChecklist = [
    { label: 'Firma digital', done: !!config.signatureUrl },
    { label: 'Logo del consultorio', done: !!config.logoUrl },
    { label: 'Matrícula profesional', done: !!config.doctorLicense },
  ];
  const configPending = configChecklist.filter(c => !c.done).length;
  const showConfigWidget = canConfigure && configPending > 0;
  const showRecetas = isMedico;
  const showPendientes = showRecetas || showConfigWidget;

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const dayStr = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // --- Acciones rápidas según rol ---
  const quickActions = [
    canSeeAgenda && { label: 'Nuevo turno', icon: CalendarPlus, to: 'agenda', primary: true },
    has('form') && { label: 'Nuevo paciente', icon: UserPlus, to: 'form', primary: false },
    has('odonto-hc') && { label: 'HC Odontológica', icon: Stethoscope, to: 'odonto-hc', primary: false },
  ].filter(Boolean) as { label: string; icon: any; to: string; primary: boolean }[];

  return (
    <div className="dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease' }}>

      {/* ZONA A — Bienvenida + acciones rápidas */}
      <section aria-label="Bienvenida" style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px',
        padding: 'clamp(1.25rem, 4vw, 1.75rem) clamp(1.25rem, 4vw, 2rem)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem',
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
            {config.clinicName} · <span style={{ color: accentText }}>{config.specialty}</span>
          </p>
        </div>
        {quickActions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            {quickActions.map(a => {
              const Icon = a.icon;
              return (
                <button
                  key={a.to}
                  onClick={() => onNavigate(a.to)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                    padding: '0.6rem 1.1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700,
                    cursor: 'pointer', transition: 'var(--transition-smooth)',
                    background: a.primary ? accentText : 'var(--bg-surface)',
                    color: a.primary ? '#fff' : 'var(--color-text)',
                    border: a.primary ? 'none' : '1px solid var(--border-color)',
                  }}
                >
                  <Icon style={{ width: '1rem', height: '1rem' }} /> {a.label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ZONA B — KPIs del día (datos reales de turnos) */}
      {canSeeAgenda && (
        <section aria-label="Resumen del día" style={{
          display: 'grid', gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
        }}>
          <KpiCard value={apptsError ? '—' : activos.length} label="Turnos de hoy" color="#2962ff" loading={apptsLoading} />
          <KpiCard value={apptsError ? '—' : enSala} label="En sala de espera" color="#d97706" loading={apptsLoading} />
          <KpiCard value={apptsError ? '—' : atendidos} label="Atendidos" color="#059669" loading={apptsLoading} />
          <KpiCard
            value={apptsError ? '—' : (proximo ? formatHora(new Date(proximo.start)) : 'Sin turnos')}
            label={proximo ? `Próximo · ${nombrePacienteDeAppt(proximo)}` : 'Próximo turno'}
            color="#7c3aed" loading={apptsLoading}
          />
        </section>
      )}

      {/* ZONA C — Agenda de hoy (protagonista) */}
      {canSeeAgenda && (
        <section aria-labelledby="agenda-hoy-title" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionTitle id="agenda-hoy-title">Agenda de hoy</SectionTitle>
            <button onClick={() => onNavigate('agenda')} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: accentText, fontWeight: 700,
              fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            }}>
              Ver agenda completa <ArrowRight style={{ width: '0.9rem', height: '0.9rem' }} />
            </button>
          </div>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px',
            padding: '0.5rem', boxShadow: 'var(--shadow-card, 0 4px 6px -1px rgba(0,0,0,0.02))',
          }}>
            {apptsLoading ? (
              <p style={{ padding: '1.5rem', margin: 0, color: 'var(--color-muted)', fontSize: '0.88rem' }}>Cargando la agenda…</p>
            ) : apptsError ? (
              <p style={{ padding: '1.5rem', margin: 0, color: 'var(--color-muted)', fontSize: '0.88rem' }}>No se pudo cargar la agenda.</p>
            ) : agendaHoy.length === 0 ? (
              <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--color-muted)' }}>
                <CalendarDays style={{ width: '2rem', height: '2rem', opacity: 0.4, marginBottom: '0.5rem' }} />
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>No tenés turnos para hoy.</p>
                <button onClick={() => onNavigate('agenda')} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem',
                  borderRadius: '10px', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer',
                  background: accentText, color: '#fff', border: 'none',
                }}>
                  <CalendarPlus style={{ width: '1rem', height: '1rem' }} /> Agendar un turno
                </button>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {agendaHoy.slice(0, 6).map((a, i) => {
                  const meta = statusMeta(a.status);
                  const inicio = a.start ? new Date(a.start) : null;
                  return (
                    <li key={a.id || i}>
                      <button onClick={() => onNavigate('agenda')} style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.9rem',
                        padding: '0.8rem 1rem', background: 'transparent', border: 'none',
                        borderTop: i === 0 ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'left',
                        transition: 'var(--transition-smooth)',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text)', minWidth: '56px' }}>
                          {inicio ? formatHora(inicio) : '--:--'}
                        </span>
                        <span style={{ flex: 1, fontSize: '0.9rem', color: 'var(--color-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {nombrePacienteDeAppt(a)}
                          {a.serviceType?.[0]?.text && (
                            <span style={{ color: 'var(--color-muted)', fontWeight: 400 }}> · {a.serviceType[0].text}</span>
                          )}
                        </span>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px',
                          color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap',
                        }}>
                          {meta.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {agendaHoy.length > 6 && (
                  <li>
                    <button onClick={() => onNavigate('agenda')} style={{
                      width: '100%', padding: '0.7rem', background: 'transparent', border: 'none',
                      borderTop: '1px solid var(--border-color)', cursor: 'pointer', color: accentText, fontWeight: 700, fontSize: '0.82rem',
                    }}>
                      Ver los {agendaHoy.length} turnos de hoy →
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* ZONA D — Pendientes (recetas + configuración solo si falta) */}
      {showPendientes && (
        <section aria-labelledby="pendientes-title" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionTitle id="pendientes-title">Pendientes</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
            {showRecetas && (
              <button onClick={() => onNavigate('odonto-hc')} disabled={pendingError} style={widgetCardStyle} aria-label="Recetas pendientes de firma">
                <div style={widgetHeaderStyle}>
                  <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>💊</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>Recetas pendientes de firma</span>
                </div>
                {pendingError ? (
                  <p style={widgetMutedStyle}>No se pudo cargar.</p>
                ) : pending === null ? (
                  <p style={widgetMutedStyle}>Cargando…</p>
                ) : pending.length === 0 ? (
                  <p style={widgetMutedStyle}>No tenés recetas pendientes de firma. ✓</p>
                ) : (
                  <>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-amber)' }}>{pending.length}</div>
                    <p style={widgetMutedStyle}>
                      {pending[0].patientName} · {pending[0].medicationName}
                      {pending.length > 1 ? ` y ${pending.length - 1} más` : ''}
                    </p>
                  </>
                )}
              </button>
            )}

            {showConfigWidget && (
              <button onClick={() => onNavigate('settings')} style={widgetCardStyle} aria-label="Completar configuración del consultorio">
                <div style={widgetHeaderStyle}>
                  <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>⚙️</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>Completá la configuración</span>
                </div>
                <ul style={{ margin: '0.25rem 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {configChecklist.map(c => (
                    <li key={c.label} style={{ fontSize: '0.8rem', color: c.done ? 'var(--color-muted)' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span aria-hidden="true">{c.done ? '✅' : '⬜'}</span> {c.label}
                    </li>
                  ))}
                </ul>
              </button>
            )}
          </div>
        </section>
      )}

      {/* ZONA E — Accesos a módulos (navegación) */}
      <section aria-labelledby="modules-title" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <SectionTitle id="modules-title">Servicios y Módulos Contratados</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1.25rem' }}>
          {modules.map(card => (
            <button
              key={card.key}
              onClick={() => onNavigate(card.key)}
              aria-label={`Acceder al módulo ${card.title}`}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '16px',
                padding: 'clamp(1.25rem, 4vw, 1.75rem)', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative',
                display: 'flex', flexDirection: 'column', gap: '0.85rem',
                boxShadow: 'var(--shadow-card, 0 4px 6px -1px rgba(15, 23, 42, 0.01))',
                minHeight: 'clamp(170px, 22vh, 200px)',
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
                  position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'var(--bg-card)',
                  color: '#475569', border: '1px solid var(--border-color)', borderRadius: '6px',
                  padding: '0.15rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.03em',
                }}>
                  {card.badge}
                </span>
              )}
              <div style={{
                width: '2.8rem', height: '2.8rem', borderRadius: '10px', background: 'var(--bg-card)',
                border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem',
              }} aria-hidden="true">
                {card.icon}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>{card.title}</h3>
                <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--color-muted)', lineHeight: 1.45, overflowWrap: 'break-word' }}>
                  {card.description}
                </p>
              </div>
              <div style={{ marginTop: 'auto', fontSize: '0.8rem', fontWeight: 700, color: moduleTextColor[card.color] || card.color, display: 'flex', alignItems: 'center', gap: '0.25rem', paddingTop: '0.5rem' }}>
                Acceder al módulo →
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '1.5rem 0 0', borderTop: '1px solid var(--border-color)', marginTop: '1rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          Powered by <strong style={{ color: accentText }}>Denta Cloud</strong> · Historia Clínica Electrónica Odontológica · HL7 FHIR R4
        </span>
      </div>

    </div>
  );
};

// Estilos compartidos de los widgets de "Pendientes"
const widgetCardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px',
  padding: '1.25rem', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column',
  gap: '0.5rem', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.02))', minHeight: '120px',
};
const widgetHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem' };
const widgetMutedStyle: React.CSSProperties = { margin: 0, fontSize: '0.82rem', color: 'var(--color-muted)', lineHeight: 1.4 };
