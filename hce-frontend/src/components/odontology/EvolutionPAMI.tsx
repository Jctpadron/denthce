import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useOdontoVisit } from './OdontoVisitContext';
import { Plus, CheckCircle, ShieldAlert, ListChecks, Trash2, CalendarClock, Lock } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

interface Props {
  patientId: string;
}

const EVOLUTION_SYSTEM = 'http://denthce.local/evolution';

export const EvolutionPAMI: React.FC<Props> = ({ patientId }) => {
  const { activeEncounterId } = useOdontoVisit();
  const [entries, setEntries] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [legacyCount, setLegacyCount] = useState(0);
  const [tratamiento, setTratamiento] = useState('');
  const [conformidad, setConformidad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apiBase = `${import.meta.env.VITE_API_URL}/odontology`;
  const authHeader = { headers: { Authorization: `Bearer ${keycloak.token}` } };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/patient/${patientId}/resource`, authHeader);
      const list = (res.data as any[])
        .filter((r) => r.resourceType === 'Procedure' && r.code?.coding?.[0]?.system === EVOLUTION_SYSTEM)
        .sort((a, b) => (b.performedDateTime || '').localeCompare(a.performedDateTime || ''));
      setEntries(list);
    } catch (err) {
      console.error('Error cargando evolución:', err);
    } finally {
      setLoading(false);
    }
    // Visitas (episodios) del paciente — independiente del log de evolución.
    try {
      const v = await axios.get(`${apiBase}/patient/${patientId}/encounter`, authHeader);
      setVisits(v.data?.visitas || []);
      setLegacyCount(v.data?.legacy?.count || 0);
    } catch (err) {
      console.error('Error cargando visitas:', err);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [patientId, activeEncounterId]);

  const handleAdd = async () => {
    if (!tratamiento.trim()) return;
    setSaving(true); setMessage(null);
    try {
      const payload: any = {
        status: 'completed',
        code: { coding: [{ system: EVOLUTION_SYSTEM, code: 'evolution' }], text: tratamiento.trim() },
        performedDateTime: new Date().toISOString(),
        conformidad,
      };
      await axios.post(`${apiBase}/patient/${patientId}/resource`, { resourceType: 'Procedure', payload, encounterId: activeEncounterId }, authHeader);
      setTratamiento(''); setConformidad(true);
      setMessage({ type: 'success', text: 'Entrada de evolución registrada.' });
      load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'No se pudo registrar.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`${apiBase}/resource/${id}`, authHeader);
      load();
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  };

  if (loading) return <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Cargando evolución...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {message && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', borderRadius: '10px',
          background: message.type === 'success' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)'}`,
          color: message.type === 'success' ? 'var(--color-emerald-text)' : 'var(--color-rose)', fontSize: '0.85rem' }}>
          {message.type === 'success' ? <CheckCircle style={{ width: '1.1rem', height: '1.1rem' }} /> : <ShieldAlert style={{ width: '1.1rem', height: '1.1rem' }} />}
          {message.text}
        </div>
      )}

      {/* Visitas (episodios) del paciente */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.85rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarClock style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-primary)' }} /> Visitas del paciente
        </h3>
        {visits.length === 0 && legacyCount === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: 0 }}>Sin visitas registradas. Iniciá una visita desde la barra superior para agrupar las prestaciones de la sesión.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {visits.map((v) => {
              const finished = v.status === 'finished';
              const cancelled = v.status === 'cancelled';
              const fecha = v.start ? new Date(v.start).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
              const hora = v.start ? new Date(v.start).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
              return (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
                  padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border-color)',
                  background: finished ? 'rgba(4,120,87,0.04)' : cancelled ? 'var(--bg-card)' : 'rgba(4,120,87,0.07)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{fecha} · {hora}</span>
                    {v.reasonText && <span style={{ fontSize: '0.82rem', color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {v.reasonText}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>{v.prestaciones} prestación{v.prestaciones === 1 ? '' : 'es'}</span>
                    {finished ? (
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-emerald-text)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} title={v.signedBy ? `Firmada por ${v.signedBy}` : 'Firmada'}>
                        <Lock style={{ width: '0.8rem', height: '0.8rem' }} /> Firmada{v.hasAddenda ? ' (con addenda)' : ''}
                      </span>
                    ) : cancelled ? (
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-muted)' }}>Cancelada</span>
                    ) : (
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-emerald-text)' }}>En curso</span>
                    )}
                  </div>
                </div>
              );
            })}
            {legacyCount > 0 && (
              <div style={{ padding: '0.6rem 0.9rem', borderRadius: '10px', border: '1px dashed var(--border-color)', background: 'var(--bg-card)', fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                Registros previos (sin visita): <strong style={{ color: 'var(--color-text)' }}>{legacyCount}</strong> — prestaciones anteriores al registro por visitas.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alta de evolución */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' }}>Tratamiento realizado</label>
          <input className="search-input" value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} placeholder="Ej: tartrectomía, restauración P36..." style={{ width: '100%' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.84rem', color: 'var(--color-text)', cursor: 'pointer', paddingBottom: '0.5rem' }}>
          <input type="checkbox" checked={conformidad} onChange={(e) => setConformidad(e.target.checked)} style={{ width: '1.05rem', height: '1.05rem' }} />
          Conformidad del afiliado
        </label>
        <button type="button" className="btn btn-primary" onClick={handleAdd} disabled={saving || !tratamiento.trim()} style={{ padding: '0.55rem 1.2rem', gap: '0.4rem' }}>
          <Plus style={{ width: '0.95rem', height: '0.95rem' }} /> Agregar
        </button>
      </div>

      {/* Tabla de evolución (anexo PAMI) */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.85rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ListChecks style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-primary)' }} /> Anexo de evolución
        </h3>
        {entries.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', margin: 0 }}>Sin entradas de evolución. Agregá la primera arriba.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-muted)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700 }}>Fecha</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700 }}>Tratamiento realizado</th>
                  <th style={{ padding: '0.5rem 0.6rem', fontWeight: 700 }}>Conformidad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.6rem', whiteSpace: 'nowrap', color: 'var(--color-muted)' }}>
                      {e.performedDateTime ? new Date(e.performedDateTime).toLocaleDateString('es-AR') : '—'}
                    </td>
                    <td style={{ padding: '0.6rem', color: 'var(--color-text)' }}>{e.code?.text || '—'}</td>
                    <td style={{ padding: '0.6rem' }}>
                      {e.conformidad
                        ? <span style={{ color: 'var(--color-emerald-text)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><CheckCircle style={{ width: '0.9rem', height: '0.9rem' }} /> Sí</span>
                        : <span style={{ color: 'var(--color-muted)' }}>No</span>}
                    </td>
                    <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                      <button type="button" onClick={() => handleDelete(e.id)} title="Eliminar"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-muted)' }}>
                        <Trash2 style={{ width: '0.95rem', height: '0.95rem' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
