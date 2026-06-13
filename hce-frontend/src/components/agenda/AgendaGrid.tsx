import React from 'react';
import { Plus } from 'lucide-react';
import {
  franjasDelDia, rangoHorarioSemanal, addMinutes, startOfDay, startOfWeek,
  formatHora, formatFechaCorta, statusMeta, nombrePacienteDeAppt, SLOT_STEP_MIN,
  DIA_POR_INDICE, DIAS_SEMANA_LABEL,
} from './agenda-utils';

interface Props {
  vista: 'dia' | 'semana';
  fechaRef: Date;
  /** Recursos FHIR Appointment (no cancelados se muestran; cancelados se atenúan). */
  appts: any[];
  scheduleJson: Record<string, string>;
  onSelectAppt: (appt: any) => void;
  onCreateAt: (date: Date) => void;
}

/** Turno cuyo `start` cae dentro de [ini, fin). */
function apptEnFranja(appts: any[], ini: Date, fin: Date): any | undefined {
  return appts.find((a) => {
    if (!a?.start || a.status === 'cancelled') return false;
    const s = new Date(a.start).getTime();
    return s >= ini.getTime() && s < fin.getTime();
  });
}

const TarjetaTurno: React.FC<{ appt: any; onClick: () => void; compact?: boolean }> = ({ appt, onClick, compact }) => {
  const meta = statusMeta(appt.status);
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        border: `1px solid ${meta.border}`, borderLeft: `3px solid ${meta.color}`,
        background: meta.bg, borderRadius: '10px', padding: compact ? '0.35rem 0.5rem' : '0.55rem 0.75rem',
        display: 'flex', flexDirection: 'column', gap: '0.15rem', transition: 'var(--transition-smooth)',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: compact ? '0.72rem' : '0.85rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {nombrePacienteDeAppt(appt)}
      </span>
      {!compact && (
        <span style={{ fontSize: '0.72rem', color: meta.color, fontWeight: 700 }}>{meta.label}</span>
      )}
    </button>
  );
};

const HuecoLibre: React.FC<{ onClick: () => void; compact?: boolean }> = ({ onClick, compact }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%', height: compact ? '100%' : 'auto', minHeight: compact ? '2.2rem' : undefined,
      cursor: 'pointer', border: '1px dashed var(--border-color)', background: 'transparent',
      borderRadius: '10px', padding: compact ? '0.25rem' : '0.5rem', color: 'var(--color-muted)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
      fontSize: '0.72rem', fontWeight: 600, transition: 'var(--transition-smooth)',
    }}
    onMouseOver={(e) => { e.currentTarget.style.borderColor = '#2962ff'; e.currentTarget.style.color = '#2962ff'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--color-muted)'; }}
  >
    <Plus style={{ width: '0.9rem', height: '0.9rem' }} /> {!compact && 'Disponible'}
  </button>
);

export const AgendaGrid: React.FC<Props> = ({ vista, fechaRef, appts, scheduleJson, onSelectAppt, onCreateAt }) => {
  // ---------- VISTA DÍA ----------
  if (vista === 'dia') {
    const franjas = franjasDelDia(scheduleJson, fechaRef);
    if (franjas.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-muted)', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>🗓️</div>
          El consultorio no tiene horario de atención configurado para este día.
          <div style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>Configurá los horarios en Personalización.</div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {franjas.map((f) => {
          const appt = apptEnFranja(appts, f.start, f.end);
          return (
            <div key={f.start.toISOString()} style={{ display: 'flex', alignItems: 'stretch', gap: '0.75rem' }}>
              <div style={{ width: '3.2rem', flexShrink: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-muted)', paddingTop: '0.6rem', textAlign: 'right' }}>
                {formatHora(f.start)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {appt
                  ? <TarjetaTurno appt={appt} onClick={() => onSelectAppt(appt)} />
                  : <HuecoLibre onClick={() => onCreateAt(f.start)} />}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---------- VISTA SEMANA ----------
  const inicioSemana = startOfWeek(fechaRef);
  const dias = Array.from({ length: 6 }, (_, i) => addMinutes(inicioSemana, i * 24 * 60)); // lun-sab
  const { startMin, endMin } = rangoHorarioSemanal(scheduleJson);
  const filas: number[] = [];
  for (let m = startMin; m < endMin; m += SLOT_STEP_MIN) filas.push(m);

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: '720px', display: 'grid', gridTemplateColumns: `3rem repeat(6, 1fr)`, gap: '0.3rem' }}>
        {/* Cabecera de días */}
        <div />
        {dias.map((d) => {
          const esHoy = startOfDay(d).getTime() === startOfDay(new Date()).getTime();
          return (
            <div key={d.toISOString()} style={{ textAlign: 'center', padding: '0.4rem', borderRadius: '8px', background: esHoy ? 'rgba(41,98,255,0.07)' : 'transparent' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: esHoy ? '#2962ff' : 'var(--color-muted)' }}>
                {DIAS_SEMANA_LABEL[DIA_POR_INDICE[d.getDay()]]?.slice(0, 3)}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: esHoy ? '#2962ff' : 'var(--color-text)' }}>{formatFechaCorta(d)}</div>
            </div>
          );
        })}

        {/* Filas horarias */}
        {filas.map((m) => (
          <React.Fragment key={m}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-muted)', textAlign: 'right', paddingTop: '0.4rem' }}>
              {String(Math.floor(m / 60)).padStart(2, '0')}:{String(m % 60).padStart(2, '0')}
            </div>
            {dias.map((d) => {
              const ini = addMinutes(startOfDay(d), m);
              const fin = addMinutes(ini, SLOT_STEP_MIN);
              // Solo permitir interacción si ese día/hora está dentro del horario de atención
              const franjasDia = franjasDelDia(scheduleJson, d);
              const dentroHorario = franjasDia.some((f) => f.start.getTime() === ini.getTime());
              const appt = apptEnFranja(appts, ini, fin);
              return (
                <div key={d.toISOString() + m} style={{ minHeight: '2.4rem' }}>
                  {!dentroHorario
                    ? <div style={{ height: '100%', minHeight: '2.2rem', borderRadius: '8px', background: 'rgba(0,0,0,0.015)' }} />
                    : appt
                      ? <TarjetaTurno appt={appt} onClick={() => onSelectAppt(appt)} compact />
                      : <HuecoLibre onClick={() => onCreateAt(ini)} compact />}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
