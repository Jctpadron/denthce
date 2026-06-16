import { useEffect, useState, useCallback } from 'react';
import keycloak from '../utils/keycloak-config';
import { ROLES, getRolesFromToken, hasAnyRole, type AppRole } from '../utils/roles';

/**
 * Hook central para leer los roles del usuario desde el token Keycloak.
 * Reactivo: si el token se refresca (`onAuthRefreshSuccess`), recalcula los roles
 * para que la UI responda a cambios de permisos sin recargar la página.
 *
 * El ocultamiento por rol en el frontend es solo UX; la autorización REAL
 * la impone el backend (RolesGuard sobre cada endpoint).
 */
export function useRoles() {
  const [roles, setRoles] = useState<AppRole[]>(() => getRolesFromToken(keycloak));

  const refresh = useCallback(() => {
    setRoles(getRolesFromToken(keycloak));
  }, []);

  useEffect(() => {
    keycloak.onAuthRefreshSuccess = refresh;
    keycloak.onAuthSuccess = refresh;
    return () => {
      // Limpiar solo si seguimos siendo los dueños del handler
      if (keycloak.onAuthRefreshSuccess === refresh) keycloak.onAuthRefreshSuccess = undefined;
      if (keycloak.onAuthSuccess === refresh) keycloak.onAuthSuccess = undefined;
    };
  }, [refresh]);

  return {
    roles,
    has: (...required: AppRole[]) => hasAnyRole(roles, required),
    isMedico: roles.includes(ROLES.MEDICO),
    isAdmin: roles.includes(ROLES.ADMINISTRADOR),
    isEnfermero: roles.includes(ROLES.ENFERMERO),
    isRecepcionista: roles.includes(ROLES.RECEPCIONISTA),
    isSuperAdmin: roles.includes(ROLES.SUPERADMIN),
    isLaboratorio: roles.includes(ROLES.LAB_OPERADOR) || roles.includes(ROLES.LAB_ADMIN),
    isLabAdmin: roles.includes(ROLES.LAB_ADMIN),
    isLabOperador: roles.includes(ROLES.LAB_OPERADOR),
    /** Equivale al antiguo `canConfigure` de ThemeContext: médico o administrador. */
    canConfigure: hasAnyRole(roles, [ROLES.ADMINISTRADOR, ROLES.MEDICO]),
  };
}
