import React from 'react';
import { FileText, AlertCircle, Shield, CreditCard, HelpCircle } from 'lucide-react';
import { DentaCloudLogoImage } from './content';
import './landing.css';

interface TermsProps {
  onBack: () => void;
}

export const TermsAndConditions: React.FC<TermsProps> = ({ onBack }) => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base, #f8fafc)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.5rem', background: '#ffffff',
        borderBottom: '1px solid var(--border-color, #e2e8f0)',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <DentaCloudLogoImage height="36px" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-muted, #64748b)' }}>Términos y Condiciones</span>
        </div>
        <button onClick={onBack} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>← Volver</button>
      </header>

      <main style={{
        flex: 1, padding: '2rem 1.5rem', maxWidth: '800px', width: '100%', margin: '0 auto',
      }}>
        <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: 'var(--color-text, #0f172a)', marginBottom: '0.5rem' }}>
          Términos y Condiciones de Uso
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-muted, #64748b)', marginBottom: '2rem' }}>
          Última actualización: Junio 2026
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          <Section icon={<FileText size={20} />} title="1. Aceptación de los términos">
            <p>
              El uso de la Plataforma Denta Cloud (en adelante, "la Plataforma"), operada por <strong>systia.ar</strong>, 
              implica la aceptación plena y sin reservas de los presentes Términos y Condiciones. 
              Si el usuario no está de acuerdo, debe abstenerse de utilizar la Plataforma.
            </p>
          </Section>

          <Section icon={<Shield size={20} />} title="2. Descripción del servicio">
            <p>
              Denta Cloud es una Historia Clínica Electrónica Odontológica (HCE) en la nube que permite a profesionales 
              odontológicos gestionar fichas clínicas, odontogramas, turnos, presupuestos, pagos, gastos, recetas digitales 
              y comunicación con pacientes. La Plataforma utiliza el estándar internacional HL7 FHIR R4.
            </p>
          </Section>

          <Section icon={<FileText size={20} />} title="3. Cuentas de usuario">
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Cada consultorio constituye un <strong>tenant</strong> independiente con aislamiento lógico de datos.</li>
              <li>El Administrador Clínico es responsable de gestionar los usuarios (profesionales, recepcionistas) y sus permisos.</li>
              <li>Las credenciales de acceso son personales e intransferibles.</li>
              <li>El usuario es responsable de todas las acciones realizadas con su cuenta.</li>
            </ul>
          </Section>

          <Section icon={<AlertCircle size={20} />} title="4. Obligaciones del usuario">
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Utilizar la Plataforma exclusivamente para fines clínicos y de gestión odontológica.</li>
              <li>No almacenar ni transmitir contenido ilícito, difamatorio, obsceno o que viole derechos de terceros.</li>
              <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
              <li>Obtener el consentimiento informado de los pacientes para el tratamiento de sus datos de salud.</li>
              <li>Cumplir con las normativas aplicables: Ley 25.326 (Protección de Datos Personales), Ley 26.529 (Derechos del Paciente), y demás legislación argentina vigente.</li>
            </ul>
          </Section>

          <Section icon={<CreditCard size={20} />} title="5. Planes, pagos y facturación">
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>La Plataforma ofrece planes de suscripción mensual/anual según cantidad de profesionales y módulos contratados.</li>
              <li>Los precios se facturan en pesos argentinos (ARS) y están sujetos a actualización con preaviso de 30 días.</li>
              <li>La falta de pago podrá resultar en la suspensión temporal del servicio hasta la regularización.</li>
              <li>Los pagos se procesan a través de pasarelas de pago seguras; Denta Cloud no almacena datos de tarjetas de crédito.</li>
            </ul>
          </Section>

          <Section icon={<Shield size={20} />} title="6. Propiedad intelectual">
            <p>
              La Plataforma, su código fuente, interfaz de usuario, logotipos, marcas y documentación son propiedad 
              exclusiva de <strong>systia.ar</strong>. El usuario adquiere únicamente una licencia de uso limitada, 
              no exclusiva e intransferible durante la vigencia de su suscripción. Queda prohibida la reproducción, 
              distribución, ingeniería inversa o modificación de la Plataforma sin autorización expresa.
            </p>
          </Section>

          <Section icon={<AlertCircle size={20} />} title="7. Limitación de responsabilidad">
            <p>
              Denta Cloud se proporciona "tal cual" (as-is). Si bien se realizan los mejores esfuerzos para garantizar 
              la disponibilidad, seguridad y precisión de los datos, la Plataforma no garantiza:
            </p>
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Disponibilidad ininterrumpida (pueden existir ventanas de mantenimiento programado).</li>
              <li>Que los datos clínicos estén exentos de errores de carga por parte del profesional.</li>
              <li>Responsabilidad por decisiones clínicas tomadas con base en los datos de la Plataforma: el profesional es el responsable último del diagnóstico y tratamiento.</li>
            </ul>
          </Section>

          <Section icon={<FileText size={20} />} title="8. Rescisión y cancelación">
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>El usuario puede cancelar su suscripción en cualquier momento desde el panel de administración.</li>
              <li>Tras la cancelación, el acceso a la Plataforma se mantiene durante el período ya abonado.</li>
              <li>Los datos clínicos se conservan durante 30 días posteriores a la cancelación para permitir la exportación. Luego se eliminan de forma segura, salvo obligación legal de conservación (10 años, Ley 26.529).</li>
              <li>Denta Cloud se reserva el derecho de suspender o cancelar cuentas que violen estos términos, con notificación previa.</li>
            </ul>
          </Section>

          <Section icon={<FileText size={20} />} title="9. Modificaciones">
            <p>
              Denta Cloud se reserva el derecho de modificar estos Términos y Condiciones en cualquier momento. 
              Los cambios se notificarán por correo electrónico y a través de la Plataforma con al menos 15 días de anticipación. 
              El uso continuado después de la entrada en vigencia implica la aceptación de los nuevos términos.
            </p>
          </Section>

          <Section icon={<HelpCircle size={20} />} title="10. Contacto y ley aplicable">
            <p>Estos Términos y Condiciones se rigen por las leyes de la República Argentina.</p>
            <div style={{
              background: 'var(--bg-card, #f1f5f9)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              display: 'flex', flexDirection: 'column', gap: '0.4rem',
              fontSize: '0.9rem',
            }}>
              <span><strong>Email:</strong> legal@systia.ar</span>
              <span><strong>Sitio web:</strong> systia.ar</span>
              <span><strong>Responsable:</strong> systia.ar — Titularidad: cada consultorio (tenant) es responsable del uso que sus profesionales hagan de la Plataforma.</span>
            </div>
          </Section>

        </div>
      </main>

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
