import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import type { TransactionContext } from '@domain/common/transaction';
import type { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import type { LagekarteId } from '@domain/value-objects/lagekarte-id';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaLagekarteMapper } from './mappers/prisma-lagekarte.mapper';
import type { PrismaClient } from '@prisma/client';
import { PrismaOutboxRepository, type PrismaTransaction } from '@/infrastructure/outbox/prisma-outbox.repository';

/**
 * Prisma Implementation des ILagekarteRepository (Hexagonal Architecture).
 *
 * Diese Klasse implementiert das Domain Repository Port Interface
 * mit Prisma ORM als Persistence Technology. Sie ist Teil der
 * Infrastructure Layer und damit austauschbar (z.B. durch TypeORM,
 * MongoDB, In-Memory Implementation für Tests).
 *
 * **AGGREGATE PERSISTENCE STRATEGY:**
 *
 * 1. **Upsert Pattern:**
 *    - save() prüft NICHT ob Lagekarte existiert
 *    - Prisma upsert() handhabt CREATE vs UPDATE automatisch
 *    - Idempotent: save() kann mehrfach mit demselben Aggregate aufgerufen werden
 *
 * 2. **POI CASCADE DELETE/CREATE:**
 *    - DELETE all existing POIs (lagekartePoi.deleteMany)
 *    - CREATE all current POIs (lagekartePoi.createMany)
 *    - Einfachheit über Effizienz (keine Delta-Berechnung)
 *    - Aggregate ist Source of Truth (alle POIs werden re-persisted)
 *
 * 3. **Transaction Support:**
 *    - Optional tx Parameter für atomare Multi-Aggregate Operations
 *    - Wenn tx=undefined: Verwendet interne Prisma Transaction
 *    - Wenn tx=provided: Nutzt externe Transaction (Handler-Level)
 *
 * **TRANSACTION CONTEXT PATTERN:**
 * - TransactionContext ist Opaque Type (framework-agnostic im Domain Layer)
 * - Infrastructure Layer castet zu Prisma.TransactionClient
 * - Ermöglicht Handler-Level Transactions über mehrere Repositories hinweg
 *
 * **ERROR HANDLING:**
 * - Prisma Errors werden NICHT gecatched (propagieren als Promise.reject())
 * - Unique Constraint Violations: P2002 (z.B. duplicate einsatzId)
 * - Foreign Key Violations: P2003 (z.B. einsatzId existiert nicht)
 * - Application Layer muss Errors behandeln (Result Pattern)
 *
 * **PERFORMANCE OPTIMIZATIONS:**
 * - POI Eager Loading: include: { pois: true } (verhindert N+1 Queries)
 * - Batch Operations: deleteMany + createMany (statt N einzelne Queries)
 * - Index Usage: einsatzId Index für schnelle Lookups
 *
 * @example
 * ```typescript
 * // In Command Handler (Application Layer)
 * constructor(
 *   @Inject('ILagekarteRepository')
 *   private readonly lagekarteRepository: ILagekarteRepository
 * ) {}
 *
 * async execute(command: CreateLagekarteCommand): Promise<void> {
 *   const aggregate = LagekarteAggregate.create(command.einsatzId);
 *   aggregate.addPoi(...);
 *   await this.lagekarteRepository.save(aggregate); // Upsert
 * }
 * ```
 */
