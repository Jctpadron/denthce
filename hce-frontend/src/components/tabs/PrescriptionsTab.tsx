import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Award, FileText, CheckCircle, ShieldAlert, Edit3, Plus, Search, Sparkles, QrCode } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';
import { PrescriptionForm } from '../PrescriptionForm';

interface PrescriptionsTabProps {
  patientId: string;
}

export const PrescriptionsTab: React.FC<PrescriptionsTabProps> = ({ patientId }) => {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Control de vistas
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [selectedQr, setSelectedQr] = useState<string | null>(null);

  const fetchPrescriptions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/MedicationRequest`,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setPrescriptions(res.data);
    } catch (e) {
      console.error('Error cargando recetas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [patientId]);

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingId(undefined);
    fetchPrescriptions();
  };

  const handleEditDraft = (id: string) => {
    setEditingId(id);
    setShowForm(true);
  };

  const formatDate = (dt?: string) => {
    if (!dt) return '';
    return new Date(dt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* 1. Header */}
      {!showForm && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
              Recetario Electrónico
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-muted)' }}>
              {prescriptions.length} recetas emitidas o en preparación
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(undefined);
              setShowForm(true);
            }}
            className="btn btn-primary"
            style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', gap: '0.25rem' }}
          >
            <Plus style={{ width: '0.9rem', height: '0.9rem' }} />
            Nueva Receta
          </button>
        </div>
      )}

      {/* 2. Visualización de Formulario */}
      {showForm && (
        <PrescriptionForm
          patientId={patientId}
          prescriptionId={editingId}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setShowForm(false);
            setEditingId(undefined);
          }}
        />
      )}

      {/* 3. Popup del QR de Validación */}
      {selectedQr && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '360px',
            width: '90%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            textAlign: 'center',
            boxShadow: 'var(--shadow-card)'
          }}>
            <QrCode style={{ width: '4.5rem', height: '4.5rem', color: '#1e293b' }} />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Código QR Farmacéutico</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-muted)', margin: 0, wordBreak: 'break-all' }}>
              {selectedQr}
            </p>
            <span style={{ fontSize: '0.68rem', color: 'var(--color-muted)' }}>
              Escanee para validar la receta electrónica digital y verificar la firma lógica contra el padrón oficial de profesionales.
            </span>
            <button
              onClick={() => setSelectedQr(null)}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '0.5rem' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* 4. Listado de Recetas */}
      {!showForm && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '2rem' }}>
              Cargando historial de recetas...
            </div>
          ) : prescriptions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: 'var(--color-muted)',
              padding: '3rem 1rem',
              border: '1px dashed var(--border-color)',
              borderRadius: '12px',
              background: 'var(--bg-card)',
              fontSize: '0.85rem'
            }}>
              Sin recetas registradas para este paciente. Presione "Nueva Receta" arriba para prescribir.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {prescriptions.map((pr) => {
                const isDraft = pr.status === 'draft';
                const medName = pr.medicationCodeableConcept?.text || 'Fármaco sin nombre';
                const dosage = pr.dosageInstruction?.[0]?.text || 'Sin indicaciones de dosis';
                const duration = pr.dispenseRequest?.expectedSupplyDuration?.value || '—';
                const createdDate = pr.authoredOn;

                return (
                  <div
                    key={pr.id}
                    className="card-premium-health"
                    style={{
                      borderLeft: `4px solid ${isDraft ? 'var(--color-amber)' : 'var(--color-emerald)'}`,
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: '0.75rem',
                    }}
                  >
                    <div className="card-premium-left" style={{ gap: '0.4rem' }}>
                      <div className="card-premium-title-container">
                        <span className="card-premium-icon-sutil">
                          <FileText style={{ width: '1.1rem', height: '1.1rem', color: isDraft ? 'var(--color-amber)' : 'var(--color-emerald)' }} />
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>
                          {medName}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          background: isDraft ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                          color: isDraft ? 'var(--color-amber)' : 'var(--color-emerald)',
                          border: `1px solid ${isDraft ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
                          letterSpacing: '0.03em'
                        }}>
                          {isDraft ? 'Borrador' : 'Firma Activa'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)', fontWeight: 500 }}>
                          · {formatDate(createdDate)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.15rem' }}>
                        <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--color-text)', fontWeight: 500, lineHeight: 1.4 }}>
                          Posología: {dosage}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                          Duración: {duration} días de tratamiento
                        </p>
                      </div>
                    </div>

                    {/* Acciones e Info de Firma */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '0.75rem',
                      marginTop: '0.15rem',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      {/* Firma lógica o Botón de Editar */}
                      {isDraft ? (
                        <button
                          onClick={() => handleEditDraft(pr.id)}
                          className="btn btn-secondary"
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.72rem',
                            borderRadius: '8px',
                            gap: '0.25rem'
                          }}
                        >
                          <Edit3 style={{ width: '0.8rem', height: '0.8rem' }} />
                          Editar y Firmar
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-muted)', fontSize: '0.72rem' }}>
                          <CheckCircle style={{ width: '0.85rem', height: '0.85rem', color: 'var(--color-emerald)' }} />
                          <span>Firmado por <strong>{pr.signedBy}</strong> el {formatDate(pr.signedAt)}</span>
                        </div>
                      )}

                      {/* Icono de visualización de QR para las recetas firmadas */}
                      {!isDraft && pr.qrCodeData && (
                        <button
                          onClick={() => setSelectedQr(pr.qrCodeData)}
                          style={{
                            background: '#f8fafc',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '0.35rem 0.65rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--color-text)',
                            transition: 'var(--transition-smooth)'
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = '#2962ff'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        >
                          <QrCode style={{ width: '0.85rem', height: '0.85rem', color: '#2962ff' }} />
                          Ver QR
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

    </div>
  );
};
