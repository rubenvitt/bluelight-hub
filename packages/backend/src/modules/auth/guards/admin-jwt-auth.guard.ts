import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Admin JWT Authentication Guard
 *
 * Dieser Guard schützt Admin-Routen und erfordert ein gültiges Admin-Token
 * im HTTP-Only Cookie. Er verwendet die 'admin-jwt' Strategie zur Validierung.
 *
 * @example
 * ```typescript
 * @UseGuards(AdminJwtAuthGuard)
 * @Get('admin/verify')
 * verifyAdmin() {
 *   // Nur mit gültigem Admin-Token erreichbar
 * }
 * ```
 */
@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('admin-jwt') {}
