import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ChevronRight, ArrowLeft, Phone, Mail, MapPin, Calendar, Heart } from 'lucide-react';
import keycloak from '../utils/keycloak-config';
import { Odontogram } from './Odontogram';
import { AllergyTab } from './tabs/AllergyTab';
import { VitalsTab } from './tabs/VitalsTab';
import { DocumentsTab } from './tabs/DocumentsTab';


export const PatientSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dniFilter, setDniFilter] = useState('');
  const [birthdateFilter, setBirthdateFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'odontogram' | 'allergies' | 'vitals' | 'documents'>('odontogram');


  const fetchPatients = async (name = '', dni = '', birthDate = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (name.trim()) params.append('name', name.trim());
      if (dni.trim()) params.append('identifier', dni.trim());
      if (birthDate.trim()) params.append('birthdate', birthDate.trim());

      const url = `http://localhost:3000/fhir/r4/Patient?${params.toString()}`;

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
    if (selectedPatient) return; // No buscar si estamos en la ficha clínica

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

      fetchPatients(name, dni, birthdateFilter);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, dniFilter, birthdateFilter, selectedPatient]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setDniFilter('');
    setBirthdateFilter('');
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

  // Si el usuario selecciona ver la Ficha Clínica del paciente
  if (selectedPatient) {
    const primaryName = selectedPatient.name?.[0] || {};
    const givenName = Array.isArray(primaryName.given) ? primaryName.given.join(' ') : (primaryName.given || '');
    const familyName = primaryName.family || '';
    const dni = selectedPatient.identifier?.[0]?.value || 'Sin DNI';
    const age = calculateAge(selectedPatient.birthDate);

    const TABS = [
      { key: 'odontogram', label: '🦷 Odontograma', color: 'var(--color-cyan)' },
      { key: 'allergies', label: '⚠️ Alergias', color: '#ef4444' },
      { key: 'vitals', label: '💓 Signos Vitales', color: '#10b981' },
      { key: 'documents', label: '📋 Documentos', color: '#8b5cf6' },
    ] as const;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'slideIn 0.2s ease' }}>
        
        {/* Barra superior de retorno */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => {
              setSelectedPatient(null);
              setActiveTab('odontogram');
              fetchPatients();
            }}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ArrowLeft style={{ width: '1rem', height: '1rem' }} />
            Volver al Buscador
          </button>
          
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
            Ficha Clínica Digital
          </h2>
        </div>

        {/* Layout: columna izquierda + área principal con pestañas */}
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Columna Izquierda: Datos Demográficos del Paciente */}
          <div className="panel" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Avatar e Información Rápida */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
              <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', background: 'rgba(2, 132, 199, 0.1)', color: 'var(--color-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 700 }}>
                {familyName.charAt(0) || 'P'}
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  {familyName}, {givenName}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)', fontWeight: 500 }}>
                  DNI: {dni}
                </span>
              </div>
            </div>

            {/* Datos Detallados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.83rem' }}>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <Calendar style={{ width: '1rem', height: '1rem', color: 'var(--color-cyan)', marginTop: '0.1rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>Edad</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{age} años ({selectedPatient.birthDate})</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <Heart style={{ width: '1rem', height: '1rem', color: 'var(--color-cyan)', marginTop: '0.1rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>Género</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{getGenderDisplayName(selectedPatient.gender)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <Phone style={{ width: '1rem', height: '1rem', color: 'var(--color-cyan)', marginTop: '0.1rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>Teléfono</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formatPhone(selectedPatient.telecom)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <Mail style={{ width: '1rem', height: '1rem', color: 'var(--color-cyan)', marginTop: '0.1rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>Email</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-all', fontSize: '0.8rem' }}>{formatEmail(selectedPatient.telecom)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                <MapPin style={{ width: '1rem', height: '1rem', color: 'var(--color-cyan)', marginTop: '0.1rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>Domicilio</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{formatAddress(selectedPatient.address)}</div>
                </div>
              </div>

            </div>

            {/* Badge FHIR */}
            <div style={{
              background: 'rgba(2, 132, 199, 0.05)',
              border: '1px solid rgba(2, 132, 199, 0.15)',
              borderRadius: '8px',
              padding: '0.65rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem'
            }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>HL7 FHIR R4</span>
              <span style={{ fontSize: '0.76rem', color: 'var(--color-muted)' }}>Ficha enlazada al estándar clínico internacional.</span>
            </div>

          </div>

          {/* Área principal: barra de pestañas + contenido */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            
            {/* Barra de pestañas */}
            <div style={{
              display: 'flex',
              gap: '0',
              borderBottom: '2px solid var(--border-color)',
              background: 'var(--bg-surface)',
              borderRadius: '12px 12px 0 0',
              overflow: 'hidden',
            }}>
              {TABS.map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      flex: 1,
                      padding: '0.85rem 0.5rem',
                      background: isActive ? 'var(--bg-card)' : 'transparent',
                      border: 'none',
                      borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                      color: isActive ? tab.color : 'var(--color-muted)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: isActive ? 700 : 500,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Panel de contenido del tab activo */}
            <div className="panel" style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
              borderRadius: '0 0 12px 12px',
              padding: '1.5rem',
              minHeight: '400px',
              animation: 'fadeIn 0.2s ease',
            }}>
              {activeTab === 'odontogram' && <Odontogram patientId={selectedPatient.id} />}
              {activeTab === 'allergies' && <AllergyTab patientId={selectedPatient.id} />}
              {activeTab === 'vitals' && <VitalsTab patientId={selectedPatient.id} />}
              {activeTab === 'documents' && <DocumentsTab patientId={selectedPatient.id} />}
            </div>

          </div>

        </div>

      </div>
    );
  }

  // Renderizado por defecto: Listado y Buscador
  const hasActiveFilters = searchTerm.trim() !== '' || dniFilter.trim() !== '' || birthdateFilter.trim() !== '';

  return (
    <div className="panel" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2rem', backdropFilter: 'blur(16px)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Cabecera de búsqueda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-cyan)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Search style={{ width: '1.8rem', height: '1.8rem' }} />
          Búsqueda de Pacientes
        </h3>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)} 
            className="btn" 
            style={{ 
              background: 'transparent', 
              border: `1px solid ${showAdvanced ? 'var(--color-cyan)' : 'var(--border-color)'}`, 
              color: showAdvanced ? 'var(--color-cyan)' : 'var(--color-text)',
              padding: '0.5rem 1rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            <SlidersHorizontal style={{ width: '1rem', height: '1rem' }} />
            Búsqueda Avanzada
          </button>

          {hasActiveFilters && (
            <button 
              onClick={handleClearFilters} 
              className="btn" 
              style={{ 
                background: 'rgba(244, 63, 94, 0.15)', 
                border: '1px solid var(--color-rose)', 
                color: 'var(--color-rose)',
                padding: '0.5rem 1rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              <XCircle style={{ width: '1rem', height: '1rem' }} />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Panel de filtros interactivos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0, 0, 0, 0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: showAdvanced ? '1fr 1fr 1fr' : '1fr', gap: '1rem', transition: 'all 0.3s ease' }}>
          
          {/* Término Principal (DNI o Nombre/Apellido) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500 }}>Buscar por DNI o Nombre/Apellido</label>
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: '1rem', width: '100%' }}
              placeholder="Ingresa un DNI (números) o un Nombre/Apellido para buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filtros avanzados adicionales */}
          {showAdvanced && (
            <>
              {/* DNI Explícito */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', animation: 'fadeIn 0.2s ease' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500 }}>DNI Específico</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="search-input"
                  style={{ paddingLeft: '1rem', width: '100%' }}
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

              {/* Fecha de Nacimiento */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', animation: 'fadeIn 0.2s ease' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 500 }}>Fecha de Nacimiento</label>
                <input
                  type="date"
                  className="search-input"
                  style={{ paddingLeft: '1rem', width: '100%', color: 'var(--color-text)' }}
                  value={birthdateFilter}
                  onChange={(e) => setBirthdateFilter(e.target.value)}
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
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 500 }}>
            {loading ? 'Buscando coincidencias...' : `Se encontraron ${patients.length} pacientes`}
          </span>
        </div>

        {loading && patients.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '2rem' }}>Cargando listado...</div>
        ) : patients.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--color-muted)', padding: '2rem', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
            No se encontraron pacientes que coincidan con los filtros ingresados.
          </div>
        ) : (
          patients.map((patient) => {
            const primaryName = patient.name?.[0] || {};
            const givenName = Array.isArray(primaryName.given) ? primaryName.given.join(' ') : (primaryName.given || '');
            const familyName = primaryName.family || '';
            const dni = patient.identifier?.[0]?.value || 'Sin DNI';

            return (
              <div key={patient.id} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'rgba(2, 132, 199, 0.1)', color: 'var(--color-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                    {familyName.charAt(0) || 'P'}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                      {familyName}, {givenName}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.15rem', margin: 0 }}>
                      DNI: <strong style={{ color: 'var(--color-cyan)' }}>{dni}</strong> | Género: {getGenderDisplayName(patient.gender)} | Fecha Nac.: {patient.birthDate}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPatient(patient)}
                  className="btn btn-primary"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  Ficha Clínica
                  <ChevronRight style={{ width: '0.9rem', height: '0.9rem' }} />
                </button>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};

// Componentes iconográficos auxiliares no importados dinámicamente
const SlidersHorizontal = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="4" x2="4" y1="21" y2="14" />
    <line x1="4" x2="4" y1="10" y2="3" />
    <line x1="12" x2="12" y1="21" y2="12" />
    <line x1="12" x2="12" y1="8" y2="3" />
    <line x1="20" x2="20" y1="21" y2="16" />
    <line x1="20" x2="20" y1="12" y2="3" />
    <line x1="2" x2="6" y1="14" y2="14" />
    <line x1="10" x2="14" y1="8" y2="8" />
    <line x1="18" x2="22" y1="16" y2="16" />
  </svg>
);

const XCircle = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);
