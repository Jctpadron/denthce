import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ShieldAlert, CheckCircle, Award, Eye, FileText } from 'lucide-react';
import keycloak from '../utils/keycloak-config';

interface PrescriptionFormProps {
  patientId: string;
  prescriptionId?: string; // Si se está editando un borrador existente
  onSuccess: () => void;
  onCancel: () => void;
}

export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({
  patientId,
  prescriptionId,
  onSuccess,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  
  // Form fields
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMed, setSelectedMed] = useState<any | null>(null);
  
  const [doseValue, setDoseValue] = useState('1');
  const [frequencyHours, setFrequencyHours] = useState('8');
  const [durationDays, setDurationDays] = useState('3');
  const [dosageText, setDosageText] = useState('');
  
  // CDS Hooks Alerts
  const [cdsWarnings, setCdsWarnings] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar datos si estamos editando
  useEffect(() => {
    if (prescriptionId) {
      const loadDraft = async () => {
        setLoading(true);
        try {
          const res = await axios.get(
            `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/MedicationRequest/${prescriptionId}`,
            { headers: { Authorization: `Bearer ${keycloak.token}` } }
          );
          const coding = res.data.medicationCodeableConcept?.coding?.[0] || {};
          setSelectedMed({
            code: coding.code,
            name: res.data.medicationCodeableConcept?.text
          });
          setSearchTerm(res.data.medicationCodeableConcept?.text || '');
          
          const dosage = res.data.dosageInstruction?.[0] || {};
          setDoseValue(String(dosage.doseAndRate?.[0]?.doseQuantity?.value || '1'));
          setFrequencyHours(String(dosage.timing?.repeat?.frequency || '8'));
          setDurationDays(String(res.data.dispenseRequest?.expectedSupplyDuration?.value || '3'));
          setDosageText(dosage.text || '');
          
          // Extraer alertas previas
          const extWarnings = res.data.extension?.find((e: any) => e.url.includes('cds-warnings'));
          if (extWarnings) {
            setCdsWarnings(JSON.parse(extWarnings.valueString || '[]'));
          }
        } catch (e) {
          console.error(e);
          setErrorMsg('Error al cargar la receta seleccionada.');
        } finally {
          setLoading(false);
        }
      };
      loadDraft();
    }
  }, [prescriptionId, patientId]);

  // Autocomplete Vademecum
  useEffect(() => {
    if (searchTerm.length < 2 || (selectedMed && selectedMed.name === searchTerm)) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/MedicationRequest/vademecum?query=${encodeURIComponent(searchTerm)}`,
          { headers: { Authorization: `Bearer ${keycloak.token}` } }
        );
        setSearchResults(res.data);
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, selectedMed, patientId]);

  // Ejecutar CDS Hooks cuando se selecciona un fármaco
  const triggerCdsHooks = async (med: any) => {
    setSelectedMed(med);
    setSearchTerm(med.name);
    setSearchResults([]);
    setErrorMsg(null);
    
    // Generar texto por defecto
    setDosageText(`Tomar 1 comprimido cada ${frequencyHours} horas durante ${durationDays} días.`);

    try {
      // Simular guardado temporal o endpoint directo para evaluar CDS Hooks
      // Usaremos el guardado de borrador automático para obtener las alertas reales del backend
      setSaving(true);
      const payload = {
        medicationName: med.name,
        medicationCode: med.code,
        doseValue,
        frequencyHours,
        durationDays,
        dosageText: `Tomar 1 comprimido cada ${frequencyHours} horas durante ${durationDays} días.`
      };

      let res: any;
      if (prescriptionId) {
        res = await axios.put(
          `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/MedicationRequest/${prescriptionId}`,
          payload,
          { headers: { Authorization: `Bearer ${keycloak.token}` } }
        );
      } else {
        res = await axios.post(
          `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/MedicationRequest`,
          payload,
          { headers: { Authorization: `Bearer ${keycloak.token}` } }
        );
      }
      
      setCdsWarnings(res.data.warnings || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // Guardar Borrador Parcial
  const handleSaveDraft = async () => {
    if (!selectedMed) {
      setErrorMsg('Debe seleccionar un medicamento del Vademécum.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        medicationName: selectedMed.name,
        medicationCode: selectedMed.code,
        doseValue,
        frequencyHours,
        durationDays,
        dosageText,
      };

      if (prescriptionId) {
        await axios.put(
          `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/MedicationRequest/${prescriptionId}`,
          payload,
          { headers: { Authorization: `Bearer ${keycloak.token}` } }
        );
      } else {
        await axios.post(
          `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/MedicationRequest`,
          payload,
          { headers: { Authorization: `Bearer ${keycloak.token}` } }
        );
      }
      onSuccess();
    } catch (e) {
      console.error(e);
      setErrorMsg('Error al guardar el borrador de la receta.');
    } finally {
      setSaving(false);
    }
  };

  // Firmar receta digitalmente (inmutable)
  const handleSignPrescription = async () => {
    if (!selectedMed) {
      setErrorMsg('Debe seleccionar un medicamento del Vademécum.');
      return;
    }
    setSigning(true);
    setErrorMsg(null);
    try {
      // 1. Guardar primero el estado actual como borrador
      const payload = {
        medicationName: selectedMed.name,
        medicationCode: selectedMed.code,
        doseValue,
        frequencyHours,
        durationDays,
        dosageText,
      };

      let activeId = prescriptionId;
      if (prescriptionId) {
        await axios.put(
          `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/MedicationRequest/${prescriptionId}`,
          payload,
          { headers: { Authorization: `Bearer ${keycloak.token}` } }
        );
      } else {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/MedicationRequest`,
          payload,
          { headers: { Authorization: `Bearer ${keycloak.token}` } }
        );
        activeId = res.data.id;
      }

      // 2. Firmar
      await axios.post(
        `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patientId}/MedicationRequest/${activeId}/sign`,
        {},
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );

      onSuccess();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.response?.data?.message || 'Error al firmar la receta.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '2rem' }}>Cargando datos del borrador...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.2s ease' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <FileText style={{ width: '1.2rem', height: '1.2rem', color: '#2962ff' }} />
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
          {prescriptionId ? 'Editar Receta (Borrador)' : 'Crear Receta Electrónica'}
        </h4>
      </div>

      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid var(--color-rose)',
          color: 'var(--color-rose)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontSize: '0.82rem',
          fontWeight: 600
        }}>
          {errorMsg}
        </div>
      )}

      {/* 1. Selector de Fármaco (Autocomplete) */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
          Fármaco (Vademécum)
        </label>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', width: '0.9rem', height: '0.9rem', color: 'var(--color-muted)' }} />
          <input
            type="text"
            className="search-input"
            style={{ paddingLeft: '2.1rem', fontSize: '0.88rem' }}
            placeholder="Escriba principio activo o nombre comercial (ej. Amoxicilina, Ibuprofeno)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Resultados del autocompletado */}
        {searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-md)',
            zIndex: 10,
            maxHeight: '200px',
            overflowY: 'auto',
            marginTop: '0.25rem'
          }}>
            {searchResults.map((med) => (
              <div
                key={med.code}
                onClick={() => triggerCdsHooks(med)}
                style={{
                  padding: '0.65rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  borderBottom: '1px solid var(--border-color)',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{med.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>{med.category} — Monodroga: {med.substance}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. PANEL DE ALERTAS CDS HOOKS (Se muestra dinámicamente) */}
      {cdsWarnings.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.04)',
          border: '1px solid var(--color-rose)',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-rose)', fontWeight: 800, fontSize: '0.85rem' }}>
            <ShieldAlert style={{ width: '1.2rem', height: '1.2rem' }} />
            <span>ALERTAS DE SEGURIDAD CLÍNICA (CDS HOOKS)</span>
          </div>
          {cdsWarnings.map((w, idx) => (
            <p key={idx} style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-rose)', fontWeight: 600, lineHeight: 1.4 }}>
              {w}
            </p>
          ))}
        </div>
      )}

      {/* 3. Parámetros de Prescripción */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>Dosis</label>
          <input
            type="text"
            className="search-input"
            style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
            value={doseValue}
            onChange={(e) => {
              setDoseValue(e.target.value);
              if (selectedMed) setDosageText(`Tomar ${e.target.value} comprimido cada ${frequencyHours} horas durante ${durationDays} días.`);
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>Frecuencia (Horas)</label>
          <select
            className="search-input"
            style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
            value={frequencyHours}
            onChange={(e) => {
              setFrequencyHours(e.target.value);
              if (selectedMed) setDosageText(`Tomar ${doseValue} comprimido cada ${e.target.value} horas durante ${durationDays} días.`);
            }}
          >
            <option value="4">Cada 4 horas</option>
            <option value="6">Cada 6 horas</option>
            <option value="8">Cada 8 horas</option>
            <option value="12">Cada 12 horas</option>
            <option value="24">Cada 24 horas (diario)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600 }}>Duración (Días)</label>
          <input
            type="number"
            className="search-input"
            style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
            value={durationDays}
            onChange={(e) => {
              setDurationDays(e.target.value);
              if (selectedMed) setDosageText(`Tomar ${doseValue} comprimido cada ${frequencyHours} horas durante ${e.target.value} días.`);
            }}
          />
        </div>
      </div>

      {/* 4. Indicaciones al Paciente */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
          Indicaciones (Posología)
        </label>
        <textarea
          className="search-input"
          style={{ height: '70px', padding: '0.65rem 0.85rem', fontSize: '0.85rem', resize: 'none' }}
          placeholder="Ej: Tomar con un vaso de agua después del almuerzo..."
          value={dosageText}
          onChange={(e) => setDosageText(e.target.value)}
        />
      </div>

      {/* 5. Acciones de Formulario */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          style={{ padding: '0.55rem 1.25rem' }}
        >
          Cancelar
        </button>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSaveDraft}
            disabled={saving || signing}
            style={{ padding: '0.55rem 1.25rem', borderColor: '#cbd5e1' }}
          >
            {saving ? 'Guardando...' : 'Guardar Borrador'}
          </button>
          
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSignPrescription}
            disabled={saving || signing}
            style={{ padding: '0.55rem 1.5rem', gap: '0.35rem' }}
          >
            <Award style={{ width: '1rem', height: '1rem' }} />
            {signing ? 'Firmando...' : 'Firmar y Emitir'}
          </button>
        </div>
      </div>

    </div>
  );
};
