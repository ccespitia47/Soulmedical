import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Sin fallback: si JWT_SECRET no está en el entorno, lanzamos error fatal al
// arrancar. Un fallback público haría que los tokens se firmen con un secret
// conocido y cualquiera podría forjar tokens de admin.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    '[FATAL] JWT_SECRET debe estar definido en .env con al menos 32 caracteres aleatorios. ' +
      'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
  );
}
export const JWT_SECRET = process.env.JWT_SECRET;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
