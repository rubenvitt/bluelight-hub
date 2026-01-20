// biome-ignore lint/style/useImportType: IErinnerungRepository is interface for DI
import { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { TransactionContext } from '@domain/common/transaction';
// biome-ignore lint/style/useImportType: Erinnerung entity needed at runtime
import { Erinnerung } from '@domain/entities/erinnerung.entity';
// biome-ignore lint/style/useImportType: ErinnerungId value object needed at runtime
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
// biome-ignore lint/style/useImportType: EinsatzId value object needed at runtime
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
        },
        update: {
          titel: data.titel,
          beschreibung: data.beschreibung,
          faelligAm: data.faelligAm,
          status: data.status,
          // Soft-Delete Felder (Story 1.4) - werden bei delete() gesetzt
          deletedAt: data.deletedAt,
          deletedBy: data.deletedBy,
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
          deletedAt: null,
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
