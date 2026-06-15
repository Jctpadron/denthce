import React from 'react';
import {
  Cloud, ShieldCheck, Network, MapPin,
  FileText, Layers, CalendarDays, MessageCircle, FileCheck2, Palette,
  Stethoscope, Lock, KeyRound, History,
  User, Users, Building2,
  MousePointerClick, Settings2, Rocket,
  type LucideIcon,
} from 'lucide-react';

/**
 * Contenido y datos de la landing pública "Denta Cloud".
 * Fuente de copy: docs/design/landing_denta_cloud_estrategia.md (NO reinventar).
 * Centralizado para que las secciones sean declarativas y fáciles de mantener.
 */

// === WhatsApp (CTA "Solicitar demo") =========================================
// Número del dueño: 351 231 3616 (Córdoba). Formato wa.me móvil AR = 54 + 9 + área + nº.
export const WHATSAPP_NUMERO = '5493512313616';

/** Arma el enlace wa.me con un mensaje pre-cargado para "Solicitar demo". */
export const buildDemoHref = (mensaje?: string): string => {
  const texto = mensaje?.trim()
    ? mensaje
    : 'Hola 👋 Quiero solicitar una demo de Denta Cloud para mi clínica.';
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(texto)}`;
};

// === Tipos ===================================================================
export interface CardItem {
  icon: LucideIcon;
  title: string;
  body: string;
}
export interface HighlightData {
  kicker: string;
  title: string;
  body: string;
  bullets: string[];
  cta: string;
  image: string;
  imageAlt: string;
  icon: LucideIcon;
}

// === Navegación ==============================================================
export const NAV_LINKS = [
  { label: 'Beneficios', href: '#beneficios' },
  { label: 'Módulos', href: '#modulos' },
  { label: 'Cómo funciona', href: '#como-funciona' },
];

// === Sección 2 — Trust bar ===================================================
export const TRUST_ITEMS: CardItem[] = [
  { icon: Cloud, title: '100% en la nube', body: 'Entrá desde cualquier dispositivo.' },
  { icon: ShieldCheck, title: 'Datos seguros', body: 'Aislamiento por clínica y auditoría de accesos.' },
  { icon: Network, title: 'Estándar HL7 FHIR R4', body: 'Interoperable de verdad.' },
  { icon: MapPin, title: 'Hecho para Argentina', body: 'Obras sociales, PAMI y WhatsApp.' },
];

// === Sección 3 — Beneficios ==================================================
export const BENEFICIOS: CardItem[] = [
  { icon: FileText, title: 'Historia clínica completa', body: 'Anamnesis, estado bucal, plan de tratamiento, evolución y consentimiento informado, siempre a mano y siempre legible.' },
  { icon: Layers, title: 'Odontograma interactivo de doble capa', body: 'Registrá lo que ya está y lo que vas a tratar. Marcá superficies directamente sobre el diente y mirá el plan de un vistazo.' },
  { icon: CalendarDays, title: 'Agenda y turnos sin fricción', body: 'Calendario por día o semana, triaje de la sala de espera por urgencia, estado del sillón y recordatorios automáticos.' },
  { icon: MessageCircle, title: 'Turnos por WhatsApp con IA', body: 'Tus pacientes piden turno por WhatsApp y se agendan solos, sincronizados con tu agenda. Menos llamados, menos ausentes.' },
  { icon: FileCheck2, title: 'Obras sociales y PAMI', body: 'Datos de afiliado y obra social integrados, con exportación de la historia a PDF en formato PAMI.' },
  { icon: Palette, title: 'Tu marca, no la nuestra', body: 'Configurá tu logo, tu color y tus datos profesionales. Tus pacientes ven tu clínica, no un sistema genérico.' },
];

// === Sección 4 — Módulos =====================================================
export const MODULOS: CardItem[] = [
  { icon: Stethoscope, title: 'Historia Clínica Odontológica', body: 'El núcleo: ficha, odontograma, plan de tratamiento y evolución.' },
  { icon: CalendarDays, title: 'Agenda y Turnos', body: 'Calendario, triaje, estado del box y recordatorios.' },
  { icon: MessageCircle, title: 'Turnos por WhatsApp (IA)', body: 'Reservas automáticas por WhatsApp sincronizadas con tu agenda.' },
  { icon: FileCheck2, title: 'Obras Sociales y PAMI', body: 'Afiliados, cobertura y exportación en formato PAMI.' },
  { icon: Palette, title: 'Marca de tu clínica (White-label)', body: 'Tu identidad visual en toda la plataforma.' },
  { icon: ShieldCheck, title: 'Seguridad y Auditoría', body: 'Control de accesos por clínica y registro de cada acción.' },
];

// === Secciones 5 y 6 — Destacadas ============================================
export const HIGHLIGHT_ODONTOGRAMA: HighlightData = {
  kicker: 'EL CORAZÓN DE LA HISTORIA CLÍNICA',
  title: 'Un odontograma que se entiende de un vistazo',
  body: 'Registrá el estado actual y el tratamiento planificado en capas separadas, marcá superficies afectadas directo sobre el diente y compartí el plan con tu paciente de forma clara. Adiós a las fichas de papel ilegibles.',
  bullets: [
    'Doble capa: lo existente y lo planificado, sin confusión.',
    'Marcado por superficie, rápido y preciso.',
    'Plan de tratamiento conectado a la evolución del paciente.',
  ],
  cta: 'Quiero verlo en acción',
  image: '/img/landing_odontograma.png',
  imageAlt: 'Vista del odontograma interactivo de doble capa de Denta Cloud',
  icon: Layers,
};

export const HIGHLIGHT_WHATSAPP: HighlightData = {
  kicker: 'MENOS TELÉFONO, MÁS CONSULTORIO',
  title: 'Tus pacientes sacan turno por WhatsApp, solos',
  body: 'Un asistente con IA atiende a tus pacientes por WhatsApp, les ofrece los horarios disponibles y agenda el turno automáticamente en tu calendario. Vos te enterás con la agenda ya actualizada.',
  bullets: [
    'Reservas 24/7 sin que nadie atienda el teléfono.',
    'Sincronización automática con tu agenda de Denta Cloud.',
    'Menos ausencias gracias a los recordatorios.',
  ],
  cta: 'Sumá WhatsApp a tu clínica',
  image: '/img/landing_whatsapp.png',
  imageAlt: 'Paciente sacando turno por WhatsApp con asistente de IA',
  icon: MessageCircle,
};

// === Sección 7 — Cómo funciona ===============================================
export interface StepData { icon: LucideIcon; title: string; body: string; }
export const PASOS: StepData[] = [
  { icon: MousePointerClick, title: 'Solicitás tu demo', body: 'Nos contás cómo trabaja tu clínica y te mostramos la plataforma con tu caso.' },
  { icon: Settings2, title: 'Configuramos tu clínica', body: 'Activamos tus módulos, cargamos tu marca y dejamos todo listo, sin instalaciones.' },
  { icon: Rocket, title: 'Empezás a atender digital', body: 'Tu equipo entra desde cualquier dispositivo y trabaja desde el primer día.' },
];

// === Sección 8 — Confianza / seguridad =======================================
export const SEGURIDAD: CardItem[] = [
  { icon: Lock, title: 'Aislamiento por clínica (Zero Trust)', body: 'Cada clínica ve únicamente sus propios datos. Nadie cruza información.' },
  { icon: KeyRound, title: 'Identidad y accesos controlados', body: 'Inicio de sesión seguro con roles por persona.' },
  { icon: History, title: 'Auditoría de accesos', body: 'Queda registro de quién accedió a cada historia y cuándo.' },
  { icon: Network, title: 'Estándar HL7 FHIR R4', body: 'Tus datos son interoperables y portables, sin quedar encerrados.' },
];

// === Sección 9 — Para quién es ===============================================
export const AUDIENCIA: CardItem[] = [
  { icon: User, title: 'Consultorios independientes', body: 'Ordená tu día a día y profesionalizá tu atención sin complicarte.' },
  { icon: Users, title: 'Clínicas multi-profesional', body: 'Coordiná agendas, sillones y equipo con todo centralizado.' },
  { icon: Building2, title: 'Clínicas con obras sociales y PAMI', body: 'Afiliados, cobertura y documentación, resueltos.' },
];

// === Estadísticas (banda de confianza) =======================================
// PLACEHOLDER: reemplazar por números reales antes de publicar. Hoy son de muestra.
export interface StatItem { value: string; label: string; }
export const STATS: StatItem[] = [
  { value: '+30', label: 'clínicas ya digitalizadas' },
  { value: '+50.000', label: 'turnos gestionados' },
  { value: '4,9★', label: 'valoración de usuarios' },
  { value: '99,9%', label: 'disponibilidad del servicio' },
];

// === Testimonios =============================================================
// PLACEHOLDER: reemplazar por testimonios reales (con foto/nombre/consentimiento).
export interface Testimonio { initials: string; name: string; specialty: string; quote: string; }
export const TESTIMONIOS: Testimonio[] = [
  { initials: 'MG', name: 'Dra. María José Gómez', specialty: 'Odontología general · Córdoba', quote: 'Dejé las fichas de papel y ahora tengo todo el historial de mis pacientes en un clic. Cambió mi día a día.' },
  { initials: 'LF', name: 'Dr. Luis Fernández', specialty: 'Ortodoncia · Jujuy', quote: 'Los turnos por WhatsApp me bajaron muchísimo los ausentes. El odontograma es lo mejor que probé.' },
  { initials: 'CV', name: 'Dra. Carla Vargas', specialty: 'Clínica multi-profesional · Salta', quote: 'Coordinar la agenda de varios profesionales y sillones se volvió simple. Y el soporte en español, un plus.' },
];

// === Footer ==================================================================
export const FOOTER_COLS = [
  { title: 'Producto', links: NAV_LINKS },
  { title: 'Empresa', links: [{ label: 'Solicitar demo', href: '#demo' }, { label: 'Contacto', href: '#demo' }] },
];

/**
 * Logo de marca Denta Cloud — LOCKUP HORIZONTAL (ícono SVG + wordmark).
 * Nítido a cualquier tamaño; pensado para la barra de navegación.
 * El wordmark replica la paleta del logo: "Denta" en azul, "Cloud" en menta.
 * `onDark`: aclara el wordmark para fondos oscuros.
 */
export const DentaCloudLogo: React.FC<{ iconSize?: string; onDark?: boolean }> = ({ iconSize = '2.5rem', onDark = false }) => (
  <span className="denta-logo">
    <svg viewBox="0 0 120 120" style={{ width: iconSize, height: iconSize, flexShrink: 0 }} aria-hidden="true">
      <path
        d="M85,65 C95,65 103,57 103,47 C103,37 95,29 85,29 C84.5,29 84,29 83.5,29.1 C80,18 70,10 58,10 C46.5,10 36.8,17.5 33,28 C32,27.9 31,27.9 30,27.9 C18,27.9 8,37.9 8,49.9 C8,61.9 18,71.9 30,71.9 L85,71.9 C85,71.9 85,65 85,65 Z"
        fill="none" stroke="var(--brand-mint)" strokeWidth="6" strokeLinejoin="round"
      />
      <path
        d="M60,30 C66,30 73,28 77.5,33 C82,37.5 83,45 83,52 C83,63 76,74 71,85 C69.5,89 70.5,94 68,96.5 C64.5,98.5 61,93 60,88.5 C59,93 55.5,98.5 52,96.5 C49.5,94 50.5,89 49,85 C44,74 37,63 37,52 C37,45 38,37.5 42.5,33 C47,28 54,30 60,30 Z"
        fill="none" stroke="var(--brand-blue)" strokeWidth="6" strokeLinejoin="round"
      />
    </svg>
    <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1 }}>
      <span style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
        <span style={{ color: onDark ? '#ffffff' : 'var(--brand-blue)' }}>Denta</span>
        <span style={{ color: 'var(--brand-mint)' }}> Cloud</span>
      </span>
      <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: onDark ? 'rgba(255,255,255,0.7)' : 'var(--color-muted)' }}>
        Odontología Digital
      </span>
    </span>
  </span>
);

/** Logo PNG completo (isologo cuadrado), para usos donde entra bien (footer/documentos). */
export const DentaCloudLogoImage: React.FC<{ height?: string; onDark?: boolean }> = ({ height = '64px', onDark = false }) => (
  <span className={onDark ? 'denta-logo denta-logo--ondark' : 'denta-logo'}>
    <img src="/img/denta_cloud_logo.png" alt="Denta Cloud — Odontología Digital" style={{ height, width: 'auto', display: 'block' }} />
  </span>
);
