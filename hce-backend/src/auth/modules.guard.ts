import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModulesService } from '../platform/modules.service';
import { REQUIRED_MODULE_KEY } from './requires-module.decorator';

/**
 * ModulesGuard — gate de SUSCRIPCIÓN (entitlement). Espeja el RolesGuard pero, en vez del rol,
 * verifica que el tenant tenga contratado y vigente el módulo marcado con @RequiresModule(key).
 *
 * Acceso = (RolesGuard: quién) ∧ (ModulesGuard: el tenant pagó). Apagar la suscripción
 * (tenant_modules.enabled=false) corta el acceso al instante, sin tocar Keycloak.
 *
 * Si no está contratado, lanza 403 con `error: 'MODULE_NOT_ENABLED'` para que el frontend
 * distinga "no contratado" (→ upsell) de "sin permiso".
 */
@Injectable()
export class ModulesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly modulesService: ModulesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<string>(REQUIRED_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!moduleKey) return true; // endpoint sin gate de módulo

    const user = context.switchToHttp().getRequest().user;
    // El Super Admin gestiona la plataforma cross-tenant: no se le aplica el gate.
    if (user?.roles?.includes('superadmin')) return true;

    const enabled = await this.modulesService.isEnabled(user?.tenantId, moduleKey);
    if (!enabled) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'MODULE_NOT_ENABLED',
        module: moduleKey,
        message: `El módulo "${moduleKey}" no está contratado para esta clínica.`,
      });
    }
    return true;
  }
}
