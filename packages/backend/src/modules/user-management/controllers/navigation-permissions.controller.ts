import { Controller, Get, InternalServerErrorException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import type { ValidatedUser } from '@/modules/auth/strategies/jwt.strategy';
import { ApiWrappedResponse } from '@/modules/common/decorators/api-wrapped-response.decorator';
import { GetNavigationPermissionsQuery, GetNavigationPermissionsQueryHandler, NavigationPermissionDto } from '@application/user-management';
import type { NavigationUserRole } from '@application/user-management';

/**
 * Controller fuer Navigations-Berechtigungen.
 *
 * Stellt den Endpoint bereit ueber den authentifizierte Benutzer
 * ihre zugaenglichen Navigationsbereiche abfragen koennen.
 *
 * @endpoint /navigation/permissions (version: alpha)
 */
@ApiTags('navigation')
@ApiBearerAuth('jwt')
@Controller({
  path: 'navigation/permissions',
  version: 'alpha',
})
@UseGuards(JwtAuthGuard)
export class NavigationPermissionsController {
  constructor(private readonly getNavigationPermissionsHandler: GetNavigationPermissionsQueryHandler) {}

  /**
   * Navigations-Berechtigungen des aktuellen Benutzers abrufen.
   *
   * Gibt fuer jeden Navigationsbereich zurueck ob der aktuelle
   * Benutzer darauf zugreifen darf. Basiert auf UserRole + Custom Permissions.
   *
   * @returns NavigationPermissionDto[] - Liste aller Bereiche mit Zugangsstatus
   */
  @Get()
  @ApiOperation({ summary: 'Navigations-Berechtigungen des aktuellen Benutzers' })
  @ApiWrappedResponse(NavigationPermissionDto, {
    isArray: true,
    description: 'Liste der Navigations-Berechtigungen',
  })
  async getPermissions(@CurrentUser() user: ValidatedUser): Promise<NavigationPermissionDto[]> {
    const userRole: NavigationUserRole = (user.role as NavigationUserRole) ?? 'USER';
    const query = new GetNavigationPermissionsQuery(userRole);

    const result = await this.getNavigationPermissionsHandler.execute(query);

    if (result.isFailure) {
      throw new InternalServerErrorException(result.error ?? 'Failed to fetch navigation permissions');
    }

    return result.value ?? [];
  }
}
