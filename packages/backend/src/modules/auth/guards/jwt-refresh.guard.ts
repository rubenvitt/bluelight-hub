import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Refresh Token Authentication Guard
 *
 * Dieser Guard schützt die Refresh-Token-Route und erfordert ein gültiges
 * Refresh-Token im HTTP-Only Cookie. Er verwendet die 'jwt-refresh' Strategie.
 *
 * @example
 * ```typescript
 * @UseGuards(JwtRefreshGuard)
 * @Post('refresh')
 * refreshTokens() {
 *   // Nur mit gültigem Refresh-Token erreichbar
 * }
 * ```
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
