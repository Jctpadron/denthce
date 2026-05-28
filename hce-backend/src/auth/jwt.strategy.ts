import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

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
    
    let tenantId = payload.tenant_id || payload.sub;
    if (Array.isArray(tenantId) && tenantId.length > 0) {
      tenantId = tenantId[0];
    }
    
    return {
      userId: payload.sub,
      tenantId: tenantId,
      username: payload.preferred_username,
      email: payload.email,
      roles: roles,
    };
  }
}
