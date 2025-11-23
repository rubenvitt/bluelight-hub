import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { LagekarteCreatedEvent } from '@domain/events/lagekarte-created.event';
import type { PoiAddedEvent } from '@domain/events/poi-added.event';
import type { PoiRemovedEvent } from '@domain/events/poi-removed.event';
import type { PoiPositionUpdatedEvent } from '@domain/events/poi-position-updated.event';

/**
 * Event Handler für Lagekarte Domain Events.
 *
 * Dieser Handler demonstriert das Event-Handler-Pattern und loggt alle
 * Lagekarte-Events für Debugging und Audit-Zwecke. In Produktion würde
 * ein separater Handler für Audit-Logging implementiert werden.
 *
 * **Fire-and-Forget Pattern:**
 * Handler-Fehler werden intern gefangen und geloggt, aber nicht propagiert.
 * Dies verhindert, dass Event-Handler die Haupt-Transaktion beeinflussen.
 *
 * **Async Handler:**
 * Alle Handler sind async, um await-Support für zukünftige Operationen
 * (z.B. externe API-Calls) zu ermöglichen.
 */
@Injectable()
export class LagekarteEventLoggerHandler {
  private readonly logger = new Logger(LagekarteEventLoggerHandler.name);

  /**
   * Handler für LagekarteCreatedEvent.
   * Loggt die Erstellung einer neuen Lagekarte.
   */
  @OnEvent('lagekarte.created')
  async handleLagekarteCreated(event: LagekarteCreatedEvent): Promise<void> {
    try {
      this.logger.log(`Lagekarte erstellt fuer Einsatz`, {
        lagekarteId: event.lagekarteId.value,
        einsatzId: event.einsatzId.value,
        hasInitialPoi: event.hasInitialPoi,
        createdBy: event.createdBy.value,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error(`Failed to handle LagekarteCreatedEvent`, {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handler für PoiAddedEvent.
   * Loggt das Hinzufügen eines POI zur Lagekarte.
   */
  @OnEvent('lagekarte.poi_added')
  async handlePoiAdded(event: PoiAddedEvent): Promise<void> {
    try {
      this.logger.log(`POI hinzugefuegt: ${event.name}`, {
        lagekarteId: event.lagekarteId.value,
        poiId: event.poiId.value,
        category: event.category.value,
        coordinate: event.coordinate.toString(),
        createdBy: event.createdBy.value,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error(`Failed to handle PoiAddedEvent`, {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handler für PoiRemovedEvent.
   * Loggt das Entfernen eines POI von der Lagekarte.
   */
  @OnEvent('lagekarte.poi_removed')
  async handlePoiRemoved(event: PoiRemovedEvent): Promise<void> {
    try {
      this.logger.log(`POI entfernt`, {
        lagekarteId: event.lagekarteId.value,
        poiId: event.poiId.value,
        removedBy: event.removedBy.value,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error(`Failed to handle PoiRemovedEvent`, {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handler für PoiPositionUpdatedEvent.
   * Loggt die Positionsänderung eines POI.
   */
  @OnEvent('lagekarte.poi_position_updated')
  async handlePoiPositionUpdated(event: PoiPositionUpdatedEvent): Promise<void> {
    try {
      this.logger.log(`POI Position aktualisiert`, {
        lagekarteId: event.lagekarteId.value,
        poiId: event.poiId.value,
        oldMgrs: event.oldCoordinate.toString(),
        newMgrs: event.newCoordinate.toString(),
        updatedBy: event.updatedBy.value,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error(`Failed to handle PoiPositionUpdatedEvent`, {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
