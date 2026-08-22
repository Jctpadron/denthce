import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    // Deny-by-default (AUD.13): un endpoint que no declara @Roles NO se sirve.
    // Antes esto devolvia true, de modo que olvidar el decorador dejaba la ruta
    // accesible a cualquier usuario autenticado, en silencio y sin que ningun
    // test lo notara. Hoy los 104 endpoints declaran @Roles, asi que el cambio
    // no afecta a ninguna ruta existente: protege contra la que se agregue
    // manana. Si algo empieza a dar 403, le falta su @Roles.
    if (!requiredRoles || requiredRoles.length === 0) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.roles) {
      return false;
    }

    // Si el usuario tiene alguno de los roles requeridos, se le permite el acceso (OR)
    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
