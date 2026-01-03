import type { Prisma, StammPerson as PrismaStammPerson, StammPersonQualifikation } from '@prisma/client';
import { StammPerson } from '@domain/kraefte/aggregates/stamm-person.aggregate';
import { Result } from '@domain/common/result';

/**
 * Prisma Entity mit eager-loaded Qualifikationen Relation.
 *
 * **Use Case:** Repository lädt StammPerson mit `include: { qualifikationen: true }`
 * um M:N Beziehung zu Qualifikationen zu hydratisieren.
 */
export type PrismaStammPersonWithRelations = PrismaStammPerson & {
  qualifikationen: StammPersonQualifikation[];
};

/**
 * Mapper zwischen Prisma StammPerson Entity und Domain Aggregate.
 *
 * **Hexagonal Architecture:** Übersetzt zwischen Infrastructure Layer (Prisma)
 * und Domain Layer (Aggregate). Hält die Domain Layer frei von Prisma-Typen.
 *
 * **KRITISCH: NULL → undefined Konvertierung!**
 * - Prisma gibt `null` für optionale Felder zurück (DB NULL)
 * - Domain Layer verwendet `undefined` (TypeScript Konvention)
 * - ALLE optionalen Felder müssen explizit konvertiert werden
 *
 * **M:N Junction Table Handling:**
 * - qualifikationen Relation wird zu qualifikationIds Array extrahiert
 * - Repository ist verantwortlich für Sync der Junction Table
 */
export class PrismaStammPersonMapper {
  /**
   * Mappt Domain Aggregate zu Prisma Persistence Data.
   *
   * **WICHTIG:** createdAt/updatedAt werden von Prisma automatisch verwaltet
   * und sind NICHT in diesem Return-Typ enthalten.
   * Diese Felder werden bei create/update durch Prisma @default() und @updatedAt gesetzt.
   *
   * **Optional Field Handling:**
   * - funkkenungBOS ist optional
   * - undefined → null für DB NULL (Prisma erwartet null statt undefined)
   * - archivedAt, archivedBy, updatedBy sind ebenfalls optional
   *
   * **Junction Table:** qualifikationIds werden NICHT hier gemappt,
   * sondern im Repository nach dem Upsert separat synchronisiert.
   *
   * @param aggregate - Das StammPerson Domain Aggregate
   * @returns {Prisma.StammPersonUncheckedCreateInput} Prisma-kompatibles Datenobjekt
   */
  static toPersistence(aggregate: StammPerson): Prisma.StammPersonUncheckedCreateInput {
    return {
      id: aggregate.id.value,
      vorname: aggregate.vorname,
      nachname: aggregate.nachname,
      personalnummer: aggregate.personalnummer,
      funkkenungBOS: aggregate.funkkenungBOS ?? null,
      archivedAt: aggregate.archivedAt ?? null,
      archivedBy: aggregate.archivedBy ?? null,
      createdBy: aggregate.createdBy,
      updatedBy: aggregate.updatedBy ?? null,
      // Story 7.2: Externe Integration Felder
      externalSource: aggregate.externalSource ?? null,
      externalId: aggregate.externalId ?? null,
      lastSyncAt: aggregate.lastSyncAt ?? null,
    };
  }

  /**
   * Mappt Prisma Entity zu Domain Aggregate (Hydration).
   *
   * **Error Handling (Result Pattern):** Diese Methode gibt Result<StammPerson> zurück
   * statt Exception zu werfen. Der Caller im Repository kann dann entscheiden,
   * ob ein Fehler bei der Rekonstitution ein Programming Error (throw) oder
   * ein Business Error (Result.fail) ist.
   *
   * **Erwartete Fehlerszenarien:**
   * - Fehlende Pflichtfelder (sollte durch DB Constraints verhindert werden)
   * - Dateninkonsistenz (z.B. ungültige ID-Formate)
   * - Ungültige Qualifikation-Referenzen (FK-Constraint sollte dies verhindern)
   *
   * **KRITISCH: NULL → undefined Konvertierung für ALLE optionalen Felder!**
   * - funkkenungBOS: string | null → string | undefined
   * - archivedAt: Date | null → Date | undefined
   * - archivedBy: string | null → string | undefined
   * - updatedBy: string | null → string | undefined
   *
   * **Warum Type Assertion `as T | null`?**
   * - Prisma typisiert optionale Felder als `T | null`
   * - TypeScript strict mode erkennt das, aber explizite Assertion macht es deutlich
   * - Verhindert Type-Inferenz-Bugs bei Prisma Schema Änderungen
   *
   * **M:N Junction Table Extraction:**
   * - entity.qualifikationen enthält Array von Junction Table Rows
   * - Wir extrahieren nur die qualifikationId für das Aggregate
   * - Aggregate speichert Array<string> statt komplexe Objekte
   *
   * @param entity - Prisma StammPerson Entity mit Qualifikationen Relation
   * @returns Result<StammPerson> - Success mit Aggregate oder Failure mit Fehlermeldung
   */
  static toDomain(entity: PrismaStammPersonWithRelations): Result<StammPerson> {
    const result = StammPerson.reconstitute({
      id: entity.id,
      vorname: entity.vorname,
      nachname: entity.nachname,
      personalnummer: entity.personalnummer,
      // KRITISCH: NULL → undefined für ALLE optionalen Felder!
      funkkenungBOS: (entity.funkkenungBOS as string | null) ?? undefined,
      archivedAt: (entity.archivedAt as Date | null) ?? undefined,
      archivedBy: (entity.archivedBy as string | null) ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy,
      updatedBy: (entity.updatedBy as string | null) ?? undefined,
      // Qualifikationen aus Junction Table extrahieren
      qualifikationIds: entity.qualifikationen?.map((q) => q.qualifikationId) ?? [],
      // Story 7.2: Externe Integration Felder
      externalSource: (entity.externalSource as string | null) ?? undefined,
      externalId: (entity.externalId as string | null) ?? undefined,
      lastSyncAt: (entity.lastSyncAt as Date | null) ?? undefined,
    });

    if (result.isFailure || !result.value) {
      // Dateninkonsistenz in DB - Caller entscheidet über Handling
      return Result.fail<StammPerson>(`Rekonstitution fehlgeschlagen: ${result.error ?? 'Unbekannter Fehler'}`);
    }

    return Result.ok<StammPerson>(result.value);
  }
}
