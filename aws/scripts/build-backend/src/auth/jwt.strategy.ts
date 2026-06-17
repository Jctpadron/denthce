import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

/**
 * Modo estricto Zero Trust (gobernado por AUTH_STRICT).
 * Cuando está activo:
 *  - ZT-06: se RECHAZA todo token sin `tenant_id` (no se permite el fallback a `sub`,
 *    que operaba bajo un "tenant fantasma").
 *  - ZT-08: se valida la audiencia (`aud`) contra KEYCLOAK_AUDIENCE.
 * Por defecto está DESACTIVADO para no romper los logins existentes: requiere que el realm
 * de Keycloak inyecte `tenant_id` en todos los usuarios/clientes y el mapper de audiencia.
 * `devops` lo activa (AUTH_STRICT=true) tras configurar el realm.
 */
const AUTH_STRICT = process.env.AUTH_STRICT === 'true';
const EXPECTED_AUDIENCE = process.env.KEYCLOAK_AUDIENCE || 'hce-backend';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer: process.env.KEYCLOAK_ISSUER_URL || 'http://localhost:8080/realms/hce-realm',
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: process.env.KEYCLOAK_JWKS_URI || 'http://localhost:8080/realms/hce-realm/protocol/openid-connect/certs',
      }),
    });
  }

  async validate(payload: any) {
    const realmAccess = payload.realm_access || {};
    const roles = realmAccess.roles || [];

    let tenantId = payload.tenant_id;
    if (Array.isArray(tenantId) && tenantId.length > 0) {
      tenantId = tenantId[0];
    }

    if (AUTH_STRICT) {
      // ZT-06: sin tenant_id no hay identidad de inquilino → se rechaza (no fallback a sub).
      if (!tenantId) {
        throw new UnauthorizedException('Token sin tenant_id: acceso denegado (Zero Trust).');
      }
      // ZT-08: la audiencia del token debe incluir este backend.
      const aud = payload.aud;
      const audOk = Array.isArray(aud) ? aud.includes(EXPECTED_AUDIENCE) : aud === EXPECTED_AUDIENCE;
      if (!audOk) {
        throw new UnauthorizedException('Audiencia (aud) del token inválida: acceso denegado.');
      }
    } else {
      // Modo compatible (transitorio): se mantiene el fallback a `sub` hasta migrar el realm.
      tenantId = tenantId || payload.sub;
    }

    return {
      userId: payload.sub,
      sub: payload.sub, // alias explícito: varios controllers leen req.user.sub (p.ej. protesis chat → trazabilidad)
      tenantId: tenantId,
      // Exponer ambos para que getUserCtx() resuelva el actor de auditoría sin ambigüedad (QA-2).
      username: payload.preferred_username,
      name: payload.name || payload.preferred_username,
      preferred_username: payload.preferred_username,
      email: payload.email,
      roles: roles,
    };
  }
}
