import type { Einsatz as PrismaEinsatz, EinsatzStatus as PrismaEinsatzStatus, Prisma } from '@prisma/client';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { UserId } from '@domain/value-objects/user-id';
import { Address } from '@domain/value-objects/address';

/**
 * Typ-Definition für Einsatz Prisma-Daten mit allen benötigten Relationen.
 * Wird für toAggregate() verwendet.
 */
export type EinsatzWithRelations = PrismaEinsatz;

/**
 * Persistence-Daten Struktur für Prisma Upsert.
 * Enthält alle Felder die für CREATE/UPDATE benötigt werden.
 */
export interface EinsatzPersistenceData {
  id: string;
  alarmstichwort: string | null;
  einsatzort: string | null;
  beschreibung: string | null;
  status: PrismaEinsatzStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string | null;
  archivedAt: Date | null;
  archivedBy: string | null;
  // Felder die im Domain nicht existieren aber im Schema vorhanden sind
  alarmierungszeit: Date | null;
  einsatzleiter: string | null;
  metadata: Prisma.JsonValue | null;
}

/**
 * Statische Utility-Klasse für Domain ↔ Prisma Konvertierungen.
 *
 * Diese Klasse kapselt alle Mapping-Logik zwischen dem Einsatz Aggregate (Domain Layer)
 * und dem Prisma Einsatz Model (Infrastructure Layer).
 *
 * **Warum statische Klasse:**
 * - Keine Instanz-State benötigt (pure functions)
 * - Einfache Testbarkeit ohne DI
 * - Konsistent mit anderen Mappern im Projekt (PrismaEtbMapper)
 *
 * **Mapping-Herausforderungen:**
 * - `nummer` existiert NUR in Domain, NICHT in Prisma Schema
 * - `einsatzort` ist String in DB, Address Value Object in Domain
 * - `beschreibung` im Schema ↔ `bemerkung` in Domain
 * - `abgeschlossenAt` existiert NUR in Domain, NICHT in Prisma Schema
 *
 * **Design-Entscheidungen:**
 * - Address wird als JSON-String in einsatzort gespeichert (strukturiert)
 * - nummer wird bei Rekonstruktion NEU generiert (Domain-Only)
 * - abgeschlossenAt kann nicht aus DB rekonstruiert werden
 */
export class PrismaEinsatzMapper {
  /**
   * Konvertiert ein Einsatz Aggregate zu Prisma Persistence-Daten.
   *
   * Extrahiert alle Properties aus dem Aggregate und mappt sie auf das Prisma Schema.
   * Domain-Only Felder (nummer, abgeschlossenAt) werden NICHT persistiert.
   *
   * @param aggregate - Das Einsatz Aggregate
   * @param createdByUser - User-ID des Erstellers (für Audit Trail)
   * @param updatedByUser - Optional: User-ID des letzten Bearbeiters
   * @returns EinsatzPersistenceData für Prisma Upsert
   */
  static toPersistence(aggregate: Einsatz, createdByUser?: string, updatedByUser?: string): EinsatzPersistenceData {
    // Status Mapping: Domain VO → Prisma Enum String
    const status = PrismaEinsatzMapper.mapDomainStatusToPrisma(aggregate.status);

    // Address Serialization: Address VO → JSON String
    const einsatzortJson = PrismaEinsatzMapper.serializeAddress(aggregate.einsatzort);

    // archivedBy extrahieren falls archiviert
    // HINWEIS: Domain Aggregate speichert archivedBy nicht explizit als Property
    // Es kommt aus dem archive() Call - wir nutzen updatedByUser als Fallback
    const archivedBy = aggregate.archivedAt ? (updatedByUser ?? null) : null;

    return {
      id: aggregate.id.value,
      alarmstichwort: aggregate.alarmstichwort,
      einsatzort: einsatzortJson,
      beschreibung: aggregate.bemerkung ?? null, // Domain: bemerkung → DB: beschreibung
      status,
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
      createdBy: createdByUser ?? aggregate.createdBy.value,
      updatedBy: updatedByUser ?? null,
      archivedAt: aggregate.archivedAt ?? null,
      archivedBy,
      // Felder die aktuell nicht im Domain existieren - null Defaults
      alarmierungszeit: null,
      einsatzleiter: null,
      metadata: null,
    };
  }

