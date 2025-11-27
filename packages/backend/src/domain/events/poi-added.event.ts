import { DomainEvent } from '@domain/common/domain-event';
import type { LagekarteId } from '@domain/value-objects/lagekarte-id';
import type { PoiId } from '@domain/value-objects/poi-id';
import type { UserId } from '@domain/value-objects/user-id';
import type { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import type { PoiCategory } from '@domain/value-objects/poi-category';

/**
 * Event: POI zur Lagekarte hinzugefügt.
 *
 * Wird emittiert, wenn ein neuer Point of Interest (POI) zur Lagekarte hinzugefügt wird.
 * Handler können dieses Event nutzen, um:
 * - Notifications an Einsatzkräfte zu versenden
 * - Audit-Logs für Compliance zu schreiben
 * - Externe Systeme (z.B. Leitstelle) zu synchronisieren
 *
 * **Event-Carried State Transfer:**
 * Das Event enthält alle relevanten Daten (name, coordinate, category), damit Handler
 * ohne zusätzliche Datenbank-Queries reagieren können. Dies verhindert N+1-Query-Probleme
 * und entkoppelt Event-Handler von der Domain-Datenbank.
 *
 * **WICHTIG:** coordinate ist IMMER als MGRS gespeichert (DRK-Standard),
 * nicht als Lat/Lng. Handler müssen bei Bedarf zu Lat/Lng konvertieren via
 * coordinate.toLatLng().
 *
 * @example
 * ```typescript
 * // Im LagekarteAggregate nach addPoi():
 * this.addDomainEvent(new PoiAddedEvent(
 *   this.id,
 *   poi.id,
 *   'Einsatzstelle Hauptbahnhof',
 *   MgrsCoordinate.fromLatLng(52.52, 13.40, 5).getValue(),
 *   PoiCategory.EINSATZSTELLE(),
 *   userId
 * ));
 * ```
 */
export class PoiAddedEvent extends DomainEvent {
  /**
   * @param lagekarteId - ID der parent Lagekarte (Aggregate Root)
   * @param poiId - ID des neu hinzugefügten POI
   * @param name - Name/Bezeichnung des POI
   * @param coordinate - MGRS-Koordinate des POI (DRK-Standard)
   * @param category - POI-Kategorie (EINSATZSTELLE, BEREITSTELLUNGSRAUM, etc.)
   * @param createdBy - User ID des Erstellers
   */
  constructor(
    public readonly lagekarteId: LagekarteId,
    public readonly poiId: PoiId,
    public readonly name: string,
    public readonly coordinate: MgrsCoordinate,
    public readonly category: PoiCategory,
    public readonly createdBy: UserId,
  ) {
    super();
  }

  /**
   * Static Method für type-safe Event Routing.
   * @returns Event Name in past tense
   */
  public static eventName(): string {
    return 'lagekarte.poi_added';
  }
}
