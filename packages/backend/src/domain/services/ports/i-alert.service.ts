/**
 * Payload für Outbox Failure Alert.
 *
 * Enthält alle relevanten Informationen für die Benachrichtigung
 * über fehlgeschlagene Events im Transactional Outbox Pattern.
 */
export interface OutboxFailureAlertPayload {
  /** Outbox Event ID (= Domain Event ID) */
  eventId: string;
  /** Event Name (z.B. 'etb.eintrag_added') */
  eventName: string;
  /** Aggregate ID auf das sich das Event bezieht */
  aggregateId: string;
  /** Letzte Fehlermeldung */
  lastError: string;
  /** Anzahl fehlgeschlagener Retry-Versuche */
  retryCount: number;
  /** Timestamp des ursprünglichen Event-Auftretens */
  occurredAt: Date;
  /** Timestamp des Failures */
  failedAt: Date;
}

/**
 * Port Interface für Alert Service (Hexagonale Architektur).
 *
 * Diese Abstraktion ermöglicht die Entkopplung der Outbox-Infrastruktur
 * von der konkreten Alert-Implementierung (E-Mail, Slack, etc.).
 *
 * **Dependency Inversion:**
 * - Infrastructure Layer (Outbox) definiert WAS benötigt wird
 * - Concrete Adapter (EmailAlertService) implementiert WIE
 * - OutboxEventPublisher injiziert via @Inject('IAlertService')
 *
 * **Fire-and-Forget Pattern:**
 * - Alert-Fehler werden geloggt aber nicht propagiert
 * - Kritischer Outbox-Failure darf nicht durch Alert-Fehler blockiert werden
 *
 * @example
 * ```typescript
 * // In OutboxEventPublisher:
 * constructor(
 *   @Inject('IAlertService') private readonly alertService: IAlertService
 * ) {}
 *
 * private async notifyFailure(event: OutboxEventDto, error: string): Promise<void> {
 *   await this.alertService.notifyOutboxFailure({
 *     eventId: event.id,
 *     eventName: event.eventName,
 *     // ...
 *   });
 * }
 * ```
 */
export interface IAlertService {
  /**
   * Benachrichtigt SUPER_ADMIN User über ein fehlgeschlagenes Outbox Event.
   *
   * Diese Methode wird aufgerufen, wenn ein Event nach MAX_RETRIES
   * als FAILED markiert wird. SUPER_ADMIN User sollen per E-Mail
   * über den kritischen Fehler informiert werden.
   *
   * **Fire-and-Forget:**
   * - Fehler werden geloggt aber nicht propagiert
   * - Promise resolved immer (keine Exceptions)
   *
   * @param payload - Details zum fehlgeschlagenen Event
   */
  notifyOutboxFailure(payload: OutboxFailureAlertPayload): Promise<void>;
}
