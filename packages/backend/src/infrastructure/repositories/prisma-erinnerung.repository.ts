import { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { TransactionContext } from '@domain/common/transaction';
import { Erinnerung } from '@domain/entities/erinnerung.entity';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { PrismaClient } from '@/generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { Result } from '@domain/common/result';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaErinnerungMapper } from './mappers/prisma-erinnerung.mapper';

/**
 * Prisma Implementation des IErinnerungRepository (Hexagonal Architecture).
 *
 * Diese Klasse implementiert das Domain Repository Port Interface
 * mit Prisma ORM als Persistence Technology. Sie ist Teil der
 * Infrastructure Layer und damit austauschbar (z.B. durch TypeORM,
 * MongoDB, In-Memory Implementation für Tests).
 *
 * **PERSISTENCE STRATEGY:**
 *
 * 1. **Upsert Pattern:**
 *    - save() nutzt Prisma upsert() für idempotente Persistierung
 *    - Prüft NICHT vorher ob Erinnerung existiert (Performance)
 *    - CREATE vs UPDATE wird automatisch anhand ID entschieden
 *
 * 2. **Result Pattern:**
 *    - Alle Methoden geben `Result<T>` zurück
 *    - Prisma Errors werden gefangen und als Result.fail() zurückgegeben
 *    - Explizites Error Handling ohne Exceptions für erwartete Fehler
 *
 * 3. **Transaction Support:**
 *    - Optional tx Parameter für atomare Multi-Aggregate Operations
 *    - Wenn tx=undefined: Verwendet PrismaService (Auto-Commit)
 *    - Wenn tx=provided: Nutzt externe Transaction (Handler-Level)
 *
 * **TRANSACTIONAL OUTBOX PATTERN:**
 * - Repository persistiert NUR das Erinnerung Aggregate
 * - Domain Events werden vom TransactionalCommandHandler in Outbox gespeichert
 * - clearDomainEvents() wird NICHT im Repository aufgerufen
 *
 * @example
 * ```typescript
 * // In Command Handler (Application Layer)
 * constructor(
 *   @Inject(ERINNERUNG_REPOSITORY)
 *   private readonly repository: IErinnerungRepository
 * ) {}
 *
 * async execute(command: CreateErinnerungCommand): Promise<Result<string>> {
 *   const erinnerung = Erinnerung.create(...).value!;
 *   const saveResult = await this.repository.save(erinnerung, tx);
 *   if (saveResult.isFailure) {
 *     return Result.fail(saveResult.error);
 *   }
 *   return Result.ok(erinnerung.id.toString());
 * }
 * ```
 */
@Injectable()
export class PrismaErinnerungRepository implements IErinnerungRepository {
  /**
   * Constructor mit PrismaService Dependency Injection.
   *
   * PrismaService wird von NestJS gemanaged und stellt den
   * Prisma Client zur Verfügung. Singleton-Pattern im App-Lifecycle.
   *
   * @param prisma - PrismaService (NestJS-managed Singleton)
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Speichert das Erinnerung Aggregate (Upsert: Create oder Update).
   *
   * **Upsert Strategy:**
   * - Prisma upsert() entscheidet automatisch CREATE vs UPDATE
   * - Idempotent: Mehrfaches save() mit demselben Aggregate ist safe
   *
   * **Transaction Handling:**
   * - Wenn tx=undefined: Auto-Commit (einzelne Operation)
   * - Wenn tx=provided: Nutzt externe Transaction (Handler-Level)
   *
   * **WICHTIG - Transactional Outbox:**
   * - Domain Events bleiben im Aggregate (TransactionalCommandHandler extrahiert sie)
   * - Repository ruft NICHT clearDomainEvents() auf
   *
   * @param aggregate - Das zu speichernde Erinnerung Aggregate
   * @param tx - Optionale externe Transaktion
   * @returns Result<void> - Success oder Failure mit Error Message
   */
  async save(aggregate: Erinnerung, tx?: TransactionContext): Promise<Result<void>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;
      const data = PrismaErinnerungMapper.toPersistence(aggregate);

      await client.erinnerung.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          einsatzId: data.einsatzId,
          titel: data.titel,
          beschreibung: data.beschreibung,
          faelligAm: data.faelligAm,
          status: data.status,
          erstelltVon: data.erstelltVon,
          // Zuweisungsfelder (Story 3.4) - werden bei create mit assignedToId gesetzt
          assignedToId: data.assignedToId,
          assignedBy: data.assignedBy,
          assignedAt: data.assignedAt,
          // Pflichtfeld-Flag (Story 2.x) - wird bei Erstellung gesetzt
          requiresNote: data.requiresNote,
          // Eskalation (Story 4.1)
          eskalationsPersonId: data.eskalationsPersonId,
          // Intensivierungs-Counter (Hotfix für Endlos-Loop)
          intensivierungsCount: data.intensivierungsCount,
        },
        update: {
          titel: data.titel,
          beschreibung: data.beschreibung,
          faelligAm: data.faelligAm,
          status: data.status,
          // Auslösung Feld (Story 1.5) - wird bei ausloesen() gesetzt
          ausgeloestAm: data.ausgeloestAm,
          // Soft-Delete Felder (Story 1.4) - werden bei delete() gesetzt
          isDeleted: data.isDeleted,
          deletedAt: data.deletedAt,
          deletedBy: data.deletedBy,
          // Acknowledge Felder (Story 1.6) - werden bei acknowledge() gesetzt
          acknowledgedAm: data.acknowledgedAm,
          acknowledgedBy: data.acknowledgedBy,
          // Snooze Felder (Story 2.1) - werden bei snooze() gesetzt
          snoozedAt: data.snoozedAt,
          snoozedBy: data.snoozedBy,
          snoozedUntil: data.snoozedUntil,
          snoozeCount: data.snoozeCount,
          // Erledigt Felder (Story 2.5) - werden bei markErledigt() gesetzt
          erledigtAm: data.erledigtAm,
          erledigtBy: data.erledigtBy,
          erledigungsNotiz: data.erledigungsNotiz,
          // Zuweisung Felder (Story 3.3/3.4) - werden bei assignToUser() gesetzt
          assignedToId: data.assignedToId,
          assignedBy: data.assignedBy,
          assignedAt: data.assignedAt,
          // Eskalation Felder (Story 4.1/4.5) - werden bei eskalieren() gesetzt
          eskalationsPersonId: data.eskalationsPersonId,
          escalatedAt: data.escalatedAt,
          previousAssigneeId: data.previousAssigneeId,
          // Hotfix: Intensivierungs-Counter
          intensivierungsCount: data.intensivierungsCount,
          // einsatzId und erstelltVon sind immutable nach Erstellung
        },
      });

      // NOTE: clearDomainEvents() wird NICHT aufgerufen!
      // TransactionalCommandHandler extrahiert Events via getDomainEvents()

      return Result.ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      return Result.fail(`Failed to save Erinnerung: ${message}`);
    }
  }

  /**
   * Findet ein Erinnerung Aggregate anhand seiner ID.
   *
   * **NULL Handling:**
   * - Wenn Erinnerung nicht existiert: Result.ok(null)
   * - Domain Layer kann explizit prüfen: if (result.value === null)
   *
   * @param id - ErinnerungId (Type-Safe EntityId)
   * @param tx - Optionale Transaktion
   * @returns Result<Erinnerung | null>
   */
  async findById(id: ErinnerungId, tx?: TransactionContext): Promise<Result<Erinnerung | null>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;

      const data = await client.erinnerung.findUnique({
        where: { id: id.toString() },
      });

      if (!data) {
        return Result.ok(null);
      }

      return Result.ok(PrismaErinnerungMapper.toDomain(data));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      return Result.fail(`Failed to find Erinnerung: ${message}`);
    }
  }

  /**
   * Findet alle Erinnerungen eines Einsatzes.
   *
   * **Sortierung:**
   * - Nach faelligAm aufsteigend (nächste Fälligkeit zuerst)
   *
   * **Use Case (Story 1.1):**
   * - "die Erinnerung erscheint in meiner Liste"
   *
   * @param einsatzId - EinsatzId für die Filterung
   * @param tx - Optionale externe Transaktion
   * @returns Result<Erinnerung[]> - Liste der Erinnerungen
   */
  async findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<Result<Erinnerung[]>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;
      const data = await client.erinnerung.findMany({
        where: {
          einsatzId: einsatzId.toString(),
          // Soft-Delete Filter (Story 1.4) - nur nicht-gelöschte Erinnerungen
          isDeleted: false,
        },
        orderBy: { faelligAm: 'asc' },
      });

      const erinnerungen = data.map((item) => PrismaErinnerungMapper.toDomain(item));

      return Result.ok(erinnerungen);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      return Result.fail(`Failed to find Erinnerungen by EinsatzId: ${message}`);
    }
  }

  /**
   * Findet alle überfälligen Erinnerungen für die Eskalation.
   *
   * **Scope (Story 4.1/4.4):**
   * - Status: AUSGELOEST
   * - ausgeloestAm <= threshold
   * - Hotfix: Filtert Erinnerungen aus, die das Intensivierungs-Limit erreicht haben
   *   UND keine Eskalationsperson haben (diese würden nur Fehlermeldungen produzieren)
   *
   * @param threshold - Zeitgrenze ab der eine Erinnerung als überfällig gilt (now - timeout)
   * @param tx - Optional: Transaction Context
   */
  async findOverdue(threshold: Date, tx?: TransactionContext): Promise<Result<Erinnerung[]>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;

      // MAX_INTENSIVIERUNGEN aus der Entity referenzieren (zentrale Definition)
      const MAX_INTENSIVIERUNGEN = Erinnerung.MAX_INTENSIVIERUNGEN;

      const data = await client.erinnerung.findMany({
        where: {
          status: 'AUSGELOEST',
          ausgeloestAm: {
            lte: threshold,
          },
          // Soft-Delete Check
          isDeleted: false,
          // Nur Erinnerungen, die noch eskalierbar sind:
          // - ENTWEDER hat sie eine Eskalationsperson (→ echte Eskalation möglich)
          // - ODER sie hat das Intensivierungs-Limit noch nicht erreicht (→ Intensivierung möglich)
          OR: [{ eskalationsPersonId: { not: null } }, { intensivierungsCount: { lt: MAX_INTENSIVIERUNGEN } }],
        },
      });

      const erinnerungen = data.map((item) => PrismaErinnerungMapper.toDomain(item));
      return Result.ok(erinnerungen);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      return Result.fail(`Failed to find overdue Erinnerungen: ${message}`);
    }
  }

  /**
   * Prüft ob eine Erinnerung mit der gegebenen ID existiert.
   *
   * **Performance:**
   * - COUNT Query statt SELECT * (keine Row Materialization)
   * - Effizienter als findById wenn nur Existenz geprüft werden soll
   *
   * @param id - Die zu prüfende ErinnerungId
   * @returns Result<boolean> - true wenn Erinnerung existiert
   */
  async exists(id: ErinnerungId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.erinnerung.count({
        where: { id: id.toString() },
      });

      return Result.ok(count > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      return Result.fail(`Failed to check Erinnerung existence: ${message}`);
    }
  }
}
