import { Injectable } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import type { Patient as PrismaPatientRow } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import type { TransactionContext } from '@domain/common/transaction';
import { Result } from '@domain/common/result';
import { Patient, type PatientId } from '@domain/patienten/aggregates/patient.aggregate';
import { PatientDomainEvent } from '@domain/patienten/events/patient-domain-event';
import type {
  PatientEventRow,
  PatientKpiCountRows,
  PatientListFilters,
  PatientListPagination,
  PatientListResult,
  PatientListRow,
  PatientListSort,
  PatientRepository,
} from '@domain/patienten/repositories/patient.repository';
import { Behandlungsstatus, type BehandlungsstatusCode } from '@domain/patienten/value-objects/behandlungsstatus.vo';
import { DiviVakNummer } from '@domain/patienten/value-objects/divi-vak-nummer.vo';
import { ErfasserRef } from '@domain/patienten/value-objects/erfasser-ref.vo';
import { Patientennummer } from '@domain/patienten/value-objects/patientennummer.vo';
import { Sichtungskategorie, type SkCode } from '@domain/patienten/value-objects/sichtungskategorie.vo';
import { Transportstatus, type TransportstatusCode } from '@domain/patienten/value-objects/transportstatus.vo';
import { EventSerializer } from '@/infrastructure/outbox/event-serializer';

type PrismaTransactionClient = Prisma.TransactionClient;

const ADVISORY_LOCK_KEY_MASK = 0x7fffffffffffffffn;

/**
 * Raw-Row-Shape aus `prisma.$queryRaw` für die Listen-Abfrage (Story 1.6, AC1).
 * Postgres liefert Spaltennamen in snake_case zurück — werden im Adapter auf
 * `PatientListRow` (camelCase) gemapped.
 */
interface RawPatientListRow {
  id: string;
  einsatz_id: string;
  patientennummer: string;
  divi_vak_nummer: string | null;
  aktuelle_sk: string;
  behandlungsstatus: string;
  transportstatus: string;
  erfasst_am: Date;
}

const DEFAULT_EVENT_VERSION = 1;

/**
 * Komponiert eine SQL-Subexpression, die einen Spalten- oder Parameter-
 * Ausdruck konsistent für deutsche Such-Semantik normalisiert:
 *  - Lowercase (case-insensitive)
 *  - `ä→ae, ö→oe, ü→ue, ß→ss` (Mueller ↔ Müller, Strasse ↔ Straße)
 *
 * Wird in `findManyByEinsatz` symmetrisch auf Spalte und Pattern angewandt.
 */
function germanNormalize(expr: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`REPLACE(REPLACE(REPLACE(REPLACE(LOWER(${expr}), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss')`;
}

/**
 * Escaped LIKE-Wildcards (`%`, `_`, `\`) im freien Such-Input, damit die
 * Spec-Garantie aus AC4 hält: `%`/`_` werden literal behandelt, nicht als
 * SQL-Wildcards interpretiert. Wird via `ESCAPE '\\'` an die LIKE-Klausel
 * gebunden (Story 1.6 Code-Review P1).
 */
function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Hasht eine Einsatz-ID auf einen 63-bit signed Integer, der als Schlüssel
 * für `pg_advisory_xact_lock` taugt. Variante des FNV-1a-Algorithmus —
 * deterministisch, kein Crypto, keine externen Deps. Die Maske wird nur
 * einmal am Ende angewendet, damit die Bit-Verteilung des Hashs nicht durch
 * zyklisches Bit-63-Verwerfen verzerrt wird.
 */
function einsatzLockKey(einsatzId: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const fnvPrime = 0x100000001b3n;
  const wrap = 0xffffffffffffffffn;
  for (let i = 0; i < einsatzId.length; i++) {
    hash = (hash ^ BigInt(einsatzId.charCodeAt(i))) & wrap;
    hash = (hash * fnvPrime) & wrap;
  }
  return hash & ADVISORY_LOCK_KEY_MASK;
}