  /**
   * Rekonstruiert ein Einsatz Aggregate aus Prisma-Daten.
   *
   * Nutzt Object.defineProperty() um private Fields des Aggregates zu setzen,
   * da der private Constructor nicht direkt aufgerufen werden kann.
   *
   * WICHTIG: Domain-Only Felder werden NEU generiert:
   * - nummer: Wird aus ID generiert (Format: "E{YEAR}-{ID-prefix}")
   * - abgeschlossenAt: Kann NICHT aus DB rekonstruiert werden (nicht im Schema)
   *
   * @param prismaData - Einsatz Daten aus Prisma findFirst/findUnique
   * @returns Vollständig rekonstruiertes Einsatz Aggregate
   * @throws Error wenn ID oder Status Validierung fehlschlägt
   */
  static toAggregate(prismaData: EinsatzWithRelations): Einsatz {
    // Step 1: Reconstruct Value Objects mit Validierung
    const einsatzIdResult = EinsatzId.create(prismaData.id);
    if (einsatzIdResult.isFailure) {
      throw new Error(`Invalid EinsatzId: ${einsatzIdResult.error}`);
    }
    const einsatzId = einsatzIdResult.value as EinsatzId;

    const createdByResult = UserId.create(prismaData.createdBy);
    if (createdByResult.isFailure) {
      throw new Error(`Invalid UserId for createdBy: ${createdByResult.error}`);
    }
    const createdBy = createdByResult.value as UserId;

    // Status Mapping: Prisma Enum String → Domain VO
    const status = PrismaEinsatzMapper.mapPrismaStatusToDomain(prismaData.status);

    // Address Deserialization: JSON String → Address VO (optional)
    const einsatzort = PrismaEinsatzMapper.deserializeAddress(prismaData.einsatzort);

    // Step 2: Generiere nummer aus ID (Domain-Only, nicht in DB)
    // Format: "E{YEAR}-{ID-8-chars}"
    const year = prismaData.createdAt.getFullYear();
    const nummer = `E${year}-${prismaData.id.substring(0, 8)}`;

    // Step 3: Erstelle Aggregate via Factory (validiert Constraints)
    const aggregateResult = Einsatz.create({
      alarmstichwort: prismaData.alarmstichwort ?? 'Unbekannt',
      createdBy,
      einsatzort,
      bemerkung: prismaData.beschreibung ?? undefined, // DB: beschreibung → Domain: bemerkung
    });

    if (aggregateResult.isFailure) {
      throw new Error(`Failed to create Einsatz aggregate: ${aggregateResult.error}`);
    }
    const aggregate = aggregateResult.value as Einsatz;

    // Step 4: Override private fields mit DB-Werten via Object.defineProperty
    // (Factory generiert neue Werte, wir brauchen die aus der DB)

    // _id (Factory generiert neue ID, wir wollen DB-ID)
    Object.defineProperty(aggregate, '_id', {
      value: einsatzId,
      writable: false,
      configurable: true,
    });

    // _nummer (Factory generiert neue nummer, wir wollen rekonstruierte)
    Object.defineProperty(aggregate, '_nummer', {
      value: nummer,
      writable: false,
      configurable: true,
    });

    // _status (Factory setzt ANGELEGT, wir wollen DB-Status)
    Object.defineProperty(aggregate, '_status', {
      value: status,
      writable: true,
      configurable: true,
    });

    // _archivedAt (Factory hat undefined, wir wollen DB-Wert)
    if (prismaData.archivedAt) {
      Object.defineProperty(aggregate, '_archivedAt', {
        value: prismaData.archivedAt,
        writable: true,
        configurable: true,
      });
    }

    // Timestamps (Factory setzt new Date(), wir wollen DB-Werte)
    Object.defineProperty(aggregate, '_createdAt', {
      value: prismaData.createdAt,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(aggregate, '_updatedAt', {
      value: prismaData.updatedAt,
      writable: true,
      configurable: true,
    });

    // Step 5: Clear transient State (darf nicht aus DB kommen)
    // Factory hat EinsatzCreatedEvent emittiert - das wollen wir nicht
    aggregate.clearDomainEvents();

    return aggregate;
  }

  /**
   * Serialisiert ein Address Value Object zu JSON-String für DB-Speicherung.
   *
   * @param address - Optional: Address Value Object
   * @returns JSON-String oder null wenn keine Address
   */
  private static serializeAddress(address?: Address): string | null {
    if (!address) return null;

    const addressData = {
      strasse: address.strasse,
      hausnummer: address.hausnummer,
      plz: address.plz,
      ort: address.ort,
    };

    return JSON.stringify(addressData);
  }

  /**
   * Deserialisiert JSON-String zu Address Value Object.
   *
   * @param json - JSON-String aus DB (einsatzort Feld) oder null
   * @returns Address Value Object oder undefined
   */
  private static deserializeAddress(json: string | null): Address | undefined {
    if (!json) return undefined;

    try {
      const data = JSON.parse(json);

      // Erstelle Address VO mit den deserialisierten Daten
      const addressResult = Address.create({
        strasse: data.strasse,
        hausnummer: data.hausnummer,
        plz: data.plz,
        ort: data.ort,
      });

      if (addressResult.isFailure) {
        // Bei ungültigen Daten (z.B. falsche PLZ) → undefined
        return undefined;
      }

      return addressResult.value as Address;
    } catch {
      // JSON Parse Fehler → undefined (graceful degradation)
      return undefined;
    }
  }

  /**
   * Mappt Domain EinsatzStatus Value Object zu Prisma Enum String.
   *
   * @param status - Domain EinsatzStatus Value Object
   * @returns Prisma EinsatzStatus Enum Wert
   */
  private static mapDomainStatusToPrisma(status: EinsatzStatus): PrismaEinsatzStatus {
    // Domain VO hat .value Property die den String-Wert enthält
    // Das stimmt 1:1 mit Prisma Enum überein
    return status.value as PrismaEinsatzStatus;
  }

  /**
   * Mappt Prisma EinsatzStatus Enum zu Domain Value Object.
   *
   * @param status - Prisma EinsatzStatus Enum Wert
   * @returns Domain EinsatzStatus Value Object
   * @throws Error wenn unbekannter Status
   */
  private static mapPrismaStatusToDomain(status: PrismaEinsatzStatus): EinsatzStatus {
    switch (status) {
      case 'ANGELEGT':
        return EinsatzStatus.ANGELEGT();
      case 'IN_BEARBEITUNG':
        return EinsatzStatus.IN_BEARBEITUNG();
      case 'ABGESCHLOSSEN':
        return EinsatzStatus.ABGESCHLOSSEN();
      case 'ARCHIVIERT':
        return EinsatzStatus.ARCHIVIERT();
      default:
        throw new Error(`Unknown EinsatzStatus: ${status}`);
    }
  }
}
