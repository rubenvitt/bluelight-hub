/**
 * ETB-Eintrag Auto-Creation bei Erinnerung-Ausloesung.
 *
 * Dieser Event Handler implementiert das Fire-and-Forget Pattern:
 * Fehler werden geloggt aber NICHT propagiert, um die Erinnerung-Ausloesung
 * nicht zu blockieren. ETB-Eintraege koennen bei Bedarf manuell nacherstellt werden.
 *
 * **Eintrag-Text (Story 1.5 AC5):**
 * "Erinnerung '{titel}' ausgeloest"
 *
 * @module application/etb/event-handlers
 * @see ErinnerungAusgeloestEvent - Trigger Event (Domain Event via Outbox)
 * @see AddEintragHandler - Delegierter Command Handler
 */
import { Inject, Injectable } from '@nestjs/common';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import type { ErinnerungAusgeloestEvent } from '@domain/events/erinnerung-ausgeloest.event';
import { LOGGER } from '@infrastructure/di-tokens';
import { AddEintragCommand } from '../commands/add-eintrag/add-eintrag.command';
// biome-ignore lint/style/useImportType: AddEintragHandler needed for DI at runtime
import { AddEintragHandler } from '../commands/add-eintrag/add-eintrag.handler';

/**
 * Event Handler fuer automatischen ETB-Eintrag bei Erinnerung-Ausloesung.
 *
 * Verarbeitet ErinnerungAusgeloestEvent Events und erstellt automatisch einen ETB-Eintrag
 * fuer die Dokumentation der Erinnerungsausloesung (Story 1.5 AC5).
 *
 * **Fire-and-Forget Pattern:**
 * - Handler-Fehler werden geloggt, aber NICHT propagiert
 * - Erinnerung-Trigger wird NICHT blockiert bei ETB-Fehlern
 * - Idempotent: Duplicate Events koennen zu multiplen Eintraegen fuehren (OK fuer ETB)
 */
@Injectable()
export class ErinnerungAusgeloestEventHandler implements IEventHandler<ErinnerungAusgeloestEvent> {
  constructor(
    private readonly addEintragHandler: AddEintragHandler,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Verarbeitet ErinnerungAusgeloestEvent und erstellt automatisch einen ETB-Eintrag.
   *
   * @param event - Das empfangene ErinnerungAusgeloestEvent (Domain Event via Outbox)
   * @returns Promise<void> - Keine Rueckgabe (Fire-and-Forget)
   */
  async handle(event: ErinnerungAusgeloestEvent): Promise<void> {
    this.logger.log(`Creating ETB entry for ErinnerungAusgeloest: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}`, 'ErinnerungAusgeloestEventHandler');

    try {
      // Validation: Titel sollte vorhanden sein
      if (!event.titel) {
        this.logger.warn(`ErinnerungAusgeloest event has missing titel: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}`, 'ErinnerungAusgeloestEventHandler');
      }

      // ETB-ID entspricht der EinsatzId (1:1 Beziehung)
      const etbId = event.einsatzId.toString();

      // Story 1.5 AC5: Text fuer ETB-Eintrag
      const text = `Erinnerung '${event.titel}' ausgeloest`;

      // Command erstellen mit Validierung
      const commandResult = AddEintragCommand.create(
        etbId,
        text,
        event.erstelltVon.toString(),
        'SYSTEM', // ETB Kategorie fuer automatische System-Eintraege (Erinnerungen)
        event.einsatzId.toString(),
        undefined, // absender - nicht relevant fuer automatische Eintraege
        undefined, // empfaenger - nicht relevant fuer automatische Eintraege
        {
          eventType: 'ErinnerungAusgeloest',
          erinnerungId: event.erinnerungId.toString(),
          ausgeloestAm: event.ausgeloestAm.toISOString(),
        },
      );

      if (commandResult.isFailure) {
        this.logger.error(
          `Failed to create AddEintragCommand for ErinnerungAusgeloest: einsatzId=${event.einsatzId}, error=${commandResult.error}, severity=ERROR, actionRequired=Check command validation logic`,
          'ErinnerungAusgeloestEventHandler',
        );
        return; // Fire-and-Forget: Nicht propagieren
      }

      // Command ausfuehren via injiziertem Handler
      // biome-ignore lint/style/noNonNullAssertion: Safe - already checked isFailure above
      const result = await this.addEintragHandler.execute(commandResult.value!);

      if (result.isFailure) {
        this.logger.error(
          `Failed to add ETB entry for ErinnerungAusgeloest: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}, error=${result.error}, severity=ERROR, actionRequired=Manual ETB entry may be needed`,
          'ErinnerungAusgeloestEventHandler',
        );
        return; // Fire-and-Forget: Nicht propagieren
      }

      // Erfolg: ETB-Eintrag wurde erstellt
      this.logger.log(`ETB entry created for ErinnerungAusgeloest: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}`, 'ErinnerungAusgeloestEventHandler');
    } catch (error) {
      // Unerwarteter Fehler: Mit Stack Trace loggen fuer Monitoring/Alerting
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `CRITICAL: Unexpected error during ETB entry creation for ErinnerungAusgeloest: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}, error=${errorMessage}, stack=${stack}, severity=CRITICAL, actionRequired=Manual ETB entry may be needed`,
        'ErinnerungAusgeloestEventHandler',
      );
      // Fire-and-Forget: NICHT re-thrown!
    }
  }
}
