import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Search,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Grid,
  ClipboardList,
  Stethoscope,
  FileSignature,
  ListChecks,
  IdCard,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Heart,
  SlidersHorizontal,
  XCircle,
  Clock,
  Images,
  Wrench,
  PlayCircle,
  CheckCircle2,
} from 'lucide-react';
import { OdontoVisitContext } from './OdontoVisitContext';
import keycloak from '../../utils/keycloak-config';
import { OdontogramPAMI } from './OdontogramPAMI';
import { AnamnesisPAMI } from './AnamnesisPAMI';
import { OralStatusPAMI } from './OralStatusPAMI';
import { CoverageForm } from './CoverageForm';
import { ConsentForm } from './ConsentForm';
import { EvolutionPAMI } from './EvolutionPAMI';
import { OdontologyDocuments } from './OdontologyDocuments';
import { ProtesisTab } from './ProtesisTab';

/**
 * HISTORIA CLÍNICA ODONTOLÓGICA (módulo aislado).
 * Pantalla independiente colgada del dashboard como un servicio más.
 * No comparte componentes ni datos clínicos con la HC original (la ficha de
 * pacientes). Solo consulta el padrón demográfico (Patient) en modo lectura
 * para seleccionar al paciente.
 *
 * Diseño replicado de PatientSearch.tsx (Historia Clínica):
 * - Buscador con filtros avanzados
 * - Layout 2 columnas con panel demográfico lateral
 * - Cabecera premium con badge «Paciente Activo»
 */

type OdontoTab = 'odontogram' | 'anamnesis' | 'oral-status' | 'coverage' | 'consent' | 'evolution' | 'documents' | 'protesis';

const TABS: { key: OdontoTab; label: string; icon: React.ReactNode }[] = [
  { key: 'odontogram', label: 'Odontograma', icon: <Grid style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'anamnesis', label: 'Anamnesis', icon: <ClipboardList style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'oral-status', label: 'Estado bucal y plan', icon: <Stethoscope style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'coverage', label: 'Afiliado / Obra social', icon: <IdCard style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'consent', label: 'Consentimiento', icon: <FileSignature style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'evolution', label: 'Evolución', icon: <ListChecks style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'documents', label: 'Imágenes y documentos', icon: <Images style={{ width: '1rem', height: '1rem' }} /> },
  { key: 'protesis', label: 'Prótesis / Laboratorio', icon: <Wrench style={{ width: '1rem', height: '1rem' }} /> },
];

