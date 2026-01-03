/**
 * GetQualifikationMappingsHandler - Handler für GetQualifikationMappingsQuery.
 *
 * Lädt alle Qualifikations-Mappings für eine externe Quelle.
 * Inkludiert Bluelight Hub Qualifikation-Details für gemappte Einträge.
 *
 * Story 7.2: HiOrg-Server Import - Qualifikations-Mapping
 *
 * @module application/integrations/queries/get-qualifikation-mappings
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import type { IQualifikationMappingRepository } from '@domain/integrations';
import type { IQualifikationRepository } from '@domain/kraefte/repositories/i-qualifikation.repository';
import { INTEGRATIONS } from '@/infrastructure/di-tokens';
import { DI_TOKENS } from '@/infrastructure/di-tokens';
import type { GetQualifikationMappingsQuery } from './get-qualifikation-mappings.query';
import type { QualifikationId } from '@domain/kraefte/value-objects/qualifikation-id';

/**
 * DTO für ein einzelnes Mapping mit Qualifikations-Details.
 */
export interface QualifikationMappingDto {
  /** Mapping ID */
  id: string;
  /** Externer Qualifikations-Name (z.B. "Gruppenführer") */
  externalName: string;
  /** Quelle (z.B. "HIORG_SERVER") */
  externalSource: string;
  /** Gemappte Qualifikation-ID (null wenn nicht gemappt) */
  qualifikationId: string | null;
  /** Name der gemappten Qualifikation (null wenn nicht gemappt) */
  qualifikationName: string | null;
  /** Abkürzung der gemappten Qualifikation (null wenn nicht gemappt) */
  qualifikationAbkuerzung: string | null;
  /** Wurde automatisch gemappt? */
  isAutoMatched: boolean;
  /** Konfidenz-Score (0-100) für Auto-Match */
  confidence: number | null;
  /** Erstellungszeitpunkt */
  createdAt: Date;
  /** Letztes Update */
  updatedAt: Date;
}

/**
 * DTO für die gesamte Mapping-Response.
 */
export interface QualifikationMappingsResponseDto {
  /** Alle Mappings */
  mappings: QualifikationMappingDto[];
  /** Gesamtzahl */
  total: number;
  /** Anzahl gemappter */
  mapped: number;
  /** Anzahl ungemappter */
  unmapped: number;
}

/**
 * Handler für GetQualifikationMappingsQuery.
 */
@Injectable()
export class GetQualifikationMappingsHandler {
  constructor(
    @Inject(INTEGRATIONS.QUALIFIKATION_MAPPING_REPOSITORY)
    private readonly mappingRepository: IQualifikationMappingRepository,
    @Inject(DI_TOKENS.REPOSITORIES.QUALIFIKATION)
    private readonly qualifikationRepository: IQualifikationRepository,
  ) {}

  /**
   * Führt die Query aus.
   */
  async execute(query: GetQualifikationMappingsQuery): Promise<Result<QualifikationMappingsResponseDto>> {
    // 1. Mappings laden
    const mappingsResult = query.onlyUnmapped ? await this.mappingRepository.findUnmapped(query.source) : await this.mappingRepository.findByExternalSource(query.source);

    if (mappingsResult.isFailure) {
      return Result.fail(mappingsResult.error ?? 'Fehler beim Laden der Mappings');
    }

    const mappings = mappingsResult.value ?? [];

    // 2. Qualifikation-IDs extrahieren für Batch-Load
    const qualifikationIds = mappings.filter((m) => m.qualifikationId !== null).map((m) => m.qualifikationId as string);

    // 3. Qualifikationen laden (Batch für Performance)
    const qualifikationMap = new Map<string, { name: string; abkuerzung: string }>();
    if (qualifikationIds.length > 0) {
      const qualIds = qualifikationIds.map((id) => ({ value: id }) as QualifikationId);
      const qualsResult = await this.qualifikationRepository.findByIds(qualIds);
      if (qualsResult.isSuccess && qualsResult.value) {
        for (const qual of qualsResult.value) {
          qualifikationMap.set(qual.id.value, {
            name: qual.name,
            abkuerzung: qual.abkuerzung,
          });
        }
      }
    }

    // 4. DTOs erstellen
    const mappingDtos: QualifikationMappingDto[] = mappings.map((m) => {
      const qualInfo = m.qualifikationId ? qualifikationMap.get(m.qualifikationId) : null;
      return {
        id: m.id,
        externalName: m.externalName,
        externalSource: m.externalSource,
        qualifikationId: m.qualifikationId,
        qualifikationName: qualInfo?.name ?? null,
        qualifikationAbkuerzung: qualInfo?.abkuerzung ?? null,
        isAutoMatched: m.isAutoMatched,
        confidence: m.confidence,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      };
    });

    // 5. Statistiken berechnen
    const countResult = await this.mappingRepository.count(query.source);
    const stats = countResult.isSuccess && countResult.value ? countResult.value : { total: mappings.length, mapped: 0, unmapped: mappings.length };

    return Result.ok({
      mappings: mappingDtos,
      total: stats.total,
      mapped: stats.mapped,
      unmapped: stats.unmapped,
    });
  }
}
