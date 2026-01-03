/**
 * QualifikationMapping Entity - Mapping externer Qualifikations-Namen auf interne Qualifikationen.
 *
 * Story 7.2: HiOrg-Server Import - Qualifikations-Mapping
 *
 * Diese Entity repräsentiert ein Mapping zwischen externen Qualifikations-Namen (z.B. "Gruppenführer"
 * in HiOrg-Server) und internen Qualifikation-Aggregates.
 *
 * **Features:**
 * - Automatisches Matching via Levenshtein-Distanz mit Confidence Score
 * - Manuelles Überschreiben von Auto-Matches
 * - Audit-Trail für Nachvollziehbarkeit
 *
 * @module domain/integrations/entities
 */

import { Result } from '@domain/common/result';
import type { IntegrationType } from './integration-credential.entity';

/**
 * Properties für QualifikationMapping Entity.
 */
export interface QualifikationMappingProps {
  /** Eindeutige ID (CUID) */
  id: string;
  /** Name der Qualifikation im externen System (z.B. "Gruppenführer") */
  externalName: string;
  /** Quelle des Mappings (z.B. "HIORG_SERVER") */
  externalSource: IntegrationType;
  /** ID der internen Qualifikation (null = nicht gemappt) */
  qualifikationId: string | null;
  /** Wurde automatisch via Levenshtein/exaktem Match gefunden? */
  isAutoMatched: boolean;
  /** Konfidenz-Score (0-100) für Auto-Match */
  confidence: number | null;
  /** Erstellungszeitpunkt */
  createdAt: Date;
  /** Letztes Update */
  updatedAt: Date;
  /** Erstellt von (User ID, optional bei Auto-Import) */
  createdBy: string | null;
  /** Aktualisiert von (User ID) */
  updatedBy: string | null;
}

/**
 * DTO für Erstellung eines neuen Mappings.
 */
export interface CreateMappingDto {
  externalName: string;
  externalSource: IntegrationType;
  qualifikationId?: string | null;
  isAutoMatched?: boolean;
  confidence?: number | null;
  createdBy?: string | null;
}

/**
 * DTO für Update eines Mappings.
 */
export interface UpdateMappingDto {
  qualifikationId: string | null;
  updatedBy: string;
}

/**
 * QualifikationMapping Domain Entity.
 *
 * **Verwendung:**
 * ```typescript
 * // Auto-Match erstellen
 * const mappingResult = QualifikationMapping.create({
 *   externalName: 'Gruppenführer',
 *   externalSource: INTEGRATION_TYPES.HIORG_SERVER,
 *   qualifikationId: 'grfue-id',
 *   isAutoMatched: true,
 *   confidence: 95,
 * });
 *
 * // Manuelles Mapping aktualisieren
 * const updated = mapping.updateMapping({
 *   qualifikationId: 'new-qual-id',
 *   updatedBy: userId,
 * });
 * ```
 */
export class QualifikationMapping {
  private constructor(private readonly props: QualifikationMappingProps) {}

  // === Getters ===

  get id(): string {
    return this.props.id;
  }

  get externalName(): string {
    return this.props.externalName;
  }

  get externalSource(): IntegrationType {
    return this.props.externalSource;
  }

  get qualifikationId(): string | null {
    return this.props.qualifikationId;
  }

  get isAutoMatched(): boolean {
    return this.props.isAutoMatched;
  }

  get confidence(): number | null {
    return this.props.confidence;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get createdBy(): string | null {
    return this.props.createdBy;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy;
  }

  /**
   * Prüft ob dieses Mapping auf eine interne Qualifikation verweist.
   */
  get isMapped(): boolean {
    return this.props.qualifikationId !== null;
  }

  // === Factory Methods ===

  /**
   * Erstellt ein neues QualifikationMapping.
   *
   * @param dto - Create DTO mit Mapping-Daten
   * @returns Result mit neuer Entity oder Fehler
   */
  static create(dto: CreateMappingDto): Result<QualifikationMapping> {
    // Validierung
    if (!dto.externalName || dto.externalName.trim().length === 0) {
      return Result.fail('External name darf nicht leer sein');
    }

    if (dto.externalName.length > 200) {
      return Result.fail('External name darf maximal 200 Zeichen lang sein');
    }

    if (!dto.externalSource) {
      return Result.fail('External source ist erforderlich');
    }

    // Confidence Validierung (wenn gesetzt)
    if (dto.confidence !== undefined && dto.confidence !== null) {
      if (dto.confidence < 0 || dto.confidence > 100) {
        return Result.fail('Confidence muss zwischen 0 und 100 liegen');
      }
    }

    const now = new Date();
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 25); // CUID-ähnlich

    return Result.ok(
      new QualifikationMapping({
        id,
        externalName: dto.externalName.trim(),
        externalSource: dto.externalSource,
        qualifikationId: dto.qualifikationId ?? null,
        isAutoMatched: dto.isAutoMatched ?? false,
        confidence: dto.confidence ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: dto.createdBy ?? null,
        updatedBy: null,
      }),
    );
  }

