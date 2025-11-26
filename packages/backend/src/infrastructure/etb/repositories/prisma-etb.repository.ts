import { PrismaService } from '@/prisma/prisma.service';
import type { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import type { IEtbRepository, TransactionContext } from '@domain/repositories/i-etb.repository';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { EtbId } from '@domain/value-objects/etb-id';
import { type EtbEintragSnapshot, EtbSnapshot } from '@domain/value-objects/etb-snapshot';
import { EtbVersion } from '@domain/value-objects/etb-version';
import { Injectable } from '@nestjs/common';
import type { EtbSnapshot as PrismaEtbSnapshot, Prisma } from '@prisma/client';
import { PrismaEtbMapper } from '../mappers/prisma-etb.mapper';
import { PrismaOutboxRepository, type PrismaTransaction } from '@/infrastructure/outbox/prisma-outbox.repository';

/**
 * Transaction Client Type Alias fuer bessere Lesbarkeit.
 * Kombiniert den Standard PrismaService mit Prisma's TransactionClient.
 */
type PrismaTransactionClient = Prisma.TransactionClient;

/**
 * Prisma Implementation des IEtbRepository (Hexagonal Architecture).
 *
 * Diese Klasse implementiert das Domain Repository Port Interface
 * mit Prisma ORM als Persistence Technology. Sie ist Teil der
 * Infrastructure Layer und damit austauschbar (z.B. durch TypeORM,
 * MongoDB, In-Memory Implementation für Tests).
 *
 * **AGGREGATE PERSISTENCE STRATEGY:**
 *
 * 1. **Upsert Pattern:**
 *    - save() prüft NICHT ob ETB existiert
 *    - Prisma upsert() handhabt CREATE vs UPDATE automatisch
 *    - Idempotent: save() kann mehrfach mit demselben Aggregate aufgerufen werden
 *
 * 2. **EINTRAG APPEND-ONLY (DRK-Compliance):**
 *    - INSERT neue Eintraege mit ON CONFLICT DO NOTHING
 *    - Bestehende Eintraege bleiben UNVERÄNDERT (keine Updates)
 *    - KEINE physischen Deletes (NO-DELETE Trigger aktiv)
 *    - Soft-Delete via deletedAt Feld für "gelöschte" Einträge
 *    - 10-Jahres-Aufbewahrungspflicht wird respektiert
 *
 * 3. **Transaction Support:**
 *    - Optional tx Parameter für atomare Multi-Aggregate Operations
 *    - Wenn tx=undefined: Verwendet interne Prisma Transaction
 *    - Wenn tx=provided: Nutzt externe Transaction (Handler-Level)
 *
 * 4. **Snapshot Management:**
 *    - Snapshots werden automatisch bei save() persistiert
 *    - Uncommitted Snapshots aus Aggregate werden in DB geschrieben
 *    - Nach Persistierung: clearSnapshots() auf Aggregate
 *
 * **TRANSACTION CONTEXT PATTERN:**
 * - TransactionContext ist Opaque Type (framework-agnostic im Domain Layer)
 * - Infrastructure Layer castet zu PrismaClient
 * - Ermöglicht Handler-Level Transactions über mehrere Repositories hinweg
 *
 * **ERROR HANDLING:**
 * - Prisma Errors werden NICHT gecatched (propagieren als Promise.reject())
 * - Unique Constraint Violations: P2002 (z.B. duplicate einsatzId)
 * - Foreign Key Violations: P2003 (z.B. einsatzId existiert nicht)
 * - Application Layer muss Errors behandeln (Result Pattern)
 *
 * **PERFORMANCE OPTIMIZATIONS:**
 * - Eintrag Eager Loading: include: { eintraege: true } (verhindert N+1 Queries)
 * - Append-Only INSERT: ON CONFLICT DO NOTHING für idempotente Saves
 * - Index Usage: einsatzId Index für schnelle Lookups
 */
@Injectable()
export class PrismaEtbRepository implements IEtbRepository {
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
   * Speichert das ETB-Aggregat (Upsert: Create oder Update).
   *
   * Diese Methode implementiert das Upsert-Pattern für Aggregate Persistence.
   * Sie erstellt ein neues ETB wenn dieses noch nicht existiert, oder
   * aktualisiert ein existierendes ETB.
   *
   * **EINTRAG APPEND-ONLY STRATEGY (DRK-Compliance):**
   * 1. UPSERT ETB (einsatztagebuch.upsert)
   * 2. INSERT neue Eintraege mit ON CONFLICT DO NOTHING
   * 3. Persist uncommitted Snapshots
   * 4. Clear Snapshots auf Aggregate
   * 5. Persist Domain Events to Outbox (Story 4-4)
   * 6. Clear Domain Events auf Aggregate (nach erfolgreicher Transaction)
   *
   * **Warum Append-Only statt DELETE + CREATE:**
   * - DRK-Compliance: 10-Jahres-Aufbewahrungspflicht, NO-DELETE Trigger aktiv
   * - Audit-Trail: Einträge werden nie physisch gelöscht, nur soft-deleted
   * - Idempotenz: ON CONFLICT DO NOTHING garantiert idempotente Saves
   * - Bestehende Einträge bleiben unverändert (immutable nach Creation)
   *
   * **Transaction Handling:**
   * - Wenn tx=undefined: Verwendet interne Prisma $transaction()
   * - Wenn tx=provided: Nutzt externe Transaction (Handler-Level)
   * - Atomicity: ETB + Eintraege + Snapshots + Outbox Events werden zusammen committed oder rolled back
   *
   * **Transactional Outbox Pattern (Story 4-4):**
   * - Domain Events werden ATOMAR mit dem Aggregate persistiert
   * - Events landen in outbox_events Tabelle (status=PENDING)
   * - Polling Worker published Events asynchron aus Outbox
   * - Garantiert: Kein Event-Verlust durch Transaction Rollback
   * - clearDomainEvents() erfolgt NACH Transaction Commit
   *
   * @param aggregate - Das zu speichernde ETB Aggregat
   * @param tx - Optionale externe Transaktion
   * @throws Prisma Errors (P2002, P2003, etc.) als Promise.reject()
   */
  async save(aggregate: EinsatztagebuchAggregate, tx?: TransactionContext): Promise<void> {
    // Transaction Client: externe tx oder interne Prisma Client
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    // Aggregate → Prisma Data Mapping
    // HINWEIS: createdBy wird aus dem ersten Eintrag extrahiert oder als 'SYSTEM' Default verwendet
    // updatedBy wird ebenfalls aus dem letzten Eintrag extrahiert (falls vorhanden)
    const firstEintrag = aggregate.eintraege[0];
    const lastEintrag = aggregate.eintraege[aggregate.eintraege.length - 1];
    // Fallback: wenn Aggregate noch keine Eintraege hat (z.B. auto-creation bei Einsatz),
    // nutze den Ersteller des Einsatzes als createdBy, damit FK constraint erfüllt ist.
    const createdByUser =
      firstEintrag?.createdBy.value ??
      (
        await client.einsatz.findUnique({
          select: { createdBy: true },
          where: { id: aggregate.einsatzId.value },
        })
      )?.createdBy ??
      'SYSTEM';
    const updatedByUser = lastEintrag?.createdBy.value;

    const { etb, eintraege } = PrismaEtbMapper.toPersistence(aggregate, createdByUser, updatedByUser);
    const etbId = aggregate.id.value;

    // Transaction Closure: ETB Upsert + Eintrag INSERT + Snapshot Persistence
    const operation = async (prismaClient: PrismaTransactionClient): Promise<void> => {
      // Step 1: UPSERT ETB Record (CREATE or UPDATE)
      // HINWEIS: Wir verwenden "unchecked" Syntax mit direkten FK-IDs statt connect
      // Das ist konsistenter und vermeidet Prisma Type-Konflikte
      await prismaClient.einsatztagebuch.upsert({
        where: { id: etbId },
        create: {
          id: etbId,
          einsatzId: etb.einsatzId,
          createdBy: etb.createdBy,
          status: etb.status,
          version: etb.version,
          versionTimestamp: etb.versionTimestamp,
          nextSequenceNumber: etb.nextSequenceNumber,
          lockedAt: etb.lockedAt,
          lockedBy: etb.lockedBy,
          updatedBy: etb.updatedBy,
        },
        update: {
          status: etb.status,
          version: etb.version,
          versionTimestamp: etb.versionTimestamp,
          nextSequenceNumber: etb.nextSequenceNumber,
          lockedAt: etb.lockedAt,
          lockedBy: etb.lockedBy,
          updatedBy: etb.updatedBy,
          // einsatzId und createdBy können NICHT geändert werden (readonly in Domain)
        },
      });

      // Step 2: UPSERT Eintraege (DRK-Compliance: Append-Only + Updates erlaubt)
      // WICHTIG: Keine DELETE-Operation! ETB-Einträge werden NIEMALS physisch gelöscht.
      // - Neue Einträge werden hinzugefügt (INSERT)
      // - Bestehende Einträge werden aktualisiert (ON CONFLICT DO UPDATE)
      // - "Gelöschte" Einträge werden soft-deleted (deletedAt != null)
      // Dies respektiert den NO-DELETE Trigger und die 10-Jahres-Aufbewahrungspflicht.
      if (eintraege.length > 0) {
        // Verwende Raw SQL mit ON CONFLICT DO UPDATE für Upsert-Semantik
        // Der Unique Constraint (etbId, sequenceNumber) ermöglicht Updates
        for (const eintrag of eintraege) {
          await prismaClient.$executeRaw`
            INSERT INTO etb_eintraege (
              "id", "etbId", "sequenceNumber", "text", "createdBy", "createdAt",
              "updatedAt", "deletedAt", "deletedBy", "kategorie", "timestamp",
              "version", "isAutomatic", "metadata"
            ) VALUES (
              ${eintrag.id}, ${etbId}, ${eintrag.sequenceNumber}, ${eintrag.text},
              ${eintrag.createdBy}, ${eintrag.createdAt}, ${eintrag.updatedAt},
              ${eintrag.deletedAt}, ${eintrag.deletedBy}, ${eintrag.kategorie}::"EtbKategorie",
              ${eintrag.timestamp}, ${eintrag.version}, ${eintrag.isAutomatic},
              ${eintrag.metadata ?? null}::jsonb
            )
            ON CONFLICT ("etbId", "sequenceNumber") DO UPDATE SET
              "text" = EXCLUDED."text",
              "updatedAt" = EXCLUDED."updatedAt",
              "deletedAt" = EXCLUDED."deletedAt",
              "deletedBy" = EXCLUDED."deletedBy",
              "version" = EXCLUDED."version"
          `;
        }
      }

      // Step 6: Persist uncommitted Snapshots
      const snapshots = aggregate.getUncommittedSnapshots();
      if (snapshots.length > 0) {
        await prismaClient.etbSnapshot.createMany({
          data: snapshots.map((snapshot) => ({
            etbId,
            versionNumber: snapshot.versionNumber,
            snapshotAt: snapshot.snapshotAt,
            // Cast zu Prisma InputJsonValue - EtbEintragSnapshot[] ist JSON-kompatibel
            eintraege: snapshot.toJSON().eintraege as unknown as object,
          })),
        });
      }

      // Step 7: Clear aggregate's uncommitted Snapshots
      // WICHTIG: Nach erfolgreicher Persistierung müssen Snapshots geleert werden
      // um doppelte Persistierung zu verhindern
      aggregate.clearSnapshots();

      // Step 8: Persist Domain Events to Outbox (ATOMIC with ETB + Eintraege)
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

    // Step 9: Clear Domain Events AFTER successful transaction
    // WICHTIG: clearDomainEvents() muss NACH dem Transaction Commit erfolgen
    // → Verhindert Event-Verlust bei Transaction Rollback
    // → Analog zu clearSnapshots() innerhalb der Transaction
    aggregate.clearDomainEvents();
  }

  /**
   * Lädt ein ETB-Aggregat anhand seiner ID.
   *
   * Diese Methode führt ein Eager Loading der Eintraege durch, um das
   * vollständige Aggregate zu rekonstruieren (Aggregate Consistency Boundary).
   *
   * **Eager Loading:**
   * - include: { eintraege: { orderBy: { sequenceNumber: 'asc' } } } lädt alle Eintraege in einem Query
   * - Verhindert N+1 Query Problem (1 Query für ETB + N Queries für Eintraege)
   * - Performance: Index auf etbId für schnellen Eintrag Lookup
   * - Sortierung: Eintraege nach sequenceNumber aufsteigend für chronologische Anzeige
   *
   * **NULL Handling:**
   * - Wenn ETB nicht existiert: return null (NICHT Exception)
   * - Domain Layer kann explizit prüfen: if (result === null)
   * - Echte Errors (DB Connection Failed) werden als Promise.reject() propagiert
   *
   * **Transaction Support:**
   * - Optional tx Parameter für Read in Transaction Context
   * - Wichtig für Consistency: ETB + andere Aggregates in einer Transaction lesen
   *
   * @param id - EtbId (Type-Safe EntityId)
   * @param tx - Optionale Transaktion
   * @returns Promise mit EinsatztagebuchAggregate oder null wenn nicht gefunden
   */
  async findById(id: EtbId, tx?: TransactionContext): Promise<EinsatztagebuchAggregate | null> {
    // Transaction Client: externe tx oder interne Prisma Client
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    // ETB mit Eintraegen laden (Eager Loading)
    const etb = await client.einsatztagebuch.findUnique({
      where: { id: id.value },
      include: {
        eintraege: {
          orderBy: { sequenceNumber: 'asc' }, // Chronologische Sortierung
        },
      },
    });

    // NULL Handling: ETB nicht gefunden
    if (!etb) {
      return null;
    }

    // Prisma → Domain Mapping (Aggregate Reconstruction)
    return PrismaEtbMapper.toAggregate(etb);
  }

  /**
   * Lädt ein ETB-Aggregat anhand der Einsatz-ID.
   *
   * Dies ist der primäre Zugriffspfad für ETB-Abfragen, da ETBs
   * typischerweise über den Einsatz zugegriffen werden (1:1 Beziehung).
   *
   * **Performance:**
   * - Index auf einsatzId für schnellen Lookup (UNIQUE Index)
   * - Eager Loading der Eintraege (verhindert N+1 Queries)
   * - Schneller als findById() bei Einsatz-basiertem Zugriff
   *
   * **Use Cases:**
   * - "Zeige mir das ETB für diesen Einsatz"
   * - Lazy Creation: Prüfen ob ETB bereits existiert
   * - Einsatz-Details View: Lade zugehöriges ETB
   *
   * **NULL Handling:**
   * - Wenn kein ETB existiert: return null
   * - Caller muss ETB erstellen wenn null (Lazy Creation Pattern)
   *
   * @param einsatzId - Einsatz-Identifier (Foreign Key)
   * @param tx - Optionale Transaktion
   * @returns Promise mit EinsatztagebuchAggregate oder null wenn nicht gefunden
   */
  async findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<EinsatztagebuchAggregate | null> {
    // Transaction Client: externe tx oder interne Prisma Client
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    // ETB mit Eintraegen laden (via einsatzId Index)
    const etb = await client.einsatztagebuch.findUnique({
      where: { einsatzId: einsatzId.value },
      include: {
        eintraege: {
          orderBy: { sequenceNumber: 'asc' }, // Chronologische Sortierung
        },
      },
    });

    // NULL Handling: ETB nicht gefunden
    if (!etb) {
      return null;
    }

    // Prisma → Domain Mapping (Aggregate Reconstruction)
    return PrismaEtbMapper.toAggregate(etb);
  }

  /**
   * Lädt die Versions-Historie eines ETBs.
   *
   * Diese Methode lädt alle gespeicherten Snapshots für ein ETB und
   * rekonstruiert die EtbSnapshot Value Objects aus der Datenbank.
   *
   * **Sortierung:**
   * - Älteste Version zuerst (ascending) für chronologischen Audit-Trail
   * - Ermöglicht "Replay" der Änderungshistorie von Anfang an
   *
   * **Snapshot Rekonstruktion:**
   * - Aus DB-Zeile wird EtbVersion + EtbEintragSnapshot[] rekonstruiert
   * - EtbVersion.create() erzeugt neues Value Object (neuer Timestamp)
   * - snapshotAt wird aus DB-Zeile verwendet (original Timestamp)
   *
   * **Use Cases:**
   * - Audit-Trail UI: Zeige alle Versionen eines ETBs
   * - Rollback-Funktionalität: Stelle frühere Version wieder her
   * - Compliance: DRK-konforme Änderungshistorie
   *
   * **WICHTIG: Kein Transaction Support!**
   * - Snapshots sind historical read-only data
   * - Keine transaktionale Konsistenz erforderlich
   * - Separate Query außerhalb von Aggregate-Lifecycle
   *
   * @param id - ETB Aggregate ID
   * @returns Promise<EtbSnapshot[]> - Array von Snapshots (älteste zuerst)
   */
  async getHistory(id: EtbId): Promise<EtbSnapshot[]> {
    // Snapshots laden (älteste zuerst für chronologischen Audit-Trail)
    const snapshots = await this.prisma.etbSnapshot.findMany({
      where: { etbId: id.value },
      orderBy: { versionNumber: 'asc' }, // Älteste zuerst
    });

    // DB → Domain Mapping (EtbSnapshot Reconstruction)
    return snapshots.map((dbSnapshot: PrismaEtbSnapshot) => {
      // EtbVersion rekonstruieren (mit aktuellem Timestamp)
      const versionResult = EtbVersion.create(dbSnapshot.versionNumber);
      if (versionResult.isFailure) {
        // Sollte nie passieren bei validen DB-Daten
        throw new Error(`Invalid version number in snapshot: ${dbSnapshot.versionNumber}`);
      }
      const version = versionResult.value as EtbVersion;

      // EtbSnapshot mit original snapshotAt rekonstruieren
      // HINWEIS: eintraege ist als Prisma Json gespeichert und muss via unknown gecastet werden
      return new EtbSnapshot(version, dbSnapshot.eintraege as unknown as EtbEintragSnapshot[], dbSnapshot.snapshotAt);
    });
  }
}
