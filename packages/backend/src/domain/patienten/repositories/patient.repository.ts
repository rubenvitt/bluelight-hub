import type { TransactionContext } from '@domain/common/transaction';
import type { Result } from '@domain/common/result';
import type { Patient, PatientId } from '../aggregates/patient.aggregate';
import type { BehandlungsstatusCode } from '../value-objects/behandlungsstatus.vo';
import type { Patientennummer } from '../value-objects/patientennummer.vo';
import type { SkCode } from '../value-objects/sichtungskategorie.vo';
import type { TransportstatusCode } from '../value-objects/transportstatus.vo';

/**
 * Aggregat-Resultat aus `PatientRepository.getKpiCounts` (Story 1.5, AC1).
 *
 * Repräsentiert die drei `prisma.patient.groupBy()`-Ergebnisse für SK,
 * Behandlung und Transport. Leere Buckets fehlen — der Application-Layer
 * (`KpiAggregatMapper`) initialisiert sie explizit auf `0`. Die Bucket-Werte
 * sind über die Domain-`*Code`-Aliase typisiert; sie sind string-identisch
 * mit den Prisma-Enums, halten den Domain-Port aber framework-agnostisch.
 */
export interface PatientKpiCountRows {
  skRows: Array<{ aktuelleSk: SkCode; count: number }>;
  behandlungRows: Array<{ behandlungsstatus: BehandlungsstatusCode; count: number }>;
  transportRows: Array<{ transportstatus: TransportstatusCode; count: number }>;
}

/**
 * Filter-Vertrag für `findManyByEinsatz` (Story 1.6, AC2).
 *
 * Leere Arrays werden vom Application-Layer bereits zu `undefined` normalisiert
 * (siehe `ListPatientenQuery.create`); der Adapter darf vorhandene Arrays daher
 * als "hat Werte" behandeln.
 */
export interface PatientListFilters {
  sk?: SkCode[];
  behandlungsstatus?: BehandlungsstatusCode[];
  transportstatus?: TransportstatusCode[];
  /** Bereits getrimmter Such-String (max. 64 Zeichen, siehe Query-Factory). */
  search?: string;
}

/** Sortier-Vertrag — `sk` mappt auf `[aktuelleSk, erfasstAm]` (Story 1.6, AC3). */
export interface PatientListSort {
  field: 'sk' | 'zeit' | 'patientennummer';
  direction: 'asc' | 'desc';
}

/** 1-basierte Pagination (Story 1.6, AC1; `pageSize` 1..100). */
export interface PatientListPagination {
  page: number;
  pageSize: number;
}

/**
 * Read-Row aus `findManyByEinsatz` — gespiegelt im Application-Mapper
 * (`patient-list-item.mapper.ts`). Domain-Port bleibt framework-agnostisch.
 */
export interface PatientListRow {
  id: string;
  einsatzId: string;
  patientennummer: string;
  diviVakNummer: string | null;
  aktuelleSk: SkCode;
  behandlungsstatus: BehandlungsstatusCode;
  transportstatus: TransportstatusCode;
  erfasstAm: Date;
  eventVersion: number;
}

/** Aggregat-Resultat aus `findManyByEinsatz`. */
export interface PatientListResult {
  items: PatientListRow[];
  total: number;
}

/**
 * Dünner Persistenz-Row-Type für `findEventsByPatientId` (Story 1.7, AC3).
 *
 * Spiegelt die `PatientEvent`-Spalten (außer `outboxRef` — interner Outbox-
 * Marker, kein Client-Konsum). Hält den Domain-Port framework-agnostisch
 * (keine Prisma-Typen im Domain-Layer). Application-Mapper konvertiert in
 * `PatientEventDto`.
 */
export interface PatientEventRow {
  id: string;
  patientId: string;
  einsatzId: string;
  eventType: string;
  eventVersion: number;
  payload: Record<string, unknown>;
  occurredAt: Date;
  recordedAt: Date;
  actorUserId: string | null;
  actorDeviceId: string | null;
  originSessionId: string | null;
  clockDriftSeconds: number | null;
}

/**
 * Domain-Port für die Patient-Persistenz (Story 1.1, Architecture §D-1/§D-3).
 *
 * Konkrete Implementierung liegt im Infrastructure-Layer
 * (`PatientRepositoryAdapter`). Die Patientennummer wird pro Einsatz monoton
 * und unter `@@unique([einsatzId, patientennummer])` vergeben — siehe Architecture §D-3.
 */
export interface PatientRepository {
  /**
   * Persistiert ein neues Patient-Aggregate. Story 1.1 unterstützt nur den
   * Insert-Pfad (Domain-Event-Persistenz folgt in Story 1.2 via Outbox).
   */
  save(patient: Patient, tx?: TransactionContext): Promise<Result<void>>;

  findById(id: PatientId, tx?: TransactionContext): Promise<Patient | null>;

  /**
   * Liefert die nächste freie Patientennummer für den angegebenen Einsatz.
   * Implementierung garantiert Race-Resistenz durch Insert-Retry auf
   * `UNIQUE([einsatzId, patientennummer])` — kein globaler Postgres-Sequence-Bezug.
   */
  nextPatientennummer(einsatzId: string, tx: TransactionContext): Promise<Result<Patientennummer>>;

  /**
   * Liefert die Aggregat-Counts für den KPI-Read-Endpoint (Story 1.5, AC1,
   * Architecture §D-7). Drei parallele `prisma.patient.groupBy()`-Calls über
   * den denormalisierten Patient-Snapshot — kein Event-Replay, keine
   * Materialized View für MVP.
   *
   * Fehlende Buckets (kein Patient in einer Kategorie) sind im Ergebnis nicht
   * enthalten; der Mapper initialisiert sie auf `0`.
   */
  getKpiCounts(einsatzId: string): Promise<Result<PatientKpiCountRows>>;

  /**
   * Liefert eine paginierte, gefilterte und sortierte Patienten-Read-Projektion
   * für den Listen-Endpoint (Story 1.6, AC1–AC4).
   *
   * Lesepfad — keine Aggregate-Rehydration, keine Events. `eventVersion` pro
   * Row wird per gebatchtem `MAX(eventVersion)`-Join aus `patient_events`
   * angereichert (n+1-frei: ein einzelner GroupBy nach Findall).
   */
  findManyByEinsatz(einsatzId: string, filters: PatientListFilters, sort: PatientListSort, pagination: PatientListPagination): Promise<Result<PatientListResult>>;

  /**
   * Liefert die chronologisch aufsteigend sortierte Event-Historie eines
   * Patienten (Story 1.7, AC1/AC3). Single-Query — der Detail-Handler
   * parallelisiert sie mit `findById` via `Promise.all`.
   *
   * Leeres Array bei unbekannter `patientId` (Defensive); Persistenz-Fehler
   * werden als `Result.fail` propagiert. `outboxRef` ist intern und kein Teil
   * des Row-Shapes (PatientEventRow).
   */
  findEventsByPatientId(patientId: string): Promise<Result<PatientEventRow[]>>;
}
