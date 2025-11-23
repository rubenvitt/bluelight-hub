import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { EtbEintrag } from '@domain/entities/etb-eintrag.entity';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { EtbId } from '@domain/value-objects/etb-id';
import { EtbSequenceNumber } from '@domain/value-objects/etb-sequence-number';
import { EtbStatus } from '@domain/value-objects/etb-status';
import { EtbVersion } from '@domain/value-objects/etb-version';
import { UserId } from '@domain/value-objects/user-id';
import type { Einsatztagebuch, EtbEintrag as PrismaEtbEintrag, EtbStatus as PrismaEtbStatus } from '@prisma/client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Einsatztagebuch Type mit eager-loaded Eintraegen (fuer Aggregate Reconstruction).
 *
 * Diese Type Definition spiegelt das Prisma-Include-Pattern wider:
 * `prisma.einsatztagebuch.findUnique({ include: { eintraege: true } })`
 */
export type EinsatztagebuchWithEintraege = Einsatztagebuch & {
  eintraege: PrismaEtbEintrag[];
};

/**
 * Persistence Data fuer EtbEintrag (Prisma CreateInput ohne Relation).
 *
 * Wird fuer Repository-Operations verwendet (createMany/upsert).
 * Enthaelt nur Felder die vom Domain Layer bereitgestellt werden.
 *
 * Alias: PrismaEtbEintragData (fuer Kompatibilitaet mit Repository)
 */
export interface EtbEintragPersistenceData {
  id: string;
  etbId: string;
  sequenceNumber: number;
  text: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  // Default values fuer Prisma-Schema
  kategorie: 'LAGE'; // Default Kategorie (muss vom Repository gesetzt werden)
  timestamp: Date;
  version: number;
  isAutomatic: boolean;
}

/**
 * Persistence Data fuer Einsatztagebuch (Prisma Upsert Data).
 *
 * Enthaelt ETB-Felder und nested Eintraege fuer atomische Save-Operation.
 */
export interface EtbPersistenceData {
  etb: {
    id: string;
    einsatzId: string;
    status: PrismaEtbStatus;
    version: number;
    versionTimestamp: Date;
    nextSequenceNumber: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    updatedBy: string | null;
    lockedAt: Date | null;
    lockedBy: string | null;
  };
  eintraege: EtbEintragPersistenceData[];
}

/**
 * Alias fuer EtbEintragPersistenceData (Kompatibilitaet mit Repository).
 *
 * @deprecated Verwende EtbEintragPersistenceData stattdessen
 */
export type PrismaEtbEintragData = EtbEintragPersistenceData;

// ============================================================================
// EINTRAG MAPPER
// ============================================================================

/**
 * Mapper fuer EtbEintrag Entity <-> Prisma EtbEintrag Transformation.
 *
 * Diese Klasse implementiert bidirektionale Konvertierung zwischen:
 * - Domain Layer: EtbEintrag Entity mit Value Objects (EintragId, EtbSequenceNumber, UserId)
 * - Infrastructure Layer: Prisma EtbEintrag mit primitiven Typen
 *
 * **Soft-Delete Mapping:**
 * - Domain: isDeleted boolean Flag
 * - Prisma: deletedAt DateTime? (deletedAt !== null -> isDeleted = true)
 *
 * **Field Mapping:**
 * - Domain: EintragId.value -> Prisma: id (string)
 * - Domain: sequenceNumber.value -> Prisma: sequenceNumber (int)
 * - Domain: createdBy.value -> Prisma: createdBy (string)
 */
