import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENT_NAMES } from '@domain/events/event-names';
import type { PatientErfasst } from '@domain/patienten/events/patient-erfasst.event';
import type { PatientGesichtet } from '@domain/patienten/events/patient-gesichtet.event';
import type { PatientSichtungAktualisiert } from '@domain/patienten/events/patient-sichtung-aktualisiert.event';
import type { ILogger } from '@domain/ports/i-logger.port';
import { LOGGER } from '@infrastructure/di-tokens';

/**
 * Event Logger für Patient-Domain-Events (Story 1.2/1.3, Architecture §D-6).
 *
 * Story 1.2 hatte den Adapter nur für `patient.erfasst` verdrahtet; Story 1.3
 * schließt die 4-Punkt-Registry für `patient.gesichtet` (Erst-Sichtung) und
 * `patient.sichtung-aktualisiert` (Reevaluierung). Der eigentliche
 * WS-Broadcast-Adapter folgt in Story 3.1; bis dahin loggt dieser Handler die
 * Events als Audit-Spur und erfüllt den 3. Registry-Punkt (Subscriber-
 * Verdrahtung im AdaptersModule), damit Build/Tests vertraglich grün bleiben.
 *
 * **Fire-and-Forget Pattern:** Handler-Fehler werden gefangen und geloggt,
 * aber nie an die Haupt-Transaktion propagiert.
 */
@Injectable()
export class PatientEventLoggerHandler {
  constructor(@Inject(LOGGER) private readonly logger: ILogger) {}

  @OnEvent(EVENT_NAMES.PATIENT.ERFASST)
  async handlePatientErfasst(event: PatientErfasst): Promise<void> {
    try {
      this.logger.log(`Patient ${event.patientennummer} erfasst (${event.initialeSk})`, {
        einsatzId: event.einsatzId,
        patientId: event.patientId,
        patientennummer: event.patientennummer,
        initialeSk: event.initialeSk,
        actorUserId: event.actorUserId,
        actorDeviceId: event.actorDeviceId,
        originSessionId: event.originSessionId,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error('Failed to handle PatientErfasst event', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @OnEvent(EVENT_NAMES.PATIENT.GESICHTET)
  async handlePatientGesichtet(event: PatientGesichtet): Promise<void> {
    try {
      this.logger.log(`Patient ${event.patientId} initial gesichtet (${event.sk}, ${event.sichtungArt})`, {
        einsatzId: event.einsatzId,
        patientId: event.patientId,
        sk: event.sk,
        sichtungArt: event.sichtungArt,
        eventVersion: event.eventVersion,
        actorUserId: event.actorUserId,
        actorDeviceId: event.actorDeviceId,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error('Failed to handle PatientGesichtet event', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @OnEvent(EVENT_NAMES.PATIENT.SICHTUNG_AKTUALISIERT)
  async handlePatientSichtungAktualisiert(event: PatientSichtungAktualisiert): Promise<void> {
    try {
      this.logger.log(`Patient ${event.patientId}: Sichtung ${event.vorher} → ${event.neu} (${event.sichtungArt})`, {
        einsatzId: event.einsatzId,
        patientId: event.patientId,
        vorher: event.vorher,
        neu: event.neu,
        sichtungArt: event.sichtungArt,
        grund: event.grund,
        eventVersion: event.eventVersion,
        actorUserId: event.actorUserId,
        actorDeviceId: event.actorDeviceId,
        eventId: event.eventId,
      });
    } catch (error) {
      this.logger.error('Failed to handle PatientSichtungAktualisiert event', {
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
