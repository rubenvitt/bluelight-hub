import { BadRequestException, type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isCuid } from '@paralleldrive/cuid2';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { BEFEHL_ROLLEN_KEY } from '../decorators/requires-befehl-rolle.decorator';

/**
 * Guard zur Pruefung befehlsspezifischer Rollen im Einsatz-Kontext.
 *
 * Story 4.2 AC1/AC3: Prueft ob der User die erforderliche Rolle hat.
 *
 * Flow:
 * 1. @RequiresBefehlRolle() Metadata auslesen
 * 2. JWT-User extrahieren
 * 3. Admin/SuperAdmin: immer Zugriff
 * 4. EinsatzId ermitteln (aus Body/Query oder Befehl-Lookup)
 * 5. EinsatzRollenzuweisung abfragen
 * 6. Rolle gegen Metadata pruefen
 */
@Injectable()
export class BefehlRollenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Erforderliche Rollen aus Decorator-Metadata lesen
    const requiredRoles = this.reflector.get<string[] | undefined>(BEFEHL_ROLLEN_KEY, context.getHandler());

    // Kein Decorator → kein Rollen-Check noetig
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId: string; role?: string } | undefined;

    if (!user?.userId) {
      throw new ForbiddenException({
        code: 'MISSING_ROLLE',
        message: 'Nicht authentifiziert',
        allowedRoles: requiredRoles,
        nextAction: 'Bitte melden Sie sich an.',
      });
    }

    // 2. Admin/SuperAdmin: immer Zugriff
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      return true;
    }

    // 3. EinsatzId ermitteln
    const einsatzId = await this.resolveEinsatzId(request);

    if (!einsatzId) {
      throw new ForbiddenException({
        code: 'MISSING_ROLLE',
        message: 'Einsatz-Kontext konnte nicht ermittelt werden',
        allowedRoles: requiredRoles,
        nextAction: 'Bitte stellen Sie sicher, dass eine Einsatz-ID angegeben ist.',
      });
    }

    // 4. Rollenzuweisung abfragen
    const zuweisung = await this.prisma.einsatzRollenzuweisung.findUnique({
      where: {
        einsatzId_userId: {
          einsatzId,
          userId: user.userId,
        },
      },
    });

    if (!zuweisung) {
      throw new ForbiddenException({
        code: 'MISSING_ROLLE',
        message: 'Keine Berechtigung fuer diese Aktion',
        allowedRoles: requiredRoles,
        nextAction: 'Sie haben keine Rolle in diesem Einsatz. Wenden Sie sich an den Einsatzleiter.',
      });
    }

    // 5. Rolle gegen erforderliche Rollen pruefen (OR-Verknuepfung)
    if (!requiredRoles.includes(zuweisung.rolle)) {
      throw new ForbiddenException({
        code: 'MISSING_ROLLE',
        message: 'Keine Berechtigung fuer diese Aktion',
        allowedRoles: requiredRoles,
        nextAction: `Ihre Rolle (${zuweisung.rolle}) hat keinen Zugriff. Erforderlich: ${requiredRoles.join(' oder ')}.`,
      });
    }

    // Rolle im Request speichern fuer spaetere Verwendung (z.B. Query-Filterung)
    request.einsatzRolle = zuweisung.rolle;
    request.resolvedEinsatzId = einsatzId;

    return true;
  }

  /**
   * Ermittelt die EinsatzId aus verschiedenen Quellen:
   * 1. Body (POST /befehle)
   * 2. Query (GET /befehle?einsatzId=...)
   * 3. Befehl-Lookup (POST /befehle/:id/quittieren → Befehl → einsatzId)
   */
  private async resolveEinsatzId(request: { body?: { einsatzId?: string }; query?: { einsatzId?: string }; params?: { id?: string } }): Promise<string | undefined> {
    // Direkt aus Body oder Query
    if (request.body?.einsatzId) {
      if (!isCuid(request.body.einsatzId)) {
        throw new BadRequestException('Ungültige Einsatz-ID');
      }
      return request.body.einsatzId;
    }
    if (request.query?.einsatzId) {
      if (!isCuid(request.query.einsatzId)) {
        throw new BadRequestException('Ungültige Einsatz-ID');
      }
      return request.query.einsatzId;
    }

    // Befehl-Lookup fuer Subrouten (/:id/quittieren, /:id/korrigieren, etc.)
    const befehlId = request.params?.id;
    if (befehlId) {
      if (!isCuid(befehlId)) {
        throw new BadRequestException('Ungültige Einsatz-ID');
      }
      const befehl = await this.prisma.befehl.findUnique({
        where: { id: befehlId },
        select: { einsatzId: true },
      });
      return befehl?.einsatzId;
    }

    return undefined;
  }
}
