import React, { useState, useEffect } from 'react';
import axios from 'axios';
import keycloak from '../../utils/keycloak-config';

interface VitalsTabProps {
  patientId: string;
}

interface VitalSign {
  id?: string;
  resourceType: string;
  code?: { coding?: { display?: string; code?: string }[]; text?: string };
  valueQuantity?: { value?: number; unit?: string };
  effectiveDateTime?: string;
  component?: {
    code?: { coding?: { display?: string }[] };
    valueQuantity?: { value?: number; unit?: string };
  }[];
}

// Códigos LOINC estándar para signos vitales odontológicos
const VITAL_PRESETS = [
  { label: 'Presión Arterial', code: '55284-4', unit: 'mmHg', isComposite: true },
  { label: 'Temperatura', code: '8310-5', unit: '°C', isComposite: false },
  { label: 'Pulso / FC', code: '8867-4', unit: 'lpm', isComposite: false },
  { label: 'Peso', code: '29463-7', unit: 'kg', isComposite: false },
  { label: 'Talla', code: '8302-2', unit: 'cm', isComposite: false },
  { label: 'Saturación O₂', code: '59408-5', unit: '%', isComposite: false },
];

export const VitalsTab: React.FC<VitalsTabProps> = ({ patientId }) => {
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: VITAL_PRESETS[0].code,
    value: '',
    systolic: '',
    diastolic: '',
    unit: VITAL_PRESETS[0].unit,
    isComposite: VITAL_PRESETS[0].isComposite,
    label: VITAL_PRESETS[0].label,
    date: new Date().toISOString().slice(0, 16),
  });

  const fetchVitals = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:3000/fhir/r4/Patient/${patientId}/clinical-resource`,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      const obs: VitalSign[] = res.data.filter(
        (r: any) => r.resourceType === 'Observation'
      );
      setVitals(obs.reverse()); // Más recientes primero
    } catch (e) {
      console.error('Error cargando signos vitales:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVitals();
  }, [patientId]);

  const handleTypeChange = (code: string) => {
    const preset = VITAL_PRESETS.find(p => p.code === code)!;
    setForm(f => ({
      ...f,
      type: code,
      unit: preset.unit,
      isComposite: preset.isComposite,
      label: preset.label,
      value: '',
      systolic: '',
      diastolic: '',
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const preset = VITAL_PRESETS.find(p => p.code === form.type)!;
      let payload: any;

      if (form.isComposite) {
        // Presión arterial: componentes sistólica/diastólica
        payload = {
          resourceType: 'Observation',
          payload: {
            status: 'final',
            code: { coding: [{ system: 'http://loinc.org', code: form.type, display: form.label }], text: form.label },
            effectiveDateTime: form.date,
            component: [
              {
                code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Sistólica' }] },
                valueQuantity: { value: parseFloat(form.systolic), unit: 'mmHg' },
              },
              {
                code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastólica' }] },
                valueQuantity: { value: parseFloat(form.diastolic), unit: 'mmHg' },
              },
            ],
          },
        };
      } else {
        payload = {
          resourceType: 'Observation',
          payload: {
            status: 'final',
            code: { coding: [{ system: 'http://loinc.org', code: form.type, display: preset.label }], text: preset.label },
            valueQuantity: { value: parseFloat(form.value), unit: form.unit },
            effectiveDateTime: form.date,
          },
        };
      }

      await axios.post(
        `http://localhost:3000/fhir/r4/Patient/${patientId}/clinical-resource`,
        payload,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      setShowForm(false);
      fetchVitals();
    } catch (e) {
      console.error('Error guardando signo vital:', e);
    } finally {
      setSaving(false);
    }
  };

  const formatVitalValue = (vital: VitalSign): string => {
    if (vital.component && vital.component.length >= 2) {
      const sys = vital.component[0]?.valueQuantity?.value;
      const dia = vital.component[1]?.valueQuantity?.value;
      return `${sys}/${dia} mmHg`;
    }
    const val = vital.valueQuantity?.value;
    const unit = vital.valueQuantity?.unit;
    return val !== undefined ? `${val} ${unit || ''}` : '—';
  };

  const formatDate = (dt?: string) => {
    if (!dt) return '';
    return new Date(dt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
            Signos Vitales
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-muted)' }}>
            {vitals.length} registros — códigos LOINC estándar
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: showForm ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.12)',
            border: `1px solid ${showForm ? 'var(--color-rose)' : '#10b981'}`,
            color: showForm ? 'var(--color-rose)' : '#10b981',
            borderRadius: '8px',
            padding: '0.45rem 1rem',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {showForm ? '✕ Cancelar' : '+ Nuevo Registro'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{
          background: 'rgba(16,185,129,0.04)',
          border: '1px solid rgba(16,185,129,0.2)',
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
                Tipo de Signo Vital
              </label>
              <select
                className="search-input"
                style={{ marginTop: '0.25rem', paddingLeft: '0.75rem', cursor: 'pointer' }}
                value={form.type}
                onChange={e => handleTypeChange(e.target.value)}
              >
                {VITAL_PRESETS.map(p => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>
                Fecha y Hora
              </label>
              <input
                type="datetime-local"
                className="search-input"
                style={{ marginTop: '0.25rem', paddingLeft: '0.75rem', color: 'var(--color-text)' }}
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>
          </div>

          {form.isComposite ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>
                  Sistólica (mmHg)
                </label>
                <input
                  type="number"
                  className="search-input"
                  style={{ marginTop: '0.25rem', paddingLeft: '0.75rem' }}
                  placeholder="Ej: 120"
                  value={form.systolic}
                  onChange={e => setForm({ ...form, systolic: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>
                  Diastólica (mmHg)
                </label>
                <input
                  type="number"
                  className="search-input"
                  style={{ marginTop: '0.25rem', paddingLeft: '0.75rem' }}
                  placeholder="Ej: 80"
                  value={form.diastolic}
                  onChange={e => setForm({ ...form, diastolic: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>
                Valor ({form.unit})
              </label>
              <input
                type="number"
                className="search-input"
                style={{ marginTop: '0.25rem', paddingLeft: '0.75rem', maxWidth: '200px' }}
                placeholder={`Ingrese valor en ${form.unit}`}
                value={form.value}
                onChange={e => setForm({ ...form, value: e.target.value })}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.55rem 1.5rem',
                cursor: saving ? 'wait' : 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Guardando...' : 'Guardar Signo Vital'}
            </button>
          </div>
        </div>
      )}

      {/* Tabla de registros */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '1.5rem' }}>
          Cargando signos vitales...
        </div>
      ) : vitals.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: 'var(--color-muted)',
          padding: '2rem',
          border: '1px dashed var(--border-color)',
          borderRadius: '12px',
          fontSize: '0.9rem',
        }}>
          Sin registros de signos vitales todavía
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                {['Parámetro', 'Valor', 'Fecha/Hora'].map(h => (
                  <th key={h} style={{
                    padding: '0.65rem 1rem',
                    textAlign: 'left',
                    color: 'var(--color-muted)',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vitals.map((v, idx) => (
                <tr key={v.id || idx} style={{
                  borderBottom: '1px solid var(--border-color)',
                  transition: 'background 0.15s',
                }}>
                  <td style={{ padding: '0.7rem 1rem', color: 'var(--color-text)', fontWeight: 600 }}>
                    {v.code?.text || v.code?.coding?.[0]?.display || 'Observación'}
                  </td>
                  <td style={{ padding: '0.7rem 1rem', color: '#10b981', fontWeight: 700 }}>
                    {formatVitalValue(v)}
                  </td>
                  <td style={{ padding: '0.7rem 1rem', color: 'var(--color-muted)' }}>
                    {formatDate(v.effectiveDateTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
