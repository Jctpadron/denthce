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
  const [activeChart, setActiveChart] = useState<'BP' | 'Pulse' | 'Temp'>('BP');
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
        `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/clinical-resource`,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      const obs: VitalSign[] = res.data.filter(
        (r: any) => r.resourceType === 'Observation'
      );
      // Mantener orden cronológico descendente para la tabla, pero asc para gráficos
      setVitals(obs);
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
    if (form.isComposite && (!form.systolic || !form.diastolic)) return;
    if (!form.isComposite && !form.value) return;
    setSaving(true);
    try {
      const preset = VITAL_PRESETS.find(p => p.code === form.type)!;
      let payload: any;

      if (form.isComposite) {
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
        `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/clinical-resource`,
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

  // Función para graficar mediante SVG Dinámico
  const renderTrendChart = () => {
    // 1. Filtrar y ordenar cronológicamente
    let dataPoints: any[] = [];
    
    if (activeChart === 'BP') {
      const bpObs = vitals.filter(v => v.code?.coding?.[0]?.code === '55284-4');
      dataPoints = bpObs.map(v => ({
        date: new Date(v.effectiveDateTime || ''),
        rawDate: v.effectiveDateTime,
        systolic: v.component?.[0]?.valueQuantity?.value || 0,
        diastolic: v.component?.[1]?.valueQuantity?.value || 0,
      })).sort((a, b) => a.date.getTime() - b.date.getTime());
    } else if (activeChart === 'Pulse') {
      const pulseObs = vitals.filter(v => v.code?.coding?.[0]?.code === '8867-4');
      dataPoints = pulseObs.map(v => ({
        date: new Date(v.effectiveDateTime || ''),
        rawDate: v.effectiveDateTime,
        value: v.valueQuantity?.value || 0,
      })).sort((a, b) => a.date.getTime() - b.date.getTime());
    } else {
      const tempObs = vitals.filter(v => v.code?.coding?.[0]?.code === '8310-5');
      dataPoints = tempObs.map(v => ({
        date: new Date(v.effectiveDateTime || ''),
        rawDate: v.effectiveDateTime,
        value: v.valueQuantity?.value || 0,
      })).sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    if (dataPoints.length < 2) {
      return (
        <div style={{
          height: '180px',
          background: '#f8fafc',
          border: '1px dashed var(--border-color)',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-muted)',
          fontSize: '0.82rem',
          flexDirection: 'column',
          gap: '0.35rem'
        }}>
          <span>📈 Gráfico evolutivo de tendencias</span>
          <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Se requieren al menos 2 mediciones históricas para trazar la curva.</span>
        </div>
      );
    }

    // Configuración de dimensiones de gráfica SVG
    const width = 600;
    const height = 180;
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    // Determinar escalas Y según el tipo de dato
    let minVal = 0, maxVal = 100;
    let gridLines: number[] = [];

    if (activeChart === 'BP') {
      minVal = 40;
      maxVal = 180;
      gridLines = [60, 90, 120, 150, 180];
    } else if (activeChart === 'Pulse') {
      minVal = 40;
      maxVal = 140;
      gridLines = [60, 80, 100, 120, 140];
    } else {
      minVal = 35;
      maxVal = 41;
      gridLines = [36, 37, 38, 39, 40];
    }

    const getY = (val: number) => {
      const clamped = Math.max(minVal, Math.min(maxVal, val));
      const ratio = (clamped - minVal) / (maxVal - minVal);
      return paddingTop + plotHeight - (ratio * plotHeight);
    };

    const getX = (idx: number) => {
      return paddingLeft + (idx / (dataPoints.length - 1)) * plotWidth;
    };

    // Construcción de líneas
    let pathD = '';
    let pathD2 = ''; // Para diastólica en BP
    let fillD = '';
    let fillD2 = '';

    if (activeChart === 'BP') {
      // Línea Sistólica (Azul)
      const sysCoords = dataPoints.map((dp, idx) => `${getX(idx)},${getY(dp.systolic)}`);
      pathD = `M ${sysCoords.join(' L ')}`;
      fillD = `M ${getX(0)},${paddingTop + plotHeight} L ${sysCoords.join(' L ')} L ${getX(dataPoints.length - 1)},${paddingTop + plotHeight} Z`;

      // Línea Diastólica (Celeste/Verde)
      const diaCoords = dataPoints.map((dp, idx) => `${getX(idx)},${getY(dp.diastolic)}`);
      pathD2 = `M ${diaCoords.join(' L ')}`;
      fillD2 = `M ${getX(0)},${paddingTop + plotHeight} L ${diaCoords.join(' L ')} L ${getX(dataPoints.length - 1)},${paddingTop + plotHeight} Z`;
    } else {
      const valCoords = dataPoints.map((dp, idx) => `${getX(idx)},${getY(dp.value)}`);
      pathD = `M ${valCoords.join(' L ')}`;
      fillD = `M ${getX(0)},${paddingTop + plotHeight} L ${valCoords.join(' L ')} L ${getX(dataPoints.length - 1)},${paddingTop + plotHeight} Z`;
    }

    const formatLabelDate = (d: Date) => {
      return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    };

    const strokeColor = activeChart === 'Pulse' ? 'var(--color-rose)' : activeChart === 'Temp' ? 'var(--color-amber)' : '#2962ff';
    const gradientId = `areaGrad-${activeChart}`;

    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="areaGradDia" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-emerald)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--color-emerald)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Líneas de cuadrícula horizontales */}
          {gridLines.map((gl) => (
            <g key={gl}>
              <line
                x1={paddingLeft}
                y1={getY(gl)}
                x2={width - paddingRight}
                y2={getY(gl)}
                stroke="var(--border-color)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <text
                x={paddingLeft - 8}
                y={getY(gl) + 4}
                textAnchor="end"
                style={{ fontSize: '0.68rem', fill: 'var(--color-muted)', fontWeight: 600 }}
              >
                {gl}
              </text>
            </g>
          ))}

          {/* Rellenos bajo la curva */}
          {activeChart === 'BP' ? (
            <>
              <path d={fillD} fill="url(#areaGrad-BP)" />
              <path d={fillD2} fill="url(#areaGradDia)" />
            </>
          ) : (
            <path d={fillD} fill={`url(#${gradientId})`} />
          )}

          {/* Líneas de la curva */}
          {activeChart === 'BP' ? (
            <>
              <path d={pathD} fill="none" stroke="#2962ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d={pathD2} fill="none" stroke="var(--color-emerald)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : (
            <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Puntos y Etiquetas de datos */}
          {dataPoints.map((dp, idx) => {
            const x = getX(idx);
            
            if (activeChart === 'BP') {
              const ySys = getY(dp.systolic);
              const yDia = getY(dp.diastolic);
              return (
                <g key={idx}>
                  {/* Sistólica */}
                  <circle cx={x} cy={ySys} r="4.5" fill="#2962ff" stroke="#fff" strokeWidth="1.5" />
                  <text x={x} y={ySys - 8} textAnchor="middle" style={{ fontSize: '0.68rem', fontWeight: 800, fill: '#1e293b' }}>
                    {dp.systolic}
                  </text>
                  {/* Diastólica */}
                  <circle cx={x} cy={yDia} r="4.5" fill="var(--color-emerald)" stroke="#fff" strokeWidth="1.5" />
                  <text x={x} y={yDia + 14} textAnchor="middle" style={{ fontSize: '0.68rem', fontWeight: 800, fill: '#1e293b' }}>
                    {dp.diastolic}
                  </text>
                  {/* Fecha eje X */}
                  <text x={x} y={height - 8} textAnchor="middle" style={{ fontSize: '0.62rem', fill: 'var(--color-muted)', fontWeight: 500 }}>
                    {formatLabelDate(dp.date)}
                  </text>
                </g>
              );
            } else {
              const y = getY(dp.value);
              const unit = activeChart === 'Pulse' ? ' lpm' : '°C';
              return (
                <g key={idx}>
                  <circle cx={x} cy={y} r="4.5" fill={strokeColor} stroke="#fff" strokeWidth="1.5" />
                  <text x={x} y={y - 8} textAnchor="middle" style={{ fontSize: '0.68rem', fontWeight: 800, fill: '#1e293b' }}>
                    {dp.value}{unit}
                  </text>
                  <text x={x} y={height - 8} textAnchor="middle" style={{ fontSize: '0.62rem', fill: 'var(--color-muted)', fontWeight: 500 }}>
                    {formatLabelDate(dp.date)}
                  </text>
                </g>
              );
            }
          })}
        </svg>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
            Signos Vitales y Constantes
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

      {/* Selector de Gráfico Evolutivo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>Gráfico evolutivo de:</span>
        <div className="segmented-control" style={{ background: 'rgba(0,0,0,0.03)' }}>
          <button
            onClick={() => setActiveChart('BP')}
            className={`segmented-button ${activeChart === 'BP' ? 'active' : ''}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
          >
            Presión Arterial
          </button>
          <button
            onClick={() => setActiveChart('Pulse')}
            className={`segmented-button ${activeChart === 'Pulse' ? 'active' : ''}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
          >
            FC / Pulso
          </button>
          <button
            onClick={() => setActiveChart('Temp')}
            className={`segmented-button ${activeChart === 'Temp' ? 'active' : ''}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
          >
            Temperatura
          </button>
        </div>
      </div>

      {/* Gráfico SVG renderizado */}
      {renderTrendChart()}

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
              {[...vitals].reverse().map((v, idx) => (
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
