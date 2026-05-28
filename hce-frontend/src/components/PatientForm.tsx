import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, CheckCircle, AlertTriangle, Search, DatabaseZap } from 'lucide-react';
import keycloak from '../utils/keycloak-config';

interface PatientFormProps {
  patient?: any;
  onSuccess: () => void;
  onCancel?: () => void;
}

export const PatientForm: React.FC<PatientFormProps> = ({ patient, onSuccess, onCancel }) => {
  const [dni, setDni] = useState('');
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('unknown');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Estado SISA ---
  const [sisaStatus, setSisaStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const [sisaMessage, setSisaMessage] = useState('');

  /** Consulta el padrón SISA y propone autocompletar los campos del formulario */
  const handleVerificarSisa = async () => {
    if (!dni || dni.length < 6) {
      setSisaStatus('error');
      setSisaMessage('Ingresá un DNI válido antes de verificar en SISA.');
      return;
    }
    setSisaStatus('loading');
    setSisaMessage('');
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/sisa/verificar?dni=${dni}&gender=${gender}`,
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      const data = response.data;
      if (data.status === 'found') {
        setSisaStatus('found');
        const isReal = data.source === 'sisa-real';
        setSisaMessage(`${isReal ? '✅ Verificado en SISA' : '🔧 Modo demo (SISA mock)'}`);
        // Proponer autocompletado solo si los campos están vacíos
        if (!familyName && data.apellido) setFamilyName(data.apellido);
        if (!givenName && data.nombre) setGivenName(data.nombre);
        if (!birthDate && data.fechaNacimiento) setBirthDate(data.fechaNacimiento);
        if (data.sexo && data.sexo !== 'unknown') setGender(data.sexo);
      } else if (data.status === 'not_found') {
        setSisaStatus('not_found');
        setSisaMessage('⚠️ DNI no encontrado en el padrón SISA.');
      } else {
        setSisaStatus('error');
        setSisaMessage('🔌 SISA no disponible en este momento.');
      }
    } catch {
      setSisaStatus('error');
      setSisaMessage('🔌 Error conectando con el servicio SISA.');
    }
  };

  useEffect(() => {
    if (patient) {
      const primaryName = patient.name?.[0] || {};
      const given = Array.isArray(primaryName.given) ? primaryName.given.join(' ') : (primaryName.given || '');
      const family = primaryName.family || '';
      const dniVal = patient.identifier?.[0]?.value || '';
      
      const phoneObj = patient.telecom?.find((t: any) => t.system === 'phone');
      const emailObj = patient.telecom?.find((t: any) => t.system === 'email');
      
      const addressObj = patient.address?.[0] || {};
      const line = addressObj.line ? addressObj.line.join(' ') : '';
      const cityVal = addressObj.city || '';

      setDni(dniVal);
      setGivenName(given);
      setFamilyName(family);
      setBirthDate(patient.birthDate || '');
      setGender(patient.gender || 'unknown');
      setPhone(phoneObj ? phoneObj.value : '');
      setEmail(emailObj ? emailObj.value : '');
      setAddressLine(line);
      setCity(cityVal);
    } else {
      setDni('');
      setGivenName('');
      setFamilyName('');
      setBirthDate('');
      setGender('unknown');
      setPhone('');
      setEmail('');
      setAddressLine('');
      setCity('');
    }
  }, [patient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Mapear los campos al esquema estándar HL7 FHIR Patient R4
    const fhirPatient = {
      resourceType: 'Patient',
      active: true,
      identifier: [
        {
          use: 'official',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'NNARG', // Identificación nacional Argentina (DNI)
                display: 'National Person Identifier',
              },
            ],
          },
          system: 'http://hospital.gov/dni',
          value: dni.trim(),
        },
      ],
      name: [
        {
          use: 'official',
          family: familyName.trim(),
          given: [givenName.trim()],
        },
      ],
      gender: gender,
      birthDate: birthDate,
      telecom: [
        ...(phone ? [{ system: 'phone', value: phone.trim(), use: 'home' }] : []),
        ...(email ? [{ system: 'email', value: email.trim(), use: 'home' }] : []),
      ],
      address: [
        ...(addressLine || city
          ? [
              {
                use: 'home',
                type: 'both',
                line: [addressLine.trim()],
                city: city.trim(),
                country: 'Argentina',
              },
            ]
          : []),
      ],
    };

    try {
      const isEditing = !!patient;
      const url = isEditing
        ? `${import.meta.env.VITE_API_URL}/fhir/r4/Patient/${patient.id}`
        : import.meta.env.VITE_API_URL + '/fhir/r4/Patient';

      const response = await axios({
        method: isEditing ? 'PUT' : 'POST',
        url,
        data: fhirPatient,
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
      });

      setMessage({
        type: 'success',
        text: isEditing
          ? 'Paciente actualizado con éxito.'
          : `Paciente registrado con éxito. Identificador generado: ${response.data.id}`,
      });
      
      if (!isEditing) {
        // Limpiar formulario
        setDni('');
        setGivenName('');
        setFamilyName('');
        setBirthDate('');
        setGender('unknown');
        setPhone('');
        setEmail('');
        setAddressLine('');
        setCity('');
      }
      
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || (patient ? 'Error al intentar actualizar el paciente.' : 'Error al intentar registrar el paciente.');
      setMessage({
        type: 'error',
        text: errMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '2rem', backdropFilter: 'blur(16px)' }}>
      <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-cyan)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <UserPlus style={{ width: '1.8rem', height: '1.8rem' }} />
        {patient ? 'Modificar Datos del Paciente' : 'Formulario de Admisión de Paciente'}
      </h3>

      {message && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
          border: `1px solid ${message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)'}`,
          color: message.type === 'success' ? 'var(--color-emerald)' : 'var(--color-rose)'
        }}>
          {message.type === 'success' ? <CheckCircle /> : <AlertTriangle />}
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* Identificación DNI + Verificación SISA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-muted)' }}>DNI *</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              required
              inputMode="numeric"
              pattern="[0-9]*"
              className="search-input"
              style={{ paddingLeft: '1rem', flex: 1 }}
              placeholder="Ej: 38450123"
              value={dni}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*$/.test(val)) {
                  setDni(val);
                  setSisaStatus('idle');
                }
              }}
            />
            {/* Botón SISA — oculto hasta tener credenciales del Ministerio de Salud */}
            {/* Para activar: configurar SISA_MOCK=false + SISA_USER + SISA_PASSWORD en .env del backend */}
            <button
              type="button"
              onClick={handleVerificarSisa}
              disabled={sisaStatus === 'loading'}
              title="Verificar DNI en el padrón SISA (Ministerio de Salud Argentina)"
              style={{
                display: 'none',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 0.9rem',
                borderRadius: '10px',
                border: `1px solid ${sisaStatus === 'found' ? 'rgba(16,185,129,0.4)' : 'var(--border-color)'}`,
                background: sisaStatus === 'found' ? 'rgba(16,185,129,0.08)' : 'rgba(41,98,255,0.06)',
                color: sisaStatus === 'found' ? '#10b981' : '#2962ff',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: sisaStatus === 'loading' ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: 1,
                transition: 'all 0.2s ease',
              }}
            >
              {sisaStatus === 'loading'
                ? <Search style={{ width: '0.85rem', height: '0.85rem', animation: 'spin 1s linear infinite' }} />
                : <DatabaseZap style={{ width: '0.85rem', height: '0.85rem' }} />
              }
              SISA
            </button>
          </div>
          {sisaStatus !== 'idle' && sisaMessage && (
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '0.3rem 0.6rem',
              borderRadius: '6px',
              background: sisaStatus === 'found' ? 'rgba(16,185,129,0.08)' :
                          sisaStatus === 'not_found' ? 'rgba(234,179,8,0.08)' : 'rgba(239,68,68,0.08)',
              color: sisaStatus === 'found' ? '#047857' :
                     sisaStatus === 'not_found' ? '#92400e' : '#b91c1c',
              border: `1px solid ${sisaStatus === 'found' ? 'rgba(16,185,129,0.2)' :
                                    sisaStatus === 'not_found' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              {sisaMessage}
            </div>
          )}
        </div>

        {/* Género biológico */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-muted)' }}>Género *</label>
          <select
            className="search-input"
            style={{ paddingLeft: '1rem', height: '43px', background: 'var(--bg-card)' }}
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="male">Masculino</option>
            <option value="female">Femenino</option>
            <option value="other">Otro</option>
            <option value="unknown">Desconocido</option>
          </select>
        </div>

        {/* Nombres */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-muted)' }}>Nombres *</label>
          <input
            type="text"
            required
            className="search-input"
            style={{ paddingLeft: '1rem' }}
            placeholder="Ej: Julio César"
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
          />
        </div>

        {/* Apellidos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-muted)' }}>Apellidos *</label>
          <input
            type="text"
            required
            className="search-input"
            style={{ paddingLeft: '1rem' }}
            placeholder="Ej: Mendoza"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
        </div>

        {/* Fecha de nacimiento */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-muted)' }}>Fecha de Nacimiento *</label>
          <input
            type="date"
            required
            className="search-input"
            style={{ paddingLeft: '1rem', color: 'var(--color-text)' }}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>

        {/* Teléfono */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-muted)' }}>Teléfono</label>
          <input
            type="text"
            className="search-input"
            style={{ paddingLeft: '1rem' }}
            placeholder="Ej: +54 9 261 4567890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        {/* Email */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', gridColumn: 'span 2' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-muted)' }}>Correo Electrónico</label>
          <input
            type="email"
            className="search-input"
            style={{ paddingLeft: '1rem' }}
            placeholder="Ej: julio.mendoza@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Dirección de domicilio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-muted)' }}>Calle y Altura</label>
          <input
            type="text"
            className="search-input"
            style={{ paddingLeft: '1rem' }}
            placeholder="Ej: Av. San Martín 1024"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
          />
        </div>

        {/* Ciudad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-muted)' }}>Ciudad</label>
          <input
            type="text"
            className="search-input"
            style={{ paddingLeft: '1rem' }}
            placeholder="Ej: Mendoza"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        {/* Botones de Acción */}
        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
              style={{ padding: '0.75rem 2rem', fontSize: '1rem', width: '150px' }}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '0.75rem 2rem', fontSize: '1rem', width: '200px' }}
          >
            {loading ? (patient ? 'Guardando...' : 'Registrando...') : (patient ? 'Guardar Cambios' : 'Registrar')}
          </button>
        </div>
      </form>
    </div>
  );
};
