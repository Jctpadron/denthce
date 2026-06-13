import React, { useState, useEffect, useRef } from 'react';
import { Search, Save, FileText, CheckCircle, ShieldAlert, Sparkles, User, Calendar, Lock } from 'lucide-react';
import cie10Data from '../data/cie10-odonto.json';

interface SoapEditorProps {
  encounter?: any; // undefined para nueva consulta
  onSave: (data: any) => Promise<void>;
  onSign: () => Promise<void>;
  onCancel: () => void;
}

export const SoapEditor: React.FC<SoapEditorProps> = ({ encounter, onSave, onSign, onCancel }) => {
  const isSigned = encounter?.status === 'finished';

  // Estados para los campos SOAP
  const [subjetivo, setSubjetivo] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [apreciacion, setApreciacion] = useState('');
  const [plan, setPlan] = useState('');

  // Clase del encuentro
  const [classCode, setClassCode] = useState('AMB');

  // CIE-10 autocomplete
  const [cieSearch, setCieSearch] = useState('');
  const [showCieList, setShowCieList] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<{ code: string; display: string }[]>([]);
  const cieRef = useRef<HTMLDivElement>(null);

  // Mensaje local de carga/error
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (encounter) {
      setClassCode(encounter.class?.code || 'AMB');
      
      // Parsear notas SOAP desde notes
      const notes = encounter.note || [];
      const sNote = notes.find((n: any) => n.text?.startsWith('S: '))?.text?.replace(/^S:\s*/, '') || '';
      const oNote = notes.find((n: any) => n.text?.startsWith('O: '))?.text?.replace(/^O:\s*/, '') || '';
      const aNote = notes.find((n: any) => n.text?.startsWith('A: '))?.text?.replace(/^A:\s*/, '') || '';
      const pNote = notes.find((n: any) => n.text?.startsWith('P: '))?.text?.replace(/^P:\s*/, '') || '';
      
      setSubjetivo(sNote);
      setObjetivo(oNote);
      setApreciacion(aNote);
      setPlan(pNote);

      // Parsear diagnósticos CIE-10
      const reasonCodes = encounter.reasonCode || [];
      const diagnoses = reasonCodes.map((rc: any) => {
        const coding = rc.coding?.[0] || {};
        return { code: coding.code, display: coding.display };
      });
      setSelectedDiagnoses(diagnoses);
    }
  }, [encounter]);

  // Cerrar buscador de CIE-10 si hace click afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cieRef.current && !cieRef.current.contains(e.target as Node)) {
        setShowCieList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrar diagnósticos
  const filteredCie = cie10Data.filter(d => 
    d.code.toLowerCase().includes(cieSearch.toLowerCase()) || 
    d.display.toLowerCase().includes(cieSearch.toLowerCase())
  );

  const handleSelectCie = (diag: { code: string; display: string }) => {
    if (!selectedDiagnoses.some(d => d.code === diag.code)) {
      setSelectedDiagnoses([...selectedDiagnoses, diag]);
    }
    setCieSearch('');
    setShowCieList(false);
  };

  const handleRemoveCie = (code: string) => {
    if (isSigned) return;
    setSelectedDiagnoses(selectedDiagnoses.filter(d => d.code !== code));
  };

  const handleSave = async () => {
    setErrorMsg(null);
    setSaving(true);
    try {
      const data = {
        class: {
          code: classCode,
          display: classCode === 'AMB' ? 'Ambulatorio' : classCode === 'URG' ? 'Urgencias' : 'Control / Seguimiento'
        },
        reasonCode: selectedDiagnoses.map(d => ({
          coding: [{
            system: 'http://hl7.org/fhir/sid/icd-10',
            code: d.code,
            display: d.display
          }]
        })),
        note: [
          { text: `S: ${subjetivo}` },
          { text: `O: ${objetivo}` },
          { text: `A: ${apreciacion}` },
          { text: `P: ${plan}` }
        ]
      };
      await onSave(data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Error al guardar la consulta');
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!subjetivo.trim() && !objetivo.trim() && !apreciacion.trim() && !plan.trim()) {
      setErrorMsg('No se puede firmar una consulta totalmente vacía.');
      return;
    }
    setErrorMsg(null);
    setSigning(true);
    try {
      await onSign();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Error al firmar la consulta');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease' }}>
      
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontFamily: 'var(--font-title)' }}>
            <FileText style={{ color: '#2962ff' }} />
            {encounter ? `Consulta: ${encounter.id.slice(0,8).toUpperCase()}` : 'Nueva Nota SOAP'}
            {isSigned && (
              <span style={{
                fontSize: '0.72rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--color-emerald)',
                padding: '0.2rem 0.6rem',
                borderRadius: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                marginLeft: '0.75rem',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <Lock style={{ width: '0.8rem', height: '0.8rem' }} />
                Nota Firmada
              </span>
            )}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-muted)', margin: '0.2rem 0 0 0' }}>
            Documenta la atención asistencial del paciente en formato SOAP.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onCancel} style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}>
          Volver al Historial
        </button>
      </div>

      {errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--color-rose)', color: 'var(--color-rose)', padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
          <ShieldAlert style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid del Formulario */}
      <div className="soap-editor-grid">
        
        {/* Editor SOAP (4 Campos) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: '#2962ff', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(41, 98, 255, 0.08)', borderRadius: '50%', fontSize: '0.7rem', fontWeight: 800 }}>S</span>
              Subjetivo (Motivo de consulta, síntomas referidos por el paciente)
            </label>
            <textarea
              className="search-input"
              rows={3}
              value={subjetivo}
              onChange={(e) => setSubjetivo(e.target.value)}
              disabled={isSigned}
              placeholder="Ej: Paciente refiere dolor punzante en zona molar inferior derecha desde hace 3 días..."
              style={{ fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: '#2962ff', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(41, 98, 255, 0.08)', borderRadius: '50%', fontSize: '0.7rem', fontWeight: 800 }}>O</span>
              Objetivo (Hallazgos del examen físico, signos vitales, exploración bucal)
            </label>
            <textarea
              className="search-input"
              rows={3}
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              disabled={isSigned}
              placeholder="Ej: A la exploración se observa lesión cariosa profunda en pieza 46. Sensibilidad a la percusión vertical..."
              style={{ fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: '#2962ff', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(41, 98, 255, 0.08)', borderRadius: '50%', fontSize: '0.7rem', fontWeight: 800 }}>A</span>
              Apreciación (Diagnóstico presuntivo, análisis de evolución, notas clínicas)
            </label>
            <textarea
              className="search-input"
              rows={3}
              value={apreciacion}
              onChange={(e) => setApreciacion(e.target.value)}
              disabled={isSigned}
              placeholder="Ej: Caries de dentina profunda activa con pulpalgia reversible en 46..."
              style={{ fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: '#2962ff', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(41, 98, 255, 0.08)', borderRadius: '50%', fontSize: '0.7rem', fontWeight: 800 }}>P</span>
              Plan (Tratamiento inmediato, medicamentos, indicaciones, derivaciones, próxima cita)
            </label>
            <textarea
              className="search-input"
              rows={3}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              disabled={isSigned}
              placeholder="Ej: Se realiza apertura cavitaria y restauración provisional. Se agenda turno para endodoncia..."
              style={{ fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

        </div>

        {/* Panel Lateral: Metadata, CIE-10 y Acciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Tipo de Consulta */}
          <div className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Tipo de Consulta</h4>
            <select
              className="search-input"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              disabled={isSigned}
              style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
            >
              <option value="AMB">Ambulatorio / General</option>
              <option value="URG">Urgencias / Guardia</option>
              <option value="CTRL">Control / Seguimiento</option>
            </select>
          </div>

          {/* Autocompletado CIE-10 */}
          <div className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} ref={cieRef}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles style={{ width: '0.95rem', height: '0.95rem', color: '#2962ff' }} />
              Codificación CIE-10
            </h4>
            
            {!isSigned && (
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', width: '0.9rem', height: '0.9rem', color: 'var(--color-muted)' }} />
                <input
                  type="text"
                  className="search-input"
                  style={{ paddingLeft: '2.1rem', paddingRight: '1rem', fontSize: '0.82rem', height: '36px' }}
                  placeholder="Buscar diagnóstico..."
                  value={cieSearch}
                  onChange={(e) => {
                    setCieSearch(e.target.value);
                    setShowCieList(true);
                  }}
                  onFocus={() => setShowCieList(true)}
                />

                {showCieList && cieSearch.trim().length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    zIndex: 10,
                    marginTop: '0.25rem'
                  }}>
                    {filteredCie.length === 0 ? (
                      <div style={{ padding: '0.65rem', fontSize: '0.8rem', color: 'var(--color-muted)', textAlign: 'center' }}>Sin resultados</div>
                    ) : (
                      filteredCie.map(diag => (
                        <div
                          key={diag.code}
                          onClick={() => handleSelectCie(diag)}
                          style={{
                            padding: '0.55rem 0.75rem',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <strong>{diag.code}</strong> - {diag.display}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Listado de seleccionados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
              {selectedDiagnoses.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', textAlign: 'center', padding: '0.5rem 0', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                  Sin códigos vinculados.
                </div>
              ) : (
                selectedDiagnoses.map(d => (
                  <div key={d.code} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc',
                    border: '1px solid var(--border-color)',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    gap: '0.5rem'
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 800, color: '#2962ff', marginRight: '0.25rem' }}>{d.code}</span>
                      <span style={{ color: 'var(--color-text)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{d.display}</span>
                    </div>
                    {!isSigned && (
                      <button
                        onClick={() => handleRemoveCie(d.code)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-rose)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800 }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Firma o Controles */}
          <div className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {isSigned ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-emerald)', fontSize: '0.8rem', fontWeight: 700 }}>
                  <CheckCircle style={{ width: '1rem', height: '1rem' }} />
                  Nota Firmada y Bloqueada
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem', background: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <User style={{ width: '0.8rem', height: '0.8rem' }} />
                    {encounter.signedBy}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Calendar style={{ width: '0.8rem', height: '0.8rem' }} />
                    {new Date(encounter.signedAt).toLocaleString()}
                  </span>
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Hash: {encounter.contentHash}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleSave}
                  disabled={saving || signing}
                  style={{ width: '100%', fontSize: '0.82rem', height: '40px' }}
                >
                  <Save style={{ width: '0.95rem', height: '0.95rem' }} />
                  {saving ? 'Guardando...' : 'Guardar Borrador'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSign}
                  disabled={saving || signing}
                  style={{ width: '100%', fontSize: '0.82rem', height: '40px' }}
                >
                  <Lock style={{ width: '0.95rem', height: '0.95rem' }} />
                  {signing ? 'Firmando...' : 'Firmar Nota Asistencial'}
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
