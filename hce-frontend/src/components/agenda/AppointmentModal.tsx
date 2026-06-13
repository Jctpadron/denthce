import React, { useState } from 'react';
import axios from 'axios';
import {
  X, Search, UserCheck, Clock, CalendarPlus, AlertTriangle, CheckCircle2,
  LogIn, UserX, Ban, Stethoscope, Bell,
} from 'lucide-react';
import keycloak from '../../utils/keycloak-config';
import { useTheme } from '../../context/ThemeContext';
import {
  formatHora, statusMeta, nombrePacienteDeAppt, toLocalDateTimeInput,
  PRIORITY_LEVELS, priorityMeta, prioridadDeAppt,
} from './agenda-utils';

const API = import.meta.env.VITE_API_URL;
const authHeader = () => ({ headers: { Authorization: `Bearer ${keycloak.token}` } });

interface Props {
  /** 'create' abre el formulario de alta; 'detail' muestra un turno existente. */
  mode: 'create' | 'detail';
  /** Fecha/hora pre-seleccionada al crear desde un hueco de la grilla. */
  prefillStart?: Date;
  /** Recurso FHIR Appointment para el modo detalle. */
  appt?: any;
  onClose: () => void;
  /** Se llama tras crear/cancelar/cambiar estado para refrescar la agenda. */
  onSaved: () => void;
}

const genderLabel = (g: string) =>
  ({ male: 'Masculino', female: 'Femenino', other: 'Otro', unknown: 'Sin especificar' } as Record<string, string>)[g] || g;

