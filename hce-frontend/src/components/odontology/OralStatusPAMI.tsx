import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, CheckCircle, ShieldAlert } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

interface Props {
  patientId: string;
}

const ORAL_STATUS_CODE = 'oral-status';

export const OralStatusPAMI: React.FC<Props> = ({ patientId }) => {
  const [placa, setPlaca] = useState<boolean | null>(null);
  const [periodontal, setPeriodontal] = useState<boolean | null>(null);
  const [lesiones, setLesiones] = useState<boolean | null>(null);
  const [lesionZona, setLesionZona] = useState('');
  const [lesionTipo, setLesionTipo] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [plan, setPlan] = useState('');
  const [planFecha, setPlanFecha] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apiBase = `${import.meta.env.VITE_API_URL}/odontology`;
  const authHeader = { headers: { Authorization: `Bearer ${keycloak.token}` } };

  const comp = (obs: any, key: string) => (obs.component || []).find((c: any) => c.code?.text === key);

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
        setLesiones(comp(obs, 'lesiones')?.valueBoolean ?? null);
        setLesionZona(comp(obs, 'lesionZona')?.valueString || '');
        setLesionTipo(comp(obs, 'lesionTipo')?.valueString || '');
        setDiagnostico(comp(obs, 'diagnostico')?.valueString || '');
        setPlan(comp(obs, 'plan')?.valueString || '');
        setPlanFecha(comp(obs, 'planFecha')?.valueString || '');
        setObservaciones(comp(obs, 'observaciones')?.valueString || '');
      }
    } catch (err) {
      console.error('Error cargando estado bucal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [patientId]);

  const handleSave = async () => {
    setSaving(true); setMessage(null);
    try {
      const component: any[] = [
        { code: { text: 'placa' }, valueBoolean: placa ?? false },
        { code: { text: 'periodontal' }, valueBoolean: periodontal ?? false },
        { code: { text: 'lesiones' }, valueBoolean: lesiones ?? false },
        { code: { text: 'lesionZona' }, valueString: lesionZona },
        { code: { text: 'lesionTipo' }, valueString: lesionTipo },
        { code: { text: 'diagnostico' }, valueString: diagnostico },
        { code: { text: 'plan' }, valueString: plan },
        { code: { text: 'planFecha' }, valueString: planFecha },
        { code: { text: 'observaciones' }, valueString: observaciones },
      ];
      const payload: any = {
        status: 'final',
        code: { coding: [{ system: 'http://denthce.local/oral-status', code: ORAL_STATUS_CODE }], text: 'Estado bucal, diagnóstico y plan' },
        effectiveDateTime: new Date().toISOString(),
        component,
      };
      if (existingId) await axios.delete(`${apiBase}/resource/${existingId}`, authHeader);
      const created = await axios.post(`${apiBase}/patient/${patientId}/resource`, { resourceType: 'Observation', payload }, authHeader);
      setExistingId(created.data.id);
      setMessage({ type: 'success', text: 'Estado bucal y plan guardados correctamente.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Cargando estado bucal...</p>;

  const YesNo = ({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) => (
    <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
      {[true, false].map((v) => (
        <button key={String(v)} type="button" onClick={() => onChange(v)} className="btn" style={{
          padding: '0.3rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px', fontWeight: 700,
          background: value === v ? (v ? 'rgba(16,185,129,0.08)' : 'rgba(100,116,139,0.08)') : 'var(--bg-surface)',
          borderColor: value === v ? (v ? 'var(--color-emerald)' : 'var(--color-muted)') : 'var(--border-color)',
          color: value === v && v ? 'var(--color-emerald)' : 'var(--color-text)',
        }}>{v ? 'Sí' : 'No'}</button>
      ))}
    </div>
  );

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' };
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 0' };
  const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' };
  const taStyle: React.CSSProperties = { width: '100%', minHeight: '70px', padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--color-text)', fontSize: '0.88rem', fontFamily: 'inherit', resize: 'vertical' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {message && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', borderRadius: '10px',
          background: message.type === 'success' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)'}`,
          color: message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)', fontSize: '0.85rem' }}>
          {message.type === 'success' ? <CheckCircle style={{ width: '1.1rem', height: '1.1rem' }} /> : <ShieldAlert style={{ width: '1.1rem', height: '1.1rem' }} />}
          {message.text}
        </div>
      )}

      <div style={card}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>Estado bucal general</h3>
        <div style={rowStyle}><span style={{ fontSize: '0.88rem' }}>Presencia de placa bacteriana</span><YesNo value={placa} onChange={setPlaca} /></div>
        <div style={rowStyle}><span style={{ fontSize: '0.88rem' }}>Enfermedad periodontal</span><YesNo value={periodontal} onChange={setPeriodontal} /></div>
        <div style={rowStyle}><span style={{ fontSize: '0.88rem' }}>¿Lesiones en mucosa o tejido blando?</span><YesNo value={lesiones} onChange={setLesiones} /></div>
        {lesiones === true && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={labelStyle}>Zona</label>
              <input className="search-input" value={lesionZona} onChange={(e) => setLesionZona(e.target.value)} style={{ width: '100%' }} placeholder="Ej: borde lateral de lengua" />
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={labelStyle}>Tipo</label>
              <input className="search-input" value={lesionTipo} onChange={(e) => setLesionTipo(e.target.value)} style={{ width: '100%' }} placeholder="Ej: úlcera aftosa" />
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>Diagnóstico y plan</h3>
        <div style={{ marginBottom: '0.85rem' }}>
          <label style={labelStyle}>Diagnóstico presuntivo</label>
          <textarea value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} style={taStyle} />
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
          <div style={{ flex: 3, minWidth: '220px' }}>
            <label style={labelStyle}>Plan de tratamiento</label>
            <textarea value={plan} onChange={(e) => setPlan(e.target.value)} style={taStyle} />
          </div>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <label style={labelStyle}>Fecha</label>
            <input type="date" className="search-input" value={planFecha} onChange={(e) => setPlanFecha(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Observaciones</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} style={taStyle} />
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
