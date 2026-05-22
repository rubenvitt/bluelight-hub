/**
 * Integration-Tests für `PatientRepositoryAdapter.findManyByEinsatz` (Story 1.6).
 *
 * Deckt:
 * - AC1: Pagination + total über `findMany` + `count`
 * - AC2: Filter-Mapping (SK, Behandlungsstatus, Transportstatus) auf SQL-WHERE
 * - AC3: Sort-Ordering — SK-Priorität asc (`SK_I…SK_IV, TOT`), `erfasstAm` asc/desc, `patientennummer` asc
 * - AC4: Volltext-`search` mit deutscher Umlaut-Normalisierung (`Mueller ↔ Müller`) via unaccent
 *
 * Skip bei fehlender DATABASE_URL — wie der bestehende `…adapter.integration.spec.ts`-Lauf.
 */

import { PrismaClient } from '@/generated/prisma/client';
import type { PrismaService } from '@/infrastructure/database/prisma.service';
import { EventSerializer } from '@/infrastructure/outbox/event-serializer';
import { skipIfNoDatabase, createTestPrismaClient } from '@/infrastructure/__tests__/helpers/database-test.helper';
import { PatientRepositoryAdapter } from '../patient-repository.adapter';

function cuid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'c';
  for (let i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function makeTestRunId(): string {
  const millis = Date.now().toString(36);
  const pid = (typeof process !== 'undefined' && process.pid ? process.pid : 0).toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${millis}-${pid}-${rand}`;
}

describe('PatientRepositoryAdapter.findManyByEinsatz — Integration (Story 1.6)', () => {
  let prisma: PrismaClient;
  let repository: PatientRepositoryAdapter;
  let databaseAvailable = false;
  const testRunId = makeTestRunId();
  let testUserId: string;
  let einsatzId: string;
  let otherEinsatzId: string;

  beforeAll(async () => {
    databaseAvailable = await skipIfNoDatabase();
    if (!databaseAvailable) return;

    prisma = createTestPrismaClient();
    repository = new PatientRepositoryAdapter(prisma as unknown as PrismaService, new EventSerializer());

    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM patient_events WHERE patient_id IN (SELECT id FROM patienten WHERE einsatz_id IN (SELECT id FROM einsaetze WHERE "createdBy" IN (SELECT id FROM "User" WHERE username LIKE 'patient-list-it-user-%')))`,
      );
      await prisma.$executeRawUnsafe(`DELETE FROM patienten WHERE einsatz_id IN (SELECT id FROM einsaetze WHERE "createdBy" IN (SELECT id FROM "User" WHERE username LIKE 'patient-list-it-user-%'))`);
      await prisma.$executeRawUnsafe(`DELETE FROM einsaetze WHERE "createdBy" IN (SELECT id FROM "User" WHERE username LIKE 'patient-list-it-user-%')`);
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'patient-list-it-user-%'`);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }

    testUserId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, 'x', 'ADMIN', true, NOW(), NOW())`,
      testUserId,
      `patient-list-it-user-${testRunId}`,
    );

    einsatzId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO einsaetze (id, "alarmstichwort", nummer, status, "createdAt", "updatedAt", "createdBy") VALUES ($1, 'List-Einsatz', $2, 'ANGELEGT', NOW(), NOW(), $3)`,
      einsatzId,
      `PATIENT-LIST-${testRunId}`,
      testUserId,
    );

    otherEinsatzId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO einsaetze (id, "alarmstichwort", nummer, status, "createdAt", "updatedAt", "createdBy") VALUES ($1, 'Other-List-Einsatz', $2, 'ANGELEGT', NOW(), NOW(), $3)`,
      otherEinsatzId,
      `PATIENT-LIST-O-${testRunId}`,
      testUserId,
    );
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM patient_events WHERE einsatz_id IN ($1, $2)`, einsatzId, otherEinsatzId);
      await prisma.$executeRawUnsafe(`DELETE FROM patienten WHERE einsatz_id IN ($1, $2)`, einsatzId, otherEinsatzId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM einsaetze WHERE id IN ($1, $2)`, einsatzId, otherEinsatzId);
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = $1`, testUserId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
    await prisma.$disconnect();
  });

  type SeedPatient = {
    patientennummer: string;
    aktuelleSk: 'SK_I' | 'SK_II' | 'SK_III' | 'SK_IV' | 'TOT';
    behandlungsstatus?: 'UNVERSORGT' | 'IN_BEHANDLUNG' | 'VERSORGT' | 'TRANSPORTBEREIT';
    transportstatus?: 'WARTEND' | 'IM_TRANSPORT' | 'IM_KRANKENHAUS';
    erfasstAm?: Date;
    diviVakNummer?: string | null;
    targetEinsatzId?: string;
  };

  async function seed(patients: SeedPatient[]) {
    for (const p of patients) {
      const id = cuid();
      await prisma.patient.create({
        data: {
          id,
          einsatzId: p.targetEinsatzId ?? einsatzId,
          patientennummer: p.patientennummer,
          diviVakNummer: p.diviVakNummer ?? null,
          aktuelleSk: p.aktuelleSk,
          behandlungsstatus: p.behandlungsstatus ?? 'UNVERSORGT',
          transportstatus: p.transportstatus ?? 'WARTEND',
          erfasstAm: p.erfasstAm ?? new Date(),
          erfasserUserId: testUserId,
        },
      });
      await prisma.patientEvent.create({
        data: {
          patientId: id,
          einsatzId: p.targetEinsatzId ?? einsatzId,
          eventType: 'patient.erfasst',
          eventVersion: 1,
          payload: { patientennummer: p.patientennummer },
          occurredAt: p.erfasstAm ?? new Date(),
          actorUserId: testUserId,
        },
      });
    }
  }

  it('liefert paginierte items + total bei leerem Filter', async () => {
    if (!databaseAvailable) return;
    await seed([
      { patientennummer: 'P-001', aktuelleSk: 'SK_I' },
      { patientennummer: 'P-002', aktuelleSk: 'SK_II' },
      { patientennummer: 'P-003', aktuelleSk: 'SK_III' },
    ]);

    const result = await repository.findManyByEinsatz(einsatzId, {}, { field: 'sk', direction: 'asc' }, { page: 1, pageSize: 2 });

    expect(result.isSuccess).toBe(true);
    const { items, total } = result.value!;
    expect(total).toBe(3);
    expect(items).toHaveLength(2);
    expect(items[0].patientennummer).toBe('P-001');
    expect(items[1].patientennummer).toBe('P-002');
  });

  it('isoliert Patienten je Einsatz (Defense-in-Depth)', async () => {
    if (!databaseAvailable) return;
    await seed([
      { patientennummer: 'P-001', aktuelleSk: 'SK_I' },
      { patientennummer: 'P-010', aktuelleSk: 'SK_II', targetEinsatzId: otherEinsatzId },
    ]);

    const result = await repository.findManyByEinsatz(einsatzId, {}, { field: 'sk', direction: 'asc' }, { page: 1, pageSize: 50 });

    expect(result.value!.total).toBe(1);
    expect(result.value!.items[0].patientennummer).toBe('P-001');
  });

  it('liefert leere items + total=0 bei leerem Einsatz', async () => {
    if (!databaseAvailable) return;
    const result = await repository.findManyByEinsatz(einsatzId, {}, { field: 'sk', direction: 'asc' }, { page: 1, pageSize: 50 });
    expect(result.value).toEqual({ items: [], total: 0 });
  });

  it('filtert nach SK + Behandlungs- + Transportstatus (Multi-Select)', async () => {
    if (!databaseAvailable) return;
    await seed([
      { patientennummer: 'P-001', aktuelleSk: 'SK_I', behandlungsstatus: 'TRANSPORTBEREIT', transportstatus: 'WARTEND' },
      { patientennummer: 'P-002', aktuelleSk: 'SK_II', behandlungsstatus: 'TRANSPORTBEREIT', transportstatus: 'WARTEND' },
      { patientennummer: 'P-003', aktuelleSk: 'SK_III', behandlungsstatus: 'UNVERSORGT', transportstatus: 'WARTEND' },
      { patientennummer: 'P-004', aktuelleSk: 'SK_I', behandlungsstatus: 'TRANSPORTBEREIT', transportstatus: 'IM_TRANSPORT' },
    ]);

    const result = await repository.findManyByEinsatz(
      einsatzId,
      { sk: ['SK_I', 'SK_II'], behandlungsstatus: ['TRANSPORTBEREIT'], transportstatus: ['WARTEND'] },
      { field: 'patientennummer', direction: 'asc' },
      { page: 1, pageSize: 50 },
    );

    expect(result.value!.total).toBe(2);
    expect(result.value!.items.map((i) => i.patientennummer)).toEqual(['P-001', 'P-002']);
  });

  it('sortiert per Default `sk` asc + `erfasstAm` asc — TOT reiht sich am Ende ein', async () => {
    if (!databaseAvailable) return;
    await seed([
      { patientennummer: 'P-001', aktuelleSk: 'TOT', erfasstAm: new Date('2026-01-01') },
      { patientennummer: 'P-002', aktuelleSk: 'SK_III', erfasstAm: new Date('2026-01-02') },
      { patientennummer: 'P-003', aktuelleSk: 'SK_I', erfasstAm: new Date('2026-01-03') },
      { patientennummer: 'P-004', aktuelleSk: 'SK_IV', erfasstAm: new Date('2026-01-04') },
      { patientennummer: 'P-005', aktuelleSk: 'SK_II', erfasstAm: new Date('2026-01-05') },
    ]);

    const result = await repository.findManyByEinsatz(einsatzId, {}, { field: 'sk', direction: 'asc' }, { page: 1, pageSize: 50 });

    expect(result.value!.items.map((i) => i.aktuelleSk)).toEqual(['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT']);
  });

  it('sortiert per `sk` desc invers (TOT zuerst, SK_I zuletzt)', async () => {
    if (!databaseAvailable) return;
    await seed([
      { patientennummer: 'P-001', aktuelleSk: 'SK_I' },
      { patientennummer: 'P-002', aktuelleSk: 'TOT' },
    ]);

    const result = await repository.findManyByEinsatz(einsatzId, {}, { field: 'sk', direction: 'desc' }, { page: 1, pageSize: 50 });

    expect(result.value!.items.map((i) => i.aktuelleSk)).toEqual(['TOT', 'SK_I']);
  });

  it('sortiert per `zeit` desc — jüngster Patient zuerst', async () => {
    if (!databaseAvailable) return;
    await seed([
      { patientennummer: 'P-001', aktuelleSk: 'SK_III', erfasstAm: new Date('2026-01-01') },
      { patientennummer: 'P-002', aktuelleSk: 'SK_III', erfasstAm: new Date('2026-02-01') },
      { patientennummer: 'P-003', aktuelleSk: 'SK_III', erfasstAm: new Date('2026-03-01') },
    ]);

    const result = await repository.findManyByEinsatz(einsatzId, {}, { field: 'zeit', direction: 'desc' }, { page: 1, pageSize: 50 });

    expect(result.value!.items.map((i) => i.patientennummer)).toEqual(['P-003', 'P-002', 'P-001']);
  });

  it('sortiert per `patientennummer` asc lexikografisch', async () => {
    if (!databaseAvailable) return;
    await seed([
      { patientennummer: 'P-010', aktuelleSk: 'SK_III' },
      { patientennummer: 'P-001', aktuelleSk: 'SK_III' },
      { patientennummer: 'P-100', aktuelleSk: 'SK_III' },
    ]);

    const result = await repository.findManyByEinsatz(einsatzId, {}, { field: 'patientennummer', direction: 'asc' }, { page: 1, pageSize: 50 });

    expect(result.value!.items.map((i) => i.patientennummer)).toEqual(['P-001', 'P-010', 'P-100']);
  });

  it('reichert `eventVersion` aus dem Event-Stream an (kein N+1)', async () => {
    if (!databaseAvailable) return;
    await seed([
      { patientennummer: 'P-001', aktuelleSk: 'SK_III' },
      { patientennummer: 'P-002', aktuelleSk: 'SK_III' },
    ]);
    const pat = await prisma.patient.findFirst({ where: { patientennummer: 'P-002', einsatzId } });
    await prisma.patientEvent.create({
      data: {
        patientId: pat!.id,
        einsatzId,
        eventType: 'patient.sichtung-aktualisiert',
        eventVersion: 5,
        payload: {},
        occurredAt: new Date(),
        actorUserId: testUserId,
      },
    });

    const result = await repository.findManyByEinsatz(einsatzId, {}, { field: 'patientennummer', direction: 'asc' }, { page: 1, pageSize: 50 });

    const itemByNummer = (n: string) => result.value!.items.find((i) => i.patientennummer === n);
    expect(itemByNummer('P-001')?.eventVersion).toBe(1);
    expect(itemByNummer('P-002')?.eventVersion).toBe(5);
  });

  it('search matched Patientennummer mit unaccent (Umlaut-normalisiert via DIVI-VAK)', async () => {
    if (!databaseAvailable) return;
    await seed([
      { patientennummer: 'P-001', aktuelleSk: 'SK_III', diviVakNummer: 'DIVI-Müller-42' },
      { patientennummer: 'P-002', aktuelleSk: 'SK_III', diviVakNummer: 'DIVI-Schmidt-7' },
    ]);

    const muellerResult = await repository.findManyByEinsatz(einsatzId, { search: 'Mueller' }, { field: 'patientennummer', direction: 'asc' }, { page: 1, pageSize: 50 });

    expect(muellerResult.value!.total).toBe(1);
    expect(muellerResult.value!.items[0].patientennummer).toBe('P-001');

    const muellerUmlautResult = await repository.findManyByEinsatz(einsatzId, { search: 'Müller' }, { field: 'patientennummer', direction: 'asc' }, { page: 1, pageSize: 50 });

    expect(muellerUmlautResult.value!.total).toBe(1);
    expect(muellerUmlautResult.value!.items[0].patientennummer).toBe('P-001');

    const directNummerResult = await repository.findManyByEinsatz(einsatzId, { search: 'P-002' }, { field: 'patientennummer', direction: 'asc' }, { page: 1, pageSize: 50 });

    expect(directNummerResult.value!.total).toBe(1);
    expect(directNummerResult.value!.items[0].patientennummer).toBe('P-002');
  });
});
