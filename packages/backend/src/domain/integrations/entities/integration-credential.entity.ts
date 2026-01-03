/**
 * IntegrationCredential Entity - Verschlüsselte OAuth2-Zugangsdaten für externe Dienste.
 *
 * Diese Entity repräsentiert OAuth2-Credentials für externe Integrationen wie HiOrg-Server.
 * Access und Refresh Tokens werden verschlüsselt gespeichert und nur bei Bedarf entschlüsselt.
 *
 * **Sicherheit:**
 * - Tokens werden mit AES-256-GCM verschlüsselt gespeichert
 * - Tokens werden NIEMALS in Logs oder API-Responses zurückgegeben
 * - Nur `hasOAuthTokens: boolean` wird nach außen exponiert
 *
 * **Immutable Design:**
 * - Entity ist weitgehend immutable
 * - Änderungen erfolgen über Factory-Methoden die neue Instanz zurückgeben
 *
 * @module domain/integrations/entities
 */

import { Result } from '@domain/common/result';
import { INTEGRATION_ERROR_CODES, IntegrationError } from '../common/integration-error-codes';

/**
 * Integration Types (erweiterbar für zukünftige Integrationen).
 */
export const INTEGRATION_TYPES = {
  HIORG_SERVER: 'HIORG_SERVER',
} as const;

export type IntegrationType = (typeof INTEGRATION_TYPES)[keyof typeof INTEGRATION_TYPES];

/**
 * Properties für IntegrationCredential Entity.
 */
export interface IntegrationCredentialProps {
  /** Eindeutige ID (CUID) */
  id: string;
  /** Integration-Typ (z.B. HIORG_SERVER) */
  type: IntegrationType;
  /** Ist die Integration aktiv? */
  isActive: boolean;
  /** Letzter erfolgreicher Connection Test */
  lastTestedAt?: Date;
  /** Letzte Synchronisation */
  lastSyncAt?: Date;
  /** Erstellungszeitpunkt */
  createdAt: Date;
  /** Letztes Update */
  updatedAt: Date;
  /** Erstellt von (User ID) */
  createdBy?: string;
  /** Aktualisiert von (User ID) */
  updatedBy?: string;

  // === OAuth2 Felder ===
  /** Verschlüsseltes OAuth2 Access Token */
  encryptedAccessToken?: string;
  /** Verschlüsseltes OAuth2 Refresh Token */
  encryptedRefreshToken?: string;
  /** Ablaufzeitpunkt des Access Tokens */
  accessTokenExpiresAt?: Date;
}

/**
 * Create DTO für OAuth2-basierte IntegrationCredential.
 */
export interface CreateOAuthCredentialDto {
  type: IntegrationType;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  accessTokenExpiresAt: Date;
  createdBy: string;
}

/**
 * Update DTO für OAuth2 Tokens.
 *
 * Wird verwendet um OAuth2 Tokens nach Token-Exchange oder Refresh zu aktualisieren.
 */
export interface UpdateOAuthTokensDto {
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  accessTokenExpiresAt: Date;
  updatedBy: string;
}

/**
 * IntegrationCredential Domain Entity.
 *
 * **Verwendung:**
 * ```typescript
 * const credentialResult = IntegrationCredential.createFromOAuth({
 *   type: INTEGRATION_TYPES.HIORG_SERVER,
 *   encryptedAccessToken: encryption.encrypt('access-token'),
 *   encryptedRefreshToken: encryption.encrypt('refresh-token'),
 *   accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
 *   createdBy: userId,
 * });
 *
 * if (credentialResult.isSuccess) {
 *   await repository.save(credentialResult.value);
 * }
 * ```
 */
export class IntegrationCredential {
  private constructor(private readonly props: IntegrationCredentialProps) {}

  // === Getter (Read-Only Properties) ===

  get id(): string {
    return this.props.id;
  }

  get type(): IntegrationType {
    return this.props.type;
  }

  get encryptedAccessToken(): string | undefined {
    return this.props.encryptedAccessToken;
  }

  get encryptedRefreshToken(): string | undefined {
    return this.props.encryptedRefreshToken;
  }

