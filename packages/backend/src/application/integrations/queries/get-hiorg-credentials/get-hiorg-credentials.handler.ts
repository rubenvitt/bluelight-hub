/**
 * GetHiOrgCredentialsHandler - Handler für GetHiOrgCredentialsQuery.
 *
 * Lädt den HiOrg-Server OAuth2-Verbindungsstatus.
 *
 * @module application/integrations/queries/get-hiorg-credentials
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { INTEGRATION_TYPES, type IIntegrationCredentialRepository } from '@domain/integrations';
import { INTEGRATIONS } from '@/infrastructure/di-tokens';
import type { GetHiOrgCredentialsQuery } from './get-hiorg-credentials.query';

/**
 * DTO für Credentials Response.
 */
export interface HiOrgCredentialsDto {
  /** Sind OAuth2 Tokens konfiguriert? */
  hasOAuthTokens: boolean;
  /** Ist die Integration aktiv? */
  isActive: boolean;
  /** Letzter erfolgreicher Connection Test */
  lastTestedAt?: Date;
  /** Letzte Synchronisation */
  lastSyncAt?: Date;
}

/**
 * Handler für GetHiOrgCredentialsQuery.
 */
@Injectable()
export class GetHiOrgCredentialsHandler {
  constructor(
    @Inject(INTEGRATIONS.CREDENTIAL_REPOSITORY)
    private readonly repository: IIntegrationCredentialRepository,
  ) {}

  /**
   * Führt die Query aus.
   */
  async execute(_query: GetHiOrgCredentialsQuery): Promise<Result<HiOrgCredentialsDto | undefined>> {
    const credentialResult = await this.repository.findByType(INTEGRATION_TYPES.HIORG_SERVER);
    if (credentialResult.isFailure) {
      return Result.fail(credentialResult.error ?? 'Fehler beim Laden der Credentials');
    }

    const credential = credentialResult.value;
    if (!credential) {
      return Result.ok(undefined);
    }

    return Result.ok({
      hasOAuthTokens: credential.hasOAuthTokens,
      isActive: credential.isActive,
      lastTestedAt: credential.lastTestedAt,
      lastSyncAt: credential.lastSyncAt,
    });
  }
}
