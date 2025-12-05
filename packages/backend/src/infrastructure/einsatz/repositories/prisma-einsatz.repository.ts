import { PrismaService } from '@/prisma/prisma.service';
import type { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { TransactionContext } from '@domain/common/transaction';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Result } from '@domain/common/result';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaEinsatzMapper } from '../mappers/prisma-einsatz.mapper';
import { PrismaOutboxRepository, type PrismaTransaction } from '@/infrastructure/outbox/prisma-outbox.repository';

/**
 * Transaction Client Type Alias für bessere Lesbarkeit.
 * Kombiniert den Standard PrismaService mit Prisma's TransactionClient.
 */
type PrismaTransactionClient = Prisma.TransactionClient;

/**
 * Prisma Implementation des IEinsatzRepository (Hexagonal Architecture).
 *
 * Diese Klasse implementiert das Domain Repository Port Interface
 * mit Prisma ORM als Persistence Technology. Sie ist Teil der
 * Infrastructure Layer und damit austauschbar (z.B. durch TypeORM,
 * MongoDB, In-Memory Implementation für Tests).
 *
 * **AGGREGATE PERSISTENCE STRATEGY:**
 *
 * 1. **Upsert Pattern:**
 *    - save() prüft NICHT ob Einsatz existiert
 *    - Prisma upsert() handhabt CREATE vs UPDATE automatisch
 *    - Idempotent: save() kann mehrfach mit demselben Aggregate aufgerufen werden
 *
 * 2. **NO-DELETE Policy (DRK-Compliance):**
 *    - KEINE physischen Deletes möglich (NO-DELETE Trigger aktiv)
 *    - Einsätze werden archiviert, nicht gelöscht
 *    - 10-Jahres-Aufbewahrungspflicht wird respektiert
 *
 * 3. **Transaction Support:**
 *    - Optional tx Parameter für atomare Multi-Aggregate Operations
 *    - Wenn tx=undefined: Verwendet interne Prisma Transaction
 *    - Wenn tx=provided: Nutzt externe Transaction (Handler-Level)
 *
 * 4. **Transactional Outbox Pattern:**
 *    - Domain Events werden ATOMAR mit Aggregate persistiert
 *    - Events landen in outbox_events Tabelle (status=PENDING)
 *    - Polling Worker published Events asynchron aus Outbox
 *    - Garantiert: Kein Event-Verlust durch Transaction Rollback
 *
 * **ERROR HANDLING:**
 * - save() propagiert Prisma Errors als Promise.reject()
 * - Query Methods nutzen Result Pattern für explicit Error Handling
 * - "Not found" ist SUCCESS mit null, NICHT FAILURE
 *
 * @implements IEinsatzRepository
 */
@Injectable()
export class PrismaEinsatzRepository implements IEinsatzRepository {
  private readonly logger = new Logger(PrismaEinsatzRepository.name);

