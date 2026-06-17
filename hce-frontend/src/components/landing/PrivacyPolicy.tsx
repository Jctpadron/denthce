import React from 'react';
import { Shield, Lock, Eye, FileText, Trash2, HelpCircle } from 'lucide-react';
import { DentaCloudLogoImage } from './content';
import './landing.css';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base, #f8fafc)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.5rem', background: '#ffffff',
        borderBottom: '1px solid var(--border-color, #e2e8f0)',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <DentaCloudLogoImage height="36px" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-muted, #64748b)' }}>Política de Privacidad</span>
        </div>
        <button
          onClick={onBack}
          className="btn btn-secondary"
          style={{ fontSize: '0.82rem' }}
        >
          ← Volver
        </button>
      </header>

      {/* Content */}
      <main style={{
        flex: 1,
        padding: '2rem 1.5rem',
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto',
      }}>
        <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: 'var(--color-text, #0f172a)', marginBottom: '0.5rem' }}>
          Política de Privacidad
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-muted, #64748b)', marginBottom: '2rem' }}>
          Última actualización: Junio 2026
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* 1. Introducción */}
          <Section icon={<Shield size={20} />} title="1. Introducción">
            <p>
              Denta Cloud (en adelante, "la Plataforma") es una Historia Clínica Electrónica Odontológica desarrollada por <strong>systia.ar</strong>. 
              Esta Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos la información personal y los datos de salud 
              de los pacientes y profesionales que utilizan la Plataforma, en cumplimiento de la Ley 25.326 de Protección de Datos Personales 
              de la República Argentina y estándares internacionales HL7 FHIR R4.
            </p>
          </Section>

          {/* 2. Datos que recolectamos */}
          <Section icon={<FileText size={20} />} title="2. Datos que recolectamos">
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li><strong>Datos del profesional:</strong> nombre, apellido, email, matrícula profesional, especialidad, número de teléfono.</li>
              <li><strong>Datos del paciente:</strong> nombre, apellido, DNI, fecha de nacimiento, género, domicilio, obra social, antecedentes médicos.</li>
              <li><strong>Datos clínicos:</strong> odontogramas, diagnósticos (SNOMED CT), tratamientos, prescripciones, imágenes radiográficas, informes, presupuestos, pagos.</li>
              <li><strong>Datos de uso:</strong> registros de acceso (logs de auditoría), dirección IP, tipo de dispositivo, navegador, páginas visitadas dentro de la Plataforma.</li>
            </ul>
          </Section>

          {/* 3. Finalidad del tratamiento */}
          <Section icon={<Eye size={20} />} title="3. Finalidad del tratamiento de datos">
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Gestión de la Historia Clínica Electrónica del paciente.</li>
              <li>Coordinación de turnos, presupuestos, cobros y gastos clínicos.</li>
              <li>Comunicación con el paciente y entre profesionales del mismo consultorio.</li>
              <li>Cumplimiento de obligaciones legales (auditoría, facturación, reportes sanitarios).</li>
              <li>Mejora continua de la Plataforma y soporte técnico.</li>
            </ul>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted, #64748b)', marginTop: '0.5rem' }}>
              No utilizamos datos de salud para fines publicitarios ni los compartimos con terceros ajenos a la atención clínica.
            </p>
          </Section>

          {/* 4. Seguridad */}
          <Section icon={<Lock size={20} />} title="4. Medidas de seguridad">
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li><strong>Cifrado en tránsito:</strong> todas las comunicaciones usan TLS 1.3 (HTTPS).</li>
              <li><strong>Cifrado en reposo:</strong> la base de datos PostgreSQL en AWS RDS utiliza cifrado AES-256.</li>
              <li><strong>Autenticación Zero Trust:</strong> acceso mediante Keycloak con tokens JWT, roles por profesional, y aislamiento por tenant (consultorio).</li>
              <li><strong>Auditoría inmutable:</strong> cada acceso, modificación o eliminación de datos clínicos queda registrado con timestamp, usuario y acción.</li>
              <li><strong>Rate limiting y protección anti-abuso:</strong> limitación de solicitudes por IP y por usuario.</li>
              <li><strong>Respaldo diario:</strong> backups automatizados de la base de datos con retención de 30 días.</li>
            </ul>
          </Section>

          {/* 5. Almacenamiento */}
          <Section icon={<FileText size={20} />} title="5. Almacenamiento y retención">
            <p>
              Los datos se almacenan en servidores de Amazon Web Services (AWS) en la región <strong>us-east-1</strong> (Estados Unidos), 
              bajo los estándares de seguridad SOC 2, ISO 27001 e HIPAA de AWS.
            </p>
            <p>
              Los datos clínicos se conservan durante todo el período que el consultorio mantenga activa su cuenta. 
              Al cancelar la cuenta, los datos se eliminan de forma segura en un plazo de 30 días, salvo que la legislación 
              argentina exija un período de retención mayor para historias clínicas (10 años según Ley 26.529).
            </p>
          </Section>

          {/* 6. Derechos del titular */}
          <Section icon={<Eye size={20} />} title="6. Derechos del titular de los datos">
            <p>De acuerdo con la Ley 25.326, los titulares de los datos tienen derecho a:</p>
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li><strong>Acceso:</strong> solicitar qué datos personales suyos están almacenados en la Plataforma.</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li><strong>Supresión:</strong> solicitar la eliminación de sus datos, salvo obligación legal de conservación.</li>
              <li><strong>Oposición:</strong> oponerse al tratamiento de sus datos para fines específicos.</li>
            </ul>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-muted, #64748b)', marginTop: '0.5rem' }}>
              Para ejercer estos derechos, el titular debe contactar al profesional tratante, quien gestionará la solicitud 
              a través de la Plataforma o directamente con el equipo de Denta Cloud.
            </p>
          </Section>

          {/* 7. Eliminación de datos */}
          <Section icon={<Trash2 size={20} />} title="7. Eliminación de datos">
            <p>
              Los profesionales pueden eliminar registros clínicos específicos desde la Plataforma. La eliminación es <strong>lógica</strong> (soft delete): 
              el dato se marca como inactivo y deja de ser visible para los usuarios, pero permanece en la base de datos con fines de auditoría 
              durante el período de retención legal.
            </p>
            <p>
              Para solicitar la eliminación definitiva de todos los datos de un consultorio, el administrador del tenant debe contactar 
              a <strong>privacidad@systia.ar</strong>. La eliminación se ejecuta en un plazo máximo de 30 días hábiles.
            </p>
          </Section>

          {/* 8. Cambios a esta política */}
          <Section icon={<FileText size={20} />} title="8. Cambios a esta política">
            <p>
              Denta Cloud se reserva el derecho de modificar esta Política de Privacidad en cualquier momento. 
              Los cambios serán notificados a través de la Plataforma y por correo electrónico a los administradores de cada consultorio 
              con al menos 15 días de anticipación. El uso continuado de la Plataforma después de la entrada en vigencia de los cambios 
              implica la aceptación de la nueva política.
            </p>
          </Section>

          {/* 9. Contacto */}
          <Section icon={<HelpCircle size={20} />} title="9. Contacto">
            <p>
              Para consultas sobre esta Política de Privacidad, ejercer derechos de acceso/rectificación/supresión, 
              o reportar incidentes de seguridad:
            </p>
            <div style={{
              background: 'var(--bg-card, #f1f5f9)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              display: 'flex', flexDirection: 'column', gap: '0.4rem',
              fontSize: '0.9rem',
            }}>
              <span><strong>Email:</strong> privacidad@systia.ar</span>
              <span><strong>Sitio web:</strong> systia.ar</span>
              <span><strong>Responsable:</strong> systia.ar — Titularidad de los datos: cada consultorio (tenant) es responsable del tratamiento de los datos de sus pacientes.</span>
            </div>
          </Section>

        </div>
      </main>

      {/* Footer simple */}
      <footer style={{
        textAlign: 'center', padding: '1.5rem',
        borderTop: '1px solid var(--border-color, #e2e8f0)',
        fontSize: '0.78rem', color: 'var(--color-muted, #64748b)',
        background: '#ffffff',
      }}>
        © 2026 Denta Cloud — systia.ar · HL7 FHIR R4
      </footer>
    </div>
  );
};

/** Sección colapsable o fija con ícono */
const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <section style={{
    background: '#ffffff',
    border: '1px solid var(--border-color, #e2e8f0)',
    borderRadius: '14px',
    padding: '1.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
      <span style={{ color: 'var(--color-primary, #0d9488)' }}>{icon}</span>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', margin: 0 }}>{title}</h3>
    </div>
    <div style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--color-text, #334155)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {children}
    </div>
  </section>
);
