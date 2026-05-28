import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Calendar, User, FileText, Lock, Unlock, Clock, Sparkles } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';
import { SoapEditor } from '../SoapEditor';

interface EncountersTabProps {
  patientId: string;
}

export const EncountersTab: React.FC<EncountersTabProps> = ({ patientId }) => {
  const [encounters, setEncounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vista activa: 'list' | 'create' | 'edit'
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedEncounter, setSelectedEncounter] = useState<any | null>(null);

  const loadEncounters = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/encounter`,
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );
      setEncounters(res.data);
    } catch (err: any) {
      console.error('Error cargando consultas:', err);
      setError('No se pudo cargar el historial de consultas del paciente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEncounters();
  }, [patientId]);

  const handleSave = async (data: any) => {
    try {
      if (view === 'create') {
        await axios.post(
          `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/encounter`,
          data,
          {
            headers: {
              Authorization: `Bearer ${keycloak.token}`,
            },
          }
        );
      } else if (view === 'edit' && selectedEncounter) {
        await axios.put(
          `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/encounter/${selectedEncounter.id}`,
          data,
          {
            headers: {
              Authorization: `Bearer ${keycloak.token}`,
            },
          }
        );
      }
      setView('list');
      setSelectedEncounter(null);
      loadEncounters();
    } catch (err: any) {
      throw err;
    }
  };

  const handleSign = async () => {
    if (!selectedEncounter) return;
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/encounter/${selectedEncounter.id}/sign`,
        {},
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );
      setView('list');
      setSelectedEncounter(null);
      loadEncounters();
    } catch (err: any) {
      throw err;
    }
  };

  if (view === 'create') {
    return (
      <SoapEditor
        onSave={handleSave}
        onSign={async () => {}} // No se firma de entrada sin guardar borrador primero
        onCancel={() => setView('list')}
      />
    );
  }

  if (view === 'edit' && selectedEncounter) {
    return (
      <SoapEditor
        encounter={selectedEncounter}
        onSave={handleSave}
        onSign={handleSign}
        onCancel={() => {
          setView('list');
          setSelectedEncounter(null);
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Botones de acción superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-title)' }}>
            Consultas Médicas / Notas SOAP
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', margin: '0.15rem 0 0 0' }}>
            Historial cronológico de atenciones, diagnósticos y evoluciones del paciente.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setView('create')}
          style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem' }}
        >
          <Plus style={{ width: '0.95rem', height: '0.95rem' }} />
          Nueva Consulta
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-muted)', fontSize: '0.85rem' }}>
          Cargando consultas asistenciales...
        </div>
      ) : error ? (
        <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.04)', border: '1px solid var(--color-rose)', borderRadius: '12px', color: 'var(--color-rose)', fontSize: '0.82rem' }}>
          {error}
        </div>
      ) : encounters.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: 'var(--color-muted)',
          fontSize: '0.85rem',
          padding: '4rem 1rem',
          border: '1px dashed var(--border-color)',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <FileText style={{ width: '2.5rem', height: '2.5rem', color: 'var(--color-muted)', strokeWidth: 1.2 }} />
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 0.2rem 0', color: 'var(--color-text)' }}>Sin consultas registradas</p>
            <p style={{ margin: 0, fontSize: '0.78rem' }}>Presiona "Nueva Consulta" para iniciar el registro clínico del paciente.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {encounters.map((enc) => {
            const isFinished = enc.status === 'finished';
            const notes = enc.note || [];
            const diagCode = enc.reasonCode?.[0]?.coding?.[0]?.code || 'Sin diagnóstico';
            const diagDisplay = enc.reasonCode?.[0]?.coding?.[0]?.display || 'Consulta general';
            
            // Extract preview from notes
            const sPreview = notes.find((n: any) => n.text?.startsWith('S: '))?.text?.replace(/^S:\s*/, '') || '';
            const pPreview = notes.find((n: any) => n.text?.startsWith('P: '))?.text?.replace(/^P:\s*/, '') || '';

            return (
              <div
                key={enc.id}
                onClick={() => {
                  setSelectedEncounter(enc);
                  setView('edit');
                }}
                style={{
                  padding: '1.25rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  e.currentTarget.style.borderColor = 'var(--border-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
                      {diagDisplay}
                    </span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#2962ff', backgroundColor: 'rgba(41, 98, 255, 0.06)', padding: '0.15rem 0.45rem', borderRadius: '6px' }}>
                      {diagCode}
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      backgroundColor: isFinished ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)',
                      color: isFinished ? 'var(--color-emerald)' : 'var(--color-amber)',
                      border: `1px solid ${isFinished ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'}`
                    }}>
                      {isFinished ? <Lock style={{ width: '0.75rem', height: '0.75rem' }} /> : <Unlock style={{ width: '0.75rem', height: '0.75rem' }} />}
                      {isFinished ? 'Firmado' : 'Borrador'}
                    </span>
                  </div>

                  {sPreview && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong style={{ color: 'var(--color-text)' }}>S:</strong> {sPreview}
                    </p>
                  )}

                  {pPreview && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong style={{ color: 'var(--color-text)' }}>P:</strong> {pPreview}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: '0.25rem', fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar style={{ width: '0.8rem', height: '0.8rem' }} />
                      {new Date(enc.period?.start).toLocaleDateString()}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock style={{ width: '0.8rem', height: '0.8rem' }} />
                      {new Date(enc.period?.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isFinished && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <User style={{ width: '0.8rem', height: '0.8rem' }} />
                        Firmado por: {enc.signedBy}
                      </span>
                    )}
                  </div>

                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', height: '100%' }}>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                    ID: {enc.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
