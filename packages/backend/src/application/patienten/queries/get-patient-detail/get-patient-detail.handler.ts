import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PatientId } from '@domain/patienten/aggregates/patient.aggregate';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import { LOGGER, PATIENT_REPOSITORY } from '@infrastructure/di-tokens';
import type { PatientDetailDto } from '../../dto/patient-detail.dto';
import { PatientDetailMapper } from '../../mappers/patient-detail.mapper';
import { GetPatientDetailQuery } from './get-patient-detail.query';

/**
 * Sentinel-Strings für `GetPatientDetailHandler` (Story 1.7, AC4/AC5).
 *
 * `PATIENT_NOT_FOUND:patient does not exist` und `PATIENT_NOT_FOUND:cross-einsatz-access`
 * mappen beide auf HTTP-404 mit identischem Response-Body — Defense-in-Depth
 * gegen ID-Injection-Leaks (AC1: nicht-existenz vs. fremder-einsatz ist für
 * den Angreifer ununterscheidbar).
 */
export const PATIENT_DETAIL_NOT_FOUND = 'PATIENT_NOT_FOUND:patient does not exist';
export const PATIENT_DETAIL_CROSS_EINSATZ_ACCESS = 'PATIENT_NOT_FOUND:cross-einsatz-access';

/**
 * Handler für `GetPatientDetailQuery` (Story 1.7, AC4).
 *
 * CQRS-Read-Side analog Stories 1.5/1.6:
 *  - Direkte Constructor-Injection statt CQRS-`QueryBus` (Konsistenz mit
 *    Patient-Command-Handlern). `@QueryHandler/QueryBus`-Konvertierung
 *    bleibt ein offener Folge-up (siehe Story 1.5 deferred-work).
 *  - Repository-Calls parallelisiert via `Promise.all`.
 *  - Defense-in-Depth-Check `patient.einsatzId === query.einsatzId` zusätzlich
 *    zum `EinsatzScopeGuard` (Pattern aus `korrigiere-patient.handler.ts`).
 *  - Cross-Einsatz-Zugriff wird identisch wie „Patient nicht gefunden"
 *    behandelt; nur der Logger-Eintrag dokumentiert die ID-Injection-Spur.
 */
@Injectable()
export class GetPatientDetailHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(LOGGER) private readonly logger: ILogger,
    private readonly patientDetailMapper: PatientDetailMapper,
  ) {}

  async execute(query: GetPatientDetailQuery): Promise<Result<PatientDetailDto>> {
    if (!query.einsatzId || query.einsatzId.trim().length === 0) {
      return Result.fail<PatientDetailDto>('Validation:EinsatzIdErforderlich');
    }
    if (!query.patientId || query.patientId.trim().length === 0) {
      return Result.fail<PatientDetailDto>('Validation:PatientIdErforderlich');
    }

    const patientIdResult = PatientId.create(query.patientId);
    if (patientIdResult.isFailure || !patientIdResult.value) {
      // Ungültige Patient-ID → identisch zu „nicht gefunden" behandeln (kein
      // Existenz-Leak, kein Sentinel-Detail im Response-Body).
      return Result.fail<PatientDetailDto>(PATIENT_DETAIL_NOT_FOUND);
    }

    const startedAt = Date.now();

    const [patient, eventsResult] = await Promise.all([this.patientRepository.findById(patientIdResult.value as PatientId), this.patientRepository.findEventsByPatientId(query.patientId)]);

    if (!patient) {
      return Result.fail<PatientDetailDto>(PATIENT_DETAIL_NOT_FOUND);
    }
    if (patient.einsatzId !== query.einsatzId) {
      // Defense-in-Depth: identische 404-Antwort wie nicht-existent — sonst
      // leakt die Antwort die Existenz des Patienten. Im Server-Log bleibt
      // der Cross-Einsatz-Marker, damit Operatoren ID-Injection-Versuche
      // erkennen können.
      this.logger.warn(`patient-detail-cross-einsatz-access-attempt einsatzIdQuery=${query.einsatzId} einsatzIdPatient=${patient.einsatzId} patientId=${query.patientId}`);
      return Result.fail<PatientDetailDto>(PATIENT_DETAIL_CROSS_EINSATZ_ACCESS);
    }
    if (eventsResult.isFailure) {
      // Repository-Detail nur in Server-Logs, niemals als Sentinel-Suffix nach
      // außen — sonst landen Prisma-Klartexte (Connection-Strings, Table-Namen)
      // im HTTP-Body.
      this.logger.error(`patient-detail-events-failed einsatz=${query.einsatzId} patient=${query.patientId} error=${eventsResult.error ?? 'unknown'}`);
      return Result.fail<PatientDetailDto>('Infrastructure:PatientEventsQueryFailed');
    }

    const dto = this.patientDetailMapper.toDto(patient, eventsResult.value!);

    const durationMs = Date.now() - startedAt;
    this.logger.log(`patient-detail-queried einsatz=${query.einsatzId} patient=${query.patientId} eventCount=${dto.events.length} durationMs=${durationMs}`);

    return Result.ok<PatientDetailDto>(dto);
  }
}
