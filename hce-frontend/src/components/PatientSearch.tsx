import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, 
  ChevronRight, 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Heart, 
  SlidersHorizontal, 
  XCircle,
  Activity,
  AlertCircle,
  FileText,
  Grid,
  Edit,
  Clock,
  Shield
} from 'lucide-react';
import keycloak from '../utils/keycloak-config';
import { Odontogram } from './Odontogram';
import { AllergyTab } from './tabs/AllergyTab';
import { VitalsTab } from './tabs/VitalsTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { AuditTab } from './tabs/AuditTab';
import { PatientForm } from './PatientForm';
import { EncountersTab } from './tabs/EncountersTab';
import { AntecedentsTab } from './tabs/AntecedentsTab';
import { PrescriptionsTab } from './tabs/PrescriptionsTab';
import { Stethoscope, ClipboardList, Pill } from 'lucide-react';

export const PatientSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dniFilter, setDniFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [admissionDateFilter, setAdmissionDateFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'encounter' | 'antecedents' | 'odontogram' | 'allergies' | 'vitals' | 'prescriptions' | 'documents' | 'audit'>('encounter');
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [coverages, setCoverages] = useState<any[]>([]);

  const fetchPatients = async (name = '', dni = '', age = '', admissionDate = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (name.trim()) params.append('name', name.trim());
      if (dni.trim()) params.append('identifier', dni.trim());
      if (age.trim()) params.append('age', age.trim());
      if (admissionDate.trim()) params.append('admissionDate', admissionDate.trim());

      const url = `${import.meta.env.VITE_API_URL}/fhir/r4/Patient?${params.toString()}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });

      const entries = response.data.entry || [];
      const patientsList = entries.map((entry: any) => entry.resource);
      setPatients(patientsList);
    } catch (err) {
      console.error('Error buscando pacientes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Búsqueda interactiva en tiempo real (debounced a 300ms)
  useEffect(() => {
    if (selectedPatient) return;

    const delayDebounceFn = setTimeout(() => {
      const term = searchTerm.trim();
      let name = '';
      let dni = dniFilter.trim();

      if (term !== '') {
        if (/^\d/.test(term)) {
          dni = term;
        } else {
          name = term;
        }
      }

      fetchPatients(name, dni, ageFilter, admissionDateFilter);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, dniFilter, ageFilter, admissionDateFilter, selectedPatient]);

  // Cargar coberturas del paciente seleccionado al abrir la vista de detalles
  useEffect(() => {
    if (selectedPatient?.id) {
      axios
        .get(`${import.meta.env.VITE_API_URL}/insurance/patient/${selectedPatient.id}/coverage`, {
          headers: { Authorization: `Bearer ${keycloak.token}` }
        })
        .then((res) => setCoverages(res.data))
        .catch(() => setCoverages([]));
    } else {
      setCoverages([]);
    }
  }, [selectedPatient?.id]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setDniFilter('');
    setAgeFilter('');
    setAdmissionDateFilter('');
  };

  const getGenderDisplayName = (gender: string) => {
    switch (gender?.toLowerCase()) {
      case 'male': return 'Masculino';
      case 'female': return 'Femenino';
      case 'other': return 'Otro';
      case 'unknown': return 'Desconocido';
      default: return 'No especificado';
    }
  };

  const calculateAge = (birthDateStr: string) => {
    if (!birthDateStr) return '';
    const birth = new Date(birthDateStr);
    const diff = Date.now() - birth.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970).toString();
  };

  const formatPhone = (telecom: any[]) => {
    const phoneObj = telecom?.find((t) => t.system === 'phone');
    return phoneObj ? phoneObj.value : 'No registrado';
  };

  const formatEmail = (telecom: any[]) => {
    const emailObj = telecom?.find((t) => t.system === 'email');
    return emailObj ? emailObj.value : 'No registrado';
  };

  const formatAddress = (address: any[]) => {
    if (!address || address.length === 0) return 'Sin domicilio registrado';
    const primary = address[0] || {};
    const lines = primary.line ? primary.line.join(' ') : '';
    return `${lines}${primary.city ? ', ' + primary.city : ''}`;
  };

  const formatAdmissionDate = (extensions: any[]) => {
    const ext = extensions?.find((e) => e.url === 'http://hospital.gov/fhir/StructureDefinition/admission-date');
    if (!ext || !ext.valueDateTime) return 'No registrada';
    const date = new Date(ext.valueDateTime);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Vista Detallada: Ficha Clínica del Paciente
  if (selectedPatient) {
    const primaryName = selectedPatient.name?.[0] || {};
    const givenName = Array.isArray(primaryName.given) ? primaryName.given.join(' ') : (primaryName.given || '');
    const familyName = primaryName.family || '';
    const dni = selectedPatient.identifier?.[0]?.value || 'Sin DNI';
    const age = calculateAge(selectedPatient.birthDate);

    const TABS = [
      { key: 'encounter', label: 'Consultas', icon: <Stethoscope style={{ width: '1rem', height: '1rem' }} /> },
      { key: 'antecedents', label: 'Antecedentes', icon: <ClipboardList style={{ width: '1rem', height: '1rem' }} /> },
      { key: 'odontogram', label: 'Odontograma', icon: <Grid style={{ width: '1rem', height: '1rem' }} /> },
      { key: 'allergies', label: 'Alergias', icon: <AlertCircle style={{ width: '1rem', height: '1rem' }} /> },
      { key: 'vitals', label: 'Signos Vitales', icon: <Activity style={{ width: '1rem', height: '1rem' }} /> },
      { key: 'prescriptions', label: 'Recetas', icon: <Pill style={{ width: '1rem', height: '1rem' }} /> },
      { key: 'documents', label: 'Documentos', icon: <FileText style={{ width: '1rem', height: '1rem' }} /> },
      { key: 'audit', label: 'Historial', icon: <Shield style={{ width: '1rem', height: '1rem' }} /> },
    ] as const;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'slideIn 0.25s ease' }}>
        
        {/* Barra superior de retorno */}
        <div className="ficha-clinica-header">
          <div className="ficha-clinica-header-top">
            <button
              onClick={() => {
                setSelectedPatient(null);
                setIsEditingPatient(false);
                setActiveTab('odontogram');
                fetchPatients();
              }}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ArrowLeft style={{ width: '1rem', height: '1rem' }} />
              Volver al Buscador
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#edf2f7', padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, color: '#4a5568' }} className="mobile-badge-paciente">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2962ff' }} />
              Paciente Activo
            </div>
          </div>
          
          <h2 className="ficha-clinica-header-title">
            Ficha Clínica Digital
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#edf2f7', padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, color: '#4a5568' }} className="desktop-badge-paciente">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2962ff' }} />
            Paciente Activo
          </div>
        </div>

        {/* Layout: columna izquierda + área principal con pestañas */}
        <div className="ficha-clinica-layout">
          
          {/* Columna Izquierda: Datos Demográficos del Paciente */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Avatar e Información Rápida */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
              <div style={{ 
                width: '4.5rem', 
                height: '4.5rem', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #e0e7ff, #e0f2fe)', 
                color: '#312e81', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '1.8rem', 
                fontWeight: 700,
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
              }}>
                {(familyName.charAt(0) || 'P').toUpperCase()}
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-title)' }}>
                  {familyName}, {givenName}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500, display: 'inline-block', marginTop: '0.2rem' }}>
                  DNI {dni}
                </span>
              </div>
            </div>

            {/* Datos Detallados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Calendar style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Edad</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '0.1rem' }}>{age} años ({selectedPatient.birthDate})</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Heart style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Género</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '0.1rem' }}>{getGenderDisplayName(selectedPatient.gender)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Phone style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Teléfono</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '0.1rem' }}>{formatPhone(selectedPatient.telecom)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Mail style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Email</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-all', fontSize: '0.8rem', marginTop: '0.1rem' }}>{formatEmail(selectedPatient.telecom)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <MapPin style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Domicilio</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '0.1rem', lineHeight: '1.25' }}>{formatAddress(selectedPatient.address)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Clock style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Fecha de Ingreso</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '0.1rem' }}>{formatAdmissionDate(selectedPatient.extension)}</div>
                </div>
              </div>

              {/* Cobertura de Salud del Paciente Activo */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <Shield style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div style={{ width: '100%' }}>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Cobertura de Salud</div>
                  {coverages.length === 0 ? (
                    <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
                      Particular
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.3rem' }}>
                      {coverages.map((cov) => (
                        <div key={cov.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: cov.principal ? '#6366f1' : '#94a3b8' }} />
                            <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.85rem' }}>{cov.insuranceCompany?.nombre}</span>
                            {cov.principal && (
                              <span style={{ fontSize: '0.62rem', background: '#6366f1', color: '#fff', borderRadius: '6px', padding: '0.02rem 0.35rem', fontWeight: 700 }}>Principal</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)', paddingLeft: '0.75rem' }}>
                            Afil: {cov.nroAfiliado}{cov.plan ? ` · ${cov.plan}` : ''}{!cov.esTitular && cov.nombreTitular ? ` · ${cov.nombreTitular}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Botón para Editar Datos */}
            <button
              onClick={() => setIsEditingPatient(true)}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                padding: '0.65rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                width: '100%',
                marginTop: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <Edit style={{ width: '0.95rem', height: '0.95rem', color: '#2962ff' }} />
              Editar Datos
            </button>

            {/* Badge FHIR */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              marginTop: '0.5rem'
            }}>
              <span style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: 'var(--color-emerald)', 
                display: 'inline-block',
                boxShadow: '0 0 8px var(--color-emerald)'
              }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-emerald)', letterSpacing: '0.03em' }}>HL7 FHIR R4 Standard</span>
            </div>

          </div>

          {/* Área principal: barra de pestañas segmentada + panel de contenido o formulario de edición */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
            {isEditingPatient ? (
              <PatientForm
                patient={selectedPatient}
                onSuccess={async () => {
                  setIsEditingPatient(false);
                  // Recargar los datos del paciente editado para reflejar los cambios en la barra lateral
                  try {
                    const response = await axios.get(`${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${selectedPatient.id}`, {
                      headers: {
                        Authorization: `Bearer ${keycloak.token}`,
                      },
                    });
                    setSelectedPatient(response.data);
                  } catch (err) {
                    console.error('Error actualizando datos del paciente activo:', err);
                  }
                }}
                onCancel={() => setIsEditingPatient(false)}
              />
            ) : (
              <>
                {/* Control Segmentado (Pills) */}
                <div 
                  className="segmented-control"
                  style={{ overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}
                >
                  {TABS.map(tab => {
                    const isActive = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`segmented-button ${isActive ? 'active' : ''}`}
                        style={{ flexShrink: 0 }}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Panel de Contenido del Tab Activo */}
                <div className="panel ficha-clinica-content-panel" style={{ overflow: 'visible' }}>
                  {activeTab === 'encounter' && <EncountersTab patientId={selectedPatient.id} />}
                  {activeTab === 'antecedents' && <AntecedentsTab patientId={selectedPatient.id} />}
                  {activeTab === 'odontogram' && <Odontogram patientId={selectedPatient.id} />}
                  {activeTab === 'allergies' && <AllergyTab patientId={selectedPatient.id} />}
                  {activeTab === 'vitals' && <VitalsTab patientId={selectedPatient.id} />}
                  {activeTab === 'prescriptions' && <PrescriptionsTab patientId={selectedPatient.id} />}
                  {activeTab === 'documents' && <DocumentsTab patientId={selectedPatient.id} />}
                  {activeTab === 'audit' && <AuditTab patientId={selectedPatient.id} />}
                </div>
              </>
            )}
          </div>

        </div>

      </div>
    );
  }

  // Renderizado por defecto: Listado y Buscador de Pacientes
  const hasActiveFilters = searchTerm.trim() !== '' || dniFilter.trim() !== '' || ageFilter.trim() !== '' || admissionDateFilter.trim() !== '';

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Cabecera de búsqueda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Search style={{ width: '1.6rem', height: '1.6rem', color: '#2962ff' }} />
          Búsqueda de Pacientes
        </h3>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            onClick={() => {
              const next = !showAdvanced;
              setShowAdvanced(next);
              // Al cerrar los filtros avanzados, limpiar sus valores para no dejar
              // criterios ocultos que impidan mostrar resultados en la búsqueda básica
              if (!next) {
                setDniFilter('');
                setAgeFilter('');
                setAdmissionDateFilter('');
              }
            }} 
            className="btn" 
            style={{ 
              background: showAdvanced ? 'rgba(41, 98, 255, 0.08)' : 'transparent', 
              border: `1px solid ${showAdvanced ? '#2962ff' : 'var(--border-color)'}`, 
              color: showAdvanced ? '#2962ff' : 'var(--color-text)',
              padding: '0.55rem 1.1rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <SlidersHorizontal style={{ width: '0.95rem', height: '0.95rem' }} />
            Búsqueda Avanzada
          </button>

          {hasActiveFilters && (
            <button 
              onClick={handleClearFilters} 
              className="btn" 
              style={{ 
                background: 'rgba(239, 68, 68, 0.08)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', 
                color: 'var(--color-rose)',
                padding: '0.55rem 1.1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              <XCircle style={{ width: '0.95rem', height: '0.95rem' }} />
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Caja de filtros interactivos */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem', 
        background: '#f8fafc', 
        padding: '1.25rem', 
        borderRadius: '16px', 
        border: '1px solid var(--border-color)' 
      }}>
        <div className={showAdvanced ? "grid-filters-advanced" : ""} style={{ display: showAdvanced ? 'grid' : 'block', gap: '1.25rem' }}>
          
          {/* Término Principal (DNI o Nombre/Apellido) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Buscar por DNI o Nombre/Apellido
            </label>
            <input
              type="text"
              className="search-input"
              placeholder="Ingresa un DNI (números) o Nombre del paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filtros avanzados adicionales */}
          {showAdvanced && (
            <>
              {/* DNI Explícito */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', animation: 'fadeIn 0.2s ease' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  DNI Específico
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="search-input"
                  placeholder="Ej: 38450123"
                  value={dniFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) {
                      setDniFilter(val);
                    }
                  }}
                />
              </div>

              {/* Edad */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', animation: 'fadeIn 0.2s ease' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  Edad (Años)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="search-input"
                  placeholder="Ej: 35"
                  value={ageFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*$/.test(val)) {
                      setAgeFilter(val);
                    }
                  }}
                />
              </div>

              {/* Fecha de Ingreso */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', animation: 'fadeIn 0.2s ease' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  Fecha de Ingreso
                </label>
                <input
                  type="date"
                  className="search-input"
                  style={{ color: 'var(--color-text)' }}
                  value={admissionDateFilter}
                  onChange={(e) => setAdmissionDateFilter(e.target.value)}
                />
              </div>
            </>
          )}

        </div>
      </div>

      {/* Resultados de Búsqueda */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Contador de resultados */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 600 }}>
            {loading ? 'Buscando coincidencias...' : `Coincidencias encontradas: ${patients.length}`}
          </span>
        </div>

        {loading && patients.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '3rem' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
            Cargando listado de pacientes...
          </div>
        ) : patients.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            color: 'var(--color-muted)', 
            padding: '3rem', 
            border: '1px dashed var(--border-color)', 
            borderRadius: '16px',
            background: '#ffffff'
          }}>
            No se encontraron pacientes que coincidan con la búsqueda.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {patients.map((patient) => {
              const primaryName = patient.name?.[0] || {};
              const givenName = Array.isArray(primaryName.given) ? primaryName.given.join(' ') : (primaryName.given || '');
              const familyName = primaryName.family || '';
              const dni = patient.identifier?.[0]?.value || 'Sin DNI';

              return (
                <div 
                  key={patient.id} 
                  className="patient-card"
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-hover)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-premium)';
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
                        {familyName}, {givenName}
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.65rem', fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                        <span>DNI: <strong style={{ color: '#2962ff' }}>{dni}</strong></span>
                        <span style={{ opacity: 0.5 }}>|</span>
                        <span>Género: {getGenderDisplayName(patient.gender)}</span>
                        <span style={{ opacity: 0.5 }}>|</span>
                        <span>Edad: {calculateAge(patient.birthDate)} años</span>
                        <span style={{ opacity: 0.5 }}>|</span>
                        <span>Ingreso: {formatAdmissionDate(patient.extension)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedPatient(patient)}
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

    </div>
  );
};
