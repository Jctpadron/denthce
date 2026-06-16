import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useOdontoVisit } from './OdontoVisitContext';
import { Save, CheckCircle, ShieldAlert, Eraser, AlertTriangle } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

interface Props {
  patientId: string;
}

const SIGNATURE_EXT = 'http://denthce.local/fhir/StructureDefinition/patient-signature';
const QUESTIONNAIRE_CANONICAL = 'http://denthce.local/Questionnaire/anamnesis-pami';

// Preguntas médicas sí/no. `detail` = pide texto cuando la respuesta es "Sí".
// `alert` = respuesta "Sí" se marca como bandera clínica (rojo).
const MEDICAL = [
  { id: 'enfermedad', label: '¿Sufre alguna enfermedad?', detail: '¿Cuál?' },
  { id: 'tratamiento', label: '¿Realiza algún tratamiento médico?', detail: '¿Qué tratamiento?' },
  { id: 'medicacion', label: '¿Consume medicación actualmente?', detail: '¿Cuál?' },
  { id: 'alergia', label: '¿Es alérgico a alguna droga?', detail: '¿Cuál?', alert: true },
  { id: 'diabetes', label: 'Diabetes', detail: null },
  { id: 'cardiacos', label: '¿Tiene problemas cardíacos?', detail: null, alert: true },
  { id: 'hta', label: 'Hipertensión arterial', detail: null },
  { id: 'anticoagulantes', label: '¿Toma aspirina o anticoagulantes?', detail: null, alert: true },
  { id: 'operado', label: '¿Fue operado?', detail: '¿De qué?' },
];

const ODONTO = [
  { id: 'otro_prof', label: '¿Consultó a otro profesional recientemente?' },
  { id: 'masticar', label: '¿Tiene dificultad para masticar?' },
  { id: 'hablar', label: '¿Tiene dificultad para hablar?' },
  { id: 'movilidad', label: '¿Tiene movilidad dentaria?' },
  { id: 'encias', label: '¿Le sangran las encías?' },
];

type BoolMap = Record<string, boolean | null>;
type TextMap = Record<string, string>;

