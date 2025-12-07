import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Access Token Authentication Guard
 *
 * Dieser Guard schützt Routen und erfordert ein gültiges Access-Token
 * im HTTP-Only Cookie. Er verwendet die 'jwt' Strategie zur Validierung.
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('protected')
 * getProtectedResource() {
 *   // Nur mit gültigem Access-Token erreichbar
 * }
 * ```
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
