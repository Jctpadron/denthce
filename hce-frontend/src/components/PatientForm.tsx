import React, { useState } from 'react';
import axios from 'axios';
import { UserPlus, CheckCircle, AlertTriangle } from 'lucide-react';
import keycloak from '../utils/keycloak-config';

interface PatientFormProps {
  onSuccess: () => void;
}

export const PatientForm: React.FC<PatientFormProps> = ({ onSuccess }) => {
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
      const response = await axios.post('http://localhost:3000/fhir/r4/Patient', fhirPatient, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
      });

      setMessage({
        type: 'success',
        text: `Paciente registrado con éxito. Identificador generado: ${response.data.id}`,
      });
      
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
      
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Error al intentar registrar el paciente.';
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
        Formulario de Admisión de Paciente
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
        
        {/* Identificación DNI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-muted)' }}>DNI *</label>
          <input
            type="text"
            required
            inputMode="numeric"
            pattern="[0-9]*"
            className="search-input"
            style={{ paddingLeft: '1rem' }}
            placeholder="Ej: 38450123"
            value={dni}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*$/.test(val)) {
                setDni(val);
              }
            }}
          />
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

        {/* Botón de Enviar */}
        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: '0.75rem 2rem', fontSize: '1rem', width: '200px' }}
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
};
