import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Plus, CalendarClock, CalendarCheck, Users, Armchair } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';
import { useTheme } from '../../context/ThemeContext';
import { AgendaGrid } from './AgendaGrid';
import { AppointmentModal } from './AppointmentModal';
import { WaitingRoom } from './WaitingRoom';
import {
  startOfDay, startOfWeek, addMinutes, formatFechaLarga, formatFechaCorta, formatHora, nombrePacienteDeAppt,
} from './agenda-utils';

const API = import.meta.env.VITE_API_URL;
const authHeader = () => ({ headers: { Authorization: `Bearer ${keycloak.token}` } });

type Vista = 'dia' | 'semana';

export const AgendaView: React.FC = () => {
  const { config } = useTheme();
  const [panel, setPanel] = useState<'agenda' | 'espera'>('agenda');
  const [vista, setVista] = useState<Vista>('dia');
  const [fechaRef, setFechaRef] = useState<Date>(startOfDay(new Date()));
  const [appts, setAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState<{ mode: 'create' | 'detail'; appt?: any; prefillStart?: Date } | null>(null);

  // Rango de carga según la vista
  const rango = useCallback(() => {
    if (vista === 'dia') {
      const from = startOfDay(fechaRef);
      const to = addMinutes(from, 24 * 60 - 1);
      return { from, to };
    }
    const from = startOfWeek(fechaRef);
    const to = addMinutes(from, 6 * 24 * 60 - 1);
    return { from, to };
  }, [vista, fechaRef]);

  const cargarTurnos = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = rango();
      const res = await axios.get(
        `${API}/fhir/r4/Appointment?dateFrom=${encodeURIComponent(from.toISOString())}&dateTo=${encodeURIComponent(to.toISOString())}`,
        authHeader(),
      );
      setAppts((res.data.entry || []).map((e: any) => e.resource));
    } catch (e) {
      console.error('Error cargando la agenda:', e);
      setAppts([]);
    } finally {
      setLoading(false);
    }
  }, [rango]);

  useEffect(() => { cargarTurnos(); }, [cargarTurnos]);

  const navegar = (dir: -1 | 0 | 1) => {
    if (dir === 0) { setFechaRef(startOfDay(new Date())); return; }
    const paso = vista === 'dia' ? 1 : 7;
    setFechaRef((f) => addMinutes(startOfDay(f), dir * paso * 24 * 60));
  };

  const tituloRango = () => {
    if (vista === 'dia') return formatFechaLarga(fechaRef);
    const ini = startOfWeek(fechaRef);
    const fin = addMinutes(ini, 5 * 24 * 60);
    return `Semana del ${formatFechaCorta(ini)} al ${formatFechaCorta(fin)}`;
  };

  // Atender directo desde la sala de espera (→ fulfilled).
  const atenderRapido = async (id: string) => {
    try {
      await axios.patch(`${API}/fhir/r4/Appointment/${id}/status`, { status: 'fulfilled' }, authHeader());
      cargarTurnos();
    } catch (e) {
      console.error('Error al atender el turno:', e);
    }
  };

  const activos = appts.filter((a) => a.status !== 'cancelled').length;
  const enEspera = appts.filter((a) => a.status === 'arrived');
  // Estado del box/sillón (5.4/5.5): mono-profesional = 1 box. Ocupado si hay alguien en espera/atención.
  const enAtencion = enEspera[0] || null;
  const proximo = appts
    .filter((a) => a.status === 'booked' && a.start && new Date(a.start) >= new Date())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0] || null;

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
          <CalendarClock style={{ width: '1.6rem', height: '1.6rem', color: '#2962ff' }} />
          Agenda de Turnos
        </h3>
        <button onClick={() => setModal({ mode: 'create' })} className="btn btn-primary" style={{ padding: '0.6rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 700 }}>
          <Plus style={{ width: '1rem', height: '1rem' }} /> Nuevo turno
        </button>
      </div>

      {/* Estado del box/sillón (5.5) */}
      <div className="card-premium-health" style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.7rem 1rem',
        border: `1px solid ${enAtencion ? 'rgba(217,119,6,0.28)' : 'rgba(5,150,105,0.25)'}`,
        background: enAtencion ? 'rgba(217,119,6,0.07)' : 'rgba(5,150,105,0.06)',
      }}>
        <Armchair style={{ width: '1.3rem', height: '1.3rem', color: enAtencion ? '#d97706' : '#059669', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--color-muted)', letterSpacing: '0.03em' }}>Estado del consultorio</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)' }}>
            {enAtencion
              ? `Ocupado — ${nombrePacienteDeAppt(enAtencion)}`
              : 'Libre'}
            {!enAtencion && proximo && (
              <span style={{ fontWeight: 500, color: 'var(--color-muted)', fontSize: '0.82rem' }}>
                {' '}· próximo {formatHora(new Date(proximo.start))} ({nombrePacienteDeAppt(proximo)})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Switch de panel: Agenda / Sala de espera */}
      <div className="segmented-control">
        <button onClick={() => setPanel('agenda')} className={`segmented-button ${panel === 'agenda' ? 'active' : ''}`}>
          <CalendarCheck style={{ width: '0.95rem', height: '0.95rem' }} /> Agenda
        </button>
        <button onClick={() => setPanel('espera')} className={`segmented-button ${panel === 'espera' ? 'active' : ''}`}>
          <Users style={{ width: '0.95rem', height: '0.95rem' }} /> Sala de espera
          {enEspera.length > 0 && (
            <span style={{ marginLeft: '0.35rem', background: '#d97706', color: '#fff', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, padding: '0.05rem 0.4rem' }}>{enEspera.length}</span>
          )}
        </button>
      </div>

      {panel === 'agenda' ? (
        <>
          {/* Controles: navegación de fecha + switch de vista */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => navegar(-1)} className="btn btn-secondary" style={{ padding: '0.45rem', borderRadius: '10px' }} aria-label="Anterior">
                <ChevronLeft style={{ width: '1.1rem', height: '1.1rem' }} />
              </button>
              <button onClick={() => navegar(0)} className="btn btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 700 }}>Hoy</button>
              <button onClick={() => navegar(1)} className="btn btn-secondary" style={{ padding: '0.45rem', borderRadius: '10px' }} aria-label="Siguiente">
                <ChevronRight style={{ width: '1.1rem', height: '1.1rem' }} />
              </button>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text)', marginLeft: '0.4rem', textTransform: 'capitalize' }}>
                {tituloRango()}
              </span>
            </div>

            <div className="segmented-control" style={{ flexShrink: 0 }}>
              <button onClick={() => setVista('dia')} className={`segmented-button ${vista === 'dia' ? 'active' : ''}`}>
                <CalendarDays style={{ width: '0.95rem', height: '0.95rem' }} /> Día
              </button>
              <button onClick={() => setVista('semana')} className={`segmented-button ${vista === 'semana' ? 'active' : ''}`}>
                <CalendarRange style={{ width: '0.95rem', height: '0.95rem' }} /> Semana
              </button>
            </div>
          </div>

          {/* Contador */}
          <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)', fontWeight: 600 }}>
            {loading ? 'Cargando turnos...' : `${activos} turno${activos === 1 ? '' : 's'} activo${activos === 1 ? '' : 's'} en el rango`}
          </span>

          {/* Grilla */}
          <AgendaGrid
            vista={vista}
            fechaRef={fechaRef}
            appts={appts}
            scheduleJson={config.scheduleJson}
            onSelectAppt={(appt) => setModal({ mode: 'detail', appt })}
            onCreateAt={(date) => setModal({ mode: 'create', prefillStart: date })}
          />
        </>
      ) : (
        <WaitingRoom
          enEspera={enEspera}
          loading={loading}
          onSelectAppt={(appt) => setModal({ mode: 'detail', appt })}
          onAtender={atenderRapido}
        />
      )}

      {modal && (
        <AppointmentModal
          mode={modal.mode}
          appt={modal.appt}
          prefillStart={modal.prefillStart}
          onClose={() => setModal(null)}
          onSaved={cargarTurnos}
        />
      )}
    </div>
  );
};