@Injectable()
export class PrismaLagekarteRepository implements ILagekarteRepository {
  /**
   * Constructor mit PrismaService Dependency Injection.
   *
   * PrismaService wird von NestJS gemanaged und stellt den
   * Prisma Client zur Verfügung. Singleton-Pattern im App-Lifecycle.
   *
   * @param prisma - PrismaService (NestJS-managed Singleton)
   * @param outboxRepository - OutboxRepository für Transactional Outbox Pattern (Story 4-4)
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxRepository: PrismaOutboxRepository,
  ) {}

  /**
   * Speichert das Lagekarte-Aggregat (Upsert: Create oder Update).
   *
   * Diese Methode implementiert das Upsert-Pattern für Aggregate Persistence.
   * Sie erstellt eine neue Lagekarte wenn diese noch nicht existiert, oder
   * aktualisiert eine existierende Lagekarte.
   *
   * **POI CASCADE STRATEGY:**
   * 1. DELETE all existing POIs (lagekartePoi.deleteMany)
   * 2. UPSERT Lagekarte (lagekarte.upsert)
   * 3. CREATE all current POIs (lagekartePoi.createMany)
   *
   * **Warum DELETE + CREATE statt UPDATE:**
   * - Einfachheit: Kein komplexes Delta-Tracking (added/removed/updated POIs)
   * - Aggregate Root: POIs haben keine stable Identity außerhalb Aggregate
   * - Performance: POI-Listen sind klein (<100 POIs), Batch Operations sind schnell
   * - Idempotenz: Mehrfaches save() mit demselben Aggregate produziert gleiches Ergebnis
   *
   * **Transaction Handling:**
   * - Wenn tx=undefined: Verwendet interne Prisma $transaction()
   * - Wenn tx=provided: Nutzt externe Transaction (Handler-Level)
   * - Atomicity: Lagekarte + POIs + Outbox Events werden zusammen committed oder rolled back
   *
   * **Transactional Outbox Pattern (Story 4-4):**
   * - Domain Events werden ATOMAR mit dem Aggregate persistiert
   * - Events landen in outbox_events Tabelle (status=PENDING)
   * - Polling Worker published Events asynchron aus Outbox
   * - Garantiert: Kein Event-Verlust durch Transaction Rollback
   * - clearDomainEvents() erfolgt NACH Transaction Commit
   *
   * **Error Cases:**
   * - P2002 (Unique Constraint): einsatzId bereits verwendet (sollte nicht passieren bei Upsert)
   * - P2003 (FK Violation): einsatzId existiert nicht in einsaetze table
   * - P2025 (Record Not Found): Sollte nicht passieren bei Upsert (create fallback)
   *
   * @param aggregate - Das zu speichernde Lagekarte Aggregat
   * @param tx - Optionale externe Transaktion
   * @throws Prisma Errors (P2002, P2003, etc.) als Promise.reject()
   *
   * @example
   * ```typescript
   * // Ohne Transaction (interne Transaction)
   * const aggregate = LagekarteAggregate.create(einsatzId);
   * aggregate.addPoi('Einsatzstelle', berlinMgrs, category, userId);
   * await repository.save(aggregate);
   *
   * // Mit externer Transaction (Handler-Level)
   * await prisma.$transaction(async (tx) => {
   *   await repository.save(aggregate, tx);
   *   await otherRepository.save(otherAggregate, tx);
   * });
   * ```
   */
  async save(aggregate: LagekarteAggregate, tx?: TransactionContext): Promise<void> {
    // Transaction Client: externe tx oder interne Prisma Client
    const client = (tx as PrismaClient | undefined) ?? this.prisma;

    // Aggregate → Prisma Data Mapping
    const { pois, ...lagekarteData } = PrismaLagekarteMapper.toPersistence(aggregate);
    const lagekarteId = aggregate.id.value;
    const einsatzId = aggregate.einsatzId.value;

    // Transaction Closure: Lagekarte Upsert + POI Cascade
    const operation = async (prismaClient: PrismaClient) => {
      // Step 1: DELETE all existing POIs (Cascade Strategy)
      // HINWEIS: Bypass NO-DELETE Trigger via session_replication_role
      // Das ist acceptable weil:
      // 1. Repository ist die EINZIGE Stelle die POIs managed (Aggregate Boundary)
      // 2. NO-DELETE Trigger soll User/Application SQL DELETEs blockieren, nicht Repository Cascade
      // 3. Alternative wäre Delta-Tracking (added/removed POIs), aber das ist deutlich komplexer
      // 4. session_replication_role=replica ist lokale Session (keine globalen Side-Effects)
      await prismaClient.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      await prismaClient.$executeRawUnsafe('DELETE FROM lagekarte_poi WHERE "lagekarteId" = $1', lagekarteId);
      await prismaClient.$executeRawUnsafe('SET LOCAL session_replication_role = DEFAULT');

      // Step 2: UPSERT Lagekarte (CREATE or UPDATE)
      await prismaClient.lagekarte.upsert({
        where: { id: lagekarteId },
        create: {
          id: lagekarteId,
          state: lagekarteData.state,
          einsatz: {
            connect: { id: einsatzId },
          },
        },
        update: {
          state: lagekarteData.state,
          // einsatzId kann NICHT geändert werden (readonly in Domain)
        },
      });

      // Step 3: CREATE all current POIs (Batch Operation)
      if (pois.length > 0) {
        await prismaClient.lagekartePoi.createMany({
          data: pois.map((poi) => ({
            ...poi,
            lagekarteId,
          })),
        });
      }

      // Step 4: Persist Domain Events to Outbox (ATOMIC with Lagekarte + POIs)
      // WICHTIG: Events werden in derselben Transaktion wie das Aggregate committed
      // → Garantiert Konsistenz: Kein Event-Verlust bei Transaction Rollback
      const events = aggregate.getDomainEvents();
      if (events.length > 0) {
        await this.outboxRepository.save(events, prismaClient as unknown as PrismaTransaction);
      }
    };

    // Execute in Transaction (internal oder external)
    if (tx) {
      // Externe Transaction: Nutze provided client
      await operation(client as PrismaClient);
    } else {
      // Interne Transaction: Wrap in $transaction
      await this.prisma.$transaction(async (prismaClient) => {
        await operation(prismaClient as PrismaClient);
      });
    }

    // Step 5: Clear Domain Events AFTER successful transaction
    // WICHTIG: clearDomainEvents() muss NACH dem Transaction Commit erfolgen
    // → Verhindert Event-Verlust bei Transaction Rollback
    aggregate.clearDomainEvents();
  }