  /**
   * Constructor mit Dependency Injection.
   *
   * @param prisma - PrismaService (NestJS-managed Singleton)
   * @param outboxRepository - OutboxRepository für Transactional Outbox Pattern
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxRepository: PrismaOutboxRepository,
  ) {}

  /**
   * Speichert das Einsatz-Aggregat (Upsert: Create oder Update).
   *
   * Diese Methode implementiert das Upsert-Pattern für Aggregate Persistence.
   * Sie erstellt einen neuen Einsatz wenn dieser noch nicht existiert, oder
   * aktualisiert einen existierenden Einsatz.
   *
   * **Transactional Outbox Pattern:**
   * 1. UPSERT Einsatz (einsatz.upsert)
   * 2. Persist Domain Events to Outbox (atomar in gleicher Transaction)
   * 3. Clear Domain Events auf Aggregate (nach erfolgreicher Transaction)
   *
   * **Transaction Handling:**
   * - Wenn tx=undefined: Verwendet interne Prisma $transaction()
   * - Wenn tx=provided: Nutzt externe Transaction (Handler-Level)
   * - Atomicity: Einsatz + Outbox Events werden zusammen committed oder rolled back
   *
   * @param aggregate - Das zu speichernde Einsatz Aggregat
   * @param tx - Optionale externe Transaktion
   * @returns Result<void> - Success oder Failure mit Error Message
   */
  async save(aggregate: Einsatz, tx?: TransactionContext): Promise<Result<void>> {
    // Transaction Client: externe tx oder interne Prisma Client
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    // Aggregate → Prisma Data Mapping
    // createdBy wird aus Aggregate extrahiert
    const createdByUser = aggregate.createdBy.value;
    const persistenceData = PrismaEinsatzMapper.toPersistence(aggregate, createdByUser);

    // Transaction Closure: Einsatz Upsert + Outbox Event Persistence
    const operation = async (prismaClient: PrismaTransactionClient): Promise<void> => {
      // Step 1: UPSERT Einsatz Record (CREATE or UPDATE)
      await prismaClient.einsatz.upsert({
        where: { id: persistenceData.id },
        create: {
          id: persistenceData.id,
          alarmstichwort: persistenceData.alarmstichwort,
          einsatzort: persistenceData.einsatzort,
          beschreibung: persistenceData.beschreibung,
          status: persistenceData.status,
          createdAt: persistenceData.createdAt,
          updatedAt: persistenceData.updatedAt,
          createdBy: persistenceData.createdBy,
          updatedBy: persistenceData.updatedBy,
          archivedAt: persistenceData.archivedAt,
          archivedBy: persistenceData.archivedBy,
          alarmierungszeit: persistenceData.alarmierungszeit,
          einsatzleiter: persistenceData.einsatzleiter,
          metadata: persistenceData.metadata ?? Prisma.JsonNull,
        },
        update: {
          // Mutable Felder - können bei Update geändert werden
          alarmstichwort: persistenceData.alarmstichwort,
          einsatzort: persistenceData.einsatzort,
          beschreibung: persistenceData.beschreibung,
          status: persistenceData.status,
          updatedAt: persistenceData.updatedAt,
          updatedBy: persistenceData.updatedBy,
          archivedAt: persistenceData.archivedAt,
          archivedBy: persistenceData.archivedBy,
          alarmierungszeit: persistenceData.alarmierungszeit,
          einsatzleiter: persistenceData.einsatzleiter,
          metadata: persistenceData.metadata ?? Prisma.JsonNull,
          // id, createdAt, createdBy sind readonly - werden NICHT geupdated
        },
      });

      // Step 2: Persist Domain Events to Outbox (ATOMIC with Einsatz)
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
      await operation(client as PrismaTransactionClient);
    } else {
      // Interne Transaction: Wrap in $transaction
      await this.prisma.$transaction(async (prismaClient) => {
        await operation(prismaClient);
      });
    }

    // Step 3: Clear Domain Events AFTER successful transaction
    // WICHTIG: clearDomainEvents() muss NACH dem Transaction Commit erfolgen
    // → Verhindert Event-Verlust bei Transaction Rollback
    aggregate.clearDomainEvents();

    return Result.ok(undefined);
  }