export class PrismaEintragMapper {
  /**
   * Konvertiert Prisma EtbEintrag zu Domain EtbEintrag Entity.
   *
   * Diese Methode rekonstruiert ein vollstaendiges EtbEintrag Entity aus der Datenbank.
   * Sie mappt primitive Prisma-Felder zu Domain Value Objects und behandelt
   * das Soft-Delete Pattern (deletedAt -> isDeleted).
   *
   * **Reconstruction Strategy:**
   * - Value Objects werden aus primitiven Werten rekonstruiert (EintragId, EtbSequenceNumber, UserId)
   * - Entity wird via Public Constructor erstellt
   * - Private Fields werden via Object.defineProperty() gesetzt (updatedAt, isDeleted)
   *
   * @param prismaEintrag - EtbEintrag von Prisma Query
   * @returns EtbEintrag Entity fuer Domain Layer
   * @throws Error wenn Value Object Creation fehlschlaegt
   *
   * @example
   * ```typescript
   * const prismaEintrag = await prisma.etbEintrag.findUnique({ where: { id: '...' } });
   * const domainEintrag = PrismaEintragMapper.toEntity(prismaEintrag);
   * console.log(domainEintrag.sequenceNumber.value); // 1
   * console.log(domainEintrag.isDeleted); // false
   * ```
   */
  static toEntity(prismaEintrag: PrismaEtbEintrag): EtbEintrag {
    // EintragId Reconstruction
    const idResult = EintragId.create(prismaEintrag.id);
    if (idResult.isFailure) {
      throw new Error(`Invalid EintragId: ${idResult.error}`);
    }
    const eintragId = idResult.value as EintragId;

    // SequenceNumber Reconstruction
    const seqResult = EtbSequenceNumber.create(prismaEintrag.sequenceNumber);
    if (seqResult.isFailure) {
      throw new Error(`Invalid SequenceNumber: ${seqResult.error}`);
    }
    const sequenceNumber = seqResult.value as EtbSequenceNumber;

    // UserId Reconstruction (createdBy)
    const userIdResult = UserId.create(prismaEintrag.createdBy);
    if (userIdResult.isFailure) {
      throw new Error(`Invalid UserId (createdBy): ${userIdResult.error}`);
    }
    const createdBy = userIdResult.value as UserId;

    // Create EtbEintrag via Public Constructor
    const eintrag = new EtbEintrag(eintragId, sequenceNumber, prismaEintrag.text, createdBy, prismaEintrag.createdAt);

    // Override private _updatedAt (Entity Constructor setzt dies nicht)
    if (prismaEintrag.updatedAt) {
      Object.defineProperty(eintrag, '_updatedAt', {
        value: prismaEintrag.updatedAt,
        writable: true,
        configurable: true,
      });
    }

    // Override private _isDeleted basierend auf deletedAt
    // Soft-Delete Mapping: deletedAt !== null -> isDeleted = true
    const isDeleted = prismaEintrag.deletedAt !== null;
    if (isDeleted) {
      Object.defineProperty(eintrag, '_isDeleted', {
        value: true,
        writable: true,
        configurable: true,
      });
    }

    return eintrag;
  }

  /**
   * Konvertiert Domain EtbEintrag Entity zu Prisma Persistence Data.
   *
   * Diese Methode bereitet ein EtbEintrag Entity fuer Prisma createMany/upsert vor.
   * Sie extrahiert Value Object Werte und mappt das Soft-Delete Pattern.
   *
   * **Soft-Delete Mapping:**
   * - Domain isDeleted=true -> Prisma deletedAt=new Date()
   * - Domain isDeleted=false -> Prisma deletedAt=null
   *
   * **Default Values:**
   * - kategorie: 'LAGE' (Standard-Kategorie fuer ETB Eintraege)
   * - timestamp: createdAt (Default falls nicht explizit gesetzt)
   * - version: 1 (Initial Version fuer neue Eintraege)
   * - isAutomatic: false (Manuelle Eintraege)
   *
   * @param eintrag - EtbEintrag Entity aus Domain Layer
   * @param etbId - ETB ID fuer Foreign Key Relation
   * @returns EtbEintragPersistenceData fuer Prisma Operations
   *
   * @example
   * ```typescript
   * const eintrag = new EtbEintrag(id, seqNum, 'Text', userId);
   * const persistData = PrismaEintragMapper.toPersistence(eintrag, 'etb-123');
   * await prisma.etbEintrag.createMany({ data: [persistData] });
   * ```
   */
  static toPersistence(eintrag: EtbEintrag, etbId: string): EtbEintragPersistenceData {
    return {
      id: eintrag.id.value,
      etbId,
      sequenceNumber: eintrag.sequenceNumber.value,
      text: eintrag.text,
      createdBy: eintrag.createdBy.value,
      createdAt: eintrag.createdAt,
      updatedAt: eintrag.updatedAt ?? eintrag.createdAt,
      // Soft-Delete Mapping: isDeleted -> deletedAt
      deletedAt: eintrag.isDeleted ? new Date() : null,
      deletedBy: null, // TODO: Track deletedBy in Domain Entity (Epic 4)
      // Default values fuer Prisma-Schema
      kategorie: 'LAGE', // Default Kategorie (Business Rule: alle Domain-Eintraege sind 'LAGE')
      timestamp: eintrag.createdAt, // timestamp = createdAt fuer konsistente Sortierung
      version: 1, // Initial version (Historie wird separat verwaltet)
      isAutomatic: false, // Domain-Eintraege sind manuell
    };
  }
}

