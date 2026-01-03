/**
 * Error Codes für Integration-Module (Story 7-1).
 *
 * Strukturierte Fehlercodes für HiOrg-Server und andere externe Integrationen.
 * Folgt dem Projekt-Pattern: `[ERROR_CODE] Message` Format.
 *
 * @module domain/integrations/common
 */

/**
 * Error Codes für Integration-Operationen.
 *
 * **Verwendung in Handlers:**
 * ```typescript
 * if (connectionFailed) {
 *   return Result.fail(INTEGRATION_ERROR_CODES.CONNECTION_FAILED);
 * }
 * ```
 *
 * **Error Code Prüfung:**
 * ```typescript
 * if (IntegrationError.hasCode(result.error, INTEGRATION_ERROR_CODES.FEATURE_LOCKED)) {
 *   throw new ServiceUnavailableException('Feature in HiOrg-Server deaktiviert');
 * }
 * ```
 */
export const INTEGRATION_ERROR_CODES = {
  /** Credentials nicht gefunden */
  CREDENTIALS_NOT_FOUND: 'INTEGRATION_001',
  /** Verbindung zum externen Dienst fehlgeschlagen */
  CONNECTION_FAILED: 'INTEGRATION_002',
  /** API-Token ungültig oder abgelaufen */
  INVALID_TOKEN: 'INTEGRATION_003',
  /** Feature im externen Dienst deaktiviert/nicht lizenziert (HTTP 423) */
  FEATURE_LOCKED: 'INTEGRATION_004',
  /** Rate Limit des externen Dienstes überschritten */
  RATE_LIMITED: 'INTEGRATION_005',
  /** Ungültiges Organisations-Kürzel Format */
  INVALID_ORG_KUERZEL: 'INTEGRATION_006',
  /** Verschlüsselung fehlgeschlagen */
  ENCRYPTION_FAILED: 'INTEGRATION_007',
  /** Entschlüsselung fehlgeschlagen */
  DECRYPTION_FAILED: 'INTEGRATION_008',
  /** Ungültiger oder unbekannter Integrations-Typ */
  INVALID_INTEGRATION_TYPE: 'INTEGRATION_009',
  /** Ungültiger oder abgelaufener OAuth State (CSRF-Schutz) */
  OAUTH_STATE_INVALID: 'INTEGRATION_010',
  /** OAuth Authorization Code Exchange fehlgeschlagen */
  OAUTH_CODE_EXCHANGE_FAILED: 'INTEGRATION_011',
  /** OAuth Token Refresh fehlgeschlagen (Refresh Token ungültig/widerrufen) */
  OAUTH_TOKEN_REFRESH_FAILED: 'INTEGRATION_012',
  /** OAuth Client nicht konfiguriert (Client ID/Secret fehlen) */
  OAUTH_NOT_CONFIGURED: 'INTEGRATION_013',
  /** OAuth2State konnte nicht gespeichert werden */
  STATE_SAVE_FAILED: 'INTEGRATION_014',
  /** OAuth2State nicht gefunden */
  STATE_NOT_FOUND: 'INTEGRATION_015',
  /** OAuth2State konnte nicht gelöscht werden */
  STATE_DELETE_FAILED: 'INTEGRATION_016',
  /** Import von externen Personen fehlgeschlagen */
  IMPORT_FAILED: 'INTEGRATION_017',
  /** Qualifikations-Mapping nicht gefunden */
  MAPPING_NOT_FOUND: 'INTEGRATION_018',
  /** Person-Validierung während Import fehlgeschlagen */
  PERSON_VALIDATION_FAILED: 'INTEGRATION_019',
  /** Duplikat während Import erkannt */
  DUPLICATE_DETECTED: 'INTEGRATION_020',
  /** Import überschreitet maximale Anzahl */
  IMPORT_LIMIT_EXCEEDED: 'INTEGRATION_021',
  /** Import-Timeout erreicht */
  IMPORT_TIMEOUT: 'INTEGRATION_022',
} as const;

/**
 * Typisierter Error Code Union Type.
 */
export type IntegrationErrorCode = (typeof INTEGRATION_ERROR_CODES)[keyof typeof INTEGRATION_ERROR_CODES];

/**
 * Hilfsfunktionen für Integration Error Handling.
 */
export class IntegrationError {
  /**
   * Prüft ob ein Error String einen bestimmten Error Code enthält.
   *
   * @param error - Der Error String aus Result.error
   * @param code - Der erwartete Error Code
   * @returns true wenn der Code im Error enthalten ist
   */
  static hasCode(error: string | undefined, code: IntegrationErrorCode): boolean {
    if (!error) return false;
    return error.includes(code);
  }

  /**
   * Extrahiert die Message aus einem formatierten Error String.
   *
   * @param error - Der Error String im Format `[CODE] Message`
   * @returns Die extrahierte Message oder der gesamte String
   */
  static extractMessage(error: string | undefined): string {
    if (!error) return 'Unbekannter Fehler';
    const match = error.match(/^\[INTEGRATION_\d+\]\s*(.*)$/);
    return match?.[1] ?? error;
  }

  /**
   * Erstellt einen formatierten Error String.
   *
   * @param code - Der Error Code
   * @param message - Die Fehlermeldung
   * @returns Formatierter String `[CODE] Message`
   */
  static format(code: IntegrationErrorCode, message: string): string {
    return `[${code}] ${message}`;
  }
}