  /**
   * Lädt ein Einsatz-Aggregat anhand seiner ID.
   *
   * **NULL Handling:**
   * - Wenn Einsatz nicht existiert: Result.ok(null)
   * - "Not found" ist kein Error, sondern valides Resultat
   * - Echte DB-Errors werden als Result.fail() zurückgegeben
   *
   * @param id - EinsatzId (Type-Safe EntityId)
   * @returns Promise<Result<Einsatz | null>> - Success mit Aggregate oder null
   */
  async findById(id: EinsatzId): Promise<Result<Einsatz | null>> {
    try {
      const einsatz = await this.prisma.einsatz.findUnique({
        where: { id: id.value },
      });

      // NULL Handling: Einsatz nicht gefunden = SUCCESS mit null
      if (!einsatz) {
        return Result.ok(null);
      }

      // Prisma → Domain Mapping (Aggregate Reconstruction)
      const aggregate = PrismaEinsatzMapper.toAggregate(einsatz);
      return Result.ok(aggregate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to find Einsatz by ID: ${message}`, { einsatzId: id.value });
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Findet alle aktiven Einsätze (Status !== ARCHIVIERT).
   *
   * **Filtering Logic:**
   * - Nur Einsätze mit Status ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN
   * - Archivierte Einsätze werden ausgefiltert (operativ irrelevant)
   * - Sortierung: Neueste zuerst (createdAt DESC)
   *
   * **DRK-Compliance:**
   * - Archivierte Einsätze sind legal relevant, aber operativ nicht aktiv
   * - Separater "Archiv" View für historische Einsätze
   *
   * @returns Promise<Result<Einsatz[]>> - Success mit Array (leer wenn keine aktiven)
   */
  async findActive(): Promise<Result<Einsatz[]>> {
    try {
      const einsaetze = await this.prisma.einsatz.findMany({
        where: {
          status: { not: 'ARCHIVIERT' },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Prisma → Domain Mapping für alle Ergebnisse
      const aggregates = einsaetze.map((e) => PrismaEinsatzMapper.toAggregate(e));
      return Result.ok(aggregates);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to find active Einsätze: ${message}`);
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Findet ein Einsatz-Aggregat anhand der Einsatznummer (Business Key).
   *
   * **HINWEIS:** Die `nummer` ist ein Domain-Only Feld, das NICHT in der DB existiert.
   * Es wird zur Laufzeit aus der ID generiert (Format: "E{YEAR}-{ID-prefix}").
   *
   * Da wir keinen direkten DB-Lookup auf `nummer` haben, müssen wir alle
   * Einsätze laden und clientseitig filtern. Für Produktionseinsatz sollte
   * ein `nummer` Feld zum Schema hinzugefügt werden.
   *
   * @param nummer - Einsatznummer (z.B. "E2024-clw3h8x9")
   * @returns Promise<Result<Einsatz | null>> - Success mit Aggregate oder null
   */
  async findByNummer(nummer: string): Promise<Result<Einsatz | null>> {
    try {
      // Extrahiere ID-Prefix aus nummer (Format: "E{YEAR}-{ID-8-chars}")
      // Beispiel: "E2024-clw3h8x9" → Suche nach ID die mit "clw3h8x9" beginnt
      const match = nummer.match(/^E\d{4}-(.+)$/);
      if (!match) {
        // Ungültiges Format → nicht gefunden
        return Result.ok(null);
      }

      const idPrefix = match[1];

      // Suche nach Einsatz dessen ID mit dem Prefix beginnt
      const einsaetze = await this.prisma.einsatz.findMany({
        where: {
          id: { startsWith: idPrefix },
        },
        take: 1, // Nur ersten Treffer
      });

      // Array-Bounds-Check: Kein Treffer gefunden
      if (einsaetze.length === 0) {
        return Result.ok(null);
      }

      // Sicherer Array-Zugriff: einsaetze[0] ist hier garantiert definiert
      const einsatzRecord = einsaetze[0];
      if (!einsatzRecord) {
        return Result.ok(null);
      }

      const aggregate = PrismaEinsatzMapper.toAggregate(einsatzRecord);

      // Verifiziere dass die rekonstruierte nummer übereinstimmt
      if (aggregate.nummer !== nummer) {
        return Result.ok(null);
      }

      return Result.ok(aggregate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to find Einsatz by nummer: ${message}`, { nummer });
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Prüft ob ein Einsatz mit gegebener ID existiert.
   *
   * **Performance:**
   * - Verwendet COUNT Query statt SELECT * (keine Row Materialization)
   * - Effizienter für einfache Existenz-Checks
   *
   * @param id - EinsatzId (Type-Safe EntityId)
   * @returns Promise<Result<boolean>> - Success mit true/false
   */
  async exists(id: EinsatzId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.einsatz.count({
        where: { id: id.value },
      });
      return Result.ok(count > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to check Einsatz existence: ${message}`, { einsatzId: id.value });
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Zaehlt Einsaetze gruppiert nach Status.
   *
   * Verwendet parallele COUNT Queries fuer optimale Performance.
   * Archivierte Einsaetze werden optional inkludiert (Default: ausgeschlossen).
   *
   * **Performance:**
   * - 4x parallele COUNT Queries via Promise.all()
   * - Keine Row Materialization (nur Counts)
   * - Index-optimiert (Status Column ist indexed)
   *
   * **includeArchived Logik:**
   * - false (default): archiviert = 0 (Query wird nicht ausgeführt)
   * - true: archiviert = tatsächlicher Count aus DB
   *
   * @param includeArchived - Ob archivierte Einsaetze mitgezaehlt werden sollen
   * @returns Promise<Result<StatusCounts>> - Success mit Counts oder Failure bei DB-Fehler
   */
  async countByStatus(includeArchived: boolean): Promise<
    Result<{
      angelegt: number;
      inBearbeitung: number;
      abgeschlossen: number;
      archiviert: number;
    }>
  > {
    try {
      // Parallel COUNT Queries für optimale Performance
      const [angelegt, inBearbeitung, abgeschlossen, archiviert] = await Promise.all([
        this.prisma.einsatz.count({
          where: { status: 'ANGELEGT' },
        }),
        this.prisma.einsatz.count({
          where: { status: 'IN_BEARBEITUNG' },
        }),
        this.prisma.einsatz.count({
          where: { status: 'ABGESCHLOSSEN' },
        }),
        // Conditional: Nur archivierte Zählen wenn includeArchived=true
        includeArchived ? this.prisma.einsatz.count({ where: { status: 'ARCHIVIERT' } }) : Promise.resolve(0),
      ]);

      return Result.ok({
        angelegt,
        inBearbeitung,
        abgeschlossen,
        archiviert,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to count Einsaetze by status: ${message}`);
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Findet alle Einsaetze mit Pagination, Filterung und Sortierung.
   *
   * Diese Methode implementiert flexible Einsatz-Suche mit dynamischen Filtern.
   * Sie ersetzt die alte findWithPagination() aus dem Legacy EinsatzRepository.
   *
   * **Filter-Logik:**
   * - status: Optional - Filtert nach spezifischem Status (überschreibt includeArchived)
   * - includeArchived: false (default) - Filtert ARCHIVIERT Status aus
   * - searchTerm: Optional - Case-insensitive LIKE auf alarmstichwort und id
   *
   * **Pagination:**
   * - page (1-based): Skip berechnet als (page - 1) * limit
   * - limit: Take parameter für Prisma
   * - totalPages: Math.ceil(total / limit)
   *
   * **Sortierung:**
   * - orderBy: Dynamisches Feld (z.B. 'createdAt', 'alarmstichwort')
   * - orderDirection: 'asc' oder 'desc'
   * - Default: createdAt desc (neueste zuerst)
   *
   * **Performance:**
   * - Parallele Queries: findMany() + count() via Promise.all()
   * - Index-Optimierung: status Column ist indexed
   * - Pagination verhindert Memory Overflow bei grossen Datensets
   *
   * @param filters - Filter-Optionen (status, includeArchived, searchTerm)
   * @param pagination - Pagination-Optionen (page, limit)
   * @param sorting - Sortier-Optionen (orderBy, orderDirection)
   * @returns Promise<Result<PaginatedResult>> - Success mit paginierten Aggregates oder Failure
   */
  async findAllPaginated(
    filters: {
      status?: string;
      includeArchived?: boolean;
      searchTerm?: string;
    },
    pagination: {
      page: number;
      limit: number;
    },
    sorting: {
      orderBy: string;
      orderDirection: 'asc' | 'desc';
    },
  ): Promise<
    Result<{
      items: Einsatz[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  > {
    try {
      const { status, includeArchived = false, searchTerm } = filters;
      const { page, limit } = pagination;
      const { orderBy, orderDirection } = sorting;

      // Berechne Skip für Pagination (1-based page number)
      const skip = (page - 1) * limit;

      // Baue dynamische WHERE-Clause
      const where: Prisma.EinsatzWhereInput = {};

      // Status-Filter
      if (status) {
        // Spezifischer Status überschreibt includeArchived
        // Cast string zu EinsatzStatus Enum für Type Safety
        where.status = status as unknown as Prisma.EnumEinsatzStatusFilter;
      } else if (!includeArchived) {
        // Default: Filtere archivierte Einsätze aus
        where.status = { not: 'ARCHIVIERT' };
      }
      // Wenn includeArchived=true und kein Status: Zeige alle (kein Filter)

      // Volltextsuche (case-insensitive)
      if (searchTerm?.trim()) {
        where.OR = [{ alarmstichwort: { contains: searchTerm.trim(), mode: 'insensitive' } }, { id: { contains: searchTerm.trim(), mode: 'insensitive' } }];
      }

      // Baue OrderBy-Clause
      const orderByClause: Prisma.EinsatzOrderByWithRelationInput = {
        [orderBy]: orderDirection,
      };

      // Parallele Queries für optimale Performance
      const [items, total] = await Promise.all([
        this.prisma.einsatz.findMany({
          where,
          skip,
          take: limit,
          orderBy: orderByClause,
        }),
        this.prisma.einsatz.count({ where }),
      ]);

      // Prisma → Domain Mapping für alle Ergebnisse
      const aggregates = items.map((e) => PrismaEinsatzMapper.toAggregate(e));

      // Berechne totalPages (mindestens 1 wenn total > 0)
      const totalPages = total > 0 ? Math.ceil(total / Math.max(1, limit)) : 0;

      this.logger.log(`Found ${total} Einsätze (showing ${aggregates.length}) - Filters: status=${status}, search='${searchTerm}', includeArchived=${includeArchived}, page=${page}, limit=${limit}`);

      return Result.ok({
        items: aggregates,
        total,
        page,
        limit,
        totalPages,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to find paginated Einsätze: ${message}`);
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Findet Einsaetze die fuer Archivierung eligible sind (DRK 10-Jahres-Policy).
   *
   * Diese Methode implementiert die Query-Logik fuer Bulk-Archivierung.
   * Sie findet alle abgeschlossenen Einsaetze, die aelter als ein
   * gegebenes Threshold-Datum sind.
   *
   * **Filter Criteria:**
   * - status = ABGESCHLOSSEN (nur abgeschlossene, nicht bereits archivierte)
   * - createdAt <= olderThan (aelter als Schwellwert)
   *
   * **Warum nur ABGESCHLOSSEN:**
   * - ANGELEGT/IN_BEARBEITUNG: Noch aktiv (duerfen NICHT archiviert werden)
   * - ABGESCHLOSSEN: Einsatz beendet (eligible fuer Archivierung)
   * - ARCHIVIERT: Bereits archiviert (vermeidet Duplikate und Race Conditions)
   *
   * **Warum createdAt statt abgeschlossenAt:**
   * - Prisma Schema hat kein abgeschlossenAt Feld (nur createdAt, updatedAt, archivedAt)
   * - createdAt ist konservativer Proxy: Wenn Einsatz vor 10 Jahren erstellt wurde, ist er definitiv alt genug
   * - Domain Layer kann spaeter abgeschlossenAt hinzufuegen (Schema Migration)
   *
   * **Sortierung:**
   * - Aelteste Einsaetze zuerst (createdAt ASC)
   * - Use Case: Bulk Archive Command verarbeitet aelteste Einsaetze first
   *
   * **Performance:**
   * - Index auf (status, createdAt) existiert bereits im Schema
   * - Pagination kann in Application Layer hinzugefuegt werden (Take/Skip)
   *
   * @param olderThan - Threshold Date (Einsaetze erstellt VOR diesem Datum)
   * @returns Promise<Result<Einsatz[]>> - Success mit Array eligible Einsaetze (leer wenn keine)
   *
   * @example
   * ```typescript
   * // Finde Einsaetze aelter als 10 Jahre
   * const tenYearsAgo = new Date();
   * tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
   * const result = await repository.findEligibleForArchival(tenYearsAgo);
   *
   * if (result.isSuccess) {
   *   for (const einsatz of result.value) {
   *     // Archive logic
   *   }
   * }
   * ```
   */
  async findEligibleForArchival(olderThan: Date): Promise<Result<Einsatz[]>> {
    try {
      // Query: Status = ABGESCHLOSSEN && createdAt <= olderThan
      const einsaetze = await this.prisma.einsatz.findMany({
        where: {
          status: 'ABGESCHLOSSEN',
          createdAt: {
            lte: olderThan,
          },
        },
        orderBy: {
          createdAt: 'asc', // Aelteste zuerst
        },
      });

      // Prisma → Domain Mapping für alle Ergebnisse
      const aggregates = einsaetze.map((e) => PrismaEinsatzMapper.toAggregate(e));

      this.logger.log(`Found ${aggregates.length} Einsaetze eligible for archival (older than ${olderThan.toISOString()})`);

      return Result.ok(aggregates);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to find eligible Einsaetze for archival: ${message}`);
      return Result.fail(`Database error: ${message}`);
    }
  }
}
