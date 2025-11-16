import { DomainEvent } from '@domain/common/domain-event';
import type { LagekarteId } from '@domain/value-objects/lagekarte-id';
import type { PoiId } from '@domain/value-objects/poi-id';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Event: POI von Lagekarte entfernt.
 *
 * Wird emittiert, wenn ein Point of Interest (POI) von der Lagekarte entfernt wird.
 * Handler können dieses Event nutzen, um:
 * - Audit-Logs für Compliance zu schreiben (wer hat wann was gelöscht)
 * - Externe Systeme zu synchronisieren (Soft-Delete Pattern)
 * - Notifications zu versenden
 *
 * **Design Entscheidung - Minimale Event-Daten:**
 * WICHTIG: Dieses Event enthält NICHT die gelöschten POI-Daten (Name, Koordinate, Kategorie).
 *
 * **Warum?**
 * - Soft-Delete Pattern: POI bleibt in Datenbank für Audit-Zwecke
 * - Handler, die POI-Daten benötigen, können diese aus Datenbank laden
 * - Event-Size Optimierung: Kleinere Events = bessere Performance im Event Store
 *
 * **Alternative Strategie:**
 * Handler, die gelöschte POI-Daten benötigen, sollten ein separates "Before-Delete"
 * Event abonnieren oder POI-Snapshots vor Löschung in eigenem Read Model cachen.
 *
 * @example
 * ```typescript
 * // Im LagekarteAggregate nach removePoi():
 * this.addDomainEvent(new PoiRemovedEvent(
 *   this.id,
 *   poiId,
 *   userId
 * ));
 * ```
 */
export class PoiRemovedEvent extends DomainEvent {
  /**
   * Event Name für Event Router (Past Tense, lowercase dot-separated).
   */
  public readonly eventName = 'lagekarte.poi_removed';

  /**
   * @param lagekarteId - ID der parent Lagekarte (Aggregate Root)
   * @param poiId - ID des entfernten POI
   * @param removedBy - User ID des Löschenden
   */
  constructor(
    public readonly lagekarteId: LagekarteId,
    public readonly poiId: PoiId,
    public readonly removedBy: UserId,
  ) {
    super();
  }

  /**
   * Static Method für type-safe Event Routing.
   * @returns Event Name in past tense
   */
  public static eventName(): string {
    return 'lagekarte.poi_removed';
  }
}
