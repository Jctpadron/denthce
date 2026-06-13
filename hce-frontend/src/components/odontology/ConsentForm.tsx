import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Save, CheckCircle, ShieldAlert, Eraser, FileSignature } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

interface Props {
  patientId: string;
}

const DEFAULT_TEXT =
  'He comprendido todas las explicaciones que se me han facilitado en lenguaje claro y sencillo, ' +
  'he podido realizar todas las observaciones y se me han aclarado todas las dudas; por lo que estoy ' +
  'completamente de acuerdo con el tratamiento odontológico que se me va a realizar, otorgando mi ' +
  'consentimiento para rehabilitar mi salud bucodental según el plan propuesto por el profesional.';

// Pad de firma reutilizable
const SignaturePad: React.FC<{ label: string; saved: string | null; onChange: (dataUrl: string | null) => void }> = ({ label, saved, onChange }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const drawn = useRef(false);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => { drawing.current = true; const c = ref.current!.getContext('2d')!; const p = pos(e); c.beginPath(); c.moveTo(p.x, p.y); ref.current!.setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const c = ref.current!.getContext('2d')!; const p = pos(e); c.lineTo(p.x, p.y); c.strokeStyle = '#0f172a'; c.lineWidth = 2; c.lineCap = 'round'; c.stroke(); drawn.current = true; };
  const end = () => { drawing.current = false; if (drawn.current) onChange(ref.current!.toDataURL('image/png')); };
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); drawn.current = false; onChange(null); };
  return (
    <div style={{ flex: 1, minWidth: '260px' }}>
      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)', display: 'block', marginBottom: '0.35rem' }}>{label}</label>
      {saved && (
        <img src={saved} alt={label} style={{ display: 'block', maxHeight: '70px', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '0.35rem', background: '#fff' }} />
      )}
      <canvas ref={ref} width={400} height={120} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
        style={{ width: '100%', height: '120px', border: '1px dashed var(--border-color)', borderRadius: '10px', background: '#fff', touchAction: 'none', cursor: 'crosshair' }} />
      <button type="button" className="btn" onClick={clear} style={{ marginTop: '0.4rem', padding: '0.3rem 0.7rem', fontSize: '0.78rem', gap: '0.3rem' }}>
        <Eraser style={{ width: '0.8rem', height: '0.8rem' }} /> Limpiar
      </button>
    </div>
  );
};

export const ConsentForm: React.FC<Props> = ({ patientId }) => {
  const [texto] = useState(DEFAULT_TEXT);
  const [acepta, setAcepta] = useState(false);
  const [firmaPaciente, setFirmaPaciente] = useState<string | null>(null);
  const [firmaProfesional, setFirmaProfesional] = useState<string | null>(null);
  const [savedPaciente, setSavedPaciente] = useState<string | null>(null);
  const [savedProfesional, setSavedProfesional] = useState<string | null>(null);
  const [matricula, setMatricula] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [firmadoEl, setFirmadoEl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const apiBase = `${import.meta.env.VITE_API_URL}/odontology`;
  const authHeader = { headers: { Authorization: `Bearer ${keycloak.token}` } };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/patient/${patientId}/resource`, authHeader);
      const cons = (res.data as any[]).filter((r) => r.resourceType === 'Consent').slice(-1)[0];
      if (cons) {
        setExistingId(cons.id);
        setSavedPaciente(cons.firmaPaciente || null);
        setSavedProfesional(cons.firmaProfesional || null);
        setMatricula(cons.matricula || '');
        setFirmadoEl(cons.dateTime || null);
        setAcepta(true);
      }
    } catch (err) {
      console.error('Error cargando consentimiento:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [patientId]);

  const pacienteSig = firmaPaciente || savedPaciente;
  const profesionalSig = firmaProfesional || savedProfesional;
  const canSign = acepta && !!pacienteSig && !!profesionalSig && matricula.trim() !== '';

  const handleSign = async () => {
    if (!canSign) return;
    setSaving(true); setMessage(null);
    try {
      const now = new Date().toISOString();
      const payload: any = {
        status: 'active',
        scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' }] },
        patient: { reference: `Patient/${patientId}` },
        dateTime: now,
        text: texto,
        matricula,
        firmaPaciente: pacienteSig,
        firmaProfesional: profesionalSig,
      };
      if (existingId) await axios.delete(`${apiBase}/resource/${existingId}`, authHeader);
      const created = await axios.post(`${apiBase}/patient/${patientId}/resource`, { resourceType: 'Consent', payload }, authHeader);
      setExistingId(created.data.id);
      setSavedPaciente(pacienteSig); setSavedProfesional(profesionalSig); setFirmadoEl(now);
      setMessage({ type: 'success', text: 'Consentimiento firmado y registrado correctamente.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'No se pudo registrar el consentimiento.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Cargando consentimiento...</p>;

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

      {firmadoEl && (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CheckCircle style={{ width: '1rem', height: '1rem' }} /> Consentimiento firmado el {new Date(firmadoEl).toLocaleString('es-AR')}
        </div>
      )}

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileSignature style={{ width: '1.1rem', height: '1.1rem', color: 'var(--color-primary)' }} /> Consentimiento informado
        </h3>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--color-text)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.85rem 1rem', maxHeight: '160px', overflowY: 'auto' }}>
          {texto}
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.86rem', color: 'var(--color-text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} style={{ width: '1.05rem', height: '1.05rem' }} />
          Confirmo que leí y comprendí en lenguaje claro (obligatorio)
        </label>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <SignaturePad label="Firma del paciente / tutor" saved={savedPaciente && !firmaPaciente ? savedPaciente : null} onChange={setFirmaPaciente} />
        <div style={{ flex: 1, minWidth: '260px' }}>
          <SignaturePad label="Firma y sello del profesional" saved={savedProfesional && !firmaProfesional ? savedProfesional : null} onChange={setFirmaProfesional} />
          <div style={{ marginTop: '0.6rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' }}>Matrícula (M.N. / M.P.)</label>
            <input className="search-input" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Ej: M.P. 12345" style={{ width: '100%' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
        {!canSign && <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>Requiere aceptación + ambas firmas + matrícula.</span>}
        <button type="button" className="btn btn-primary" onClick={handleSign} disabled={!canSign || saving} style={{ padding: '0.6rem 1.5rem', gap: '0.5rem', opacity: canSign ? 1 : 0.5 }}>
          <Save style={{ width: '1rem', height: '1rem' }} />
          {saving ? 'Registrando...' : 'Confirmar y firmar'}
        </button>
      </div>
    </div>
  );
};
