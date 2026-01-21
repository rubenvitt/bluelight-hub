/**
 * ETB-Eintrag Auto-Creation bei Erinnerung-Erledigung.
 *
 * Dieser Event Handler implementiert das Fire-and-Forget Pattern:
 * Fehler werden geloggt aber NICHT propagiert, um die Erinnerung-Erledigung
 * nicht zu blockieren. ETB-Eintraege koennen bei Bedarf manuell nacherstellt werden.
 *
 * **Eintrag-Text (Story 2.5 AC4):**
 * - Mit Notiz: "Erinnerung '{titel}' erledigt: {notiz}"
 * - Ohne Notiz: "Erinnerung '{titel}' erledigt"
 *
 * @module application/etb/event-handlers
 * @see ErinnerungErledigtEvent - Trigger Event (Domain Event via Outbox)
 * @see AddEintragHandler - Delegierter Command Handler
 */
import { Inject, Injectable } from '@nestjs/common';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { ErinnerungErledigtEvent } from '@domain/events/erinnerung-erledigt.event';
import { LOGGER } from '@infrastructure/di-tokens';
import { AddEintragCommand } from '../commands/add-eintrag/add-eintrag.command';
// biome-ignore lint/style/useImportType: AddEintragHandler needed for DI at runtime
import { AddEintragHandler } from '../commands/add-eintrag/add-eintrag.handler';
import type { EtbKategorieValue } from '@domain/value-objects/etb-kategorie';

/**
 * ETB Kategorie fuer automatische System-Eintraege (Erinnerungen).
 * Als Konstante definiert fuer bessere Wartbarkeit und Type-Safety.
 */
const ETB_KATEGORIE_SYSTEM: EtbKategorieValue = 'SYSTEM';

/**
 * Event Handler fuer automatischen ETB-Eintrag bei Erinnerung-Erledigung.
 *
 * Verarbeitet ErinnerungErledigtEvent Events und erstellt automatisch einen ETB-Eintrag
 * fuer die Dokumentation der Erinnerungserledigung (Story 2.5 AC4).
 *
 * **Fire-and-Forget Pattern:**
 * - Handler-Fehler werden geloggt, aber NICHT propagiert
 * - Erinnerung-Erledigung wird NICHT blockiert bei ETB-Fehlern
 * - Idempotent: Duplicate Events koennen zu multiplen Eintraegen fuehren (OK fuer ETB)
 */
@Injectable()
export class ErinnerungErledigtEventHandler implements IEventHandler<ErinnerungErledigtEvent> {
  constructor(
    private readonly addEintragHandler: AddEintragHandler,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Verarbeitet ErinnerungErledigtEvent und erstellt automatisch einen ETB-Eintrag.
   *
   * @param event - Das empfangene ErinnerungErledigtEvent (Domain Event via Outbox)
   * @returns Promise<void> - Keine Rueckgabe (Fire-and-Forget)
   */
  async handle(event: ErinnerungErledigtEvent): Promise<void> {
    this.logger.log(`Creating ETB entry for ErinnerungErledigt: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}`, 'ErinnerungErledigtEventHandler');

    try {
      // Validierung aller required Fields
      if (!event.titel || !event.erledigtBy || !event.erinnerungId || !event.einsatzId) {
        this.logger.error(
          `ErinnerungErledigt event has missing required fields: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}, erledigtBy=${event.erledigtBy}`,
          'ErinnerungErledigtEventHandler',
        );
        return; // Early exit - Event ist ungueltig
      }

      // ETB-ID entspricht der EinsatzId (1:1 Beziehung)
      const etbId = event.einsatzId.toString();

      // Story 2.5 AC4: Text fuer ETB-Eintrag mit optionaler Notiz
      const text = event.erledigungsNotiz ? `Erinnerung '${event.titel}' erledigt: ${event.erledigungsNotiz}` : `Erinnerung '${event.titel}' erledigt`;

      // Command erstellen mit Validierung
      const commandResult = AddEintragCommand.create(
        etbId,
        text,
        event.erledigtBy.toString(),
        ETB_KATEGORIE_SYSTEM,
        event.einsatzId.toString(),
        undefined, // absender - nicht relevant fuer automatische Eintraege
        undefined, // empfaenger - nicht relevant fuer automatische Eintraege
        {
          eventType: 'ErinnerungErledigt',
          erinnerungId: event.erinnerungId.toString(),
          erledigtAm: event.erledigtAm.toISOString(),
          erledigtBy: event.erledigtBy.toString(),
          erledigungsNotiz: event.erledigungsNotiz ?? null,
        },
      );

      if (commandResult.isFailure) {
        this.logger.error(
          `Failed to create AddEintragCommand for ErinnerungErledigt: einsatzId=${event.einsatzId}, error=${commandResult.error}, severity=ERROR, actionRequired=Check command validation logic`,
          'ErinnerungErledigtEventHandler',
        );
        return; // Fire-and-Forget: Nicht propagieren
      }

      // Command ausfuehren via injiziertem Handler
      // biome-ignore lint/style/noNonNullAssertion: Safe - already checked isFailure above
      const result = await this.addEintragHandler.execute(commandResult.value!);

      if (result.isFailure) {
        this.logger.error(
          `Failed to add ETB entry for ErinnerungErledigt: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}, error=${result.error}, severity=ERROR, actionRequired=Manual ETB entry may be needed`,
          'ErinnerungErledigtEventHandler',
        );
        return; // Fire-and-Forget: Nicht propagieren
      }

      // Erfolg: ETB-Eintrag wurde erstellt
      this.logger.log(`ETB entry created for ErinnerungErledigt: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}`, 'ErinnerungErledigtEventHandler');
    } catch (error) {
      // Unerwarteter Fehler: Mit Stack Trace loggen fuer Monitoring/Alerting
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `CRITICAL: Unexpected error during ETB entry creation for ErinnerungErledigt: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}, error=${errorMessage}, stack=${stack}, severity=CRITICAL, actionRequired=Manual ETB entry may be needed`,
        'ErinnerungErledigtEventHandler',
      );
      // Fire-and-Forget: NICHT re-thrown!
    }
  }
}
