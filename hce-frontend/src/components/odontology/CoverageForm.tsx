import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, CheckCircle, ShieldAlert } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

interface Props {
  patientId: string;
}

export const CoverageForm: React.FC<Props> = ({ patientId }) => {
  const [obraSocial, setObraSocial] = useState('PAMI');
  const [afiliado, setAfiliado] = useState('');
  const [beneficio, setBeneficio] = useState('');
  const [prestador, setPrestador] = useState('');
  const [medicoCabecera, setMedicoCabecera] = useState('');
  const [titular, setTitular] = useState(true);
  const [parentesco, setParentesco] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apiBase = `${import.meta.env.VITE_API_URL}/odontology`;
  const authHeader = { headers: { Authorization: `Bearer ${keycloak.token}` } };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/patient/${patientId}/resource`, authHeader);
      const cov = (res.data as any[]).filter((r) => r.resourceType === 'Coverage').slice(-1)[0];
      if (cov) {
        setExistingId(cov.id);
        setObraSocial(cov.obraSocial || 'PAMI');
        setAfiliado(cov.subscriberId || '');
        setBeneficio(cov.beneficio || '');
        setPrestador(cov.prestador || '');
        setMedicoCabecera(cov.medicoCabecera || '');
        setTitular(cov.titular ?? true);
        setParentesco(cov.parentesco || '');
      }
    } catch (err) {
      console.error('Error cargando cobertura:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [patientId]);

  const handleSave = async () => {
    setSaving(true); setMessage(null);
    try {
      const payload: any = {
        status: 'active',
        beneficiary: { reference: `Patient/${patientId}` },
        subscriberId: afiliado,
        obraSocial, beneficio, prestador, medicoCabecera, titular, parentesco,
        payor: [{ display: obraSocial }],
      };
      if (existingId) await axios.delete(`${apiBase}/resource/${existingId}`, authHeader);
      const created = await axios.post(`${apiBase}/patient/${patientId}/resource`, { resourceType: 'Coverage', payload }, authHeader);
      setExistingId(created.data.id);
      setMessage({ type: 'success', text: 'Datos de afiliado guardados correctamente.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Cargando datos de afiliado...</p>;

  const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' };
  const field = (label: string, value: string, set: (v: string) => void, placeholder = '') => (
    <div style={{ flex: 1, minWidth: '200px' }}>
      <label style={labelStyle}>{label}</label>
      <input className="search-input" value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} style={{ width: '100%' }} />
    </div>
  );

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

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>Afiliado y obra social</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {field('Obra social', obraSocial, setObraSocial, 'PAMI / OSDE / ...')}
          {field('Nº de afiliado', afiliado, setAfiliado)}
          {field('Nº de beneficio', beneficio, setBeneficio)}
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {field('Código de prestador', prestador, setPrestador)}
          {field('Médico de cabecera', medicoCabecera, setMedicoCabecera)}
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ minWidth: '200px' }}>
            <label style={labelStyle}>¿Es titular?</label>
            <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => setTitular(v)} className="btn" style={{
                  padding: '0.4rem 1rem', fontSize: '0.82rem', borderRadius: '8px', fontWeight: 700,
                  background: titular === v ? 'rgba(41,98,255,0.06)' : 'var(--bg-surface)',
                  borderColor: titular === v ? 'var(--color-primary)' : 'var(--border-color)',
                  color: titular === v ? 'var(--color-primary)' : 'var(--color-text)',
                }}>{v ? 'Sí' : 'No'}</button>
              ))}
            </div>
          </div>
          {!titular && field('Parentesco con el titular', parentesco, setParentesco, 'Ej: cónyuge, hijo/a')}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '0.6rem 1.5rem', gap: '0.5rem' }}>
          <Save style={{ width: '1rem', height: '1rem' }} />
          {saving ? 'Guardando...' : 'Guardar datos de afiliado'}
        </button>
      </div>
    </div>
  );
};
