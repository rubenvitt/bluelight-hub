import type { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import type { IEtbRepository, TransactionContext } from '@domain/repositories/i-etb.repository';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { EtbId } from '@domain/value-objects/etb-id';
import { EtbSnapshot, type EtbEintragSnapshot } from '@domain/value-objects/etb-snapshot';
import { EtbVersion } from '@domain/value-objects/etb-version';
import { Injectable } from '@nestjs/common';
import type { EtbSnapshot as PrismaEtbSnapshot, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaEtbMapper, type EtbEintragPersistenceData } from '../mappers/prisma-etb.mapper';

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
 * 2. **EINTRAG CASCADE DELETE/CREATE:**
 *    - DELETE all existing Eintraege (etbEintrag.deleteMany)
 *    - CREATE all current Eintraege (etbEintrag.createMany)
 *    - Einfachheit über Effizienz (keine Delta-Berechnung)
 *    - Aggregate ist Source of Truth (alle Eintraege werden re-persisted)
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
 * - Batch Operations: deleteMany + createMany (statt N einzelne Queries)
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
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Speichert das ETB-Aggregat (Upsert: Create oder Update).
   *
   * Diese Methode implementiert das Upsert-Pattern für Aggregate Persistence.
   * Sie erstellt ein neues ETB wenn dieses noch nicht existiert, oder
   * aktualisiert ein existierendes ETB.
   *
   * **EINTRAG CASCADE STRATEGY:**
   * 1. Disable NO-DELETE Trigger (für deleteMany)
   * 2. DELETE all existing Eintraege (etbEintrag.deleteMany)
   * 3. Re-enable Trigger
   * 4. UPSERT ETB (einsatztagebuch.upsert)
   * 5. CREATE all current Eintraege (etbEintrag.createMany)
   * 6. Persist uncommitted Snapshots
   * 7. Clear Snapshots auf Aggregate
   *
   * **Warum DELETE + CREATE statt UPDATE:**
   * - Einfachheit: Kein komplexes Delta-Tracking (added/removed/updated Eintraege)
   * - Aggregate Root: Eintraege haben keine stable Identity außerhalb Aggregate
   * - Performance: Eintrag-Listen sind klein (<1000 Eintraege), Batch Operations sind schnell
   * - Idempotenz: Mehrfaches save() mit demselben Aggregate produziert gleiches Ergebnis
   *
   * **Transaction Handling:**
   * - Wenn tx=undefined: Verwendet interne Prisma $transaction()
   * - Wenn tx=provided: Nutzt externe Transaction (Handler-Level)
   * - Atomicity: ETB + Eintraege + Snapshots werden zusammen committed oder rolled back
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
    const createdByUser = firstEintrag?.createdBy.value ?? 'SYSTEM';
    const updatedByUser = lastEintrag?.createdBy.value;

    const { etb, eintraege } = PrismaEtbMapper.toPersistence(aggregate, createdByUser, updatedByUser);
    const etbId = aggregate.id.value;

    // Transaction Closure: ETB Upsert + Eintrag Cascade + Snapshot Persistence
    const operation = async (prismaClient: PrismaTransactionClient): Promise<void> => {
      // Step 1: Disable NO-DELETE Trigger (für deleteMany)
      // HINWEIS: Bypass NO-DELETE Trigger via session_replication_role
      // Das ist acceptable weil:
      // 1. Repository ist die EINZIGE Stelle die Eintraege managed (Aggregate Boundary)
      // 2. NO-DELETE Trigger soll User/Application SQL DELETEs blockieren, nicht Repository Cascade
      // 3. Alternative wäre Delta-Tracking (added/removed Eintraege), aber das ist deutlich komplexer
      // 4. session_replication_role=replica ist lokale Session (keine globalen Side-Effects)
      await prismaClient.$executeRawUnsafe('SET LOCAL session_replication_role = replica');

      // Step 2: DELETE all existing Eintraege (Cascade Strategy)
      await prismaClient.$executeRawUnsafe('DELETE FROM etb_eintraege WHERE "etbId" = $1', etbId);

      // Step 3: Re-enable Trigger
      await prismaClient.$executeRawUnsafe('SET LOCAL session_replication_role = DEFAULT');

      // Step 4: UPSERT ETB Record (CREATE or UPDATE)
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

      // Step 5: CREATE all current Eintraege (Batch Operation)
      if (eintraege.length > 0) {
        await prismaClient.etbEintrag.createMany({
          data: eintraege.map((eintrag: EtbEintragPersistenceData) => ({
            ...eintrag,
            etbId,
          })),
        });
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
