import { DomainEvent } from '@domain/common/domain-event';
import type { LagekarteId } from '@domain/value-objects/lagekarte-id';
import type { PoiId } from '@domain/value-objects/poi-id';
import type { UserId } from '@domain/value-objects/user-id';
import type { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { EVENT_NAMES } from './event-names';

/**
 * Event: POI-Position aktualisiert.
 *
 * Wird emittiert, wenn die Position eines POI geändert wird.
 * Handler können dieses Event nutzen, um:
 * - Bewegungsprotokolle für Audit-Zwecke zu erstellen
 * - Distanzänderungen zu berechnen (z.B. für Alarmierungsradius)
 * - Externe Kartensysteme zu aktualisieren
 *
 * **Event-Carried State Transfer - Alte & Neue Position:**
 * WICHTIG: Event enthält ALTE und NEUE Koordinate (beide als MGRS),
 * sodass Handler keine Datenbank-Abfragen benötigen, um die Änderung
 * zu verstehen. Dies verhindert N+1 Query-Probleme in Event-Handlern.
 *
 * **Warum beide Koordinaten?**
 * - Distanzberechnung: Handler können Bewegungsdistanz direkt aus Event berechnen
 *   via oldCoordinate.distanceTo(newCoordinate) ohne DB-Query
 * - Audit-Trail: Vollständige Historie der Position (von → zu) für Compliance
 * - Performance: Eliminiert N+1 Queries für Event-Handler
 * - Pattern Consistency: Analog zu EinsatzStatusChangedEvent (old + new status)
 *
 * **MGRS-Standard:**
 * Beide Koordinaten sind IMMER im MGRS-Format gespeichert (DRK-Standard).
 * Handler müssen bei Bedarf zu Lat/Lng konvertieren via coordinate.toLatLng().
 *
 * @example
 * ```typescript
 * // Im LagekarteAggregate nach updatePoiPosition():
 * this.addDomainEvent(new PoiPositionUpdatedEvent(
 *   this.id,
 *   poiId,
 *   oldCoordinate, // Previous MGRS position
 *   newCoordinate, // New MGRS position
 *   userId
 * ));
 *
 * // Event-Handler kann Distanz direkt berechnen:
 * const distanceM = event.oldCoordinate.distanceTo(event.newCoordinate);
 * if (distanceM > 1000) {
 *   console.log(`POI moved ${distanceM}m - significant change!`);
 * }
 * ```
 */
export class PoiPositionUpdatedEvent extends DomainEvent {
  /**
   * @param lagekarteId - ID der parent Lagekarte (Aggregate Root)
   * @param poiId - ID des aktualisierten POI
   * @param oldCoordinate - Alte MGRS-Koordinate (vor Update)
   * @param newCoordinate - Neue MGRS-Koordinate (nach Update)
   * @param updatedBy - User ID des Aktualisierenden
   */
  constructor(
    public readonly lagekarteId: LagekarteId,
    public readonly poiId: PoiId,
    public readonly oldCoordinate: MgrsCoordinate,
    public readonly newCoordinate: MgrsCoordinate,
    public readonly updatedBy: UserId,
  ) {
    super();
  }

  /**
   * Static Method für type-safe Event Routing.
   * @returns Event Name in past tense
   */
  public static eventName(): string {
    return EVENT_NAMES.LAGEKARTE.POI_POSITION_UPDATED;
  }
}
