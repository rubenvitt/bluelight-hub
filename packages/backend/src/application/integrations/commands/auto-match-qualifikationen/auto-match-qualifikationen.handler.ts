/**
 * AutoMatchQualifikationenHandler - Handler für automatisches Qualifikations-Matching.
 *
 * Verwendet Levenshtein-Distanz und exaktes Matching um externe
 * Qualifikationen automatisch auf interne Qualifikationen abzubilden.
 *
 * Story 7.2: HiOrg-Server Import - Qualifikations-Mapping
 *
 * @module application/integrations/commands/auto-match-qualifikationen
 */

import { Inject, Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { AUTO_MATCH_CONFIG, type IQualifikationMappingRepository, type AutoMatchType } from '@domain/integrations';
import type { IQualifikationRepository } from '@domain/kraefte/repositories/i-qualifikation.repository';
import type { Qualifikation } from '@domain/kraefte/aggregates/qualifikation.aggregate';
import { INTEGRATIONS, DI_TOKENS, LOGGER } from '@/infrastructure/di-tokens';
import type { ILogger } from '@domain/ports/i-logger.port';
import type { AutoMatchQualifikationenCommand } from './auto-match-qualifikationen.command';

/**
 * DTO für ein einzelnes Match-Ergebnis.
 */
export interface AutoMatchResultItemDto {
  /** Externer Qualifikations-Name */
  externalName: string;
  /** Gematchte Qualifikation-ID (null wenn kein Match) */
  matchedQualifikationId: string | null;
  /** Name der gematchten Qualifikation */
  matchedQualifikationName: string | null;
  /** Konfidenz-Score (0-100) */
  confidence: number;
  /** Match-Typ */
  matchType: AutoMatchType;
}

/**
 * DTO für die gesamte Auto-Match Response.
 */
export interface AutoMatchResultDto {
  /** Alle Match-Ergebnisse */
  matches: AutoMatchResultItemDto[];
  /** Anzahl erfolgreicher Matches */
  totalMatched: number;
  /** Anzahl ohne Match */
  totalUnmatched: number;
  /** Durchschnittliche Konfidenz der Matches */
  averageConfidence: number;
}

/**
 * Handler für AutoMatchQualifikationenCommand.
 */
@Injectable()
export class AutoMatchQualifikationenHandler {
  constructor(
    @Inject(LOGGER)
    private readonly logger: ILogger,
    @Inject(INTEGRATIONS.QUALIFIKATION_MAPPING_REPOSITORY)
    private readonly mappingRepository: IQualifikationMappingRepository,
    @Inject(DI_TOKENS.REPOSITORIES.QUALIFIKATION)
    private readonly qualifikationRepository: IQualifikationRepository,
  ) {}

  /**
   * Führt den Command aus.
   */
  async execute(command: AutoMatchQualifikationenCommand): Promise<Result<AutoMatchResultDto>> {
    this.logger.log(`Starting auto-match for ${command.source} by ${command.initiatedBy}`);

    // 1. Mappings laden (nur ungemappte wenn onlyUnmapped=true)
    const mappingsResult = command.onlyUnmapped ? await this.mappingRepository.findUnmapped(command.source) : await this.mappingRepository.findByExternalSource(command.source);

    if (mappingsResult.isFailure) {
      return Result.fail(mappingsResult.error ?? 'Fehler beim Laden der Mappings');
    }

    const mappings = mappingsResult.value ?? [];
    if (mappings.length === 0) {
      return Result.ok({
        matches: [],
        totalMatched: 0,
        totalUnmatched: 0,
        averageConfidence: 0,
      });
    }

    // 2. Alle aktiven Qualifikationen laden
    const qualsResult = await this.qualifikationRepository.findAll({ istAktiv: true });
    if (qualsResult.isFailure) {
      return Result.fail(qualsResult.error ?? 'Fehler beim Laden der Qualifikationen');
    }

    const qualifikationen = qualsResult.value ?? [];
    this.logger.log(`Matching ${mappings.length} external names against ${qualifikationen.length} qualifications`);

    // 3. Auto-Matching durchführen
    const results: AutoMatchResultItemDto[] = [];
    let totalConfidence = 0;
    let matchedCount = 0;

    for (const mapping of mappings) {
      const matchResult = this.findBestMatch(mapping.externalName, qualifikationen);
      results.push(matchResult);

      if (matchResult.matchedQualifikationId) {
        matchedCount++;
        totalConfidence += matchResult.confidence;

        // Update Mapping in DB
        const updatedMapping = mapping.updateAutoMatch(matchResult.matchedQualifikationId, matchResult.confidence);
        await this.mappingRepository.save(updatedMapping);
      }
    }

    const avgConfidence = matchedCount > 0 ? Math.round(totalConfidence / matchedCount) : 0;

    this.logger.log(`Auto-match completed: ${matchedCount}/${mappings.length} matched, avg confidence: ${avgConfidence}%`);

    return Result.ok({
      matches: results,
      totalMatched: matchedCount,
      totalUnmatched: mappings.length - matchedCount,
      averageConfidence: avgConfidence,
    });
  }

  /**
   * Findet das beste Match für einen externen Namen.
   */
  private findBestMatch(externalName: string, qualifikationen: Qualifikation[]): AutoMatchResultItemDto {
    const normalizedExternal = this.normalize(externalName);
    let bestMatch: {
      qualifikation: Qualifikation | null;
      confidence: number;
      matchType: AutoMatchType;
    } = {
      qualifikation: null,
      confidence: 0,
      matchType: 'NONE',
    };

    for (const qual of qualifikationen) {
      const normalizedName = this.normalize(qual.name);
      const normalizedAbkuerzung = this.normalize(qual.abkuerzung);

      // 1. Exakter Name-Match
      if (normalizedExternal === normalizedName) {
        return {
          externalName,
          matchedQualifikationId: qual.id.value,
          matchedQualifikationName: qual.name,
          confidence: AUTO_MATCH_CONFIG.EXACT_MATCH_SCORE,
          matchType: 'EXACT',
        };
      }

      // 2. Exakter Abkürzungs-Match
      if (normalizedExternal === normalizedAbkuerzung) {
        const confidence = AUTO_MATCH_CONFIG.EXACT_MATCH_SCORE;
        if (confidence > bestMatch.confidence) {
          bestMatch = { qualifikation: qual, confidence, matchType: 'SHORT_NAME' };
        }
        continue;
      }

      // 3. Levenshtein-Match auf Name
      const nameSimilarity = this.calculateSimilarity(normalizedExternal, normalizedName);
      if (nameSimilarity >= AUTO_MATCH_CONFIG.LEVENSHTEIN_THRESHOLD) {
        const confidence = Math.round(nameSimilarity * 100);
        if (confidence > bestMatch.confidence) {
          bestMatch = { qualifikation: qual, confidence, matchType: 'FUZZY' };
        }
      }

      // 4. Levenshtein-Match auf Abkürzung (mit Bonus)
      const abkuerzungSimilarity = this.calculateSimilarity(normalizedExternal, normalizedAbkuerzung);
      if (abkuerzungSimilarity >= AUTO_MATCH_CONFIG.LEVENSHTEIN_THRESHOLD) {
        const confidence = Math.round(abkuerzungSimilarity * 100) + AUTO_MATCH_CONFIG.SHORT_NAME_BONUS;
        if (confidence > bestMatch.confidence) {
          bestMatch = { qualifikation: qual, confidence: Math.min(100, confidence), matchType: 'SHORT_NAME' };
        }
      }
    }

    // Nur Matches über dem Minimum-Threshold zurückgeben
    if (bestMatch.confidence >= AUTO_MATCH_CONFIG.MIN_CONFIDENCE_FOR_SUGGESTION && bestMatch.qualifikation) {
      return {
        externalName,
        matchedQualifikationId: bestMatch.qualifikation.id.value,
        matchedQualifikationName: bestMatch.qualifikation.name,
        confidence: bestMatch.confidence,
        matchType: bestMatch.matchType,
      };
    }

    return {
      externalName,
      matchedQualifikationId: null,
      matchedQualifikationName: null,
      confidence: 0,
      matchType: 'NONE',
    };
  }

  /**
   * Normalisiert einen String für Vergleich.
   */
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Berechnet die Levenshtein-Ähnlichkeit zwischen zwei Strings.
   *
   * @returns Ähnlichkeit zwischen 0 und 1
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - distance / maxLength;
  }

  /**
   * Berechnet die Levenshtein-Distanz zwischen zwei Strings.
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Optimierung: Wenn ein String leer ist
    if (m === 0) return n;
    if (n === 0) return m;

    // Matrix erstellen und initialisieren
    const matrix: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));

    // Matrix füllen
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const deletion = (matrix[i - 1]?.[j] ?? 0) + 1;
        const insertion = (matrix[i]?.[j - 1] ?? 0) + 1;
        const substitution = (matrix[i - 1]?.[j - 1] ?? 0) + cost;
        matrix[i]![j] = Math.min(deletion, insertion, substitution);
      }
    }

    return matrix[m]?.[n] ?? 0;
  }
}
