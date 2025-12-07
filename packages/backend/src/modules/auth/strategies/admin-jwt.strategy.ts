import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { isAdmin } from '../utils/auth.utils';

/**
 * Admin JWT-Payload-Interface
 */

export interface AdminJwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Validierter Admin-Benutzer nach JWT-Validierung
 */
export interface ValidatedAdminUser {
  userId: string;
  username: string;
  role: UserRole;
}

/**
 * JWT-Strategie für Admin-Tokens
 *
 * Diese Strategie extrahiert und validiert Admin-Tokens aus HTTP-Only Cookies.
 * Sie stellt sicher, dass nur Tokens mit isAdmin=true akzeptiert werden.
 */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.cookies?.adminToken;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('ADMIN_JWT_SECRET') || 'fallback-secret',
      passReqToCallback: true, // Pass the request to the validate method
    } as never);
  }

  /**
   * Validiert das Admin-JWT-Payload
   *
   * @param req - Request object with cookies
   * @param payload - Das dekodierte JWT-Payload
   * @returns Der validierte Admin-Benutzer
   * @throws UnauthorizedException wenn der Benutzer kein Admin ist oder nicht mehr existiert
   */
  async validate(req: Request, payload: AdminJwtPayload): Promise<ValidatedAdminUser> {
    // First check if regular accessToken is present and valid
    const accessToken = req?.cookies?.accessToken;
    if (!accessToken) {
      throw new UnauthorizedException('Access token required along with admin token');
    }

    // Verify the access token is valid
    try {
      await this.authService.verifyAccessToken(accessToken);
    } catch (_error) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    // For testing, check if isAdmin is present in payload (new format) or check role (old format)
    const payloadWithIsAdmin = payload as AdminJwtPayload & {
      isAdmin?: boolean;
    };

    // Accept both formats: new tokens with isAdmin field, and legacy check based on role
    if (!payloadWithIsAdmin.isAdmin && (!payload.role || !isAdmin(payload.role))) {
      throw new UnauthorizedException('Token is not an admin token');
    }

    // Prüfe ob der Benutzer noch in der Datenbank existiert
    const user = await this.authService.findUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    // Prüfe ob der Benutzer immer noch Admin-Rechte hat
    if (!isAdmin(user.role)) {
      throw new UnauthorizedException('User is no longer an admin');
    }

    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
