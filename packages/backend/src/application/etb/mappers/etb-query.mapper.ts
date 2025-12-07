import type { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import type { EtbEintrag } from '@domain/entities/etb-eintrag.entity';
import type { EtbSnapshot, EtbEintragSnapshot } from '@domain/value-objects/etb-snapshot';
import type { EtbDto } from '@application/etb/dto/etb.dto';
import type { EintragDto } from '@application/etb/dto/eintrag.dto';
import type { EtbVersionDto } from '@application/etb/dto/etb-version.dto';

// Re-export DTOs from dto/ for consumers (backwards compatibility)
export type { EtbDto, EintragDto, EtbVersionDto };

/**
 * DTO fuer einen ETB-Eintrag im Snapshot.
 *
 * **WICHTIG:** Dieses Interface ist NICHT identisch mit EintragDto!
 * - EintragDto: createdAt/updatedAt sind Date-Objekte
 * - EtbEintragSnapshotDto: createdAt/updatedAt sind ISO 8601 Strings
 *
 * Der Unterschied kommt daher, dass Snapshots im Domain Layer bereits
 * serialisiert gespeichert werden (EtbEintragSnapshot aus value-objects).
 */
export interface EtbEintragSnapshotDto {
  /** EintragId als String */
  id: string;
  /** Sequenznummer */
  sequenceNumber: number;
  /** Textinhalt */
  text: string;
  /** UserId des Erstellers */
  createdBy: string;
  /** Creation timestamp als ISO 8601 String */
  createdAt: string;
  /** Optional: Update timestamp als ISO 8601 String */
  updatedAt?: string;
  /** Soft-Delete Flag */
  isDeleted: boolean;
}

/**
 * DTO fuer einen ETB-Snapshot.
 *
 * **WICHTIG:** Verwendet EtbEintragSnapshotDto (String-Timestamps),
 * NICHT EintragDto (Date-Timestamps). Das entspricht dem Domain-Snapshot-Format.
 */
export interface EtbSnapshotDto {
  /** Versionsnummer zum Zeitpunkt des Snapshots */
  version: number;
  /** Zeitpunkt der Snapshot-Erstellung */
  snapshotAt: Date;
  /** Array aller Eintraege im Snapshot (mit String-Timestamps!) */
  eintraege: EtbEintragSnapshotDto[];
}

/**
 * Query Mapper fuer ETB Domain → DTO Transformation.
 *
 * Diese Klasse trennt die Domain-Schicht (EinsatztagebuchAggregate mit Business Logic)
 * von der API-Schicht (DTOs als reine Daten-Objekte). Die Transformation
 * erfolgt rein funktional ohne Dependencies.
 *
 * **Warum separater Mapper statt direkter Serialisierung:**
 * - Versionierung: API-Struktur kann unabhaengig von Domain evolvieren
 * - Projektion: Nur API-relevante Felder werden exportiert (keine Domain Events)
 * - Security: Interne Domain-Details bleiben verborgen
 * - Testbarkeit: Mapper koennen isoliert ohne Domain-Logik getestet werden
 *
 * **Pattern:**
 * - Pure Functions: Kein State, keine Side Effects, keine Dependencies
 * - Immutable Input: Aggregates werden nicht modifiziert
 * - Static Methods: Keine Instanziierung notwendig
 *
 * @example
 * ```typescript
 * // ETB Aggregate zu DTO konvertieren
 * const dto = EtbQueryMapper.toEtbDto(etbAggregate);
 *
 * // Mit soft-deleted Eintraegen
 * const dtoWithDeleted = EtbQueryMapper.toEtbDto(etbAggregate, true);
 *
 * // Einzelnen Eintrag konvertieren
 * const eintragDto = EtbQueryMapper.toEintragDto(eintrag);
 *
 * // Snapshot konvertieren
 * const snapshotDto = EtbQueryMapper.toSnapshotDto(snapshot);
 * ```
 */
export class EtbQueryMapper {
  /**
   * Konvertiert ein EinsatztagebuchAggregate zu einem EtbDto.
   *
   * Diese Transformation trennt die Domain-Schicht von der API-Schicht,
   * damit interne Aenderungen am Aggregate die API-Struktur nicht brechen.
   *
   * Die Eintraege werden basierend auf dem `includeDeleted` Parameter gefiltert.
   * Standardmaessig werden soft-deleted Eintraege ausgeschlossen (false).
   *
   * **Edge Cases:**
   * - Null/Undefined Aggregate: Wirft TypeError (Caller muss validieren)
   * - Leere Eintraege-Liste: Gibt leeres Array zurueck
   * - Locked Status: lockedAt/lockedBy sind undefined (nicht im Aggregate gespeichert)
   *
   * @param aggregate - Das zu konvertierende EinsatztagebuchAggregate
   * @param includeDeleted - Ob soft-deleted Eintraege inkludiert werden sollen (default: false)
   * @returns EtbDto fuer API-Response
   */
  static toEtbDto(aggregate: EinsatztagebuchAggregate, includeDeleted = false): EtbDto {
    // Filter Eintraege basierend auf includeDeleted Parameter
    const filteredEintraege = includeDeleted ? aggregate.eintraege : aggregate.eintraege.filter((e) => !e.isDeleted);

    // Map Eintraege zu DTOs
    const eintraegeDtos = filteredEintraege.map((eintrag) => EtbQueryMapper.toEintragDto(eintrag));

    // Status als typisierter String (DRAFT, ACTIVE, LOCKED)
    const status = aggregate.status.value as 'DRAFT' | 'ACTIVE' | 'LOCKED';

    // Base DTO ohne Lock-Informationen
    const dto: EtbDto = {
      id: aggregate.id.value,
      einsatzId: aggregate.einsatzId.value,
      status,
      eintraege: eintraegeDtos,
      version: {
        versionNumber: aggregate.version.versionNumber,
        timestamp: aggregate.version.timestamp,
      },
      createdAt: aggregate.createdAt,
    };

    // Lock-Informationen werden nicht aus dem Aggregate extrahiert,
    // da sie dort nicht gespeichert sind. Diese wuerden typischerweise
    // beim Reconstitute aus der Datenbank kommen (Epic 4).
    // lockedAt und lockedBy bleiben undefined.

    return dto;
  }

  /**
   * Konvertiert ein EtbEintrag Entity zu einem EintragDto.
   *
   * Diese Methode mappt alle relevanten Properties vom Domain Entity
   * auf das DTO-Format mit primitiven Typen fuer JSON-Serialisierung.
   *
   * **Mapping-Details:**
   * - Value Objects (id, sequenceNumber, createdBy) werden auf ihre primitiven Werte gemappt
   * - Dates werden als Date-Objekte beibehalten (JSON.stringify serialisiert zu ISO-String)
   * - Optional fields (updatedAt) werden nur gesetzt wenn vorhanden
   *
   * **Limitierung:**
   * Die Domain-Entity enthaelt nicht alle Prisma-Properties (z.B. timestamp, funkrufname, standort).
   * Diese werden mit Default-Werten befuellt. Fuer vollstaendige DTOs sollte ein
   * separater Prisma-Query-Mapper verwendet werden (CQRS Read-Side Optimierung).
   *
   * @param eintrag - Das zu konvertierende EtbEintrag Entity
   * @returns EintragDto fuer API-Response (mit Default-Werten fuer nicht-verfuegbare Properties)
   */
  static toEintragDto(eintrag: EtbEintrag): EintragDto {
    const dto: EintragDto = {
      id: eintrag.id.value,
      sequenceNumber: eintrag.sequenceNumber.value,
      kategorie: eintrag.kategorie.value,
      text: eintrag.text,
      // Fachlicher Zeitstempel: Default = createdAt (Domain hat kein separates timestamp-Feld)
      timestamp: eintrag.createdAt,
      // Optionale Properties: Domain-Entity hat diese nicht, Defaults = null
      funkrufname: null,
      standort: null,
      // Versionsnummer: Default = 1 (Domain trackt Version nicht auf Entity-Ebene)
      version: 1,
      // Automatisch-Flag: Default = false (Domain-Eintraege sind manuell)
      isAutomatic: false,
      createdBy: eintrag.createdBy.value,
      createdAt: eintrag.createdAt,
      // updatedBy: Domain-Entity trackt nur createdBy (kein updatedBy)
      updatedBy: null,
      isDeleted: eintrag.isDeleted,
      // Soft-Delete Properties: Domain hat deletedAt nicht explizit
      deletedAt: eintrag.isDeleted ? (eintrag.updatedAt ?? null) : null,
      deletedBy: null, // Domain trackt deletedBy nicht
      deleterUsername: null, // Benoetigt User-Join (nur via Prisma verfuegbar)
    };

    // Optional: updatedAt nur setzen wenn vorhanden
    if (eintrag.updatedAt !== undefined) {
      dto.updatedAt = eintrag.updatedAt;
    }

    // Optional: metadata nur setzen wenn vorhanden
    if (eintrag.metadata !== undefined) {
      dto.metadata = eintrag.metadata;
    }

    return dto;
  }

  /**
   * Konvertiert einen EtbSnapshot zu einem EtbSnapshotDto.
   *
   * Snapshots enthalten bereits serialisierbare Daten (EtbEintragSnapshot),
   * daher ist das Mapping straightforward. Die Eintraege werden als
   * Deep Copy uebernommen um Mutation-Safety zu garantieren.
   *
   * **Hinweis:**
   * Die Eintraege im Snapshot sind bereits im EtbEintragSnapshot-Format
   * (primitive Typen) und muessen nicht weiter transformiert werden.
   *
   * @param snapshot - Der zu konvertierende EtbSnapshot
   * @returns EtbSnapshotDto fuer API-Response
   */
  static toSnapshotDto(snapshot: EtbSnapshot): EtbSnapshotDto {
    return {
      version: snapshot.versionNumber,
      snapshotAt: snapshot.snapshotAt,
      // Deep copy der Eintraege fuer Mutation-Safety
      eintraege: snapshot.eintraege.map((e: EtbEintragSnapshot) => ({
        id: e.id,
        sequenceNumber: e.sequenceNumber,
        text: e.text,
        createdBy: e.createdBy,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        isDeleted: e.isDeleted,
      })),
    };
  }
}
