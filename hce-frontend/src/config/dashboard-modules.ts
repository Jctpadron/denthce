import { ROLES, hasAnyRole, type AppRole } from '../utils/roles';

/** Destinos de navegación del shell (coinciden con AppView en App.tsx). */
export type ModuleKey = 'patients' | 'form' | 'users' | 'settings';

export interface DashboardModule {
  key: ModuleKey;
  icon: string;
  title: string;
  description: string;
  /** Variable CSS de acento (no hex hardcodeado, dark-mode safe). */
  color: string;
  badge: string | null;
  /** Roles que ven el módulo. [] = visible para todo usuario autenticado. */
  allowedRoles: AppRole[];
}

/**
 * Catálogo declarativo de accesos a módulos activos (Tarea 3.12).
 * La regla "qué rol ve qué módulo" vive como DATO, no incrustada en el JSX.
 * Las visibilidades reflejan los guards reales del backend.
 */
export const DASHBOARD_MODULES: DashboardModule[] = [
  {
    key: 'patients',
    icon: '🏥',
    title: 'Historia Clínica',
    description: 'Buscá, registrá y gestioná pacientes. Odontograma, alergias, signos vitales y documentos clínicos.',
    color: 'var(--color-emerald)',
    badge: null,
    allowedRoles: [ROLES.MEDICO, ROLES.ENFERMERO, ROLES.RECEPCIONISTA, ROLES.ADMINISTRADOR],
  },
  {
    key: 'form',
    icon: '➕',
    title: 'Admisión de Pacientes',
    description: 'Registrá un nuevo paciente con sus datos demográficos completos según estándar FHIR R4.',
    color: 'var(--color-cyan)',
    badge: null,
    // Coherente con el backend: POST /patient permite médico, recepción y administrador.
    allowedRoles: [ROLES.MEDICO, ROLES.RECEPCIONISTA, ROLES.ADMINISTRADOR],
  },
  {
    key: 'users',
    icon: '👥',
    title: 'Gestión de Personal',
    description: 'Registrá y administrá secretarias o enfermeros para que colaboren en tu consultorio clínico.',
    color: 'var(--color-amber)',
    badge: 'Médico/Admin',
    allowedRoles: [ROLES.ADMINISTRADOR, ROLES.MEDICO],
  },
  {
    key: 'settings',
    icon: '🎨',
    title: 'Personalización',
    description: 'Configurá el logo, colores, datos del profesional, horarios y firma digital del consultorio.',
    color: 'var(--color-violet)',
    badge: 'Médico/Admin',
    allowedRoles: [ROLES.ADMINISTRADOR, ROLES.MEDICO],
  },
];

/** Filtra el catálogo a los módulos visibles para el conjunto de roles dado. */
export function getVisibleModules(roles: AppRole[]): DashboardModule[] {
  return DASHBOARD_MODULES.filter(m => hasAnyRole(roles, m.allowedRoles));
}