export const OdontologyHC: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<OdontoTab>('odontogram');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Filtros avanzados (réplica de PatientSearch)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dniFilter, setDniFilter] = useState('');
  const [ageFilter, setAgeFilter] = useState('');
  const [admissionDateFilter, setAdmissionDateFilter] = useState('');

  // Datos derivados por paciente (última visita + obra social), resueltos en lote.
  const [enrichMap, setEnrichMap] = useState<Record<string, { lastVisit: string | null; obraSocial: string | null }>>({});
  // Paginación de render (la grilla no pinta miles de tarjetas de una sola vez).
  const PAGE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE);

  // Navegación de la barra de pestañas (flechas ‹ › que aparecen solo si hay
  // contenido oculto hacia ese lado). Resuelve la falta de affordance del scroll horizontal.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabNav, setTabNav] = useState({ left: false, right: false });
  const updateTabNav = () => {
    const el = tabsRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setTabNav({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  const scrollTabs = (dir: number) => {
    const el = tabsRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
  };
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    updateTabNav();
    const ro = new ResizeObserver(updateTabNav);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedPatient]);

  // ---- Visita / Encuentro activo ----
  const [activeVisit, setActiveVisit] = useState<any | null>(null);
  const [visitBusy, setVisitBusy] = useState(false);
  const authHeader = () => ({ headers: { Authorization: `Bearer ${keycloak.token}` } });
  const encUrl = (pid: string) => `${import.meta.env.VITE_API_URL}/odontology/patient/${pid}/encounter`;

  // Al seleccionar paciente, resolver si tiene una visita en curso.
  useEffect(() => {
    if (!selectedPatient) { setActiveVisit(null); return; }
    let cancel = false;
    (async () => {
      try {
        const res = await axios.get(`${encUrl(selectedPatient.id)}/active`, authHeader());
        if (!cancel) setActiveVisit(res.data?.active || null);
      } catch { if (!cancel) setActiveVisit(null); }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient]);

  const handleOpenVisit = async () => {
    if (!selectedPatient || visitBusy) return;
    setVisitBusy(true);
    try {
      const res = await axios.post(encUrl(selectedPatient.id), { classCode: 'AMB' }, authHeader());
      setActiveVisit(res.data);
    } catch (err) {
      console.error('Error al iniciar la visita:', err);
      alert('No se pudo iniciar la visita. Intentá nuevamente.');
    } finally {
      setVisitBusy(false);
    }
  };

  const handleFinalizeVisit = async () => {
    if (!selectedPatient || !activeVisit || visitBusy) return;
    if (!window.confirm('Vas a FINALIZAR Y FIRMAR la visita. Las prestaciones registradas quedarán inmutables (solo se podrán corregir por addenda). ¿Confirmás?')) return;
    setVisitBusy(true);
    try {
      await axios.post(`${encUrl(selectedPatient.id)}/${activeVisit.id}/sign`, {}, authHeader());
      setActiveVisit(null);
      alert('Visita finalizada y firmada correctamente.');
    } catch (err: any) {
      console.error('Error al finalizar la visita:', err);
      alert(err?.response?.data?.message || 'No se pudo finalizar la visita.');
    } finally {
      setVisitBusy(false);
    }
  };

  // ---- Helpers ----

  const patientName = (p: any): string => {
    if (!p) return '';
    if (typeof p.name === 'string') return p.name;
    const n = Array.isArray(p.name) ? p.name[0] : p.name;
    if (!n) return p.fullName || 'Paciente';
    const given = Array.isArray(n.given) ? n.given.join(' ') : (n.given || '');
    return `${given} ${n.family || ''}`.trim() || 'Paciente';
  };

  /** Nombre en formato "Apellido, Nombre" (como PatientSearch). */
  const patientNameFormatted = (p: any): { family: string; given: string } => {
    if (!p) return { family: '', given: '' };
    const n = Array.isArray(p.name) ? p.name[0] : p.name;
    if (!n) return { family: '', given: p.fullName || 'Paciente' };
    const given = Array.isArray(n.given) ? n.given.join(' ') : (n.given || '');
    return { family: n.family || '', given };
  };

  const patientDni = (p: any): string => {
    if (!p) return '';
    if (p.dni) return p.dni;
    const id = Array.isArray(p.identifier) ? p.identifier[0] : p.identifier;
    return id?.value || '';
  };

  const calcAge = (birthDate?: string): string => {
    if (!birthDate) return '';
    const b = new Date(birthDate);
    if (isNaN(b.getTime())) return '';
    const age = Math.abs(new Date(Date.now() - b.getTime()).getUTCFullYear() - 1970);
    return String(age);
  };

  const getGenderDisplayName = (gender?: string): string => {
    switch ((gender || '').toLowerCase()) {
      case 'male': return 'Masculino';
      case 'female': return 'Femenino';
      case 'other': return 'Otro';
      case 'unknown': return 'Desconocido';
      default: return 'No especificado';
    }
  };

  const genderInfo = (g?: string): { label: string; symbol: string; color: string } => {
    switch ((g || '').toLowerCase()) {
      case 'male': return { label: 'Masculino', symbol: '♂', color: '#1d4ed8' };
      case 'female': return { label: 'Femenino', symbol: '♀', color: '#be185d' };
      case 'other': return { label: 'Otro', symbol: '⚧', color: '#6d28d9' };
      default: return { label: 'No especificado', symbol: '•', color: 'var(--color-muted)' };
    }
  };

  const formatPhone = (telecom: any[]): string => {
    const phoneObj = telecom?.find((t: any) => t.system === 'phone');
    return phoneObj ? phoneObj.value : 'No registrado';
  };

  const formatEmail = (telecom: any[]): string => {
    const emailObj = telecom?.find((t: any) => t.system === 'email');
    return emailObj ? emailObj.value : 'No registrado';
  };

  const formatAddress = (address: any[]): string => {
    if (!address || address.length === 0) return 'Sin domicilio registrado';
    const primary = address[0] || {};
    const lines = primary.line ? primary.line.join(' ') : '';
    return `${lines}${primary.city ? ', ' + primary.city : ''}` || 'Sin domicilio registrado';
  };

  const formatAdmissionDate = (extensions: any[]): string => {
    const ext = extensions?.find((e: any) => typeof e?.url === 'string' && e.url.includes('admission-date'));
    if (!ext || !ext.valueDateTime) return 'No registrada';
    const d = new Date(ext.valueDateTime);
    if (isNaN(d.getTime())) return 'No registrada';
    return d.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  // Fecha de la última visita (ISO) → dd/mm/aaaa.
  const fmtVisit = (iso?: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // ---- Data fetching ----

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
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      const data = response.data;
      const list = Array.isArray(data) ? data : (data?.entry?.map((e: any) => e.resource) ?? []);
      setPatients(list);
      setVisibleCount(PAGE);
      enrichPatients(list.slice(0, PAGE));
    } catch (err) {
      console.error('Error buscando pacientes:', err);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const enrichPatients = async (visible: any[]) => {
    const ids = visible.map((p) => p?.id).filter(Boolean);
    const pending = ids.filter((id) => !(id in enrichMap));
    if (pending.length === 0) return;
    try {
      const url = `${import.meta.env.VITE_API_URL}/odontology/patients/enrich`;
      const res = await axios.post(url, { patientIds: pending }, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      setEnrichMap((prev) => ({ ...prev, ...(res.data || {}) }));
    } catch (err) {
      console.error('Error enriqueciendo pacientes:', err);
    }
  };

  // Carga inicial: lista TODO el padrón al entrar (sin necesidad de buscar).
  useEffect(() => {
    fetchPatients('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Búsqueda reactiva (debounce 300ms).
  const firstRun = useRef(true);
  useEffect(() => {
    if (selectedPatient) return;
    if (firstRun.current) { firstRun.current = false; return; }

    const t = setTimeout(() => {
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
    return () => clearTimeout(t);
  }, [searchTerm, dniFilter, ageFilter, admissionDateFilter, selectedPatient]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setDniFilter('');
    setAgeFilter('');
    setAdmissionDateFilter('');
  };

  const hasActiveFilters = searchTerm.trim() !== '' || dniFilter.trim() !== '' || ageFilter.trim() !== '' || admissionDateFilter.trim() !== '';

  // =====================================================
  // VISTA: Ficha Clínica Odontológica (paciente seleccionado)
  // =====================================================
  if (selectedPatient) {
    const { family: familyName, given: givenName } = patientNameFormatted(selectedPatient);
    const dni = patientDni(selectedPatient) || 'Sin DNI';
    const age = calcAge(selectedPatient.birthDate);

    return (
      <OdontoVisitContext.Provider value={{ activeEncounterId: activeVisit?.id ?? null }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'slideIn 0.25s ease' }}>

        {/* Barra superior de retorno (réplica de PatientSearch) */}
        <div className="ficha-clinica-header">
          <div className="ficha-clinica-header-top">
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#edf2f7', padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, color: '#4a5568' }} className="mobile-badge-paciente">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2962ff' }} />
              Paciente Activo
            </div>
          </div>

          <h2 className="ficha-clinica-header-title">
            🦷 Ficha Clínica Odontológica
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#edf2f7', padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, color: '#4a5568' }} className="desktop-badge-paciente">
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2962ff' }} />
              Paciente Activo
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
        </div>

        {/* Barra de VISITA: estado del encuentro activo + iniciar / finalizar (firmar) */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem',
          padding: '0.75rem 1rem', borderRadius: '14px',
          background: activeVisit ? 'rgba(4, 120, 87, 0.06)' : 'var(--bg-card)',
          border: `1px solid ${activeVisit ? 'rgba(4, 120, 87, 0.25)' : 'var(--border-color)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem', color: 'var(--color-text)' }}>
            <span style={{
              width: '9px', height: '9px', borderRadius: '50%',
              background: activeVisit ? 'var(--color-emerald-text)' : 'var(--color-muted)',
              boxShadow: activeVisit ? '0 0 8px var(--color-emerald-text)' : 'none', flexShrink: 0,
            }} />
            {activeVisit ? (
              <span><strong>Visita en curso</strong>{activeVisit.start ? ` · iniciada ${new Date(activeVisit.start).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}. Lo que registres se asocia a esta visita.</span>
            ) : (
              <span style={{ color: 'var(--color-muted)' }}>Sin visita activa. Iniciá una visita para agrupar y firmar las prestaciones de hoy.</span>
            )}
          </div>
          {activeVisit ? (
            <button
              onClick={handleFinalizeVisit}
              disabled={visitBusy}
              className="btn"
              style={{ padding: '0.5rem 1rem', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem', background: 'var(--color-emerald-text)', color: '#fff', border: 'none', cursor: visitBusy ? 'wait' : 'pointer' }}
            >
              <CheckCircle2 style={{ width: '1rem', height: '1rem' }} />
              {visitBusy ? 'Finalizando…' : 'Finalizar y firmar visita'}
            </button>
          ) : (
            <button
              onClick={handleOpenVisit}
              disabled={visitBusy}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: visitBusy ? 'wait' : 'pointer' }}
            >
              <PlayCircle style={{ width: '1rem', height: '1rem' }} />
              {visitBusy ? 'Iniciando…' : 'Iniciar visita'}
            </button>
          )}
        </div>

        {/* Layout: columna izquierda (datos demográficos) + área principal (tabs) */}
        <div className="ficha-clinica-layout">

          {/* Panel lateral izquierdo: Datos Demográficos */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Avatar e información rápida */}
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

            {/* Datos detallados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Calendar style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Edad</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '0.1rem' }}>
                    {age ? `${age} años (${selectedPatient.birthDate})` : 'No registrada'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Heart style={{ width: '1rem', height: '1rem', color: genderInfo(selectedPatient.gender).color, marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Género</div>
                  <div style={{ 
                    fontWeight: 600, 
                    color: 'var(--color-text)', 
                    marginTop: '0.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    <span style={{ 
                      color: genderInfo(selectedPatient.gender).color, 
                      fontWeight: 800, 
                      fontSize: '1.1rem', 
                      lineHeight: 1 
                    }}>
                      {genderInfo(selectedPatient.gender).symbol}
                    </span>
                    {genderInfo(selectedPatient.gender).label}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Phone style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Teléfono</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '0.1rem' }}>
                    {formatPhone(selectedPatient.telecom)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Mail style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Email</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-all', fontSize: '0.8rem', marginTop: '0.1rem' }}>
                    {formatEmail(selectedPatient.telecom)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <MapPin style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Domicilio</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '0.1rem', lineHeight: '1.25' }}>
                    {formatAddress(selectedPatient.address)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Clock style={{ width: '1rem', height: '1rem', color: 'var(--color-muted)', marginTop: '0.15rem', flexShrink: 0 }} />
                <div>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600 }}>Fecha de Ingreso</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)', marginTop: '0.1rem' }}>
                    {formatAdmissionDate(selectedPatient.extension)}
                  </div>
                </div>
              </div>

            </div>

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
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-emerald-text)', letterSpacing: '0.03em' }}>HL7 FHIR R4 Standard</span>
            </div>

          </div>

          {/* Área principal: barra de pestañas + panel de contenido */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

            {/* Control Segmentado (Pills) con flechas de desplazamiento en los bordes */}
            <div className="segmented-tabs-wrap">
              <button
                type="button"
                className="seg-arrow seg-arrow--left"
                aria-label="Ver pestañas anteriores"
                data-show={tabNav.left}
                onClick={() => scrollTabs(-1)}
              >
                <ChevronLeft style={{ width: '1.15rem', height: '1.15rem' }} />
              </button>

              <div
                ref={tabsRef}
                onScroll={updateTabNav}
                className="segmented-control"
                style={{ overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}
              >
                {TABS.map((tab) => {
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

              <button
                type="button"
                className="seg-arrow seg-arrow--right"
                aria-label="Ver más pestañas"
                data-show={tabNav.right}
                onClick={() => scrollTabs(1)}
              >
                <ChevronRight style={{ width: '1.15rem', height: '1.15rem' }} />
              </button>
            </div>

            {/* Panel de Contenido del Tab Activo */}
            <div className="panel ficha-clinica-content-panel" style={{ overflow: 'visible' }}>
              {activeTab === 'odontogram' && <OdontogramPAMI patientId={selectedPatient.id} birthDate={selectedPatient.birthDate} />}
              {activeTab === 'anamnesis' && <AnamnesisPAMI patientId={selectedPatient.id} />}
              {activeTab === 'oral-status' && <OralStatusPAMI patientId={selectedPatient.id} />}
              {activeTab === 'coverage' && <CoverageForm patientId={selectedPatient.id} />}
              {activeTab === 'consent' && <ConsentForm patientId={selectedPatient.id} />}
              {activeTab === 'evolution' && <EvolutionPAMI patientId={selectedPatient.id} />}
              {activeTab === 'documents' && <OdontologyDocuments patientId={selectedPatient.id} />}
              {activeTab === 'protesis' && <ProtesisTab patientId={selectedPatient.id} />}
            </div>

          </div>
        </div>
      </div>
      </OdontoVisitContext.Provider>
    );
  }

  // =====================================================
  // VISTA: Búsqueda de Pacientes (listado)
  // =====================================================
  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Cabecera de búsqueda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Search style={{ width: '1.6rem', height: '1.6rem', color: '#2962ff' }} />
          Búsqueda de Pacientes
        </h3>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const next = !showAdvanced;
              setShowAdvanced(next);
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
        <div className={showAdvanced ? 'grid-filters-advanced' : ''} style={{ display: showAdvanced ? 'grid' : 'block', gap: '1.25rem' }}>

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
            {patients.slice(0, visibleCount).map((p) => {
              const { family, given } = patientNameFormatted(p);
              const enr = enrichMap[p.id];
              return (
                <div
                  key={p.id}
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
                      {(family.charAt(0) || 'P').toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, fontFamily: 'var(--font-title)' }}>
                        {family}, {given}
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.65rem', fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
                        <span>DNI: <strong style={{ color: '#1d4ed8' }}>{patientDni(p) || 'N/D'}</strong></span>
                        <span style={{ opacity: 0.5 }}>|</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} title={genderInfo(p.gender).label}>
                          <span style={{ color: genderInfo(p.gender).color, fontWeight: 800, fontSize: '1.05rem', lineHeight: 1 }}>{genderInfo(p.gender).symbol}</span>
                          {genderInfo(p.gender).label}
                        </span>
                        <span style={{ opacity: 0.5 }}>|</span>
                        <span>Edad: {calcAge(p.birthDate) || 'N/D'} años</span>
                        <span style={{ opacity: 0.5 }}>|</span>
                        <span>Ingreso: {formatAdmissionDate(p.extension)}</span>
                        {enr?.lastVisit && (
                          <>
                            <span style={{ opacity: 0.5 }}>|</span>
                            <span>Última visita: <strong style={{ color: 'var(--color-text)' }}>{fmtVisit(enr.lastVisit)}</strong></span>
                          </>
                        )}
                        {enr?.obraSocial && (
                          <>
                            <span style={{ opacity: 0.5 }}>|</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.05rem 0.5rem', borderRadius: '999px', background: 'rgba(41,98,255,0.07)', color: '#1d4ed8', fontWeight: 600 }}>
                              <IdCard style={{ width: '0.8rem', height: '0.8rem' }} />
                              {enr.obraSocial}
                            </span>
                          </>
                        )}
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

            {patients.length > visibleCount && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: '0.55rem 1.4rem', fontSize: '0.85rem', fontWeight: 700 }}
                  onClick={() => {
                    const next = visibleCount + PAGE;
                    setVisibleCount(next);
                    enrichPatients(patients.slice(visibleCount, next));
                  }}
                >
                  Mostrar más
                </button>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                  Mostrando {Math.min(visibleCount, patients.length)} de {patients.length}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
