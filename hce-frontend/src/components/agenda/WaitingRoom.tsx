import React from 'react';
import { CheckCircle2, Clock, Users } from 'lucide-react';
import { formatHora, priorityMeta, prioridadDeAppt, nombrePacienteDeAppt, statusMeta } from './agenda-utils';

interface Props {
  /** Turnos en estado 'arrived' del rango cargado. */
  enEspera: any[];
  loading: boolean;
  onSelectAppt: (appt: any) => void;
  onAtender: (id: string) => void;
}

/**
 * Sala de espera (Tarea 5.4): lista los pacientes que ya llegaron, ordenados por
 * nivel de urgencia (1 = más urgente) y luego por hora del turno. Permite atender.
 */
export const WaitingRoom: React.FC<Props> = ({ enEspera, loading, onSelectAppt, onAtender }) => {
  const ordenados = [...enEspera].sort((a, b) => {
    const pa = prioridadDeAppt(a) ?? 4;
    const pb = prioridadDeAppt(b) ?? 4;
    if (pa !== pb) return pa - pb; // menor nivel = más urgente, va primero
    const sa = a.start ? new Date(a.start).getTime() : 0;
    const sb = b.start ? new Date(b.start).getTime() : 0;
    return sa - sb;
  });

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--color-muted)' }}>Cargando sala de espera...</div>;
  }

  if (ordenados.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted)', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
        <Users style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.5 }} />
        <div>No hay pacientes en la sala de espera.</div>
        <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>Marcá la llegada de un turno desde la agenda para que aparezca aquí.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {ordenados.map((appt, idx) => {
        const p = priorityMeta(prioridadDeAppt(appt));
        const meta = statusMeta(appt.status);
        const inicio = appt.start ? new Date(appt.start) : null;
        return (
          <div key={appt.id} className="card-premium-health" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.8rem 1rem', border: `1px solid ${meta.border}`, borderLeft: `4px solid ${p.color}` }}>
            {/* Orden / nivel */}
            <div style={{ flexShrink: 0, width: '2.4rem', height: '2.4rem', borderRadius: '50%', background: p.bg, color: p.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontWeight: 800, lineHeight: 1 }}>
              <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>N{p.level}</span>
              <span style={{ fontSize: '0.95rem' }}>{idx + 1}</span>
            </div>

            {/* Datos */}
            <button onClick={() => onSelectAppt(appt)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nombrePacienteDeAppt(appt)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.15rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Clock style={{ width: '0.8rem', height: '0.8rem' }} /> {inicio ? formatHora(inicio) : '—'}
                </span>
                <span style={{ color: p.color, fontWeight: 700 }}>{p.label}</span>
                {appt.serviceType?.[0]?.text && <span style={{ opacity: 0.7 }}>· {appt.serviceType[0].text}</span>}
              </div>
            </button>

            {/* Atender */}
            <button onClick={() => onAtender(appt.id)} className="btn btn-primary" style={{ flexShrink: 0, padding: '0.5rem 0.9rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 style={{ width: '0.9rem', height: '0.9rem' }} /> Atender
            </button>
          </div>
        );
      })}
    </div>
  );
};
