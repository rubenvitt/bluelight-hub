import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

/**
 * Metadata-Key für Roles Decorator.
 *
 * Ermöglicht dem RolesGuard die erforderlichen Rollen aus den Metadaten zu extrahieren.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator zum Festlegen erforderlicher Rollen für Endpunkte.
 *
 * Kann auf Controller-Klassen oder einzelne Methoden angewendet werden.
 * Der RolesGuard prüft, ob der authentifizierte User eine der angegebenen Rollen hat.
 *
 * @param roles - Eine oder mehrere Rollen, die für den Zugriff erforderlich sind (OR-Verknüpfung)
 *
 * @example
 * ```typescript
 * // Nur ADMIN oder SUPER_ADMIN dürfen zugreifen
 * @Roles('ADMIN', 'SUPER_ADMIN')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * async lockEtb() { ... }
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