// ============================================================================
// ETB MAPPER
// ============================================================================

/**
 * Mapper fuer EinsatztagebuchAggregate <-> Prisma Einsatztagebuch Transformation.
 *
 * Diese Klasse implementiert bidirektionale Konvertierung zwischen:
 * - Domain Layer: EinsatztagebuchAggregate mit EtbEintrag[] Collection
 * - Infrastructure Layer: Prisma Einsatztagebuch mit EtbEintrag[] Relation
 *
 * **AGGREGATE PATTERN:**
 * - EinsatztagebuchAggregate ist die Transactional Boundary
 * - EtbEintrag[] sind Child Entities innerhalb des Aggregates
 * - Aggregate Reconstruction erfordert eager loading von Eintraegen
 * - Save Operation erstellt/updated ETB + Eintraege atomisch
 *
 * **EINTRAEGE CASCADE STRATEGY:**
 * - Einfachheit ueber Effizienz: DELETE all Eintraege + CREATE all Eintraege
 * - Keine Delta-Berechnung (welche Eintraege changed/added/removed)
 * - Aggregate ist Source of Truth (alle Eintraege werden re-persisted)
 * - DB Performance: Batch DELETE + Batch CREATE (nicht N einzelne Updates)
 *
 * **STATUS MAPPING:**
 * - Domain EtbStatus Value Object <-> Prisma EtbStatus Enum
 * - 1:1 Mapping: DRAFT, ACTIVE, LOCKED
 *
 * **VERSIONIERUNG:**
 * - Domain EtbVersion Value Object -> Prisma version + versionTimestamp
 * - EtbVersion enthaelt versionNumber + timestamp
 *
 * @example
 * ```typescript
 * // Domain -> Prisma (Save)
 * const aggregate = EinsatztagebuchAggregate.create(einsatzId);
 * aggregate.addEintrag('Text', userId);
 * const prismaData = PrismaEtbMapper.toPersistence(aggregate);
 *
 * // Prisma -> Domain (Load)
 * const prismaEtb = await prisma.einsatztagebuch.findUnique({
 *   where: { id: '...' },
 *   include: { eintraege: true }
 * });
 * const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);
 * ```
 */
