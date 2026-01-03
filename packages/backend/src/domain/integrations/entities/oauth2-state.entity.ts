/**
 * OAuth2State Entity - Temporärer State für OAuth2 Authorization Code Flow.
 *
 * Speichert PKCE Code Verifier und State für CSRF-Schutz.
 * Kurzlebig (max. 10 Minuten), wird nach Callback gelöscht.
 *
 * **Sicherheit:**
 * - State-Token schützt vor CSRF-Angriffen
 * - Code Verifier ist Teil des PKCE-Flows (RFC 7636)
 * - Automatische Ablaufzeit verhindert Replay-Attacken
 *
 * @module domain/integrations/entities
 */

import { Result } from '@domain/common/result';

/**
 * Properties für OAuth2State Entity.
 */
export interface OAuth2StateProps {
  /** Eindeutige ID (CUID) */
  id: string;
  /** State-Token für CSRF-Schutz (min. 32 Zeichen) */
  state: string;
  /** PKCE Code Verifier (min. 43 Zeichen, RFC 7636) */
  codeVerifier: string;
  /** Integration-Typ (z.B. HIORG_SERVER) */
  integrationType: string;
  /** Redirect URI nach OAuth Callback */
  redirectUri: string;
  /** User ID der den Flow gestartet hat */
  createdBy: string;
  /** Ablaufzeitpunkt (nach Ablauf ungültig) */
  expiresAt: Date;
  /** Erstellungszeitpunkt */
  createdAt: Date;
}

/**
 * Create DTO für neuen OAuth2State.
 */
export interface CreateOAuth2StateProps {
  /** State-Token für CSRF-Schutz (min. 32 Zeichen) */
  state: string;
  /** PKCE Code Verifier (min. 43 Zeichen) */
  codeVerifier: string;
  /** Integration-Typ (z.B. HIORG_SERVER) */
  integrationType: string;
  /** Redirect URI nach OAuth Callback */
  redirectUri: string;
  /** User ID der den Flow startet */
  createdBy: string;
  /** Ablaufzeit in Minuten (Default: 10) */
  expiresInMinutes?: number;
}

/**
 * OAuth2State Domain Entity.
 *
 * **Verwendung:**
 * ```typescript
 * // State generieren für OAuth Flow Start
 * const stateResult = OAuth2State.create({
 *   state: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
 *   codeVerifier: generateCodeVerifier(), // 43-128 Zeichen
 *   integrationType: 'HIORG_SERVER',
 *   redirectUri: '/integrations/hiorg/callback',
 *   createdBy: userId,
 * });
 *
 * // Nach Callback: State validieren
 * const storedState = await repository.findByState(callbackState);
 * if (!storedState || storedState.isExpired()) {
 *   return Result.fail('Ungültiger oder abgelaufener State');
 * }
 * ```
 */
export class OAuth2State {
  private constructor(private readonly props: OAuth2StateProps) {}

  // === Getter (Read-Only Properties) ===

  get id(): string {
    return this.props.id;
  }

  get state(): string {
    return this.props.state;
  }

  get codeVerifier(): string {
    return this.props.codeVerifier;
  }

  get integrationType(): string {
    return this.props.integrationType;
  }

  get redirectUri(): string {
    return this.props.redirectUri;
  }

  get createdBy(): string {
    return this.props.createdBy;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // === Business Logic ===

  /**
   * Prüft ob der State abgelaufen ist.
   *
   * Nach Ablauf ist der State ungültig und sollte nicht mehr
   * für Token-Exchange verwendet werden.
   */
  isExpired(): boolean {
    return new Date() > this.props.expiresAt;
  }

  // === Factory Methods ===

  /**
   * Erstellt einen neuen OAuth2State für den Authorization Code Flow.
   *
   * **Validierung:**
   * - State muss mindestens 32 Zeichen lang sein (Sicherheit)
   * - Code Verifier muss mindestens 43 Zeichen lang sein (RFC 7636)
   * - Integration Type und Redirect URI sind Pflichtfelder
   *
   * @param props - Create DTO mit PKCE-Parametern
   * @returns Result mit Entity bei Erfolg, Fehler bei Validierungsproblemen
   */
  static create(props: CreateOAuth2StateProps): Result<OAuth2State> {
    // State-Token Validierung (CSRF-Schutz)
    if (!props.state || props.state.length < 32) {
      return Result.fail('State muss mindestens 32 Zeichen lang sein für CSRF-Schutz');
    }

    // PKCE Code Verifier Validierung (RFC 7636: 43-128 Zeichen)
    if (!props.codeVerifier || props.codeVerifier.length < 43) {
      return Result.fail('Code Verifier muss mindestens 43 Zeichen lang sein (RFC 7636)');
    }

    if (props.codeVerifier.length > 128) {
      return Result.fail('Code Verifier darf maximal 128 Zeichen lang sein (RFC 7636)');
    }

    // Integration Type Validierung
    if (!props.integrationType || props.integrationType.trim().length === 0) {
      return Result.fail('Integration Type ist erforderlich');
    }

    // Redirect URI Validierung
    if (!props.redirectUri || props.redirectUri.trim().length === 0) {
      return Result.fail('Redirect URI ist erforderlich');
    }

    // Created By Validierung
    if (!props.createdBy || props.createdBy.trim().length === 0) {
      return Result.fail('Created By (User ID) ist erforderlich');
    }

    const expiresInMinutes = props.expiresInMinutes ?? 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    return Result.ok(
      new OAuth2State({
        id: '', // Wird beim Speichern durch Repository/DB generiert
        state: props.state,
        codeVerifier: props.codeVerifier,
        integrationType: props.integrationType.trim(),
        redirectUri: props.redirectUri.trim(),
        createdBy: props.createdBy.trim(),
        expiresAt,
        createdAt: new Date(),
      }),
    );
  }

  /**
   * Rekonstruiert Entity aus Datenbank-Daten.
   *
   * Keine Validierung da Daten bereits validiert in DB gespeichert wurden.
   *
   * @param props - Alle Properties aus Datenbank
   * @returns Entity Instanz
   */
  static fromPersistence(props: OAuth2StateProps): OAuth2State {
    return new OAuth2State(props);
  }
}