export const AnamnesisPAMI: React.FC<Props> = ({ patientId }) => {
  const { activeEncounterId } = useOdontoVisit();
  const [bools, setBools] = useState<BoolMap>({});
  const [details, setDetails] = useState<TextMap>({});
  const [fuma, setFuma] = useState<boolean | null>(null);
  const [cigarrillos, setCigarrillos] = useState('');
  const [motivo, setMotivo] = useState('');
  const [cepillados, setCepillados] = useState('');
  const [azucar, setAzucar] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  const apiBase = `${import.meta.env.VITE_API_URL}/odontology`;
  const authHeader = { headers: { Authorization: `Bearer ${keycloak.token}` } };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiBase}/patient/${patientId}/resource`, authHeader);
      const qr = (res.data as any[])
        .filter((r) => r.resourceType === 'QuestionnaireResponse' && r.questionnaire === QUESTIONNAIRE_CANONICAL)
        .sort((a, b) => (b.authored || '').localeCompare(a.authored || ''))[0];
      if (qr) {
        setExistingId(qr.id);
        const b: BoolMap = {}; const d: TextMap = {};
        (qr.item || []).forEach((it: any) => {
          const ans = it.answer?.[0] || {};
          if (it.linkId === 'motivo') setMotivo(ans.valueString || '');
          else if (it.linkId === 'cepillados') setCepillados(ans.valueInteger != null ? String(ans.valueInteger) : '');
          else if (it.linkId === 'azucar') setAzucar(ans.valueInteger != null ? String(ans.valueInteger) : '');
          else if (it.linkId === 'fuma') { setFuma(ans.valueBoolean ?? null); const c = it.answer?.[1]; if (c?.valueInteger != null) setCigarrillos(String(c.valueInteger)); }
          else { b[it.linkId] = ans.valueBoolean ?? null; const det = it.answer?.[1]; if (det?.valueString) d[it.linkId] = det.valueString; }
        });
        setBools(b); setDetails(d);
        const sig = (qr.extension || []).find((e: any) => e.url === SIGNATURE_EXT)?.valueString;
        if (sig) setSavedSignature(sig);
      }
    } catch (err) {
      console.error('Error cargando anamnesis:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [patientId]);

  // --- Firma (canvas) ---
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true; const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();
    hasDrawn.current = true;
  };
  const end = () => { drawing.current = false; if (hasDrawn.current) setSignature(canvasRef.current!.toDataURL('image/png')); };
  const clearSig = () => {
    const c = canvasRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    hasDrawn.current = false; setSignature(null);
  };

  const setBool = (id: string, v: boolean) => setBools((s) => ({ ...s, [id]: v }));

  const handleSave = async () => {
    setSaving(true); setMessage(null);
    try {
      const item: any[] = [];
      [...MEDICAL, ...ODONTO].forEach((q) => {
        const answer: any[] = [{ valueBoolean: bools[q.id] ?? false }];
        if ((q as any).detail && details[q.id]) answer.push({ valueString: details[q.id] });
        item.push({ linkId: q.id, text: q.label, answer });
      });
      item.push({ linkId: 'fuma', text: 'Fuma', answer: [{ valueBoolean: fuma ?? false }, ...(cigarrillos ? [{ valueInteger: parseInt(cigarrillos, 10) }] : [])] });
      item.push({ linkId: 'motivo', text: 'Motivo de consulta', answer: [{ valueString: motivo }] });
      if (cepillados) item.push({ linkId: 'cepillados', text: 'Cepillados por día', answer: [{ valueInteger: parseInt(cepillados, 10) }] });
      if (azucar) item.push({ linkId: 'azucar', text: 'Momentos de azúcar', answer: [{ valueInteger: parseInt(azucar, 10) }] });

      const sig = signature || savedSignature;
      const payload: any = {
        status: 'completed',
        questionnaire: QUESTIONNAIRE_CANONICAL,
        authored: new Date().toISOString(),
        item,
        ...(sig ? { extension: [{ url: SIGNATURE_EXT, valueString: sig }] } : {}),
      };

      // Una sola anamnesis por paciente: si existe, la reemplazamos.
      if (existingId) {
        await axios.delete(`${apiBase}/resource/${existingId}`, authHeader);
      }
      const created = await axios.post(`${apiBase}/patient/${patientId}/resource`, { resourceType: 'QuestionnaireResponse', payload, encounterId: activeEncounterId }, authHeader);
      setExistingId(created.data.id);
      if (signature) setSavedSignature(signature);
      setMessage({ type: 'success', text: 'Anamnesis guardada correctamente.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'No se pudo guardar la anamnesis.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Cargando anamnesis...</p>;

  const YesNo = ({ value, onYes, onNo, alert }: { value: boolean | null; onYes: () => void; onNo: () => void; alert?: boolean }) => (
    <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
      <button type="button" onClick={onYes} className="btn" style={{
        padding: '0.3rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px',
        background: value === true ? (alert ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)') : 'var(--bg-surface)',
        borderColor: value === true ? (alert ? 'var(--color-rose)' : 'var(--color-emerald)') : 'var(--border-color)',
        color: value === true ? (alert ? 'var(--color-rose)' : 'var(--color-emerald)') : 'var(--color-text)', fontWeight: 700,
      }}>Sí</button>
      <button type="button" onClick={onNo} className="btn" style={{
        padding: '0.3rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px',
        background: value === false ? 'rgba(100,116,139,0.08)' : 'var(--bg-surface)',
        borderColor: value === false ? 'var(--color-muted)' : 'var(--border-color)',
        color: value === false ? 'var(--color-text)' : 'var(--color-text)', fontWeight: 700,
      }}>No</button>
    </div>
  );

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.25rem' };
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' };

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

      {/* Cuestionario médico */}
      <div style={card}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>Cuestionario médico</h3>
        {MEDICAL.map((q) => (
          <div key={q.id} style={rowStyle}>
            <span style={{ fontSize: '0.88rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {(q as any).alert && bools[q.id] === true && <AlertTriangle style={{ width: '0.95rem', height: '0.95rem', color: 'var(--color-rose)' }} />}
              {q.label}
            </span>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              {q.detail && bools[q.id] === true && (
                <input className="search-input" aria-label={q.detail} placeholder={q.detail} value={details[q.id] || ''} onChange={(e) => setDetails((s) => ({ ...s, [q.id]: e.target.value }))}
                  style={{ height: '32px', fontSize: '0.8rem', width: '180px' }} />
              )}
              <YesNo value={bools[q.id] ?? null} onYes={() => setBool(q.id, true)} onNo={() => setBool(q.id, false)} alert={(q as any).alert} />
            </div>
          </div>
        ))}
        <div style={{ ...rowStyle, borderBottom: 'none' }}>
          <span style={{ fontSize: '0.88rem', color: 'var(--color-text)' }}>Fuma</span>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            {fuma === true && <input className="search-input" aria-label="Cigarrillos por día" placeholder="¿Cuántos por día?" value={cigarrillos} onChange={(e) => setCigarrillos(e.target.value.replace(/\D/g, ''))} style={{ height: '32px', fontSize: '0.8rem', width: '140px' }} />}
            <YesNo value={fuma} onYes={() => setFuma(true)} onNo={() => setFuma(false)} />
          </div>
        </div>
      </div>

      {/* Historia odontológica */}
      <div style={card}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>Historia clínica odontológica</h3>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' }}>Motivo de consulta</label>
          <input className="search-input" aria-label="Motivo de consulta" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: dolor en molar inferior derecho" style={{ width: '100%' }} />
        </div>
        {ODONTO.map((q) => (
          <div key={q.id} style={rowStyle}>
            <span style={{ fontSize: '0.88rem', color: 'var(--color-text)' }}>{q.label}</span>
            <YesNo value={bools[q.id] ?? null} onYes={() => setBool(q.id, true)} onNo={() => setBool(q.id, false)} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' }}>Cepillados por día</label>
            <input className="search-input" aria-label="Cepillados por día" inputMode="numeric" value={cepillados} onChange={(e) => setCepillados(e.target.value.replace(/\D/g, ''))} style={{ width: '110px' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' }}>Momentos de azúcar</label>
            <input className="search-input" aria-label="Momentos de azúcar" inputMode="numeric" value={azucar} onChange={(e) => setAzucar(e.target.value.replace(/\D/g, ''))} style={{ width: '110px' }} />
          </div>
        </div>
      </div>

      {/* Firma del paciente */}
      <div style={card}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>Firma del paciente</h3>
        {savedSignature && !signature && (
          <div style={{ marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-emerald)', fontWeight: 600 }}>✔ Firma registrada</span>
            <img src={savedSignature} alt="Firma" style={{ display: 'block', maxHeight: '90px', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '0.35rem', background: '#fff' }} />
          </div>
        )}
        <canvas
          ref={canvasRef} width={500} height={140}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
          style={{ width: '100%', maxWidth: '500px', height: '140px', border: '1px dashed var(--border-color)', borderRadius: '10px', background: '#fff', touchAction: 'none', cursor: 'crosshair' }}
        />
        <div style={{ marginTop: '0.5rem' }}>
          <button type="button" className="btn" onClick={clearSig} style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', gap: '0.35rem' }}>
            <Eraser style={{ width: '0.85rem', height: '0.85rem' }} /> Limpiar firma
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '0.6rem 1.5rem', gap: '0.5rem' }}>
          <Save style={{ width: '1rem', height: '1rem' }} />
          {saving ? 'Guardando...' : 'Guardar anamnesis'}
        </button>
      </div>
    </div>
  );
};
