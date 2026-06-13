import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, ArrowLeft, ChevronRight, Grid, ClipboardList, Stethoscope, FileSignature, ListChecks, IdCard, FileText } from 'lucide-react';
import keycloak from '../../utils/keycloak-config';
import { OdontogramPAMI } from './OdontogramPAMI';
import { AnamnesisPAMI } from './AnamnesisPAMI';
import { OralStatusPAMI } from './OralStatusPAMI';
import { CoverageForm } from './CoverageForm';
import { ConsentForm } from './ConsentForm';
import { EvolutionPAMI } from './EvolutionPAMI';

/**
 * HISTORIA CLÍNICA ODONTOLÓGICA (módulo aislado).
 * Pantalla independiente colgada del dashboard como un servicio más.
 * No comparte componentes ni datos clínicos con la HC original (la ficha de
 * pacientes). Solo consulta el padrón demográfico (Patient) en modo lectura
 * para seleccionar al paciente.
 */

type OdontoTab = 'odontogram' | 'anamnesis' | 'oral-status' | 'coverage' | 'consent' | 'evolution';

const TABS: { key: OdontoTab; label: string; icon: React.ReactNode }[] = [
  { key: 'odontogram', label: 'Odontograma', icon: <Grid style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'anamnesis', label: 'Anamnesis', icon: <ClipboardList style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'oral-status', label: 'Estado bucal y plan', icon: <Stethoscope style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'coverage', label: 'Afiliado / Obra social', icon: <IdCard style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'consent', label: 'Consentimiento', icon: <FileSignature style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'evolution', label: 'Evolución', icon: <ListChecks style={{ width: '1rem', height: '1rem' }} /> },
];

export const OdontologyHC: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<OdontoTab>('odontogram');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!selectedPatient) return;
    setDownloadingPdf(true);
    try {
      const url = `${import.meta.env.VITE_API_URL}/odontology/patient/${selectedPatient.id}/report/pdf`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
        responseType: 'blob',
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `HC_Odontologica_${patientDni(selectedPatient) || 'paciente'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error al descargar el PDF:', err);
      alert('Ocurrió un error al generar el PDF de PAMI. Por favor, intente nuevamente.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const fetchPatients = async (name = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (name.trim()) params.append('name', name.trim());
      const url = `${import.meta.env.VITE_API_URL}/fhir/r4/Patient?${params.toString()}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      // El endpoint puede devolver un Bundle FHIR o un arreglo simple.
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.entry?.map((e: any) => e.resource) ?? []);
      setPatients(list);
    } catch (err) {
      console.error('Error buscando pacientes:', err);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  // Carga inicial: lista TODO el padrón al entrar (sin necesidad de buscar).
  useEffect(() => {
    fetchPatients('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Búsqueda reactiva al tipear (debounce 300ms). Se omite la primera ejecución
  // porque la carga inicial ya trajo todo el padrón.
  const firstRun = useRef(true);
  useEffect(() => {
    if (selectedPatient) return;
    if (firstRun.current) { firstRun.current = false; return; }
    const t = setTimeout(() => { fetchPatients(searchTerm); }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, selectedPatient]);

  const patientName = (p: any): string => {
    if (!p) return '';
    if (typeof p.name === 'string') return p.name;
    const n = Array.isArray(p.name) ? p.name[0] : p.name;
    if (!n) return p.fullName || 'Paciente';
    const given = Array.isArray(n.given) ? n.given.join(' ') : (n.given || '');
    return `${given} ${n.family || ''}`.trim() || 'Paciente';
  };

  const patientDni = (p: any): string => {
    if (!p) return '';
    if (p.dni) return p.dni;
    const id = Array.isArray(p.identifier) ? p.identifier[0] : p.identifier;
    return id?.value || '';
  };

  // ---- Vista de selección de paciente ----
  if (!selectedPatient) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🦷</span> Historia Clínica Odontológica
          </h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', margin: '0.35rem 0 0' }}>
            Ficha odontológica completa. Seleccioná un paciente para comenzar.
          </p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); fetchPatients(searchTerm); }}
          style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'var(--color-muted)' }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: '2.4rem', width: '100%' }}
              placeholder="Buscar paciente por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1.4rem' }}>
            Buscar
          </button>
        </form>

        {loading ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>Buscando pacientes...</p>
        ) : patients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--color-muted)', fontSize: '0.88rem', border: '1px dashed var(--border-color)', borderRadius: '14px', background: 'var(--bg-card)' }}>
            Buscá un paciente del padrón para abrir su historia clínica odontológica.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {patients.map((p) => {
              const n = Array.isArray(p.name) ? p.name[0] : p.name;
              const familyName = n?.family || '';
              return (
                <div 
                  key={p.id} 
                  className="patient-card"
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#2962ff';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(41,98,255,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <div className="patient-card-left">
                    <div style={{ 
                      width: '2.8rem', 
                      height: '2.8rem', 
                      borderRadius: '50%', 
                      background: 'linear-gradient(135deg, #e0e7ff, #e0f2fe)', 
                      color: '#312e81', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontWeight: 700,
                      fontSize: '1.05rem',
                      flexShrink: 0
                    }}>
                      {(familyName.charAt(0) || 'P').toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-title)' }}>
                        {patientName(p)}
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.65rem', fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                        <span>DNI: <strong style={{ color: '#2962ff' }}>{patientDni(p) || 'N/D'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => { setSelectedPatient(p); setActiveTab('odontogram'); }}
                    className="btn btn-primary patient-card-btn"
                    style={{ padding: '0.5rem 1.1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    Ficha Clínica
                    <ChevronRight style={{ width: '0.9rem', height: '0.9rem' }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---- Vista de HC odontológica del paciente seleccionado ----
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Cabecera del paciente */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button
            onClick={() => setSelectedPatient(null)}
            className="btn"
            style={{ padding: '0.5rem 0.85rem', gap: '0.4rem' }}
          >
            <ArrowLeft style={{ width: '0.95rem', height: '0.95rem' }} />
            Cambiar paciente
          </button>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
              {patientName(selectedPatient)}
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
              DNI: {patientDni(selectedPatient) || 'N/D'} · Historia Clínica Odontológica
            </span>
          </div>
        </div>

        <button
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          className="btn btn-primary"
          style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
        >
          <FileText style={{ width: '1rem', height: '1rem' }} />
          {downloadingPdf ? 'Generando PDF...' : 'Exportar Ficha PDF'}
        </button>
      </div>

      {/* Sub-pestañas */}
      <div className="segmented-control" style={{ overflowX: 'auto', display: 'flex', gap: '0.25rem', paddingBottom: '0.25rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`segmented-button ${activeTab === tab.key ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', padding: '0.5rem 0.9rem', fontSize: '0.82rem' }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div>
        {activeTab === 'odontogram' && <OdontogramPAMI patientId={selectedPatient.id} />}
        {activeTab === 'anamnesis' && <AnamnesisPAMI patientId={selectedPatient.id} />}
        {activeTab === 'oral-status' && <OralStatusPAMI patientId={selectedPatient.id} />}
        {activeTab === 'coverage' && <CoverageForm patientId={selectedPatient.id} />}
        {activeTab === 'consent' && <ConsentForm patientId={selectedPatient.id} />}
        {activeTab === 'evolution' && <EvolutionPAMI patientId={selectedPatient.id} />}
      </div>
    </div>
  );
};
