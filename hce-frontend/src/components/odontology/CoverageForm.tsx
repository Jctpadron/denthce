import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, CheckCircle, ShieldAlert, Shield } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';

interface Props {
  patientId: string;
}

export const CoverageForm: React.FC<Props> = ({ patientId }) => {
  const [insuranceList, setInsuranceList] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [covSearch, setCovSearch] = useState('');
  const [nroAfiliado, setNroAfiliado] = useState('');
  const [plan, setPlan] = useState('');
  const [esTitular, setEsTitular] = useState(true);
  const [nombreTitular, setNombreTitular] = useState('');
  
  const [existingCoverageId, setExistingCoverageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const authHeader = { headers: { Authorization: `Bearer ${keycloak.token}` } };

  // Cargar catálogo de obras sociales y cobertura del paciente
  const load = async () => {
    setLoading(true);
    try {
      // 1. Cargar catálogo
      const catRes = await axios.get(`${import.meta.env.VITE_API_URL}/insurance`, authHeader);
      setInsuranceList(catRes.data);

      // 2. Cargar coberturas del paciente
      const covRes = await axios.get(
        `${import.meta.env.VITE_API_URL}/insurance/patient/${patientId}/coverage`,
        authHeader
      );
      
      // Tomamos la cobertura marcada como principal, o la primera si existe
      const primaryCov = covRes.data.find((c: any) => c.principal) || covRes.data[0];
      
      if (primaryCov) {
        setExistingCoverageId(primaryCov.id);
        setSelectedCompanyId(primaryCov.insuranceCompanyId);
        setCovSearch(primaryCov.insuranceCompany?.nombre || '');
        setNroAfiliado(primaryCov.nroAfiliado || '');
        setPlan(primaryCov.plan || '');
        setEsTitular(primaryCov.esTitular ?? true);
        setNombreTitular(primaryCov.nombreTitular || '');
      } else {
        setExistingCoverageId(null);
        setSelectedCompanyId('');
        setCovSearch('');
        setNroAfiliado('');
        setPlan('');
        setEsTitular(true);
        setNombreTitular('');
      }
    } catch (err) {
      console.error('Error cargando datos de cobertura:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const handleSave = async () => {
    // Resolver ID por nombre si no se seleccionó explícitamente pero el texto coincide con una obra social del catálogo
    let companyId = selectedCompanyId;
    if (!companyId && covSearch.trim()) {
      const matched = insuranceList.find(
        (os) => os.nombre.toLowerCase() === covSearch.toLowerCase().trim()
      );
      if (matched) {
        companyId = matched.id;
        setSelectedCompanyId(matched.id);
      }
    }

    if (!companyId) {
      setMessage({ type: 'error', text: 'Debe seleccionar una Obra Social válida del combo.' });
      return;
    }
    if (!nroAfiliado.trim()) {
      setMessage({ type: 'error', text: 'El número de afiliado es obligatorio.' });
      return;
    }
    if (!esTitular && !nombreTitular.trim()) {
      setMessage({ type: 'error', text: 'El nombre del titular es obligatorio si el paciente no es el titular.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        insuranceCompanyId: companyId,
        nroAfiliado: nroAfiliado.trim(),
        plan: plan.trim() || undefined,
        esTitular,
        nombreTitular: !esTitular ? nombreTitular.trim() : undefined,
        principal: true,
      };

      let res: any;
      if (existingCoverageId) {
        res = await axios.put(
          `${import.meta.env.VITE_API_URL}/insurance/patient/${patientId}/coverage/${existingCoverageId}`,
          payload,
          authHeader
        );
        setMessage({ type: 'success', text: 'Datos de cobertura actualizados correctamente.' });
      } else {
        res = await axios.post(
          `${import.meta.env.VITE_API_URL}/insurance/patient/${patientId}/coverage`,
          payload,
          authHeader
        );
        setExistingCoverageId(res.data.id);
        setMessage({ type: 'success', text: 'Datos de cobertura guardados correctamente.' });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'No se pudo guardar la cobertura.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Cargando datos de cobertura...</p>;

  const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-muted)', display: 'block', marginBottom: '0.3rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {message && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', borderRadius: '10px',
          background: message.type === 'success' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)'}`,
          color: message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)', fontSize: '0.85rem'
        }}>
          {message.type === 'success' ? <CheckCircle style={{ width: '1.1rem', height: '1.1rem' }} /> : <ShieldAlert style={{ width: '1.1rem', height: '1.1rem' }} />}
          {message.text}
        </div>
      )}

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <Shield style={{ width: '1.2rem', height: '1.2rem', color: '#6366f1' }} />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>Afiliado y Obra Social Oficial</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', flexWrap: 'wrap' }}>
          
          {/* Obra Social con Combo Datalist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={labelStyle}>Obra Social / Cobertura *</label>
            <input
              type="text"
              list="obras-sociales-list"
              className="search-input"
              value={covSearch}
              onChange={(e) => {
                const val = e.target.value;
                setCovSearch(val);
                const matched = insuranceList.find(
                  (os) => os.nombre.toLowerCase() === val.toLowerCase().trim()
                );
                if (matched) {
                  setSelectedCompanyId(matched.id);
                } else {
                  setSelectedCompanyId('');
                }
              }}
              placeholder="Buscar obra social..."
              style={{ width: '100%' }}
            />
            <datalist id="obras-sociales-list">
              {insuranceList.map((os) => (
                <option key={os.id} value={os.nombre} />
              ))}
            </datalist>
          </div>

          {/* Nº de Afiliado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={labelStyle}>Nº de Afiliado *</label>
            <input
              className="search-input"
              value={nroAfiliado}
              onChange={(e) => setNroAfiliado(e.target.value)}
              placeholder="Ej: 1234567890"
              style={{ width: '100%' }}
            />
          </div>

          {/* Plan / Categoría */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={labelStyle}>Plan / Categoría</label>
            <input
              className="search-input"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="Ej: Plan 310, Activo..."
              style={{ width: '100%' }}
            />
          </div>

          {/* Es Titular */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={labelStyle}>¿El paciente es el titular?</label>
            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setEsTitular(v)}
                  className="btn"
                  style={{
                    padding: '0.45rem 1.25rem',
                    fontSize: '0.82rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: esTitular === v ? 'rgba(99,102,241,0.08)' : 'var(--bg-surface)',
                    borderColor: esTitular === v ? '#6366f1' : 'var(--border-color)',
                    color: esTitular === v ? '#4f46e5' : 'var(--color-text)',
                    border: '1px solid',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {v ? 'Sí' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre del Titular */}
          {!esTitular && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', gridColumn: 'span 2', animation: 'fadeIn 0.2s ease' }}>
              <label style={labelStyle}>Nombre Completo del Titular *</label>
              <input
                className="search-input"
                value={nombreTitular}
                onChange={(e) => setNombreTitular(e.target.value)}
                placeholder="Ej: Gómez, Juan Carlos"
                style={{ width: '100%' }}
              />
            </div>
          )}

        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '0.6rem 1.5rem', gap: '0.5rem', display: 'flex', alignItems: 'center', fontWeight: 700 }}
        >
          <Save style={{ width: '1rem', height: '1rem' }} />
          {saving ? 'Guardando...' : 'Guardar Cobertura Oficial'}
        </button>
      </div>
    </div>
  );
};
