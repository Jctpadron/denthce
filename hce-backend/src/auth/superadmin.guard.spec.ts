import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './superadmin.guard';

/** Construye un ExecutionContext falso con los roles dados en req.user. */
function ctx(roles?: string[]): ExecutionContext {
  const req = { user: roles === undefined ? undefined : { roles } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('permite el acceso a un usuario con rol superadmin', () => {
    expect(guard.canActivate(ctx(['superadmin']))).toBe(true);
  });

  it('permite si superadmin está entre otros roles', () => {
    expect(guard.canActivate(ctx(['medico', 'superadmin']))).toBe(true);
  });

  it('rechaza a un administrador clínico (no es superadmin)', () => {
    expect(() => guard.canActivate(ctx(['administrador']))).toThrow(ForbiddenException);
  });

  it('rechaza si no hay roles', () => {
    expect(() => guard.canActivate(ctx([]))).toThrow(ForbiddenException);
  });

  it('rechaza si no hay usuario en el request', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});
