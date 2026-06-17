import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useOdontoVisit } from './OdontoVisitContext';
import { Save, CheckCircle, ShieldAlert, Plus, Trash2 } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

interface Props {
  patientId: string;
}

interface PlanItem {
  id: string;
  descripcion: string;
  prioridad: 'Urgente' | 'Necesario' | 'Electivo';
  estado: 'Pendiente' | 'En curso' | 'Completado' | 'Cancelado';
  pieza?: string;
}

const ORAL_STATUS_CODE = 'oral-status';

const REGIONES_TEJIDOS: { key: string; label: string }[] = [
  { key: 'labios', label: 'Labios' },
  { key: 'mucosa_yugal', label: 'Mucosa yugal' },
  { key: 'encia', label: 'Encía' },
  { key: 'lengua_dorso', label: 'Lengua — dorso' },
  { key: 'lengua_bordes', label: 'Lengua — bordes' },
  { key: 'lengua_ventral', label: 'Lengua — ventral' },
  { key: 'paladar_duro', label: 'Paladar duro' },
  { key: 'paladar_blando', label: 'Paladar blando / úvula' },
  { key: 'piso_boca', label: 'Piso de boca' },
  { key: 'orofaringe', label: 'Orofaringe' },
];

const PRIORIDADES: PlanItem['prioridad'][] = ['Urgente', 'Necesario', 'Electivo'];
const ESTADOS: PlanItem['estado'][] = ['Pendiente', 'En curso', 'Completado', 'Cancelado'];
const ESTADO_BADGE: Record<string, React.CSSProperties> = {
  Pendiente: { background: 'color-mix(in srgb, var(--color-amber) 12%, transparent)', color: 'var(--color-amber)' },
  'En curso': { background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' },
  Completado: { background: 'color-mix(in srgb, var(--color-emerald) 12%, transparent)', color: 'var(--color-emerald)' },
  Cancelado: { background: 'color-mix(in srgb, var(--color-rose) 12%, transparent)', color: 'var(--color-rose)' },
};
const PRIORIDAD_BADGE: Record<string, React.CSSProperties> = {
  Urgente: { background: 'color-mix(in srgb, var(--color-rose) 12%, transparent)', color: 'var(--color-rose)' },
  Necesario: { background: 'color-mix(in srgb, var(--color-amber) 12%, transparent)', color: 'var(--color-amber)' },
  Electivo: { background: 'color-mix(in srgb, var(--color-emerald) 12%, transparent)', color: 'var(--color-emerald)' },
};

export const OralStatusPAMI: React.FC<Props> = ({ patientId }) => {
  const { activeEncounterId } = useOdontoVisit();

  // Existing fields
  const [placa, setPlaca] = useState<boolean | null>(null);
  const [periodontal, setPeriodontal] = useState<boolean | null>(null);
  const [diagnostico, setDiagnostico] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Soft tissues: key → 'normal' | descripción del hallazgo
  const [tejidos, setTejidos] = useState<Record<string, string>>({});
  const [tejidosOpen, setTejidosOpen] = useState(false);

  // Plan items
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);

  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apiBase = `${import.meta.env.VITE_API_URL}/odontology`;
  const authHeader = { headers: { Authorization: `Bearer ${keycloak.token}` } };

  const comp = (obs: any, key: string) => (obs.component || []).find((c: any) => c.code?.text === key);

  const initTejidos = () => {
    const t: Record<string, string> = {};
    REGIONES_TEJIDOS.forEach(r => { t[r.key] = 'normal'; });
    return t;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/patient/${patientId}/resource`, authHeader);
      const obs = (res.data as any[])
        .filter((r) => r.resourceType === 'Observation' && r.code?.coding?.[0]?.code === ORAL_STATUS_CODE)
        .sort((a, b) => (b.effectiveDateTime || '').localeCompare(a.effectiveDateTime || ''))[0];
      if (obs) {
        setExistingId(obs.id);
        setPlaca(comp(obs, 'placa')?.valueBoolean ?? null);
        setPeriodontal(comp(obs, 'periodontal')?.valueBoolean ?? null);
        setDiagnostico(comp(obs, 'diagnostico')?.valueString || '');
        setObservaciones(comp(obs, 'observaciones')?.valueString || '');

        const t = initTejidos();
        REGIONES_TEJIDOS.forEach(r => {
          const v = comp(obs, `tejidos_${r.key}`)?.valueString;
          if (v !== undefined && v !== null) t[r.key] = v;
        });
        setTejidos(t);

        const planRaw = comp(obs, 'plan_items')?.valueString;
        if (planRaw) {
          try { setPlanItems(JSON.parse(planRaw)); } catch { setPlanItems([]); }
        }
      } else {
        setTejidos(initTejidos());
      }
    } catch (err) {
      console.error('Error cargando estado bucal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [patientId]);

  const setTejido = (key: string, val: string) => {
    setTejidos(prev => ({ ...prev, [key]: val }));
  };

  const addPlanItem = () => {
    setPlanItems(prev => [...prev, { id: crypto.randomUUID(), descripcion: '', prioridad: 'Necesario', estado: 'Pendiente' }]);
  };

  const updatePlanItem = (id: string, field: keyof PlanItem, value: string) => {
    setPlanItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removePlanItem = (id: string) => {
    setPlanItems(prev => prev.filter(i => i.id !== id));
  };

  const handleSave = async () => {
    setSaving(true); setMessage(null);
    try {
      const component: any[] = [
        { code: { text: 'placa' }, valueBoolean: placa ?? false },
        { code: { text: 'periodontal' }, valueBoolean: periodontal ?? false },
        { code: { text: 'diagnostico' }, valueString: diagnostico },
        { code: { text: 'observaciones' }, valueString: observaciones },
        { code: { text: 'plan_items' }, valueString: JSON.stringify(planItems) },
      ];
      REGIONES_TEJIDOS.forEach(r => {
        component.push({ code: { text: `tejidos_${r.key}` }, valueString: tejidos[r.key] ?? 'normal' });
      });

      const payload: any = {
        status: 'final',
        code: { coding: [{ system: 'http://denthce.local/oral-status', code: ORAL_STATUS_CODE }], text: 'Estado bucal, diagnóstico y plan' },
        effectiveDateTime: new Date().toISOString(),
        component,
      };
      if (existingId) await axios.delete(`${apiBase}/resource/${existingId}`, authHeader);
      const created = await axios.post(`${apiBase}/patient/${patientId}/resource`, { resourceType: 'Observation', payload, encounterId: activeEncounterId }, authHeader);
      setExistingId(created.data.id);
      setMessage({ type: 'success', text: 'Estado bucal y plan guardados correctamente.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Cargando estado bucal...</p>;

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' };
  const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' };
  const taStyle: React.CSSProperties = { width: '100%', minHeight: '70px', padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--color-text)', fontSize: '0.88rem', fontFamily: 'inherit', resize: 'vertical' };

  const YesNo = ({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) => (
    <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
      {[true, false].map((v) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)} className="btn" style={{
          padding: '0.3rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px', fontWeight: 700,
          background: value === v ? (v ? 'rgba(16,185,129,0.08)' : 'rgba(100,116,139,0.08)') : 'var(--bg-surface)',
          borderColor: value === v ? (v ? 'var(--color-emerald)' : 'var(--color-muted)') : 'var(--border-color)',
          color: value === v && v ? 'var(--color-emerald-text)' : 'var(--color-text)',
        }}>{v ? 'Sí' : 'No'}</button>
      ))}
    </div>
  );

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

      {/* === ESTADO BUCAL GENERAL === */}
      <div style={card}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>Estado bucal general</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.88rem' }}>Presencia de placa bacteriana</span>
            <YesNo value={placa} onChange={setPlaca} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.88rem' }}>Enfermedad periodontal</span>
            <YesNo value={periodontal} onChange={setPeriodontal} />
          </div>
        </div>
      </div>

      {/* === EXAMEN DE TEJIDOS BLANDOS === */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>Examen de tejidos blandos</h3>
          <button type="button" className="btn btn-secondary" onClick={() => setTejidosOpen(!tejidosOpen)} style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}>
            {tejidosOpen ? 'Contraer' : 'Desplegar'}
          </button>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: '0 0 0.75rem' }}>
          Evaluación sistemática por región anatómica. Marcar como "Normal" o describir el hallazgo.
        </p>
        {tejidosOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {REGIONES_TEJIDOS.map(r => {
              const val = tejidos[r.key] ?? 'normal';
              const isNormal = val === 'normal';
              return (
                <div key={r.key} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{r.label}</span>
                    <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                      {['normal', 'hallazgo'].map(opt => (
                        <button key={opt} type="button" onClick={() => setTejido(r.key, opt === 'normal' ? 'normal' : '')} className="btn" style={{
                          padding: '0.2rem 0.65rem', fontSize: '0.72rem', borderRadius: '6px', fontWeight: 600,
                          background: (opt === 'normal' && isNormal) || (opt === 'hallazgo' && !isNormal) ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                          borderColor: (opt === 'normal' && isNormal) || (opt === 'hallazgo' && !isNormal) ? 'var(--color-primary)' : 'var(--border-color)',
                          color: (opt === 'normal' && isNormal) || (opt === 'hallazgo' && !isNormal) ? 'var(--color-primary)' : 'var(--color-muted)',
                        }}>
                          {opt === 'normal' ? '✓ Normal' : 'Hallazgo'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!isNormal && (
                    <textarea
                      value={val}
                      onChange={e => setTejido(r.key, e.target.value)}
                      placeholder="Describa el hallazgo (tipo, tamaño, color, consistencia, etc.)"
                      style={{ ...taStyle, minHeight: '50px', marginTop: '0.4rem', fontSize: '0.82rem' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* === PLAN DE TRATAMIENTO === */}
      <div style={card}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>Plan de tratamiento</h3>
        {planItems.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {planItems.map(item => (
              <div key={item.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: '160px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', display: 'block', marginBottom: '0.15rem' }}>Procedimiento</label>
                    <input className="search-input" value={item.descripcion} onChange={e => updatePlanItem(item.id, 'descripcion', e.target.value)} placeholder="Ej: Raspaje y alisado radicular" style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', display: 'block', marginBottom: '0.15rem' }}>Prioridad</label>
                    <select className="search-input" value={item.prioridad} onChange={e => updatePlanItem(item.id, 'prioridad', e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px' }}>
                      {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', display: 'block', marginBottom: '0.15rem' }}>Estado</label>
                    <select className="search-input" value={item.estado} onChange={e => updatePlanItem(item.id, 'estado', e.target.value)} style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px' }}>
                      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 0.6, minWidth: '80px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-muted)', display: 'block', marginBottom: '0.15rem' }}>Pieza</label>
                    <input className="search-input" value={item.pieza || ''} onChange={e => updatePlanItem(item.id, 'pieza', e.target.value)} placeholder="N°" style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderRadius: '8px' }} />
                  </div>
                  <button type="button" onClick={() => removePlanItem(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-rose)', marginTop: '1.1rem', padding: '0.25rem' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, ...PRIORIDAD_BADGE[item.prioridad] }}>{item.prioridad}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700, ...ESTADO_BADGE[item.estado] }}>{item.estado}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: '0 0 0.75rem' }}>No hay procedimientos planificados. Agregue el primero.</p>
        )}
        <button type="button" className="btn btn-secondary" onClick={addPlanItem} style={{ marginTop: '0.5rem', gap: '0.35rem' }}>
          <Plus size={14} /> Agregar procedimiento
        </button>
      </div>

      {/* === DIAGNÓSTICO Y OBSERVACIONES === */}
      <div style={card}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>Diagnóstico y observaciones</h3>
        <div style={{ marginBottom: '0.85rem' }}>
          <label style={labelStyle}>Diagnóstico presuntivo</label>
          <textarea aria-label="Diagnóstico presuntivo" value={diagnostico} onChange={e => setDiagnostico(e.target.value)} style={taStyle} />
        </div>
        <div>
          <label style={labelStyle}>Observaciones</label>
          <textarea aria-label="Observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} style={taStyle} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '0.6rem 1.5rem', gap: '0.5rem' }}>
          <Save style={{ width: '1rem', height: '1rem' }} />
          {saving ? 'Guardando...' : 'Guardar estado bucal y plan'}
        </button>
      </div>
    </div>
  );
};
