import type Keycloak from 'keycloak-js';

/**
 * Taxonomía única de roles clínicos del realm `hce-realm`.
 * Fuente de verdad para el frontend; coincide con los roles definidos en Keycloak
 * y validados por el backend (RolesGuard).
 */
export const ROLES = {
  MEDICO: 'medico',
  ENFERMERO: 'enfermero',
  RECEPCIONISTA: 'recepcionista',
  ADMINISTRADOR: 'administrador',
  PACIENTE: 'paciente',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

const KNOWN_ROLES: AppRole[] = Object.values(ROLES);

/**
 * Lee los roles de negocio desde `realm_access.roles` del token Keycloak.
 * Filtra los roles técnicos internos de Keycloak (offline_access, uma_authorization, etc.).
 * Punto ÚNICO de lectura: si en el futuro se migra a roles de cliente
 * (`resource_access[clientId].roles`), se cambia solo aquí.
 */
export function getRolesFromToken(kc: Keycloak): AppRole[] {
  const raw: string[] = kc.tokenParsed?.realm_access?.roles ?? [];
  return raw.filter((r): r is AppRole => KNOWN_ROLES.includes(r as AppRole));
}

/** ¿El usuario tiene alguno de los roles requeridos? (semántica OR, igual que el RolesGuard backend) */
export function hasAnyRole(roles: AppRole[], required: AppRole[]): boolean {
  if (required.length === 0) return true; // sin requisito = visible para todo autenticado
  return required.some(r => roles.includes(r));
}

/** Nombre legible en español para un rol. */
export function roleDisplayName(role: string): string {
  switch (role.toLowerCase()) {
    case ROLES.MEDICO: return 'Médico';
    case ROLES.ENFERMERO: return 'Enfermero/a';
    case ROLES.RECEPCIONISTA: return 'Recepcionista';
    case ROLES.ADMINISTRADOR: return 'Administrador';
    case ROLES.PACIENTE: return 'Paciente';
    default: return role;
  }
}
