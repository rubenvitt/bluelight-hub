/**
 * Admin API Feature - Public Exports
 *
 * Zentrale Export-Datei für alle Admin-API-Funktionen.
 * Vereinfacht Imports und definiert die öffentliche API des Features.
 */

// Query Keys
export { ADMIN_QUERY_KEYS } from './queries';

// Hooks
export { useAdminUserManagement } from './use-admin-user-management';
export { useAdminQualifikationenManagement, type QualifikationKategorie, KATEGORIE_LABELS, getKategorieBadgeVariant } from './use-admin-qualifikationen-management';
export { useAdminRollenDefinitionenManagement } from './use-admin-rollen-definitionen-management';
export { useAdminStammFahrzeugeManagement } from './use-admin-stamm-fahrzeuge-management';
export { useAdminStammPersonenManagement } from './use-admin-stamm-personen-management';
export { useAdminHiOrgIntegration } from './use-admin-hiorg-integration';

// Re-export generierte DTOs für Convenience
export type { CreateQualifikationDto, QualifikationDto, UpdateQualifikationDto } from '@bluelight-hub/shared/client';
export type { CreateRollenDefinitionDto, RollenDefinitionDto, UpdateRollenDefinitionDto } from '@bluelight-hub/shared/client';
export type { CreateStammFahrzeugDto, StammFahrzeugDto, UpdateStammFahrzeugDto } from '@bluelight-hub/shared/client';
export type { CreateStammPersonDto, StammPersonDto, UpdateStammPersonDto, StammPersonQualifikationDto } from '@bluelight-hub/shared/client';
export type { SaveHiOrgCredentialsDto, HiOrgCredentialsResponseDto, HiOrgConnectionInfoDto, HiOrgPersonsPreviewResponseDto } from '@bluelight-hub/shared/client';
