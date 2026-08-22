import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

/**
 * Construye un ExecutionContext falso.
 * @param roles roles que trae el usuario en el JWT (undefined = sin usuario)
 */
function ctx(roles?: string[]): ExecutionContext {
  const req = { user: roles === undefined ? undefined : { roles } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

/** Reflector que devuelve los roles exigidos por el endpoint. */
function reflectorQueExige(requiredRoles?: string[]): Reflector {
  return {
    get: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;
}

describe('RolesGuard', () => {
  describe('deny-by-default (AUD.13)', () => {
    // El guard era fail-open: un endpoint sin @Roles quedaba accesible a
    // cualquier usuario autenticado. Hoy los 104 endpoints declaran @Roles,
    // así que el riesgo es el endpoint futuro que se olvide de hacerlo.
    it('RECHAZA un endpoint sin @Roles (metadata undefined)', () => {
      const guard = new RolesGuard(reflectorQueExige(undefined));
      expect(guard.canActivate(ctx(['medico']))).toBe(false);
    });

    it('RECHAZA un endpoint con @Roles() vacío', () => {
      const guard = new RolesGuard(reflectorQueExige([]));
      expect(guard.canActivate(ctx(['administrador']))).toBe(false);
    });

    it('RECHAZA aunque el usuario tenga muchos roles, si el endpoint no declara ninguno', () => {
      const guard = new RolesGuard(reflectorQueExige(undefined));
      expect(
        guard.canActivate(ctx(['medico', 'administrador', 'enfermero'])),
      ).toBe(false);
    });
  });

  describe('comportamiento normal (no debe cambiar)', () => {
    it('permite si el usuario tiene el rol exigido', () => {
      const guard = new RolesGuard(reflectorQueExige(['medico']));
      expect(guard.canActivate(ctx(['medico']))).toBe(true);
    });

    it('permite si tiene alguno de los roles exigidos (OR)', () => {
      const guard = new RolesGuard(reflectorQueExige(['medico', 'enfermero']));
      expect(guard.canActivate(ctx(['enfermero']))).toBe(true);
    });

    it('rechaza si no tiene ninguno de los roles exigidos', () => {
      const guard = new RolesGuard(reflectorQueExige(['administrador']));
      expect(guard.canActivate(ctx(['paciente']))).toBe(false);
    });

    it('rechaza si no hay usuario en el request', () => {
      const guard = new RolesGuard(reflectorQueExige(['medico']));
      expect(guard.canActivate(ctx(undefined))).toBe(false);
    });

    it('rechaza si el usuario no trae roles', () => {
      const guard = new RolesGuard(reflectorQueExige(['medico']));
      expect(guard.canActivate(ctx(undefined))).toBe(false);
    });
  });
});
