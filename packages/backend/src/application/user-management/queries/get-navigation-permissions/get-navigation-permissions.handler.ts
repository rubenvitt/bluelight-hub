import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { NavigationPermissionDto } from '@/application/user-management/dto/navigation-permission.dto';
import { GetNavigationPermissionsQuery } from './get-navigation-permissions.query';

/**
 * Navigations-Bereiche und deren erforderliche Rollen.
 *
 * User-Level RBAC (Global):
 * - Operative Flaechen (ueberblick, etb, befehle) sind fuer alle authentifizierten Nutzer zugaenglich
 * - Admin-Flaechen (stammdaten, berechtigungen, integrationen) nur fuer ADMIN/SUPER_ADMIN
 */
const NAVIGATION_AREAS: ReadonlyArray<{
  area: string;
  allowedRoles: readonly string[];
  deniedReason: string;
}> = [
  {
    area: 'ueberblick',
    allowedRoles: ['USER', 'ADMIN', 'SUPER_ADMIN'],
    deniedReason: 'Dieser Bereich ist für Ihre Rolle nicht freigegeben',
  },
  {
    area: 'etb',
    allowedRoles: ['USER', 'ADMIN', 'SUPER_ADMIN'],
    deniedReason: 'Dieser Bereich ist für Ihre Rolle nicht freigegeben',
  },
  {
    area: 'befehle',
    allowedRoles: ['USER', 'ADMIN', 'SUPER_ADMIN'],
    deniedReason: 'Dieser Bereich ist für Ihre Rolle nicht freigegeben',
  },
  {
    area: 'stammdaten',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
    deniedReason: 'Nur für Administratoren freigegeben',
  },
  {
    area: 'berechtigungen',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
    deniedReason: 'Nur für Administratoren freigegeben',
  },
  {
    area: 'integrationen',
    allowedRoles: ['ADMIN', 'SUPER_ADMIN'],
    deniedReason: 'Nur für Administratoren freigegeben',
  },
];

/**
 * Handler fuer GetNavigationPermissionsQuery.
 *
 * Bestimmt basierend auf der UserRole welche Navigationsbereiche
 * fuer den Benutzer zugaenglich sind. Unterstuetzt Custom Permissions
 * als additive Erweiterung der rollenbasierten Berechtigungen.
 */
@QueryHandler(GetNavigationPermissionsQuery)
@Injectable()
export class GetNavigationPermissionsQueryHandler implements IQueryHandler<GetNavigationPermissionsQuery, Result<NavigationPermissionDto[]>> {
  async execute(query: GetNavigationPermissionsQuery): Promise<Result<NavigationPermissionDto[]>> {
    const { userRole, customPermissions } = query;

    const permissions: NavigationPermissionDto[] = NAVIGATION_AREAS.map((navArea) => {
      const roleAllowed = navArea.allowedRoles.includes(userRole);

      // Custom Permissions koennen additiv Zugang gewaehren (OR-Verknuepfung)
      const customAllowed = customPermissions?.some((p) => p === `nav:${navArea.area}` || p === 'nav:*') ?? false;

      const accessible = roleAllowed || customAllowed;

      return {
        area: navArea.area,
        accessible,
        reason: accessible ? null : navArea.deniedReason,
      };
    });

    return Result.ok<NavigationPermissionDto[]>(permissions);
  }
}