/**
 * Infrastructure-Adapter für `PatientRepository` (Story 1.1, Architecture §D-1/§D-3).
 *
 * Patientennummer-Sequence: `pg_advisory_xact_lock(hash(einsatzId))` pro
 * Transaktion serialisiert parallele Einfügungen pro Einsatz, sodass
 * `MAX(seq) + 1` race-resistent berechnet wird. Die Sperre wird beim
 * Commit/Rollback der Transaktion automatisch freigegeben. Die Sequenz ist
 * pro Einsatz monoton (`@@unique([einsatzId, patientennummer])`), nicht global —
 * eine globale Postgres-Sequence wäre falsch (zwei Einsätze starten beide bei
 * P-001).
 *
 * Scope Story 1.1: Persistiert ausschließlich das Aggregate. Domain-Events
 * werden in Story 1.2 über die Outbox geschrieben.
 */
@Injectable()
export class PatientRepositoryAdapter implements PatientRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventSerializer: EventSerializer,
  ) {}

  async save(patient: Patient, tx?: TransactionContext): Promise<Result<void>> {
    const client = (tx as PrismaTransactionClient | undefined) ?? (this.prisma as unknown as PrismaTransactionClient);
    const create = this.toPersistence(patient);
    // Update-Branch nur fuer veraenderliche Snapshot-Felder. Identitaet
    // (`id`, `einsatzId`, `patientennummer`), Erfassungs-Kontext und
    // Event-Stream-Relation (`events`) bleiben unangetastet.
    const update: Prisma.PatientUncheckedUpdateInput = {
      diviVakNummer: create.diviVakNummer,
      aktuelleSk: create.aktuelleSk,
      behandlungsstatus: create.behandlungsstatus,
      transportstatus: create.transportstatus,
      clockDriftSeconds: create.clockDriftSeconds,
      notiz: create.notiz,
    };
    try {
      await client.patient.upsert({
        where: { id: create.id! },
        create,
        update,
      });

      // Story 1.2, Architecture §D-1/§D-6: Domain-Events in PatientEvent-Tabelle
      // persistieren — in derselben Transaktion wie der Aggregate-Upsert, damit
      // Snapshot und Event-Stream nie auseinanderlaufen. `outboxRef` bleibt
      // initial `null`; der Outbox-Forwarder (Story 4.x) verknüpft es später.
      const events = patient.getDomainEvents();
      if (events.length > 0) {
        // Patient-Aggregate emittiert ausschließlich `PatientDomainEvent`-Instanzen
        // (siehe `addDomainEvent`-Call-Sites in `patient.aggregate.ts`). Der
        // Type-Guard mit `instanceof` macht die Invariante explizit und engt den
        // statisch breiteren `DomainEvent[]`-Rückgabetyp des AggregateRoot-Base
        // auf den Patient-spezifischen Subtype ein.
        const patientEvents = events.filter((event): event is PatientDomainEvent => event instanceof PatientDomainEvent);
        if (patientEvents.length !== events.length) {
          throw new Error('Infrastructure:PatientNonPatientDomainEventEmitted');
        }
        const rows = patientEvents.map((event) => this.toPatientEventRow(patient, event));
        await client.patientEvent.createMany({ data: rows });
        patient.clearDomainEvents();
      }

      return Result.ok<void>(undefined);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return Result.fail<void>(`ConflictDetected:PatientennummerVergeben:${patient.patientennummer.value}`);
      }
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<void>(`Infrastructure:PatientSaveFailed:${message}`);
    }
  }

  async findById(id: PatientId, tx?: TransactionContext): Promise<Patient | null> {
    const client = (tx as PrismaTransactionClient | undefined) ?? (this.prisma as unknown as PrismaTransactionClient);
    const row = await client.patient.findUnique({ where: { id: id.value } });
    if (!row) return null;
    // Story 1.1 persistiert keine Events; sobald Story 1.2 das verdrahtet,
    // ersetzt eine `MAX(event_version)`-Query an dieser Stelle den Default.
    const eventVersion = await this.loadEventVersion(client, id.value);
    return this.toAggregate(row as PrismaPatientRow, eventVersion);
  }

  async findManyByEinsatz(einsatzId: string, filters: PatientListFilters, sort: PatientListSort, pagination: PatientListPagination): Promise<Result<PatientListResult>> {
    try {
      const whereSql = this.buildListWhere(einsatzId, filters);
      const orderBySql = this.buildListOrderBy(sort);
      const offset = (pagination.page - 1) * pagination.pageSize;

      // findMany + count parallel — beide nutzen identischen WHERE-Block
      // (deshalb Variable, nicht doppelt komponieren). `Prisma.sql` ist
      // SQL-injection-sicher, weil sämtliche User-Eingaben über Parameter-
      // Placeholders eingehängt werden.
      // Story 1.7 Privacy-by-Default: `notiz` wird in der Listen-Projektion
      // **bewusst nicht** selektiert. Notizen können PII enthalten und gehören
      // nur in den Detail-Endpunkt (`GET /einsaetze/:einsatzId/patienten/:patientId`),
      // nicht in eine Massen-Übersicht. Sollte ein zukünftiges Feature eine
      // Notiz-Vorschau wollen, ist dafür ein eigener feldspezifischer Truncate-
      // + Redact-Pfad nötig.
      const [rawRows, countRows] = await Promise.all([
        this.prisma.$queryRaw<RawPatientListRow[]>(Prisma.sql`
          SELECT id, einsatz_id, patientennummer, divi_vak_nummer,
                 aktuelle_sk, behandlungsstatus, transportstatus, erfasst_am
          FROM patienten
          ${whereSql}
          ${orderBySql}
          LIMIT ${pagination.pageSize} OFFSET ${offset}
        `),
        this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count FROM patienten ${whereSql}
        `),
      ]);

      const total = Number(countRows[0]?.count ?? 0n);

      // `eventVersion` per gebatchtem GroupBy aus dem Event-Stream nachladen
      // — n+1-frei: ein einziger Round-Trip für alle Seiten-IDs. Fallback
      // `DEFAULT_EVENT_VERSION = 1`, falls eine ältere Row (Story 1.1) noch
      // ohne Events existiert. Forward-Compat für Story 3.1 (Optimistic-
      // Concurrency); Vertrag aus AC1.
      const ids = rawRows.map((row) => row.id);
      const versionMap = await this.loadEventVersionMap(ids);

      const items: PatientListRow[] = rawRows.map((row) => ({
        id: row.id,
        einsatzId: row.einsatz_id,
        patientennummer: row.patientennummer,
        diviVakNummer: row.divi_vak_nummer,
        aktuelleSk: row.aktuelle_sk as SkCode,
        behandlungsstatus: row.behandlungsstatus as BehandlungsstatusCode,
        transportstatus: row.transportstatus as TransportstatusCode,
        erfasstAm: row.erfasst_am,
        eventVersion: versionMap.get(row.id) ?? DEFAULT_EVENT_VERSION,
      }));

      return Result.ok<PatientListResult>({ items, total });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<PatientListResult>(`Infrastructure:PatientListQueryFailed:${message}`);
    }
  }

  async findEventsByPatientId(patientId: string): Promise<Result<PatientEventRow[]>> {
    try {
      // `outboxRef` ist interner Marker, nicht im Client-DTO — wir selektieren
      // ihn nicht. `orderBy: occurredAt asc` mit `eventVersion asc` als
      // deterministischer Tie-Breaker, falls zwei Events denselben Timestamp
      // tragen (rare bei Capture-Bulk-Inserts mit identischer `Date.now()`).
      const rows = await this.prisma.patientEvent.findMany({
        where: { patientId },
        orderBy: [{ occurredAt: 'asc' }, { eventVersion: 'asc' }],
        select: {
          id: true,
          patientId: true,
          einsatzId: true,
          eventType: true,
          eventVersion: true,
          payload: true,
          occurredAt: true,
          recordedAt: true,
          actorUserId: true,
          actorDeviceId: true,
          originSessionId: true,
          clockDriftSeconds: true,
        },
      });
      const mapped: PatientEventRow[] = rows.map((row) => ({
        id: row.id,
        patientId: row.patientId,
        einsatzId: row.einsatzId,
        eventType: row.eventType,
        eventVersion: row.eventVersion,
        // `payload` ist Prisma-`Json` → JsonValue. Wir reichen sie als generisches
        // Objekt durch; downstream-Konsumenten (Mapper, Frontend) erwarten den
        // discriminated-union-Inhalt nicht typed.
        payload: (row.payload ?? {}) as Record<string, unknown>,
        occurredAt: row.occurredAt,
        recordedAt: row.recordedAt,
        actorUserId: row.actorUserId,
        actorDeviceId: row.actorDeviceId,
        originSessionId: row.originSessionId,
        clockDriftSeconds: row.clockDriftSeconds,
      }));
      return Result.ok<PatientEventRow[]>(mapped);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<PatientEventRow[]>(`Infrastructure:PatientEventsQueryFailed:${message}`);
    }
  }

  private buildListWhere(einsatzId: string, filters: PatientListFilters): Prisma.Sql {
    const conditions: Prisma.Sql[] = [Prisma.sql`einsatz_id = ${einsatzId}`];

    // Enum-Filter ohne `::text`-Cast, damit der Composite-Index
    // `(einsatz_id, aktuelle_sk)` (bzw. `behandlungsstatus`/`transportstatus`)
    // beide Spalten als Index-Cond nutzen kann (Code-Review P14 + EXPLAIN-Beleg).
    if (filters.sk && filters.sk.length > 0) {
      conditions.push(Prisma.sql`aktuelle_sk = ANY (ARRAY[${Prisma.join(filters.sk)}]::"SkEnum"[])`);
    }
    if (filters.behandlungsstatus && filters.behandlungsstatus.length > 0) {
      conditions.push(Prisma.sql`behandlungsstatus = ANY (ARRAY[${Prisma.join(filters.behandlungsstatus)}]::"BehandlungsstatusEnum"[])`);
    }
    if (filters.transportstatus && filters.transportstatus.length > 0) {
      conditions.push(Prisma.sql`transportstatus = ANY (ARRAY[${Prisma.join(filters.transportstatus)}]::"TransportstatusEnum"[])`);
    }
    if (filters.search) {
      // Deutsche Umlaut-Normalisierung (Mueller ↔ Müller) via REPLACE-Kette:
      // `unaccent` würde `ü` zu `u` strippen, was die Spelling-Variante `ue`
      // nicht trifft — für DACH-User-Erwartung braucht es die explizite
      // `ä→ae, ö→oe, ü→ue, ß→ss`-Konvention. Beide Seiten (Spalte + Pattern)
      // werden identisch normalisiert, damit das Match symmetrisch ist.
      // Wildcards (`%`, `_`, `\`) werden mit `ESCAPE '\\'` literal behandelt
      // (Spec AC4 + Code-Review P1).
      const pattern = `%${escapeLikePattern(filters.search)}%`;
      conditions.push(Prisma.sql`(
        ${germanNormalize(Prisma.sql`patientennummer`)} LIKE ${germanNormalize(Prisma.sql`${pattern}`)} ESCAPE '\\'
        OR ${germanNormalize(Prisma.sql`COALESCE(divi_vak_nummer, '')`)} LIKE ${germanNormalize(Prisma.sql`${pattern}`)} ESCAPE '\\'
      )`);
    }

    return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
  }

  private buildListOrderBy(sort: PatientListSort): Prisma.Sql {
    const dir = Prisma.raw(sort.direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC');
    // `, id ASC` als deterministischer Tie-Breaker auf jedem Sort-Pfad —
    // ohne diesen kann bei gleichen Werten (z. B. zwei `erfasst_am`-
    // Timestamps oder kollidierende Patientennummer-Lex-Reihenfolgen)
    // dieselbe Row über Page-Grenzen doppelt erscheinen oder ausfallen
    // (Code-Review P8).
    if (sort.field === 'zeit') {
      return Prisma.sql`ORDER BY erfasst_am ${dir}, id ASC`;
    }
    if (sort.field === 'patientennummer') {
      return Prisma.sql`ORDER BY patientennummer ${dir}, id ASC`;
    }
    // Default: `sk` — zwei-stufig SK-Priorität, dann `erfasstAm` asc als
    // stabiler Tiebreaker. Triage-Ordering nutzt die zufällig lexikografisch
    // korrekte Enum-Sortierung (SK_I < SK_II < SK_III < SK_IV < TOT).
    return Prisma.sql`ORDER BY aktuelle_sk ${dir}, erfasst_am ASC, id ASC`;
  }

  private async loadEventVersionMap(patientIds: string[]): Promise<Map<string, number>> {
    if (patientIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.patientEvent.groupBy({
      by: ['patientId'],
      where: { patientId: { in: patientIds } },
      _max: { eventVersion: true },
    });
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row._max.eventVersion != null) {
        map.set(row.patientId, row._max.eventVersion);
      }
    }
    return map;
  }

  async getKpiCounts(einsatzId: string): Promise<Result<PatientKpiCountRows>> {
    try {
      // Drei parallele groupBy-Calls (Architecture §D-7): jeder schlägt einen
      // eigenen Composite-Index (`(einsatzId, <dim>)`) und läuft als
      // Index-only-Scan. `Promise.all` minimiert den Roundtrip-Overhead —
      // bei n=250 erwarten wir p95 ≤ 20 ms auf Mittelklasse-Hardware.
      const [skRows, behandlungRows, transportRows] = await Promise.all([
        this.prisma.patient.groupBy({
          by: ['aktuelleSk'],
          where: { einsatzId },
          _count: { _all: true },
        }),
        this.prisma.patient.groupBy({
          by: ['behandlungsstatus'],
          where: { einsatzId },
          _count: { _all: true },
        }),
        this.prisma.patient.groupBy({
          by: ['transportstatus'],
          where: { einsatzId },
          _count: { _all: true },
        }),
      ]);

      return Result.ok<PatientKpiCountRows>({
        skRows: skRows.map((row) => ({ aktuelleSk: row.aktuelleSk as SkCode, count: row._count._all })),
        behandlungRows: behandlungRows.map((row) => ({ behandlungsstatus: row.behandlungsstatus as BehandlungsstatusCode, count: row._count._all })),
        transportRows: transportRows.map((row) => ({ transportstatus: row.transportstatus as TransportstatusCode, count: row._count._all })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<PatientKpiCountRows>(`Infrastructure:PatientKpiCountsFailed:${message}`);
    }
  }

  async nextPatientennummer(einsatzId: string, tx: TransactionContext): Promise<Result<Patientennummer>> {
    if (!einsatzId || typeof einsatzId !== 'string' || einsatzId.trim().length === 0) {
      return Result.fail<Patientennummer>('BusinessRule:EinsatzIdErforderlich');
    }
    if (tx === undefined || tx === null) {
      return Result.fail<Patientennummer>('Infrastructure:nextPatientennummerRequiresTransaction');
    }
    const client = tx as PrismaTransactionClient;

    // Advisory-Lock pro Einsatz: serialisiert die `MAX(seq) + 1`-Berechnung
    // parallel laufender Transaktionen, ohne dass eine globale Sequence nötig
    // ist. Lock wird beim Commit/Rollback der Transaktion automatisch
    // freigegeben (vgl. Architecture §D-3, „atomarer Sequence-Increment …
    // ODER optimistic select-then-insert").
    await client.$executeRawUnsafe(`SELECT pg_advisory_xact_lock($1::bigint)`, einsatzLockKey(einsatzId).toString());

    // Sequenz-Anteil numerisch sortieren, nicht lexikographisch — sonst sortiert
    // Postgres `'P-999'` vor `'P-1000'` (`9` > `1` als Zeichen).
    const rows = (await client.$queryRaw`
      SELECT patientennummer
      FROM patienten
      WHERE einsatz_id = ${einsatzId}
      ORDER BY CAST(SUBSTRING(patientennummer FROM 3) AS INTEGER) DESC
      LIMIT 1
    `) as Array<{ patientennummer: string }>;

    const lastPatientennummer = rows[0]?.patientennummer ?? null;
    const nextSequence = this.parseSequence(lastPatientennummer) + 1;

    return Patientennummer.fromSequence(nextSequence);
  }

  // Mapper

  private toPersistence(patient: Patient): Prisma.PatientUncheckedCreateInput {
    const erfasserData = patient.erfasserRef.data;
    return {
      id: patient.id.value,
      einsatzId: patient.einsatzId,
      patientennummer: patient.patientennummer.value,
      diviVakNummer: patient.diviVakNummer?.value ?? null,
      aktuelleSk: patient.aktuelleSk.code,
      behandlungsstatus: patient.behandlungsstatus.code,
      transportstatus: patient.transportstatus.code,
      erfasstAm: patient.erfasstAm,
      erfasserUserId: erfasserData.type === 'user' ? erfasserData.userId : null,
      erfasserDeviceId: erfasserData.type === 'device' ? erfasserData.deviceId : null,
      erfasserSessionId: erfasserData.type === 'device' ? (erfasserData.captureSessionId ?? null) : null,
      clockDriftSeconds: patient.clockDriftSeconds,
      notiz: patient.notiz,
    };
  }

  /**
   * Mapped ein bereits emittiertes `PatientDomainEvent` auf eine
   * `PatientEvent`-Row (Story 1.2, Architecture §D-1).
   *
   * Der `eventType`-Discriminator stammt aus der statischen `eventName()`-Methode
   * der Event-Klasse — exakt derselbe Identifier, den auch der Outbox
   * `EventSerializer` als Switch-Case verwendet. Damit bleibt der
   * Persistenz-Stream binärgleich zur Outbox-Pipeline (DRY, Architecture §D-6).
   */
  private toPatientEventRow(patient: Patient, event: PatientDomainEvent): Prisma.PatientEventUncheckedCreateInput {
    const serialized = this.eventSerializer.serialize(event);
    return {
      patientId: patient.id.value,
      einsatzId: patient.einsatzId,
      eventType: serialized.eventName,
      eventVersion: event.eventVersion,
      payload: serialized.payload as Prisma.InputJsonValue,
      occurredAt: event.occurredAt,
      actorUserId: event.actorUserId ?? null,
      actorDeviceId: event.actorDeviceId ?? null,
      originSessionId: event.originSessionId ?? null,
      clockDriftSeconds: event.clockDriftSeconds ?? null,
      outboxRef: null,
    };
  }

  private async loadEventVersion(client: PrismaTransactionClient, patientId: string): Promise<number> {
    const aggregate = (await client.patientEvent.aggregate({
      _max: { eventVersion: true },
      where: { patientId },
    })) as { _max: { eventVersion: number | null } };
    return aggregate._max.eventVersion ?? 1;
  }

  private toAggregate(row: PrismaPatientRow, eventVersion: number): Patient {
    const patientennummer = Patientennummer.fromString(row.patientennummer).value!;
    const aktuelleSk = Sichtungskategorie.create(row.aktuelleSk as SkCode).value!;
    const behandlungsstatus = Behandlungsstatus.create(row.behandlungsstatus as BehandlungsstatusCode).value!;
    const transportstatus = Transportstatus.create(row.transportstatus as TransportstatusCode).value!;
    const erfasserRef = this.buildErfasserRef(row);
    const diviVakNummer = row.diviVakNummer ? DiviVakNummer.create(row.diviVakNummer).value! : null;

    const reconstituteResult = Patient.reconstitute({
      id: row.id,
      einsatzId: row.einsatzId,
      patientennummer,
      diviVakNummer,
      aktuelleSk,
      behandlungsstatus,
      transportstatus,
      erfasstAm: row.erfasstAm,
      erfasserRef,
      eventVersion,
      clockDriftSeconds: row.clockDriftSeconds,
      notiz: row.notiz ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
    if (reconstituteResult.isFailure || !reconstituteResult.value) {
      throw new Error(`Infrastructure:PatientReconstituteFailed:${reconstituteResult.error}`);
    }
    return reconstituteResult.value;
  }

  private buildErfasserRef(row: PrismaPatientRow): ErfasserRef {
    if (row.erfasserUserId) {
      const result = ErfasserRef.user(row.erfasserUserId);
      if (result.isFailure || !result.value) {
        throw new Error(`Infrastructure:ErfasserRefUserInvalid:${result.error}`);
      }
      return result.value;
    }
    if (row.erfasserDeviceId) {
      const result = ErfasserRef.device(row.erfasserDeviceId, row.erfasserSessionId ?? undefined);
      if (result.isFailure || !result.value) {
        throw new Error(`Infrastructure:ErfasserRefDeviceInvalid:${result.error}`);
      }
      return result.value;
    }
    throw new Error('Infrastructure:PatientErfasserRefFehlt');
  }

  private parseSequence(patientennummer: string | null): number {
    if (!patientennummer) return 0;
    const match = /^P-(\d+)$/.exec(patientennummer);
    const sequencePart = match?.[1];
    if (!sequencePart) {
      throw new Error(`Infrastructure:CorruptPatientennummer:${patientennummer}`);
    }
    const n = Number.parseInt(sequencePart, 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new Error(`Infrastructure:CorruptPatientennummer:${patientennummer}`);
    }
    return n;
  }
}
