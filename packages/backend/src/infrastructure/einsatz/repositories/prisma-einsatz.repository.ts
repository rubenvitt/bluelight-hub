import { PrismaService } from '@/prisma/prisma.service';
import type { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
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
 * Opaque Transaction Context Type für Hexagonal Architecture.
 * Domain Layer kennt NUR diesen abstrakten Type, nicht Prisma-Details.
 */
type TransactionContext = unknown;

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
}