export class PrismaEtbMapper {
  /**
   * Konvertiert Prisma Einsatztagebuch (mit Eintraegen) zu Domain EinsatztagebuchAggregate.
   *
   * Diese Methode rekonstruiert das vollstaendige Aggregate aus der Datenbank.
   * Sie laedt alle Eintraege eager und konvertiert sie zu EtbEintrag Entities.
   *
   * **Aggregate Reconstruction:**
   * - EtbId aus prisma.id
   * - EinsatzId aus prisma.einsatzId
   * - EtbStatus aus prisma.status (via mapPrismaStatusToDomain)
   * - EtbVersion aus prisma.version + prisma.versionTimestamp
   * - Eintraege[] via PrismaEintragMapper.toEntity() fuer jeden Eintrag
   * - Timestamps aus prisma.createdAt/updatedAt
   *
   * **WICHTIG: Protected Constructor Bypass:**
   * - EinsatztagebuchAggregate.create() ist fuer neue Aggregates (generiert neue ID)
   * - Reconstruction benoetigt existierende ID + Timestamps aus DB
   * - Wir nutzen Object.defineProperty() um private Fields zu setzen
   *
   * **EINTRAEGE ORDER:**
   * - Eintraege werden nach sequenceNumber sortiert (chronologisch)
   * - Garantiert konsistente Reihenfolge unabhaengig von DB-Reihenfolge
   *
   * @param prisma - Einsatztagebuch mit eager-loaded Eintraegen
   * @returns EinsatztagebuchAggregate mit rekonstruierten EtbEintrag Entities
   * @throws Error wenn EtbId, EinsatzId oder EtbVersion invalid
   *
   * @example
   * ```typescript
   * const prismaEtb = await prisma.einsatztagebuch.findUnique({
   *   where: { id: etbId },
   *   include: { eintraege: true } // WICHTIG: eager load
   * });
   * const aggregate = PrismaEtbMapper.toAggregate(prismaEtb);
   * console.log(aggregate.eintraege.length); // Anzahl Eintraege
   * ```
   */
  static toAggregate(prisma: EinsatztagebuchWithEintraege): EinsatztagebuchAggregate {
    // EtbId Reconstruction
    const etbIdResult = EtbId.create(prisma.id);
    if (etbIdResult.isFailure) {
      throw new Error(`Invalid EtbId: ${etbIdResult.error}`);
    }
    const etbId = etbIdResult.value as EtbId;

    // EinsatzId Reconstruction
    const einsatzIdResult = EinsatzId.create(prisma.einsatzId);
    if (einsatzIdResult.isFailure) {
      throw new Error(`Invalid EinsatzId: ${einsatzIdResult.error}`);
    }
    const einsatzId = einsatzIdResult.value as EinsatzId;

    // EtbStatus Reconstruction (via mapping function)
    const status = PrismaEtbMapper.mapPrismaStatusToDomain(prisma.status);

    // EtbVersion Reconstruction
    const versionResult = EtbVersion.create(prisma.version);
    if (versionResult.isFailure) {
      throw new Error(`Invalid EtbVersion: ${versionResult.error}`);
    }
    const version = versionResult.value as EtbVersion;

    // Override version timestamp (EtbVersion.create() setzt new Date())
    Object.defineProperty(version, 'props', {
      value: {
        versionNumber: prisma.version,
        timestamp: prisma.versionTimestamp,
      },
      writable: false,
      configurable: true,
    });

    // Eintraege Reconstruction (via PrismaEintragMapper)
    // WICHTIG: Sort by sequenceNumber fuer chronologische Ordnung
    const eintraege = prisma.eintraege
      .slice() // Shallow copy um Original nicht zu mutieren
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map((prismaEintrag) => PrismaEintragMapper.toEntity(prismaEintrag));

    // Aggregate Reconstruction via create() + manual property override
    // HINWEIS: create() validiert einsatzId, wir ueberschreiben dann alle anderen Fields
    const aggregateResult = EinsatztagebuchAggregate.create(einsatzId);
    if (aggregateResult.isFailure) {
      throw new Error(`Failed to create aggregate: ${aggregateResult.error}`);
    }
    const aggregate = aggregateResult.value as EinsatztagebuchAggregate;

    // Override _id (create() generiert neue ID, wir wollen die aus DB)
    Object.defineProperty(aggregate, '_id', {
      value: etbId,
      writable: false,
      configurable: true,
    });

    // Override _status (create() setzt DRAFT, wir wollen den aus DB)
    Object.defineProperty(aggregate, '_status', {
      value: status,
      writable: true, // Status kann via lock() geaendert werden
      configurable: true,
    });

    // Override _eintraege (create() hat leeres Array, wir wollen die aus DB)
    Object.defineProperty(aggregate, '_eintraege', {
      value: eintraege,
      writable: true, // Eintraege koennen via addEintrag/deleteEintrag geaendert werden
      configurable: true,
    });

    // Override _version (create() setzt Version 1, wir wollen die aus DB)
    Object.defineProperty(aggregate, '_version', {
      value: version,
      writable: true, // Version wird bei jeder Mutation inkrementiert
      configurable: true,
    });

    // Override _nextSequenceNumber (create() setzt 1, wir wollen den aus DB)
    Object.defineProperty(aggregate, '_nextSequenceNumber', {
      value: prisma.nextSequenceNumber,
      writable: true, // Counter wird bei addEintrag inkrementiert
      configurable: true,
    });

    // Override Timestamps (create() setzt new Date(), wir wollen die aus DB)
    Object.defineProperty(aggregate, '_createdAt', {
      value: prisma.createdAt,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(aggregate, '_updatedAt', {
      value: prisma.updatedAt,
      writable: true, // updatedAt wird bei Mutations aktualisiert
      configurable: true,
    });

    // Clear Domain Events (Reconstruction sollte keine Events emittieren)
    aggregate.clearDomainEvents();

    // Clear Uncommitted Snapshots (Reconstruction sollte keine Snapshots haben)
    aggregate.clearSnapshots();

    return aggregate;
  }

  /**
   * Konvertiert Domain EinsatztagebuchAggregate zu Prisma Persistence Data.
   *
   * Diese Methode bereitet das Aggregate fuer Prisma Upsert vor.
   * Sie extrahiert ETB-Felder und Eintraege-Collection.
   *
   * **EINTRAEGE CASCADE STRATEGY:**
   * - ALLE Eintraege werden als Persistence Data zurueckgegeben
   * - Caller muss existierende Eintraege loeschen bevor Create (DELETE + CREATE Pattern)
   * - Keine Delta-Berechnung (Simplicity ueber Effizienz)
   *
   * **STATUS MAPPING:**
   * - Domain EtbStatus -> Prisma EtbStatus via mapDomainStatusToPrisma()
   *
   * **LOCK FIELDS:**
   * - lockedAt/lockedBy werden gesetzt wenn Status=LOCKED
   * - Aktuell: Domain trackt diese nicht explizit (TODO: Epic 4)
   *
   * @param aggregate - EinsatztagebuchAggregate aus Domain Layer
   * @param createdBy - User ID des Erstellers (fuer neue ETBs)
   * @param updatedBy - Optional: User ID des Bearbeiters (fuer Updates)
   * @returns EtbPersistenceData mit ETB-Feldern und Eintraege-Array
   *
   * @example
   * ```typescript
   * const aggregate = EinsatztagebuchAggregate.create(einsatzId);
   * aggregate.addEintrag('Text', userId);
   *
   * const persistData = PrismaEtbMapper.toPersistence(aggregate, 'user-123');
   *
   * // Usage in Repository:
   * await prisma.etbEintrag.deleteMany({ where: { etbId } }); // DELETE old
   * await prisma.einsatztagebuch.upsert({
   *   where: { id: aggregate.id.value },
   *   create: { ...persistData.etb, einsatz: { connect: { id: einsatzId } } },
   *   update: { ...persistData.etb }
   * });
   * await prisma.etbEintrag.createMany({ data: persistData.eintraege }); // CREATE new
   * ```
   */
  static toPersistence(aggregate: EinsatztagebuchAggregate, createdBy: string, updatedBy?: string): EtbPersistenceData {
    // Status Mapping (Domain -> Prisma)
    const status = PrismaEtbMapper.mapDomainStatusToPrisma(aggregate.status);

    // Lock Fields (gesetzt wenn Status=LOCKED)
    const isLocked = aggregate.isLocked();
    const lockedAt = isLocked ? new Date() : null;
    const lockedBy = isLocked && updatedBy ? updatedBy : null;

    // Eintraege Conversion (via PrismaEintragMapper)
    const eintraegeData = aggregate.eintraege.map((eintrag) => PrismaEintragMapper.toPersistence(eintrag, aggregate.id.value));

    return {
      etb: {
        id: aggregate.id.value,
        einsatzId: aggregate.einsatzId.value,
        status,
        version: aggregate.version.versionNumber,
        versionTimestamp: aggregate.version.timestamp,
        nextSequenceNumber: PrismaEtbMapper.getNextSequenceNumber(aggregate),
        createdAt: aggregate.createdAt,
        updatedAt: aggregate.updatedAt,
        createdBy,
        updatedBy: updatedBy ?? null,
        lockedAt,
        lockedBy,
      },
      eintraege: eintraegeData,
    };
  }

  /**
   * Mappt Prisma EtbStatus Enum zu Domain EtbStatus Value Object.
   *
   * Diese Methode konvertiert Prisma Enum-Strings zu Domain Value Objects.
   * Sie wird bei Aggregate Reconstruction verwendet.
   *
   * **Mapping Table:**
   * - DRAFT (Prisma) -> EtbStatus.DRAFT() (Domain)
   * - ACTIVE (Prisma) -> EtbStatus.ACTIVE() (Domain)
   * - LOCKED (Prisma) -> EtbStatus.LOCKED() (Domain)
   *
   * **Fallback:**
   * - Unbekannte Status werden zu DRAFT gemapped (defensive programming)
   *
   * @param status - Prisma EtbStatus Enum String
   * @returns EtbStatus Value Object
   */
  private static mapPrismaStatusToDomain(status: PrismaEtbStatus): EtbStatus {
    switch (status) {
      case 'DRAFT':
        return EtbStatus.DRAFT();
      case 'ACTIVE':
        return EtbStatus.ACTIVE();
      case 'LOCKED':
        return EtbStatus.LOCKED();
      default:
        // Fallback fuer unbekannte Status (sollte nie passieren bei validem Schema)
        return EtbStatus.DRAFT();
    }
  }

  /**
   * Mappt Domain EtbStatus Value Object zu Prisma EtbStatus Enum.
   *
   * Diese Methode konvertiert Domain Value Objects zu Prisma Enum-Strings.
   * Sie wird bei Persistence verwendet.
   *
   * **Mapping Table:**
   * - EtbStatus.DRAFT() (Domain) -> 'DRAFT' (Prisma)
   * - EtbStatus.ACTIVE() (Domain) -> 'ACTIVE' (Prisma)
   * - EtbStatus.LOCKED() (Domain) -> 'LOCKED' (Prisma)
   *
   * @param status - EtbStatus Value Object
   * @returns Prisma EtbStatus Enum String
   * @throws Error wenn Status nicht gemapped werden kann (Programmierfehler)
   */
  private static mapDomainStatusToPrisma(status: EtbStatus): PrismaEtbStatus {
    const value = status.value;
    if (value === 'DRAFT' || value === 'ACTIVE' || value === 'LOCKED') {
      return value as PrismaEtbStatus;
    }
    throw new Error(`Unmapped EtbStatus: ${value}`);
  }

  /**
   * Extrahiert nextSequenceNumber aus dem Aggregate.
   *
   * Da _nextSequenceNumber private ist und kein public getter existiert,
   * nutzen wir einen Workaround: Berechnung aus eintraege.length + 1
   * ODER direkter Zugriff via Type Assertion.
   *
   * **Berechnung:**
   * - Wenn eintraege vorhanden: max(sequenceNumber) + 1
   * - Wenn keine eintraege: 1
   *
   * @param aggregate - EinsatztagebuchAggregate
   * @returns Naechste Sequenznummer
   */
  private static getNextSequenceNumber(aggregate: EinsatztagebuchAggregate): number {
    // Direkter Zugriff auf private field (unsafe but necessary for mapper)
    // biome-ignore lint/suspicious/noExplicitAny: Mapper benoetigt Zugriff auf private field
    const nextSeq = (aggregate as any)._nextSequenceNumber;
    if (typeof nextSeq === 'number' && nextSeq >= 1) {
      return nextSeq;
    }

    // Fallback: Berechnung aus eintraege
    const eintraege = aggregate.eintraege;
    if (eintraege.length === 0) {
      return 1;
    }
    const maxSeq = Math.max(...eintraege.map((e) => e.sequenceNumber.value));
    return maxSeq + 1;
  }
}
