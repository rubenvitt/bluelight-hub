import { type CanActivate, type ExecutionContext, Injectable, ForbiddenException, Logger, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { ValidatedUser } from '../strategies/jwt.strategy';

/**
 * Guard zur rollenbasierten Zugriffskontrolle (RBAC).
 *
 * Prüft, ob der authentifizierte Benutzer eine der erforderlichen Rollen hat,
 * die via @Roles() Decorator am Endpunkt definiert wurden.
 *
 * **Voraussetzung:** Muss NACH JwtAuthGuard verwendet werden, da dieser
 * den User im Request-Objekt bereitstellt.
 *
 * **Verhalten:**
 * - Kein @Roles() Decorator → Zugriff erlaubt (kein Role-Check)
 * - @Roles('ADMIN') → Nur ADMIN darf zugreifen
 * - @Roles('ADMIN', 'SUPER_ADMIN') → ADMIN ODER SUPER_ADMIN darf zugreifen
 * - User ohne Role → ForbiddenException
 * - User mit falscher Role → ForbiddenException
 *
 * @example
 * ```typescript
 * @Post(':etbId/lock')
 * @Roles('ADMIN', 'SUPER_ADMIN')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * async lockEtb() { ... }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Hole erforderliche Rollen aus @Roles() Decorator (Methode oder Klasse)
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // Kein @Roles() Decorator → Zugriff erlaubt
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Hole User aus Request (gesetzt von JwtAuthGuard)
    const request = context.switchToHttp().getRequest();
    const user: ValidatedUser | undefined = request.user;

    // Kein User → sollte nicht passieren nach JwtAuthGuard, aber sicherheitshalber
    if (!user) {
      this.logger.warn('RolesGuard: No user in request - JwtAuthGuard missing?');
      throw new ForbiddenException('Nicht authentifiziert');
    }

    // User ohne Role → Zugriff verweigert
    if (!user.role) {
      this.logger.warn(`RolesGuard: User ${user.userId} has no role assigned`);
      throw new ForbiddenException('Keine Rolle zugewiesen - Zugriff verweigert');
    }

    // Prüfe ob User eine der erforderlichen Rollen hat
    const hasRequiredRole = requiredRoles.includes(user.role);

    if (!hasRequiredRole) {
      this.logger.warn(`RolesGuard: User ${user.userId} with role ${user.role} denied access (required: ${requiredRoles.join(', ')})`);
      throw new ForbiddenException(`Zugriff verweigert - erforderliche Rolle: ${requiredRoles.join(' oder ')}`);
    }

    return true;
  }
}
