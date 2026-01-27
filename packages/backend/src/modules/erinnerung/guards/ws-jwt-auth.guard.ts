import { type CanActivate, Injectable, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Socket } from 'socket.io';
// biome-ignore lint/style/useImportType: JwtService needed for NestJS DI at runtime (AC1)
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '@/modules/auth/strategies/jwt.strategy';
// biome-ignore lint/style/useImportType: ConfigService needed for NestJS DI at runtime (AC1)
import { ConfigService } from '@nestjs/config';

/**
 * WebSocket JWT Authentication Guard.
 *
 * **Security (C2):** Validiert JWT-Token bei WebSocket-Connection.
 *
 * **Workflow:**
 * 1. Client sendet Token bei Connection: `io.connect('/erinnerungen', { auth: { token: 'jwt...' } })`
 * 2. Guard extrahiert Token aus `socket.handshake.auth.token`
 * 3. JwtService validiert Token-Signatur und Expiration
 * 4. Bei Erfolg: Socket wird mit `userId` und `role` annotiert
 * 5. Bei Fehler: Socket wird disconnected mit UnauthorizedException
 *
 * **Warum nicht PassportStrategy:**
 * - Passport ist für HTTP Requests designed (req.headers.authorization)
 * - WebSocket nutzt `socket.handshake.auth` für Token-Übergabe
 * - Custom Guard bietet bessere Kontrolle über Socket Lifecycle
 *
 * **Token Format:**
 * ```json
 * {
 *   "sub": "user-id-cuid",
 *   "role": "ADMIN",
 *   "iat": 1616239022,
 *   "exp": 1616325422
 * }
 * ```
 *
 * **Socket Context nach Auth:**
 * ```typescript
 * socket.data = {
 *   userId: "user-id-cuid",
 *   role: "ADMIN"
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Gateway verwenden
 * @WebSocketGateway({ namespace: '/erinnerungen' })
 * @UseGuards(WsJwtAuthGuard)
 * export class ErinnerungGateway {
 *   handleConnection(client: Socket) {
 *     // client.data.userId ist gesetzt wenn Auth erfolgreich
 *     console.log(`Authenticated user: ${client.data.userId}`);
 *   }
 * }
 * ```
 */
@Injectable()
export class WsJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validiert JWT Token bei WebSocket Connection.
   *
   * Extrahiert Token aus `socket.handshake.auth.token` und validiert mit JwtService.
   * Speichert userId und role in `socket.data` fuer spaetere Authorization.
   *
   * **Security:**
   * - Token MUSS vorhanden sein (sonst UnauthorizedException)
   * - Signature MUSS gueltig sein (JWT_SECRET)
   * - Token DARF NICHT expired sein
   *
   * @param context - ExecutionContext (WebSocket)
   * @returns true bei gueltiger Authentifizierung, false sonst
   * @throws UnauthorizedException wenn Token ungueltig oder fehlt
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    let token = client.handshake.auth?.token;

    // Fallback: Token aus Cookie lesen (wenn kein expliziter Auth-Token)
    if (!token && client.handshake.headers.cookie) {
      const cookies = client.handshake.headers.cookie.split(';').reduce(
        (acc, cookie) => {
          const parts = cookie.trim().split('=');
          const key = parts.shift();
          const value = parts.join('=');

          if (key && value) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );

      token = cookies.accessToken;
    }

    if (!token) {
      client.disconnect();
      throw new UnauthorizedException('No token provided');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        client.disconnect();
        throw new UnauthorizedException('JWT_SECRET not configured');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });

      // Speichere userId und role in Socket Context fuer Authorization
      client.data.userId = payload.sub;
      client.data.role = payload.role;

      return true;
    } catch (error) {
      console.error('WsJwtAuthGuard: Token validation failed', error);
      client.disconnect();
      throw new UnauthorizedException('Invalid token');
    }
  }
}
