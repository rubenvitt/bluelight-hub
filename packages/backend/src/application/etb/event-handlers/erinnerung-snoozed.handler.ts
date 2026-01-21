/**
 * ETB-Eintrag Auto-Creation bei Erinnerung-Snooze.
 *
 * Dieser Event Handler implementiert das Fire-and-Forget Pattern:
 * Fehler werden geloggt aber NICHT propagiert, um die Erinnerung-Snooze-Operation
 * nicht zu blockieren. ETB-Eintraege koennen bei Bedarf manuell nacherstellt werden.
 *
 * **Eintrag-Text (Story 2.1):**
 * "Erinnerung '{titel}' gesnoozed für {snoozeMinutes} Minuten (#{snoozeCount})"
 *
 * @module application/etb/event-handlers
 * @see ErinnerungSnoozedEvent - Trigger Event (Domain Event via Outbox)
 * @see AddEintragHandler - Delegierter Command Handler
 */
import { Inject, Injectable } from '@nestjs/common';
import type { IEventHandler } from '@domain/ports/i-event-handler.port';
// biome-ignore lint/style/useImportType: ILogger needed for DI at runtime
import { ILogger } from '@domain/ports/i-logger.port';
import type { ErinnerungSnoozedEvent } from '@domain/events/erinnerung-snoozed.event';
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
 * Event Handler fuer automatischen ETB-Eintrag bei Erinnerung-Snooze.
 *
 * Verarbeitet ErinnerungSnoozedEvent Events und erstellt automatisch einen ETB-Eintrag
 * fuer die Dokumentation des Snoozens (Story 2.1).
 *
 * **Fire-and-Forget Pattern:**
 * - Handler-Fehler werden geloggt, aber NICHT propagiert
 * - Erinnerung-Snooze wird NICHT blockiert bei ETB-Fehlern
 * - Idempotent: Duplicate Events koennen zu multiplen Eintraegen fuehren (OK fuer ETB)
 */
@Injectable()
export class ErinnerungSnoozedEventHandler implements IEventHandler<ErinnerungSnoozedEvent> {
  constructor(
    private readonly addEintragHandler: AddEintragHandler,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  /**
   * Verarbeitet ErinnerungSnoozedEvent und erstellt automatisch einen ETB-Eintrag.
   *
   * @param event - Das empfangene ErinnerungSnoozedEvent (Domain Event via Outbox)
   * @returns Promise<void> - Keine Rueckgabe (Fire-and-Forget)
   */
  async handle(event: ErinnerungSnoozedEvent): Promise<void> {
    this.logger.log(
      `Creating ETB entry for ErinnerungSnoozed: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}, snoozeMinutes=${event.snoozeMinutes}`,
      'ErinnerungSnoozedEventHandler',
    );

    try {
      // H3 Fix: Validierung aller required Fields (nicht nur titel)
      if (!event.titel || !event.snoozedBy || !event.erinnerungId || !event.einsatzId) {
        this.logger.error(
          `ErinnerungSnoozed event has missing required fields: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}, snoozedBy=${event.snoozedBy}`,
          'ErinnerungSnoozedEventHandler',
        );
        return; // Early exit - Event ist ungueltig
      }

      // ETB-ID entspricht der EinsatzId (1:1 Beziehung)
      const etbId = event.einsatzId.toString();

      // Story 2.1: Text fuer ETB-Eintrag
      const text = `Erinnerung '${event.titel}' gesnoozed für ${event.snoozeMinutes} Minuten (#${event.snoozeCount})`;

      // Command erstellen mit Validierung
      const commandResult = AddEintragCommand.create(
        etbId,
        text,
        event.snoozedBy.toString(),
        ETB_KATEGORIE_SYSTEM,
        event.einsatzId.toString(),
        undefined, // absender - nicht relevant fuer automatische Eintraege
        undefined, // empfaenger - nicht relevant fuer automatische Eintraege
        {
          eventType: 'ErinnerungSnoozed',
          erinnerungId: event.erinnerungId.toString(),
          snoozedAt: event.snoozedAt.toISOString(),
          snoozedUntil: event.snoozedUntil.toISOString(),
          snoozedBy: event.snoozedBy.toString(),
          snoozeMinutes: event.snoozeMinutes,
          snoozeCount: event.snoozeCount,
        },
      );

      if (commandResult.isFailure) {
        this.logger.error(
          `Failed to create AddEintragCommand for ErinnerungSnoozed: einsatzId=${event.einsatzId}, error=${commandResult.error}, severity=ERROR, actionRequired=Check command validation logic`,
          'ErinnerungSnoozedEventHandler',
        );
        return; // Fire-and-Forget: Nicht propagieren
      }

      // Command ausfuehren via injiziertem Handler
      // biome-ignore lint/style/noNonNullAssertion: Safe - already checked isFailure above
      const result = await this.addEintragHandler.execute(commandResult.value!);

      if (result.isFailure) {
        this.logger.error(
          `Failed to add ETB entry for ErinnerungSnoozed: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}, error=${result.error}, severity=ERROR, actionRequired=Manual ETB entry may be needed`,
          'ErinnerungSnoozedEventHandler',
        );
        return; // Fire-and-Forget: Nicht propagieren
      }

      // Erfolg: ETB-Eintrag wurde erstellt
      this.logger.log(
        `ETB entry created for ErinnerungSnoozed: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}, snoozeMinutes=${event.snoozeMinutes}`,
        'ErinnerungSnoozedEventHandler',
      );
    } catch (error) {
      // Unerwarteter Fehler: Mit Stack Trace loggen fuer Monitoring/Alerting
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `CRITICAL: Unexpected error during ETB entry creation for ErinnerungSnoozed: einsatzId=${event.einsatzId}, erinnerungId=${event.erinnerungId}, titel=${event.titel}, error=${errorMessage}, stack=${stack}, severity=CRITICAL, actionRequired=Manual ETB entry may be needed`,
        'ErinnerungSnoozedEventHandler',
      );
      // Fire-and-Forget: NICHT re-thrown!
    }
  }
}
