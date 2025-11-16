import { DomainEvent } from '@domain/common/domain-event';
import type { EintragId } from '@domain/value-objects/eintrag-id';
import type { EtbId } from '@domain/value-objects/etb-id';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Event: Ein Eintrag wurde zum ETB hinzugefügt.
 *
 * Dieses Event wird emittiert wenn ein neuer Eintrag erfolgreich zum Einsatztagebuch
 * hinzugefügt wurde. Es enthält den vollständigen Kontext für Event-Handler, damit
 * diese ohne zusätzliche Datenbank-Queries reagieren können (Event-Carried State Transfer).
 *
 * **Warum Rich Data?**
 * - sequenceNumber: Für chronologische Sortierung in Read Models
 * - text: Für Notification-Generierung ohne DB-Query
 * - createdBy: Für Audit-Trail und User-Benachrichtigungen
 *
 * **Use Cases:**
 * - Notification Service: Benachrichtige Team über neuen Eintrag
 * - Read Model Update: Aktualisiere denormalisierte ETB-Liste
 * - Audit-Log: Persistiere Änderung in Audit-Datenbank
 * - Analytics: Tracke ETB-Aktivität für Statistiken
 *
 * @example
 * ```typescript
 * // Im EinsatztagebuchAggregate nach addEintrag():
 * this.addDomainEvent(new EintragAddedEvent(
 *   this.id,
 *   eintrag.id,
 *   eintrag.sequenceNumber.value,
 *   'Fahrzeug W1 am Einsatzort',
 *   userId
 * ));
 * ```
 */
export class EintragAddedEvent extends DomainEvent {
  /**
   * Event Name für Event Router (Past Tense).
   */
  public readonly eventName = 'etb.eintrag_added';

  /**
   * @param etbId - ID des parent ETB Aggregates
   * @param eintragId - ID des neu hinzugefügten Eintrags
   * @param sequenceNumber - Sequenznummer des Eintrags (primitive für einfache Serialisierung)
   * @param text - Textinhalt des Eintrags
   * @param createdBy - User ID des Erstellers
   */
  constructor(
    public readonly etbId: EtbId,
    public readonly eintragId: EintragId,
    public readonly sequenceNumber: number,
    public readonly text: string,
    public readonly createdBy: UserId,
  ) {
    super();
  }
}
