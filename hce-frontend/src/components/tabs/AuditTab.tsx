import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, User, Clock, ChevronDown, ChevronUp, CheckCircle, PlusCircle } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

interface AuditTabProps {
  patientId: string;
}

const FIELD_LABELS: Record<string, string> = {
  dni: 'DNI',
  familyName: 'Apellido',
  givenName: 'Nombre',
  gender: 'Género',
  birthDate: 'Fecha de Nacimiento',
  phone: 'Teléfono',
  email: 'Email',
  address: 'Domicilio',
};

const GENDER_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  other: 'Otro',
  unknown: 'No especificado',
};

function formatValue(field: string, value: any): string {
  if (value === null || value === undefined || value === '') return '(vacío)';
  if (field === 'gender') return GENDER_LABELS[value] || value;
  return String(value);
}

export const AuditTab: React.FC<AuditTabProps> = ({ patientId }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAudit = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/audit`,
          { headers: { Authorization: `Bearer ${keycloak.token}` } }
        );
        setLogs(response.data || []);
      } catch (err: any) {
        setError('No se pudo cargar el historial de auditoría.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, [patientId]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem', color: 'var(--color-muted)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
          <p>Cargando historial de cambios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-rose)' }}>
        <Shield style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem' }} />
        <p>{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-muted)', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
        <Shield style={{ width: '2.5rem', height: '2.5rem', margin: '0 auto 1rem', opacity: 0.4 }} />
        <p style={{ fontWeight: 600 }}>Sin cambios registrados</p>
        <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Los cambios demográficos del paciente aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Shield style={{ width: '1.4rem', height: '1.4rem', color: '#2962ff' }} />
        <div>
          <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: '1.05rem' }}>
            Trazabilidad de Cambios Demográficos
          </h4>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-muted)' }}>
            {logs.length} evento{logs.length !== 1 ? 's' : ''} registrado{logs.length !== 1 ? 's' : ''} · Auditoría FHIR R4
          </p>
        </div>
      </div>

      {/* Timeline de eventos */}
      <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
        {/* Línea vertical del timeline */}
        <div style={{
          position: 'absolute',
          left: '7px',
          top: '12px',
          bottom: '12px',
          width: '2px',
          background: 'linear-gradient(to bottom, #2962ff44, #2962ff11)',
          borderRadius: '2px',
        }} />

        {logs.map((log, index) => {
          const isExpanded = expandedIds.has(log.id);
          const isCreate = log.action === 'CREATE';
          const changedFields = log.changedFields || {};
          const fieldCount = Object.keys(changedFields).length;
          const date = new Date(log.createdAt);

          return (
            <div
              key={log.id}
              style={{
                position: 'relative',
                marginBottom: index < logs.length - 1 ? '0.75rem' : 0,
                marginLeft: '0.75rem',
              }}
            >
              {/* Punto del timeline */}
              <div style={{
                position: 'absolute',
                left: '-1.5rem',
                top: '14px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: isCreate ? '#10b981' : '#2962ff',
                border: '2px solid white',
                boxShadow: `0 0 0 2px ${isCreate ? '#10b98133' : '#2962ff33'}`,
              }} />

              {/* Card del evento */}
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s ease',
                }}
              >
                {/* Header del evento */}
                <div
                  onClick={() => !isCreate && fieldCount > 0 && toggleExpand(log.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    cursor: (!isCreate && fieldCount > 0) ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {/* Badge de acción */}
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.6rem',
                      borderRadius: '999px',
                      background: isCreate ? 'rgba(16, 185, 129, 0.1)' : 'rgba(41, 98, 255, 0.1)',
                      color: isCreate ? '#10b981' : '#2962ff',
                      border: `1px solid ${isCreate ? '#10b98133' : '#2962ff33'}`,
                    }}>
                      {isCreate
                        ? <><PlusCircle style={{ width: '0.7rem', height: '0.7rem' }} /> Alta</>
                        : <><CheckCircle style={{ width: '0.7rem', height: '0.7rem' }} /> Modificación</>
                      }
                    </span>

                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
                        {isCreate
                          ? 'Registro inicial del paciente'
                          : fieldCount > 0
                            ? `${fieldCount} campo${fieldCount !== 1 ? 's' : ''} modificado${fieldCount !== 1 ? 's' : ''}`
                            : 'Sin cambios detectados'
                        }
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.15rem', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <User style={{ width: '0.7rem', height: '0.7rem' }} />
                          {log.userName || 'Sistema'}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock style={{ width: '0.7rem', height: '0.7rem' }} />
                          {date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          {' '}
                          {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isCreate && fieldCount > 0 && (
                    <div style={{ color: 'var(--color-muted)' }}>
                      {isExpanded
                        ? <ChevronUp style={{ width: '1rem', height: '1rem' }} />
                        : <ChevronDown style={{ width: '1rem', height: '1rem' }} />
                      }
                    </div>
                  )}
                </div>

                {/* Detalle del diff — solo si está expandido y hay campos modificados */}
                {isExpanded && !isCreate && fieldCount > 0 && (
                  <div style={{
                    borderTop: '1px solid var(--border-color)',
                    padding: '0.75rem 1rem',
                    background: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}>
                    {Object.entries(changedFields).map(([field, diff]: [string, any]) => (
                      <div key={field} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: '0.5rem', alignItems: 'start', fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-muted)', fontSize: '0.73rem', textTransform: 'uppercase', paddingTop: '2px' }}>
                          {FIELD_LABELS[field] || field}
                        </span>
                        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px', padding: '0.3rem 0.5rem', color: '#b91c1c', textDecoration: 'line-through', wordBreak: 'break-all' }}>
                          {formatValue(field, diff.before)}
                        </div>
                        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '6px', padding: '0.3rem 0.5rem', color: '#047857', wordBreak: 'break-all' }}>
                          {formatValue(field, diff.after)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
