import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * SuperAdminGuard — autoriza solo a usuarios con el rol de plataforma `superadmin`.
 *
 * A diferencia del RolesGuard (que protege endpoints clínicos scoped por tenant), el
 * superadmin opera CROSS-TENANT por diseño: sus endpoints NO filtran por req.user.tenantId,
 * sino que gestionan todas las clínicas. Por eso se separa en su propio guard explícito.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const roles: string[] = request.user?.roles || [];
    if (!roles.includes('superadmin')) {
      throw new ForbiddenException('Acceso denegado: requiere rol de Super Administrador.');
    }
    return true;
  }
}
