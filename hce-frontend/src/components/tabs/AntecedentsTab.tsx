import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, CheckCircle, Save, Plus, Trash2, ClipboardList, RefreshCw } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

interface AntecedentsTabProps {
  patientId: string;
}

interface ConditionResource {
  id?: string;
  category: 'personal' | 'familiar';
  code: string; // Ej: 'HTA', 'Diabetes Tipo 2'
  clinicalStatus: 'active' | 'resolved' | 'inactive';
  note?: string; // Observaciones
}

export const AntecedentsTab: React.FC<AntecedentsTabProps> = ({ patientId }) => {
  const [conditions, setConditions] = useState<ConditionResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campos para el formulario de nuevo antecedente
  const [category, setCategory] = useState<'personal' | 'familiar'>('personal');
  const [code, setCode] = useState('');
  const [clinicalStatus, setClinicalStatus] = useState<'active' | 'resolved' | 'inactive'>('active');
  const [note, setNote] = useState('');

  const loadAntecedents = async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargamos recursos clínicos de tipo 'Condition'
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/clinical-resource`,
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );

      // Filtramos solo los que son Conditions de antecedentes
      const filtered = res.data
        .filter((r: any) => r.resourceType === 'Condition' && (r.body?.category === 'personal' || r.body?.category === 'familiar' || r.payload?.category === 'personal' || r.payload?.category === 'familiar'))
        .map((r: any) => {
          const payload = r.payload || r.body || {};
          return {
            id: r.id,
            category: payload.category,
            code: payload.code?.text || 'Desconocido',
            clinicalStatus: payload.clinicalStatus || 'active',
            note: payload.note?.[0]?.text || '',
          };
        });

      setConditions(filtered);
    } catch (err: any) {
      console.error('Error al cargar antecedentes:', err);
      setError('Error al conectar con la base de datos de antecedentes clínicos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAntecedents();
  }, [patientId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setSaving(true);
    setError(null);

    // Formatear payload FHIR Condition para antecedentes
    const fhirCondition = {
      resourceType: 'Condition',
      clinicalStatus: clinicalStatus,
      verificationStatus: 'confirmed',
      category: category, // extensión conceptual simplificada
      code: {
        text: code,
      },
      note: note ? [{ text: note }] : [],
    };

    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/clinical-resource`,
        {
          resourceType: 'Condition',
          payload: fhirCondition,
        },
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );

      // Limpiar formulario y recargar
      setCode('');
      setNote('');
      loadAntecedents();
    } catch (err: any) {
      console.error('Error al guardar antecedente:', err);
      setError('No se pudo guardar el antecedente clínico.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar este antecedente clínico?')) return;
    setError(null);
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/clinical-resource/${id}`,
        {
          headers: {
            Authorization: `Bearer ${keycloak.token}`,
          },
        }
      );
      loadAntecedents();
    } catch (err: any) {
      console.error('Error eliminando antecedente:', err);
      setError('No se pudo eliminar el antecedente seleccionado.');
    }
  };

  const personalAntecedents = conditions.filter(c => c.category === 'personal');
  const familiarAntecedents = conditions.filter(c => c.category === 'familiar');

  return (
    <div className="antecedents-grid">
      
      {/* Listas de Antecedentes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Antecedentes Personales */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.45rem', fontFamily: 'var(--font-title)' }}>
            <ClipboardList style={{ width: '1.1rem', height: '1.1rem', color: '#2962ff' }} />
            Antecedentes Personales Patológicos / Fisiológicos
          </h3>
          
          {loading ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', textAlign: 'center', padding: '1rem 0' }}>Cargando datos...</div>
          ) : personalAntecedents.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', padding: '1.5rem 0', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
              Sin antecedentes registrados.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {personalAntecedents.map((ant) => (
                <div key={ant.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ color: 'var(--color-text)' }}>{ant.code}</strong>
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        backgroundColor: ant.clinicalStatus === 'active' ? 'rgba(239, 68, 68, 0.06)' : 'rgba(100, 116, 139, 0.06)',
                        color: ant.clinicalStatus === 'active' ? 'var(--color-rose)' : 'var(--color-muted)'
                      }}>
                        {ant.clinicalStatus === 'active' ? 'Activo' : ant.clinicalStatus === 'resolved' ? 'Resuelto' : 'Inactivo'}
                      </span>
                    </div>
                    {ant.note && <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--color-muted)' }}>{ant.note}</p>}
                  </div>
                  <button onClick={() => ant.id && handleDelete(ant.id)} style={{ background: 'transparent', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: '0.2rem' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-rose)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-muted)'}>
                    <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Antecedentes Heredofamiliares */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.45rem', fontFamily: 'var(--font-title)' }}>
            <ClipboardList style={{ width: '1.1rem', height: '1.1rem', color: '#2962ff' }} />
            Antecedentes Heredofamiliares
          </h3>
          
          {loading ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', textAlign: 'center', padding: '1rem 0' }}>Cargando datos...</div>
          ) : familiarAntecedents.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', padding: '1.5rem 0', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '10px' }}>
              Sin antecedentes registrados.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {familiarAntecedents.map((ant) => (
                <div key={ant.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.82rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ color: 'var(--color-text)' }}>{ant.code}</strong>
                    </div>
                    {ant.note && <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--color-muted)' }}>{ant.note}</p>}
                  </div>
                  <button onClick={() => ant.id && handleDelete(ant.id)} style={{ background: 'transparent', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: '0.2rem' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-rose)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-muted)'}>
                    <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Panel de Registro (Columna Derecha) */}
      <form onSubmit={handleAdd} className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Plus style={{ width: '1.1rem', height: '1.1rem', color: '#2962ff' }} />
          Nuevo Antecedente
        </h4>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--color-rose)', color: 'var(--color-rose)', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem' }}>
            <ShieldAlert style={{ width: '0.9rem', height: '0.9rem', flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>Origen/Categoría</label>
          <select
            className="search-input"
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
          >
            <option value="personal">Antecedente Personal</option>
            <option value="familiar">Antecedente Heredofamiliar</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>Descripción o Patología</label>
          <input
            type="text"
            className="search-input"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej: HTA, Asma, Diabetes (Padre)"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
          />
        </div>

        {category === 'personal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>Estado Clínico</label>
            <select
              className="search-input"
              value={clinicalStatus}
              onChange={(e) => setClinicalStatus(e.target.value as any)}
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
            >
              <option value="active">Activo</option>
              <option value="resolved">Resuelto / Curado</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>Observaciones</label>
          <textarea
            className="search-input"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Diagnosticado en 2021, medicado con Enalapril 10mg..."
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', fontFamily: 'inherit', resize: 'vertical' }}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
          style={{ width: '100%', fontSize: '0.8rem', padding: '0.55rem', height: '36px', marginTop: '0.25rem' }}
        >
          <Save style={{ width: '0.9rem', height: '0.9rem' }} />
          {saving ? 'Guardando...' : 'Agregar Registro'}
        </button>
      </form>

    </div>
  );
};
