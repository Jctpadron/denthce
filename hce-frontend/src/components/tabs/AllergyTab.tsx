import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import keycloak from '../../utils/keycloak-config';

interface AllergyTabProps {
  patientId: string;
}

interface Allergy {
  id?: string;
  resourceType: string;
  code?: { coding?: { display?: string; code?: string }[]; text?: string };
  clinicalStatus?: { coding?: { code?: string }[] };
  criticality?: string;
  reaction?: { manifestation?: { coding?: { display?: string }[] }[] }[];
  note?: { text?: string }[];
  recordedDate?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  low: '#f59e0b',
  'unable-to-assess': '#94a3b8',
};

const SEVERITY_LABELS: Record<string, string> = {
  high: 'Alta',
  low: 'Baja',
  'unable-to-assess': 'No evaluada',
};

export const AllergyTab: React.FC<AllergyTabProps> = ({ patientId }) => {
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    allergen: '',
    reaction: '',
    criticality: 'low',
    notes: '',
  });

  const fetchAllergies = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:3000/fhir/r4/Patient/${patientId}/clinical-resource`,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      const all: Allergy[] = res.data.filter(
        (r: any) => r.resourceType === 'AllergyIntolerance'
      );
      setAllergies(all);
    } catch (e) {
      console.error('Error cargando alergias:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllergies();
  }, [patientId]);

  const handleSave = async () => {
    if (!form.allergen.trim()) return;
    setSaving(true);
    try {
      const payload = {
        resourceType: 'AllergyIntolerance',
        payload: {
          clinicalStatus: { coding: [{ code: 'active', display: 'Activa' }] },
          criticality: form.criticality,
          code: {
            coding: [{ display: form.allergen }],
            text: form.allergen,
          },
          reaction: form.reaction
            ? [
                {
                  manifestation: [
                    { coding: [{ display: form.reaction }] },
                  ],
                },
              ]
            : [],
          note: form.notes ? [{ text: form.notes }] : [],
          recordedDate: new Date().toISOString().split('T')[0],
        },
      };
      await axios.post(
        `http://localhost:3000/fhir/r4/Patient/${patientId}/clinical-resource`,
        payload,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setForm({ allergen: '', reaction: '', criticality: 'low', notes: '' });
      setShowForm(false);
      fetchAllergies();
    } catch (e) {
      console.error('Error guardando alergia:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
            Alergias e Intolerancias
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            {allergies.length} registros — estándar FHIR AllergyIntolerance
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: showForm ? 'rgba(244,63,94,0.15)' : 'rgba(2,132,199,0.12)',
            border: `1px solid ${showForm ? 'var(--color-rose)' : 'var(--color-cyan)'}`,
            color: showForm ? 'var(--color-rose)' : 'var(--color-cyan)',
            borderRadius: '8px',
            padding: '0.45rem 1rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {showForm ? '✕ Cancelar' : '+ Agregar Alergia'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{
          background: 'rgba(2,132,199,0.04)',
          border: '1px solid rgba(2,132,199,0.2)',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>
                Alérgeno *
              </label>
              <input
                className="search-input"
                style={{ marginTop: '0.25rem', paddingLeft: '0.75rem' }}
                placeholder="Ej: Penicilina, Látex, Polen..."
                value={form.allergen}
                onChange={e => setForm({ ...form, allergen: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>
                Reacción Manifestada
              </label>
              <input
                className="search-input"
                style={{ marginTop: '0.25rem', paddingLeft: '0.75rem' }}
                placeholder="Ej: Urticaria, Anafilaxia..."
                value={form.reaction}
                onChange={e => setForm({ ...form, reaction: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>
                Criticidad
              </label>
              <select
                className="search-input"
                style={{ marginTop: '0.25rem', paddingLeft: '0.75rem', cursor: 'pointer' }}
                value={form.criticality}
                onChange={e => setForm({ ...form, criticality: e.target.value })}
              >
                <option value="high">Alta (High)</option>
                <option value="low">Baja (Low)</option>
                <option value="unable-to-assess">No evaluada</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>
                Notas Adicionales
              </label>
              <input
                className="search-input"
                style={{ marginTop: '0.25rem', paddingLeft: '0.75rem' }}
                placeholder="Observaciones del profesional..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSave}
              disabled={saving || !form.allergen.trim()}
              style={{
                background: 'var(--color-cyan)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.55rem 1.5rem',
                cursor: saving ? 'wait' : 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                opacity: saving || !form.allergen.trim() ? 0.6 : 1,
              }}
            >
              {saving ? 'Guardando...' : 'Guardar Alergia'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '1.5rem' }}>
          Cargando alergias...
        </div>
      ) : allergies.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: 'var(--color-muted)',
          padding: '2rem',
          border: '1px dashed var(--border-color)',
          borderRadius: '12px',
          fontSize: '0.9rem',
        }}>
          ✅ Sin alergias registradas
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {allergies.map((a, idx) => {
            const criticality = a.criticality || 'unable-to-assess';
            const color = SEVERITY_COLORS[criticality] || '#94a3b8';
            const label = SEVERITY_LABELS[criticality] || 'No evaluada';
            const allergenName = a.code?.text || a.code?.coding?.[0]?.display || 'Sin nombre';
            const reaction = a.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display;
            const date = a.recordedDate;
            const notes = a.note?.[0]?.text;

            return (
              <div key={a.id || idx} style={{
                background: 'var(--bg-surface)',
                border: `1px solid var(--border-color)`,
                borderLeft: `4px solid ${color}`,
                borderRadius: '10px',
                padding: '0.9rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                    {allergenName}
                  </span>
                  {reaction && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                      Reacción: {reaction}
                    </span>
                  )}
                  {notes && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>
                      Nota: {notes}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                  <span style={{
                    background: `${color}22`,
                    color,
                    border: `1px solid ${color}44`,
                    borderRadius: '20px',
                    padding: '0.15rem 0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}>
                    {label}
                  </span>
                  {date && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                      {date}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