  get accessTokenExpiresAt(): Date | undefined {
    return this.props.accessTokenExpiresAt;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get lastTestedAt(): Date | undefined {
    return this.props.lastTestedAt;
  }

  get lastSyncAt(): Date | undefined {
    return this.props.lastSyncAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get createdBy(): string | undefined {
    return this.props.createdBy;
  }

  get updatedBy(): string | undefined {
    return this.props.updatedBy;
  }

  /**
   * Prüft ob OAuth2 Tokens gesetzt sind.
   */
  get hasOAuthTokens(): boolean {
    return !!this.props.encryptedAccessToken && this.props.encryptedAccessToken.length > 0;
  }

  /**
   * Prüft ob das Access Token abgelaufen ist.
   *
   * Gibt true zurück wenn kein Ablaufdatum gesetzt ist oder Token abgelaufen.
   */
  get isAccessTokenExpired(): boolean {
    if (!this.props.accessTokenExpiresAt) {
      return true;
    }
    // Token als abgelaufen betrachten wenn weniger als 5 Minuten verbleiben
    const bufferMs = 5 * 60 * 1000;
    return new Date() > new Date(this.props.accessTokenExpiresAt.getTime() - bufferMs);
  }

  /**
   * Prüft ob ein Refresh Token verfügbar ist.
   */
  get hasRefreshToken(): boolean {
    return !!this.props.encryptedRefreshToken && this.props.encryptedRefreshToken.length > 0;
  }

  // === Factory Methods ===

  /**
   * Rekonstruiert Entity aus DB-Daten.
   *
   * @param props - Alle Properties aus DB
   * @returns Entity Instanz
   */
  static fromPersistence(props: IntegrationCredentialProps): IntegrationCredential {
    return new IntegrationCredential(props);
  }

  /**
   * Erstellt eine neue IntegrationCredential aus OAuth2 Flow.
   *
   * @param dto - Create DTO mit OAuth2 Tokens
   * @returns Result mit Entity bei Erfolg
   */
  static createFromOAuth(dto: CreateOAuthCredentialDto): Result<IntegrationCredential> {
    if (!dto.encryptedAccessToken || dto.encryptedAccessToken.length === 0) {
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.ENCRYPTION_FAILED, 'Verschlüsseltes Access Token ist erforderlich'));
    }

    const now = new Date();

    return Result.ok(
      new IntegrationCredential({
        id: '', // Wird von Repository/DB gesetzt
        type: dto.type,
        isActive: true,
        encryptedAccessToken: dto.encryptedAccessToken,
        encryptedRefreshToken: dto.encryptedRefreshToken,
        accessTokenExpiresAt: dto.accessTokenExpiresAt,
        createdAt: now,
        updatedAt: now,
        createdBy: dto.createdBy,
      }),
    );
  }

  // === Mutation Methods ===

  /**
   * Markiert den letzten erfolgreichen Connection Test.
   */
  markConnectionTested(): IntegrationCredential {
    return new IntegrationCredential({
      ...this.props,
      lastTestedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Markiert die letzte erfolgreiche Synchronisation.
   */
  markSynced(): IntegrationCredential {
    return new IntegrationCredential({
      ...this.props,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Deaktiviert die Integration.
   */
  deactivate(updatedBy: string): IntegrationCredential {
    return new IntegrationCredential({
      ...this.props,
      isActive: false,
      updatedAt: new Date(),
      updatedBy,
    });
  }

  /**
   * Aktiviert die Integration.
   */
  activate(updatedBy: string): IntegrationCredential {
    return new IntegrationCredential({
      ...this.props,
      isActive: true,
      updatedAt: new Date(),
      updatedBy,
    });
  }

  /**
   * Aktualisiert OAuth2 Tokens.
   *
   * Wird nach Token-Exchange oder Token-Refresh aufgerufen.
   * Ersetzt die vorhandenen OAuth2 Tokens durch neue.
   *
   * @param dto - DTO mit neuen OAuth2 Tokens
   * @returns Neue Entity-Instanz mit aktualisierten Tokens
   */
  updateOAuthTokens(dto: UpdateOAuthTokensDto): IntegrationCredential {
    return new IntegrationCredential({
      ...this.props,
      encryptedAccessToken: dto.encryptedAccessToken,
      encryptedRefreshToken: dto.encryptedRefreshToken ?? this.props.encryptedRefreshToken,
      accessTokenExpiresAt: dto.accessTokenExpiresAt,
      updatedAt: new Date(),
      updatedBy: dto.updatedBy,
    });
  }
}
