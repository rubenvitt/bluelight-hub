/**
 * TestHiOrgConnectionHandler - Handler für TestHiOrgConnectionCommand.
 *
 * Testet die Verbindung zum HiOrg-Server mit den gespeicherten OAuth2-Credentials.
 * Nutzt HiOrgTokenRefreshService für automatisches Token-Refresh bei Ablauf.
 *
 * @module application/integrations/commands/test-hiorg-connection
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { IIntegrationCredentialRepository } from '@domain/integrations';
import type { IHiOrgServerPort, HiOrgConnectionInfo } from '@domain/ports/i-hiorg-server.port';
import { INTEGRATIONS } from '@/infrastructure/di-tokens';
import type { HiOrgTokenRefreshService } from '../../services/hiorg-token-refresh.service';
import type { TestHiOrgConnectionCommand } from './test-hiorg-connection.command';

/**
 * Handler für TestHiOrgConnectionCommand.
 *
 * **Ablauf:**
 * 1. Gültiges Access Token holen (ggf. automatisch refreshen)
 * 2. Verbindung testen
 * 3. lastTestedAt aktualisieren bei Erfolg
 */
@Injectable()
export class TestHiOrgConnectionHandler {
  constructor(
    @Inject(INTEGRATIONS.CREDENTIAL_REPOSITORY)
    private readonly repository: IIntegrationCredentialRepository,
    @Inject(INTEGRATIONS.HIORG_SERVER_PORT)
    private readonly hiorg: IHiOrgServerPort,
    private readonly tokenRefresh: HiOrgTokenRefreshService,
  ) {}

  /**
   * Führt den Command aus.
   */
  async execute(_command: TestHiOrgConnectionCommand): Promise<Result<HiOrgConnectionInfo>> {
    // 1. Gültiges Access Token holen (ggf. automatisch refreshen)
    const tokenResult = await this.tokenRefresh.getValidAccessToken();
    if (tokenResult.isFailure) {
      return Result.fail(tokenResult.error ?? 'Fehler beim Abrufen des Access Tokens');
    }

    const tokenData = tokenResult.value;
    if (!tokenData) {
      return Result.fail('Kein Access Token verfügbar');
    }
    const { accessToken, credential, wasRefreshed } = tokenData;

    if (wasRefreshed) {
      // Token wurde refreshed - Info loggen (Logger ist im Service)
    }

    // 2. Verbindung testen
    const connectionResult = await this.hiorg.testConnection(accessToken);
    if (connectionResult.isFailure) {
      return Result.fail(connectionResult.error ?? 'Verbindungstest fehlgeschlagen');
    }

    const connectionInfo = connectionResult.value;
    if (!connectionInfo) {
      return Result.fail('Keine Verbindungsinformationen erhalten');
    }

    // 3. lastTestedAt aktualisieren
    const updatedCredential = credential.markConnectionTested();
    await this.repository.save(updatedCredential);

    return Result.ok(connectionInfo);
  }
}
