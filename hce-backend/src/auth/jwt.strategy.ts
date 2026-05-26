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
      // audience: ['hce-app', 'account'], // Permite tokens emitidos para hce-app
      issuer: 'http://localhost:8080/realms/hce-realm',
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: 'http://localhost:8080/realms/hce-realm/protocol/openid-connect/certs',
      }),
    });
  }

  async validate(payload: any) {
    const realmAccess = payload.realm_access || {};
    const roles = realmAccess.roles || [];
    
    return {
      userId: payload.sub,
      tenantId: payload.sub, // Identificador de inquilino (inicialmente el id del profesional)
      username: payload.preferred_username,
      email: payload.email,
      roles: roles,
    };
  }
}