  /**
   * Rekonstituiert ein QualifikationMapping aus der Persistenz.
   *
   * @param props - Vollständige Properties aus der Datenbank
   * @returns Result mit rekonstituierter Entity
   */
  static reconstitute(props: QualifikationMappingProps): Result<QualifikationMapping> {
    return Result.ok(new QualifikationMapping(props));
  }

  // === Mutation Methods ===

  /**
   * Aktualisiert das Qualifikations-Mapping.
   *
   * Bei manuellem Update wird isAutoMatched auf false gesetzt und confidence gelöscht.
   *
   * @param dto - Update DTO mit neuer Qualifikation-ID
   * @returns Neue Entity-Instanz mit aktualisiertem Mapping
   */
  updateMapping(dto: UpdateMappingDto): QualifikationMapping {
    return new QualifikationMapping({
      ...this.props,
      qualifikationId: dto.qualifikationId,
      // Manuelles Update → kein Auto-Match mehr
      isAutoMatched: false,
      confidence: null,
      updatedAt: new Date(),
      updatedBy: dto.updatedBy,
    });
  }

  /**
   * Aktualisiert das Mapping via Auto-Match.
   *
   * Behält den Auto-Match-Status bei und aktualisiert den Confidence Score.
   *
   * @param qualifikationId - Gematchte Qualifikation-ID
   * @param confidence - Confidence Score (0-100)
   * @returns Neue Entity-Instanz mit aktualisiertem Mapping
   */
  updateAutoMatch(qualifikationId: string | null, confidence: number): QualifikationMapping {
    return new QualifikationMapping({
      ...this.props,
      qualifikationId,
      isAutoMatched: true,
      confidence: Math.min(100, Math.max(0, Math.round(confidence))),
      updatedAt: new Date(),
    });
  }

  /**
   * Entfernt das aktuelle Mapping (setzt qualifikationId auf null).
   *
   * @param updatedBy - User der das Mapping entfernt
   * @returns Neue Entity-Instanz ohne Mapping
   */
  clearMapping(updatedBy: string): QualifikationMapping {
    return new QualifikationMapping({
      ...this.props,
      qualifikationId: null,
      isAutoMatched: false,
      confidence: null,
      updatedAt: new Date(),
      updatedBy,
    });
  }

  /**
   * Gibt die Entity-Properties für Persistenz zurück.
   */
  toPersistence(): QualifikationMappingProps {
    return { ...this.props };
  }
}

/**
 * Match-Typ für Auto-Matching Ergebnisse.
 */
export type AutoMatchType = 'EXACT' | 'FUZZY' | 'SHORT_NAME' | 'NONE';

/**
 * Konfiguration für Auto-Matching.
 */
export const AUTO_MATCH_CONFIG = {
  /** Exakter Match hat höchste Priorität */
  EXACT_MATCH_SCORE: 100,
  /** Levenshtein-Schwellenwert: 85% Ähnlichkeit erforderlich */
  LEVENSHTEIN_THRESHOLD: 0.85,
  /** Kurzname-Match Bonus */
  SHORT_NAME_BONUS: 10,
  /** Minimum Confidence für Auto-Match Vorschlag */
  MIN_CONFIDENCE_FOR_SUGGESTION: 70,
  /** Confidence unter der eine Warnung angezeigt wird */
  WARNING_CONFIDENCE_THRESHOLD: 90,
} as const;

/**
 * Ergebnis eines Auto-Match Versuchs.
 */
export interface AutoMatchResult {
  externalName: string;
  matchedQualifikationId: string | null;
  matchedQualifikationName: string | null;
  confidence: number;
  matchType: AutoMatchType;
}
