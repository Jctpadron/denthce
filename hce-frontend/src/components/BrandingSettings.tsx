import React, { useState, useRef } from 'react';
import axios from 'axios';
import keycloak from '../utils/keycloak-config';
import { useTheme, type TenantConfig } from '../context/ThemeContext';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABELS: Record<string, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

const COLOR_PRESETS = [
  { label: 'Cian Clínico', value: '#0284c7' },
  { label: 'Esmeralda', value: '#10b981' },
  { label: 'Violeta', value: '#7c3aed' },
  { label: 'Rosa', value: '#e11d48' },
  { label: 'Ámbar', value: '#d97706' },
  { label: 'Índigo', value: '#4f46e5' },
  { label: 'Pizarra', value: '#475569' },
  { label: 'Teal', value: '#0d9488' },
];

export const BrandingSettings: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { config, reload } = useTheme();
  const [form, setForm] = useState<Partial<TenantConfig>>({ ...config });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<'identidad' | 'profesional' | 'contacto' | 'horarios' | 'firma' | 'integracion'>('identidad');
  const [showSecret, setShowSecret] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(config.logoUrl);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(config.signatureUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const update = (field: keyof TenantConfig, value: any) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const updateSchedule = (day: string, value: string) => {
    setForm(f => ({
      ...f,
      scheduleJson: { ...(f.scheduleJson || {}), [day]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(import.meta.env.VITE_API_URL + '/api/tenant/config', form, {
        headers: { Authorization: `Bearer ${keycloak.token}` },
      });
      await reload();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert('Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axios.post(import.meta.env.VITE_API_URL + '/api/tenant/logo', fd, {
        headers: { Authorization: `Bearer ${keycloak.token}`, 'Content-Type': 'multipart/form-data' },
      });
      setLogoPreview(res.data.logoUrl);
      update('logoUrl', res.data.logoUrl);
      await reload();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Error al subir el logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSignatureUpload = async (file: File) => {
    setUploadingSignature(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axios.post(import.meta.env.VITE_API_URL + '/api/tenant/signature', fd, {
        headers: { Authorization: `Bearer ${keycloak.token}`, 'Content-Type': 'multipart/form-data' },
      });
      setSignaturePreview(res.data.signatureUrl);
      update('signatureUrl', res.data.signatureUrl);
      await reload();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Error al subir la firma.');
    } finally {
      setUploadingSignature(false);
    }
  };

  const SECTIONS = [
    { key: 'identidad', label: '🎨 Identidad', icon: '🎨' },
    { key: 'profesional', label: '👨‍⚕️ Profesional', icon: '👨‍⚕️' },
    { key: 'contacto', label: '📍 Contacto', icon: '📍' },
    { key: 'horarios', label: '🕐 Horarios', icon: '🕐' },
    { key: 'firma', label: '✍️ Firma Digital', icon: '✍️' },
    { key: 'integracion', label: '🔌 Integraciones', icon: '🔌' },
  ] as const;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.85rem',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '0.88rem',
    color: 'var(--color-text)',
    background: 'var(--bg-surface)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.3rem',
    display: 'block',
  };

  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.2s ease' }}>
      {/* Header */}
      <div className="module-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-title)' }}>
            🎨 Personalización del Consultorio
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            Solo el Administrador puede modificar estos ajustes. Los cambios se aplican al instante.
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="module-header-btn" style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 1.2rem', cursor: 'pointer', color: 'var(--color-muted)', fontSize: '0.85rem', transition: 'all 0.15s' }}>
            ← Volver
          </button>
        )}
      </div>

      {/* Tabs de Secciones */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        borderBottom: '2px solid var(--border-color)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        width: '100%',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        <style dangerouslySetInnerHTML={{__html: `
          .branding-tabs-container::-webkit-scrollbar { display: none; }
        `}} className="branding-tabs-container" />
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeSection === s.key ? `3px solid var(--color-cyan)` : '3px solid transparent',
              color: activeSection === s.key ? 'var(--color-cyan)' : 'var(--color-muted)',
              padding: '0.65rem 1rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: activeSection === s.key ? 700 : 500,
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Contenido de la Sección Activa */}
      <div className="branding-settings-grid">

        {/* Panel Izquierdo: Formulario */}
        <div className="panel" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>

          {/* SECCIÓN: IDENTIDAD */}
          {activeSection === 'identidad' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>Identidad del Consultorio</h3>

              {/* Logo Upload */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Logo del Consultorio</label>
                <div
                  onClick={() => logoInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'rgba(0,0,0,0.01)',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" style={{ maxHeight: '80px', maxWidth: '200px', objectFit: 'contain' }} />
                  ) : (
                    <>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>☁️</div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                        {uploadingLogo ? 'Subiendo...' : 'Hacé clic para subir tu logo (PNG, SVG, JPG — max 1MB)'}
                      </p>
                    </>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                />
                {logoPreview && (
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    style={{ fontSize: '0.78rem', color: 'var(--color-cyan)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                  >
                    {uploadingLogo ? 'Subiendo...' : '↻ Cambiar logo'}
                  </button>
                )}
              </div>

              <div className="grid-2col-responsive">
                <div style={fieldStyle}>
                  <label style={labelStyle}>Nombre del Consultorio</label>
                  <input style={inputStyle} value={form.clinicName || ''} onChange={e => update('clinicName', e.target.value)} placeholder="Ej: Consultorio Odontológico Dr. García" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Especialidad</label>
                  <input style={inputStyle} value={form.specialty || ''} onChange={e => update('specialty', e.target.value)} placeholder="Ej: Odontología General" />
                </div>
              </div>

              {/* Color Primario */}
              <div style={fieldStyle}>
                <label style={labelStyle}>Color Primario del Sistema</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(36px, 1fr))', gap: '0.5rem' }}>
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c.value}
                      title={c.label}
                      onClick={() => update('primaryColor', c.value)}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: '50%',
                        background: c.value,
                        border: form.primaryColor === c.value ? '3px solid var(--color-text)' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'transform 0.15s',
                        transform: form.primaryColor === c.value ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <label style={{ ...labelStyle, textTransform: 'none', marginBottom: 0 }}>Color personalizado:</label>
                  <input
                    type="color"
                    value={form.primaryColor || '#0284c7'}
                    onChange={e => update('primaryColor', e.target.value)}
                    style={{ width: '2.5rem', height: '2.5rem', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: 0 }}
                  />
                  <input
                    style={{ ...inputStyle, width: '120px', fontFamily: 'monospace' }}
                    value={form.primaryColor || ''}
                    onChange={e => update('primaryColor', e.target.value)}
                    placeholder="#0284c7"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN: PROFESIONAL */}
          {activeSection === 'profesional' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>Datos del Profesional</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-muted)' }}>Estos datos aparecen en el encabezado de recetas e informes.</p>

              <div className="grid-profesional-responsive">
                <div style={fieldStyle}>
                  <label style={labelStyle}>Título</label>
                  <select style={inputStyle} value={form.doctorTitle || 'Dr.'} onChange={e => update('doctorTitle', e.target.value)}>
                    <option>Dr.</option><option>Dra.</option><option>Od.</option><option>Lic.</option><option>Prof.</option>
                  </select>
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Nombre y Apellido del Profesional</label>
                  <input style={inputStyle} value={form.doctorName || ''} onChange={e => update('doctorName', e.target.value)} placeholder="Ej: Juan Carlos García" />
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Número de Matrícula Profesional</label>
                <input style={{ ...inputStyle, maxWidth: '300px' }} value={form.doctorLicense || ''} onChange={e => update('doctorLicense', e.target.value)} placeholder="Ej: MP 12345 / MN 98765" />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Obra Social / Prepaga (para encabezado de recetas)</label>
                <input style={inputStyle} value={form.healthInsurance || ''} onChange={e => update('healthInsurance', e.target.value)} placeholder="Ej: OSDE, Swiss Medical, Particular..." />
              </div>

              <div className="grid-form-2col">
                <div style={fieldStyle}>
                  <label style={labelStyle}>CUIT</label>
                  <input style={inputStyle} value={form.cuit || ''} onChange={e => update('cuit', e.target.value)} placeholder="Ej: 20-12345678-9" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Email Profesional</label>
                  <input type="email" style={inputStyle} value={form.email || ''} onChange={e => update('email', e.target.value)} placeholder="doctor@consultorio.com" />
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN: CONTACTO */}
          {activeSection === 'contacto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>Datos de Contacto del Consultorio</h3>

              <div style={fieldStyle}>
                <label style={labelStyle}>Dirección</label>
                <input style={inputStyle} value={form.address || ''} onChange={e => update('address', e.target.value)} placeholder="Ej: Av. Corrientes 1234, Piso 3, Of. 301" />
              </div>

              <div className="grid-3col-responsive">
                <div style={fieldStyle}>
                  <label style={labelStyle}>Ciudad</label>
                  <input style={inputStyle} value={form.city || ''} onChange={e => update('city', e.target.value)} placeholder="Ej: Buenos Aires" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Provincia</label>
                  <input style={inputStyle} value={form.province || ''} onChange={e => update('province', e.target.value)} placeholder="Ej: CABA" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>CP</label>
                  <input style={inputStyle} value={form.postalCode || ''} onChange={e => update('postalCode', e.target.value)} placeholder="1043" />
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Teléfono</label>
                <input style={{ ...inputStyle, maxWidth: '280px' }} value={form.phone || ''} onChange={e => update('phone', e.target.value)} placeholder="Ej: (011) 4321-9876" />
              </div>
            </div>
          )}

          {/* SECCIÓN: HORARIOS */}
          {activeSection === 'horarios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>Horarios de Atención</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                Formato: <code>09:00-18:00</code> — Dejá vacío si no se atiende ese día.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {DIAS.map(dia => (
                  <div key={dia} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ ...labelStyle, textTransform: 'capitalize', marginBottom: 0, fontSize: '0.88rem' }}>
                      {DIAS_LABELS[dia]}
                    </label>
                    <input
                      style={{ ...inputStyle, maxWidth: '200px' }}
                      value={(form.scheduleJson || {})[dia] || ''}
                      onChange={e => updateSchedule(dia, e.target.value)}
                      placeholder="09:00-18:00 (vacío = cerrado)"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN: FIRMA */}
          {activeSection === 'firma' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>Firma Digital del Profesional</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                Subí una imagen PNG de tu firma a mano. Se usará en el encabezado de recetas e informes clínicos. Máximo 500 KB.
              </p>

              <div
                onClick={() => signatureInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '2rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'rgba(0,0,0,0.01)',
                  minHeight: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {signaturePreview ? (
                  <img
                    src={signaturePreview}
                    alt="Firma"
                    style={{ maxHeight: '100px', maxWidth: '300px', objectFit: 'contain', filter: 'contrast(1.2)' }}
                  />
                ) : (
                  <div>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✍️</div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                      {uploadingSignature ? 'Subiendo firma...' : 'Hacé clic para subir imagen de firma (PNG/JPG, fondo blanco o transparente)'}
                    </p>
                  </div>
                )}
              </div>

              <input
                ref={signatureInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleSignatureUpload(f); }}
              />

              {signaturePreview && (
                <button
                  onClick={() => signatureInputRef.current?.click()}
                  style={{ fontSize: '0.78rem', color: 'var(--color-cyan)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                >
                  {uploadingSignature ? 'Subiendo...' : '↻ Cambiar firma'}
                </button>
              )}
            </div>
          )}

          {/* SECCIÓN: INTEGRACIONES */}
          {activeSection === 'integracion' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>🔌 Integraciones Externas</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-muted)' }}>
                Configurá las credenciales y claves de seguridad para conectar la HCE con sistemas externos autorizados.
              </p>
              
              <div style={{
                background: 'rgba(2, 132, 199, 0.05)',
                border: '1px solid rgba(2, 132, 199, 0.15)',
                borderRadius: '8px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-cyan)' }}>💬 Integración CliniChat (WhatsApp)</h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-muted)', lineHeight: '1.25rem' }}>
                  Habilita la sincronización automática de turnos en tiempo real. Cuando agendes o canceles citas en este panel, se notificará al bot de WhatsApp para que envíe los recordatorios.
                </p>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>CliniChat Webhook Secret</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type={showSecret ? 'text' : 'password'}
                    style={inputStyle}
                    value={form.hceWebhookSecret || ''}
                    onChange={e => update('hceWebhookSecret', e.target.value)}
                    placeholder="Pegá el secreto de webhook (se genera en CliniChat)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    style={{
                      padding: '0.6rem 0.85rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: 'var(--color-text)',
                      minWidth: '40px',
                    }}
                  >
                    {showSecret ? '🙈' : '👁️'}
                  </button>
                </div>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                  Clave simétrica para firmar y validar la procedencia de los eventos salientes.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: form.hceWebhookSecret ? '#10b981' : '#ef4444',
                }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text)' }}>
                  Estado de la Integración: {form.hceWebhookSecret ? 'Conectado / Firma Activa' : 'Desconectado'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Panel Derecho: Vista Previa */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '1rem' }}>
          <div className="panel" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Vista Previa
            </h4>

            {/* Mini Navbar Preview */}
            <div style={{
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              marginBottom: '0.75rem',
            }}>
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" style={{ height: '28px', width: '28px', objectFit: 'contain', borderRadius: '4px' }} />
              ) : (
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: `linear-gradient(135deg, ${form.primaryColor || '#0284c7'}, #10b981)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '1rem',
                }}>
                  {(form.clinicName || 'D').charAt(0)}
                </div>
              )}
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {form.clinicName || 'Mi Consultorio'}
                </div>
                <div style={{ fontSize: '0.65rem', color: form.primaryColor || '#0284c7', fontWeight: 600 }}>
                  {form.specialty || 'Odontología'}
                </div>
              </div>
            </div>

            {/* Mini Botón Preview */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button style={{
                background: form.primaryColor || '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'default',
              }}>
                Botón Primario
              </button>
              <button style={{
                background: `${form.primaryColor}15` || 'rgba(2,132,199,0.08)',
                color: form.primaryColor || '#0284c7',
                border: `1px solid ${form.primaryColor}30` || '1px solid rgba(2,132,199,0.2)',
                borderRadius: '6px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'default',
              }}>
                Secundario
              </button>
            </div>

            {/* Datos del Doctor Preview */}
            {(form.doctorName || form.doctorLicense) && (
              <div style={{
                marginTop: '0.75rem',
                padding: '0.65rem',
                background: 'rgba(0,0,0,0.02)',
                borderRadius: '8px',
                fontSize: '0.72rem',
                color: 'var(--color-muted)',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                  {form.doctorTitle || 'Dr.'} {form.doctorName || ''}
                </div>
                {form.doctorLicense && <div>Mat. {form.doctorLicense}</div>}
                {form.specialty && <div>{form.specialty}</div>}
              </div>
            )}
          </div>

          {/* Powered by DentHCE */}
          <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--color-muted)' }}>
            Powered by <strong style={{ color: 'var(--color-cyan)' }}>DentHCE</strong>
          </div>
        </div>

      </div>

      {/* Botón Guardar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
        {saved && (
          <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.9rem', alignSelf: 'center' }}>
            ✅ Configuración guardada correctamente
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: 'var(--color-cyan)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '0.7rem 2rem',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.7 : 1,
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'Guardando...' : '💾 Aplicar y Guardar Cambios'}
        </button>
      </div>
    </div>
  );
};
