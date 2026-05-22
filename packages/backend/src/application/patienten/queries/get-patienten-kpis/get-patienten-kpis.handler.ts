import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import { LOGGER, PATIENT_REPOSITORY } from '@infrastructure/di-tokens';
import type { KpiAggregatDto } from '../../dto/kpi-aggregat.dto';
import { KpiAggregatMapper } from '../../mappers/kpi-aggregat.mapper';
import { GetPatientenKpisQuery } from './get-patienten-kpis.query';

/**
 * Handler für `GetPatientenKpisQuery` (Story 1.5, AC1).
 *
 * CQRS-Read-Side:
 *  - Kein Event, keine Mutation, keine Transaktion (direkter Repository-Zugriff).
 *  - `stand`-Timestamp **vor** dem Repository-Call erfassen — deterministisch
 *    zur Datenabfrage-Zeit (Story AC1).
 *  - Repository liefert `Result`, der hier unverändert weitergereicht oder
 *    in `KpiAggregatDto` gemappt wird.
 *
 * Direkte Constructor-Injection statt CQRS-QueryBus, konsistent mit den
 * Command-Handlern in `application/patienten/commands/*` (Story 1.2/1.3/1.4).
 */
@Injectable()
export class GetPatientenKpisHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  async execute(query: GetPatientenKpisQuery): Promise<Result<KpiAggregatDto>> {
    if (!query.einsatzId || query.einsatzId.trim().length === 0) {
      return Result.fail<KpiAggregatDto>('Validation:EinsatzIdErforderlich');
    }

    const stand = new Date().toISOString();
    const startedAt = Date.now();

    const countsResult = await this.patientRepository.getKpiCounts(query.einsatzId);
    if (countsResult.isFailure) {
      this.logger.error(`kpi-aggregat-failed einsatz=${query.einsatzId} error=${countsResult.error ?? 'unknown'}`);
      return Result.fail<KpiAggregatDto>(countsResult.error ?? 'Infrastructure:PatientKpiCountsFailed');
    }

    const dto = KpiAggregatMapper.fromCounts({ ...countsResult.value!, stand }, (msg) => this.logger.warn(`kpi-aggregat-mapper einsatz=${query.einsatzId} ${msg}`));

    const durationMs = Date.now() - startedAt;
    this.logger.log(`kpi-aggregat-computed einsatz=${query.einsatzId} total=${dto.totalPatienten} durationMs=${durationMs}`);

    return Result.ok<KpiAggregatDto>(dto);
  }
}