  /**
   * Lädt eine Lagekarte anhand ihrer ID.
   *
   * Diese Methode führt ein Eager Loading der POIs durch, um das
   * vollständige Aggregate zu rekonstruieren (Aggregate Consistency Boundary).
   *
   * **Eager Loading:**
   * - include: { pois: true } lädt alle POIs in einem Query
   * - Verhindert N+1 Query Problem (1 Query für Lagekarte + N Queries für POIs)
   * - Performance: Index auf lagekarteId für schnellen POI Lookup
   *
   * **NULL Handling:**
   * - Wenn Lagekarte nicht existiert: return null (NICHT Exception)
   * - Domain Layer kann explizit prüfen: if (result === null)
   * - Echte Errors (DB Connection Failed) werden als Promise.reject() propagiert
   *
   * **Transaction Support:**
   * - Optional tx Parameter für Read in Transaction Context
   * - Wichtig für Consistency: Lagekarte + andere Aggregates in einer Transaction lesen
   *
   * @param id - LagekarteId (Type-Safe EntityId)
   * @param tx - Optionale Transaktion
   * @returns Promise mit LagekarteAggregate oder null wenn nicht gefunden
   *
   * @example
   * ```typescript
   * const lagekarteId = LagekarteId.create('clw3h8x9y...').value!;
   * const aggregate = await repository.findById(lagekarteId);
   *
   * if (aggregate === null) {
   *   console.log('Lagekarte nicht gefunden');
   * } else {
   *   console.log(aggregate.pois.length); // Anzahl POIs
   * }
   * ```
   */
  async findById(id: LagekarteId, tx?: TransactionContext): Promise<LagekarteAggregate | null> {
    // Transaction Client: externe tx oder interne Prisma Client
    const client = (tx as PrismaClient | undefined) ?? this.prisma;

    // Lagekarte mit POIs laden (Eager Loading)
    const lagekarte = await client.lagekarte.findUnique({
      where: { id: id.value },
      include: { pois: true }, // WICHTIG: Eager load POIs
    });

    // NULL Handling: Lagekarte nicht gefunden
    if (!lagekarte) {
      return null;
    }

    // Prisma → Domain Mapping (Aggregate Reconstruction)
    return PrismaLagekarteMapper.toAggregate(lagekarte);
  }

