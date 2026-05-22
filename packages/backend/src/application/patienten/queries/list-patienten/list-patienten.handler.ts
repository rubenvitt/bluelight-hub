import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { PatientRepository } from '@domain/patienten/repositories/patient.repository';
import { LOGGER, PATIENT_REPOSITORY } from '@infrastructure/di-tokens';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';
import type { PatientListItemDto } from '../../dto/patient-list-item.dto';
import { PatientListItemMapper } from '../../mappers/patient-list-item.mapper';
import { ListPatientenQuery } from './list-patienten.query';

export interface ListPatientenHandlerResult {
  items: PatientListItemDto[];
  pagination: PaginationMetaDto;
}

/**
 * Handler für `ListPatientenQuery` (Story 1.6, AC1–AC5).
 *
 * CQRS-Read-Side — kein Event, keine Transaktion. Konsistent mit Story 1.5
 * (`GetPatientenKpisHandler`): `@Injectable()` plus Constructor-Injection im
 * Controller, **kein** QueryBus.
 *
 * Verantwortlich für:
 *  1. Repository-Aufruf `findManyByEinsatz`.
 *  2. Mapping der Persistenz-Rows auf `PatientListItemDto`.
 *  3. Berechnung der `PaginationMetaDto` aus `total` + Pagination-Input.
 *  4. Structured Logging des Resultats (Such-Latenz, Treffer-Anzahl).
 */
@Injectable()
export class ListPatientenHandler {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(LOGGER) private readonly logger: ILogger,
  ) {}

  async execute(query: ListPatientenQuery): Promise<Result<ListPatientenHandlerResult>> {
    const startedAt = Date.now();
    const result = await this.patientRepository.findManyByEinsatz(query.einsatzId, query.filters, query.sort, query.pagination);

    if (result.isFailure) {
      this.logger.error(`patienten-list-failed einsatz=${query.einsatzId} error=${result.error ?? 'unknown'}`);
      return Result.fail<ListPatientenHandlerResult>(result.error ?? 'Infrastructure:PatientListQueryFailed');
    }

    const { items: rows, total } = result.value!;
    const items = rows.map((row) => PatientListItemMapper.fromPersistence(row));

    const pagination = new PaginationMetaDto();
    pagination.page = query.pagination.page;
    pagination.pageSize = query.pagination.pageSize;
    pagination.total = total;
    pagination.totalPages = pagination.pageSize > 0 ? Math.ceil(total / pagination.pageSize) : 0;

    const durationMs = Date.now() - startedAt;
    this.logger.log(`patienten-list-queried einsatz=${query.einsatzId} total=${total} page=${pagination.page} pageSize=${pagination.pageSize} durationMs=${durationMs}`);

    return Result.ok<ListPatientenHandlerResult>({ items, pagination });
  }
}