export const AppointmentModal: React.FC<Props> = ({ mode, prefillStart, appt, onClose, onSaved }) => {
  const { config } = useTheme();

  // --- Estado del formulario de creación ---
  const [dni, setDni] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [pacienteSel, setPacienteSel] = useState<any | null>(null);
  const [start, setStart] = useState(toLocalDateTimeInput(prefillStart || new Date()));
  const [duracion, setDuracion] = useState(30);
  const [motivo, setMotivo] = useState('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordatorioMsg, setRecordatorioMsg] = useState<string | null>(null);

  // ------- Búsqueda de paciente por DNI -------
  const buscarPaciente = async () => {
    if (!dni.trim()) return;
    setBuscando(true);
    setError(null);
    setResultados([]);
    try {
      const res = await axios.get(`${API}/fhir/r4/Patient?identifier=${dni.trim()}`, authHeader());
      const lista = (res.data.entry || []).map((e: any) => e.resource);
      setResultados(lista);
      if (lista.length === 0) {
        setError(`No hay pacientes con DNI ${dni.trim()} en tu consultorio. Registralo en Admisión antes de agendar.`);
      }
    } catch {
      setError('Error al buscar el paciente.');
    } finally {
      setBuscando(false);
    }
  };

  // ------- Crear turno -------
  const crearTurno = async () => {
    if (!pacienteSel) {
      setError('Seleccioná un paciente.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const startISO = new Date(start).toISOString();
      await axios.post(
        `${API}/fhir/r4/Appointment`,
        {
          resourceType: 'Appointment',
          status: 'booked',
          patientDni: pacienteSel.identifier?.[0]?.value || dni.trim(),
          gender: pacienteSel.gender || 'unknown',
          start: startISO,
          minutesDuration: duracion,
          serviceType: motivo || config.specialty || 'Consulta',
          practitionerName: config.doctorName || undefined,
          originChannel: 'recepcion',
          comment: motivo || undefined,
        },
        authHeader(),
      );
      onSaved();
      onClose();
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setError('Ese horario ya está ocupado por otro turno activo. Elegí otro horario.');
      } else if (e?.response?.status === 404) {
        setError('El paciente no existe en tu consultorio. Registralo en Admisión primero.');
      } else {
        setError('No se pudo crear el turno. Intentá nuevamente.');
      }
    } finally {
      setGuardando(false);
    }
  };

  // ------- Acciones del turno existente -------
  const cambiarEstado = async (nuevo: string, priority?: number, cerrar = true) => {
    if (!appt?.id) return;
    setGuardando(true);
    setError(null);
    try {
      const body: any = { status: nuevo };
      if (priority !== undefined) body.priority = priority;
      await axios.patch(`${API}/fhir/r4/Appointment/${appt.id}/status`, body, authHeader());
      onSaved();
      if (cerrar) onClose();
    } catch {
      setError('No se pudo actualizar el estado del turno.');
    } finally {
      setGuardando(false);
    }
  };

  const enviarRecordatorio = async () => {
    if (!appt?.id) return;
    setGuardando(true);
    setError(null);
    setRecordatorioMsg(null);
    try {
      await axios.post(`${API}/fhir/r4/Appointment/${appt.id}/reminder`, {}, authHeader());
      setRecordatorioMsg('Recordatorio enviado a CliniChat (WhatsApp).');
    } catch (e: any) {
      setError(
        e?.response?.status === 400
          ? 'Solo se pueden enviar recordatorios de turnos activos.'
          : 'No se pudo enviar el recordatorio. Verificá que el secreto de CliniChat esté configurado.',
      );
    } finally {
      setGuardando(false);
    }
  };

  const cancelarTurno = async () => {
    if (!appt?.id) return;
    const reason = window.prompt('Motivo de la cancelación (opcional):') ?? undefined;
    setGuardando(true);
    setError(null);
    try {
      await axios.patch(
        `${API}/fhir/r4/Appointment/${appt.id}`,
        { status: 'cancelled', cancellationReason: { text: reason } },
        authHeader(),
      );
      onSaved();
      onClose();
    } catch {
      setError('No se pudo cancelar el turno.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel"
        style={{
          width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '1.1rem', animation: 'slideIn 0.2s ease',
        }}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {mode === 'create'
              ? (<><CalendarPlus style={{ width: '1.2rem', height: '1.2rem', color: '#2962ff' }} /> Nuevo turno</>)
              : (<><Stethoscope style={{ width: '1.2rem', height: '1.2rem', color: '#2962ff' }} /> Detalle del turno</>)}
          </h3>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '10px' }} aria-label="Cerrar">
            <X style={{ width: '1.1rem', height: '1.1rem' }} />
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '0.7rem 0.9rem', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 500 }}>
            <AlertTriangle style={{ width: '1rem', height: '1rem', flexShrink: 0, marginTop: '0.1rem' }} />
            <span>{error}</span>
          </div>
        )}

        {mode === 'create' ? (
          <>
            {/* Buscar paciente */}
            {!pacienteSel ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Paciente (por DNI)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text" inputMode="numeric" className="search-input"
                    placeholder="Ej: 38450123" value={dni}
                    onChange={(e) => /^\d*$/.test(e.target.value) && setDni(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscarPaciente()}
                    style={{ flex: 1 }}
                  />
                  <button onClick={buscarPaciente} disabled={buscando} className="btn btn-primary" style={{ padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Search style={{ width: '1rem', height: '1rem' }} /> {buscando ? '...' : 'Buscar'}
                  </button>
                </div>
                {resultados.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
                    {resultados.map((p) => {
                      const nom = `${p.name?.[0]?.family || ''}, ${(p.name?.[0]?.given || []).join(' ')}`.trim();
                      return (
                        <button key={p.id} onClick={() => { setPacienteSel(p); setError(null); }}
                          className="card-premium-health"
                          style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 0.9rem', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.9rem' }}>{nom}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{genderLabel(p.gender)} · DNI {p.identifier?.[0]?.value}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="card-premium-health" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <UserCheck style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-emerald)' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>
                      {`${pacienteSel.name?.[0]?.family || ''}, ${(pacienteSel.name?.[0]?.given || []).join(' ')}`.trim()}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{genderLabel(pacienteSel.gender)} · DNI {pacienteSel.identifier?.[0]?.value}</div>
                  </div>
                </div>
                <button onClick={() => { setPacienteSel(null); setResultados([]); }} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}>Cambiar</button>
              </div>
            )}

            {/* Fecha/hora, duración, motivo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Fecha y hora</label>
              <input type="datetime-local" className="search-input" value={start} onChange={(e) => setStart(e.target.value)} style={{ color: 'var(--color-text)' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1, minWidth: '130px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Duración</label>
                <select className="search-input" value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} style={{ color: 'var(--color-text)' }}>
                  {[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 2, minWidth: '180px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Motivo / servicio</label>
                <input type="text" className="search-input" placeholder="Ej: Control, Extracción..." value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
            </div>

            <button onClick={crearTurno} disabled={guardando || !pacienteSel} className="btn btn-primary" style={{ padding: '0.8rem', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
              <CheckCircle2 style={{ width: '1.05rem', height: '1.05rem' }} /> {guardando ? 'Agendando...' : 'Confirmar turno'}
            </button>
          </>
        ) : (
          <DetalleTurno
            appt={appt}
            guardando={guardando}
            recordatorioMsg={recordatorioMsg}
            onEstado={cambiarEstado}
            onCancelar={cancelarTurno}
            onRecordatorio={enviarRecordatorio}
          />
        )}
      </div>
    </div>
  );
};

// ---- Sub-vista: detalle de un turno con acciones de estado y triaje (5.4) ----
const DetalleTurno: React.FC<{
  appt: any; guardando: boolean; recordatorioMsg: string | null;
  onEstado: (s: string, priority?: number, cerrar?: boolean) => void;
  onCancelar: () => void; onRecordatorio: () => void;
}> = ({ appt, guardando, recordatorioMsg, onEstado, onCancelar, onRecordatorio }) => {
  const meta = statusMeta(appt?.status);
  const inicio = appt?.start ? new Date(appt.start) : null;
  const fin = appt?.end ? new Date(appt.end) : null;
  const finalizado = ['fulfilled', 'cancelled', 'noshow'].includes(appt?.status);
  const puedeRecordar = ['booked', 'arrived', 'proposed'].includes(appt?.status);

  // Nivel de urgencia seleccionado (default: el del turno, o 4 = estándar).
  const [prioridad, setPrioridad] = useState<number>(prioridadDeAppt(appt) ?? 4);
  const pMeta = priorityMeta(prioridad);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card-premium-health" style={{ padding: '1rem', border: `1px solid ${meta.border}`, background: meta.bg, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-text)' }}>{nombrePacienteDeAppt(appt)}</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{meta.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 600 }}>
          <Clock style={{ width: '0.95rem', height: '0.95rem' }} />
          {inicio ? `${inicio.toLocaleDateString('es-AR')} · ${formatHora(inicio)}${fin ? ` – ${formatHora(fin)}` : ''}` : 'Sin horario'}
        </div>
        {appt?.serviceType?.[0]?.text && (
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text)' }}>{appt.serviceType[0].text}</div>
        )}
      </div>

      {!finalizado ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Clasificación de urgencia (triaje sala de espera, 5.4) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Nivel de urgencia</span>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {PRIORITY_LEVELS.map((p) => {
                const activo = p.level === prioridad;
                return (
                  <button key={p.level} onClick={() => setPrioridad(p.level)}
                    style={{
                      flex: 1, minWidth: '54px', cursor: 'pointer', padding: '0.35rem 0.2rem', borderRadius: '8px',
                      border: `1px solid ${activo ? p.color : 'var(--border-color)'}`,
                      background: activo ? p.bg : 'transparent', color: activo ? p.color : 'var(--color-muted)',
                      fontSize: '0.66rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.2,
                    }}>
                    <div style={{ fontSize: '0.85rem' }}>{p.level}</div>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Acciones</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {appt?.status === 'booked' && (
              <button onClick={() => onEstado('arrived', prioridad)} disabled={guardando} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#d97706' }}>
                <LogIn style={{ width: '0.95rem', height: '0.95rem' }} /> Marcar llegada
              </button>
            )}
            {appt?.status === 'arrived' && (
              <button onClick={() => onEstado('arrived', prioridad, false)} disabled={guardando} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.82rem', color: pMeta.color }}>
                <AlertTriangle style={{ width: '0.95rem', height: '0.95rem' }} /> Reclasificar
              </button>
            )}
            <button onClick={() => onEstado('fulfilled')} disabled={guardando} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#059669' }}>
              <CheckCircle2 style={{ width: '0.95rem', height: '0.95rem' }} /> Atendido
            </button>
            <button onClick={() => onEstado('noshow')} disabled={guardando} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#6b7280' }}>
              <UserX style={{ width: '0.95rem', height: '0.95rem' }} /> Ausente
            </button>
            <button onClick={onCancelar} disabled={guardando} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#dc2626' }}>
              <Ban style={{ width: '0.95rem', height: '0.95rem' }} /> Cancelar
            </button>
          </div>

          {/* Recordatorio por WhatsApp (CliniChat) */}
          {puedeRecordar && (
            <button onClick={onRecordatorio} disabled={guardando} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', fontSize: '0.82rem', color: '#2962ff' }}>
              <Bell style={{ width: '0.95rem', height: '0.95rem' }} /> Enviar recordatorio por WhatsApp
            </button>
          )}
          {recordatorioMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--color-emerald)', fontWeight: 600, justifyContent: 'center' }}>
              <CheckCircle2 style={{ width: '0.9rem', height: '0.9rem' }} /> {recordatorioMsg}
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--color-muted)', padding: '0.5rem' }}>
          Turno {meta.label.toLowerCase()} — sin acciones disponibles.
        </div>
      )}
    </div>
  );
};