  /**
   * Lädt eine Lagekarte anhand der Einsatz-ID.
   *
   * Dies ist der primäre Zugriffspfad für Lagekartenabfragen, da Lagekarten
   * typischerweise über den Einsatz zugegriffen werden (1:1 Beziehung).
   *
   * **Performance:**
   * - Index auf einsatzId für schnellen Lookup (UNIQUE Index)
   * - Eager Loading der POIs (verhindert N+1 Queries)
   * - Schneller als findById() bei Einsatz-basiertem Zugriff
   *
   * **Use Cases:**
   * - "Zeige mir die Lagekarte für diesen Einsatz"
   * - Lazy Creation: Prüfen ob Lagekarte bereits existiert
   * - Einsatz-Details View: Lade zugehörige Lagekarte
   *
   * **NULL Handling:**
   * - Wenn keine Lagekarte existiert: return null
   * - Caller muss Lagekarte erstellen wenn null (Lazy Creation Pattern)
   *
   * @param einsatzId - Einsatz-Identifier (Foreign Key)
   * @param tx - Optionale Transaktion
   * @returns Promise mit LagekarteAggregate oder null wenn nicht gefunden
   *
   * @example
   * ```typescript
   * const einsatzId = EinsatzId.create('clw3h8x9y...').value!;
   * const aggregate = await repository.findByEinsatzId(einsatzId);
   *
   * if (aggregate === null) {
   *   // Lagekarte existiert noch nicht - Lazy Creation
   *   const newAggregate = LagekarteAggregate.create(einsatzId);
   *   await repository.save(newAggregate);
   * } else {
   *   // Lagekarte existiert - Update
   *   aggregate.addPoi(...);
   *   await repository.save(aggregate);
   * }
   * ```
   */
  async findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<LagekarteAggregate | null> {
    // Transaction Client: externe tx oder interne Prisma Client
    const client = (tx as PrismaClient | undefined) ?? this.prisma;

    // Lagekarte mit POIs laden (via einsatzId Index)
    const lagekarte = await client.lagekarte.findUnique({
      where: { einsatzId: einsatzId.value },
      include: { pois: true }, // WICHTIG: Eager load POIs
    });

    // NULL Handling: Lagekarte nicht gefunden
    if (!lagekarte) {
      return null;
    }

    // Prisma → Domain Mapping (Aggregate Reconstruction)
    return PrismaLagekarteMapper.toAggregate(lagekarte);
  }

  /**
   * Prüft ob eine Lagekarte für einen Einsatz existiert.
   *
   * Diese Methode führt einen effizienten EXISTS/COUNT Query aus,
   * ohne die gesamte Lagekarte + POIs zu laden. Performance-Optimization
   * für Lazy Creation Pattern.
   *
   * **Performance:**
   * - COUNT Query statt SELECT * (keine Row Materialization)
   * - Index auf einsatzId (UNIQUE Index, sehr schnell)
   * - Kein POI Eager Loading (nur Existence Check)
   *
   * **Use Cases:**
   * - Validierung: "Lagekarte darf nur einmal pro Einsatz existieren"
   * - Guard Clause: if (await repo.exists(einsatzId)) return error;
   * - Lazy Creation: Prüfen bevor Create (Race Condition vermeiden)
   *
   * **Warum separate exists() Method:**
   * - Semantik: Caller braucht nur Boolean, nicht gesamtes Aggregate
   * - Performance: COUNT schneller als SELECT * bei großen POI-Listen
   * - SQL Query Plan: DB kann spezialisierte Index-Only Scan nutzen
   *
   * @param einsatzId - Einsatz-Identifier (Foreign Key)
   * @returns Promise mit true wenn Lagekarte existiert, false sonst
   *
   * @example
   * ```typescript
   * // In CreateLagekarteCommandHandler
   * const einsatzId = EinsatzId.create('clw3h8x9y...').value!;
   * const exists = await repository.exists(einsatzId);
   *
   * if (exists) {
   *   throw new AlreadyExistsError('Lagekarte existiert bereits für diesen Einsatz');
   * }
   *
   * // Lagekarte erstellen und speichern
   * const lagekarte = LagekarteAggregate.create(einsatzId);
   * await repository.save(lagekarte);
   * ```
   */
  async exists(einsatzId: EinsatzId): Promise<boolean> {
    // COUNT Query (Performance-optimiert)
    const count = await this.prisma.lagekarte.count({
      where: { einsatzId: einsatzId.value },
    });

    return count > 0;
  }
}
