/**
 * Integration-Tests für den PatientRepositoryAdapter (Story 1.1, Issue #417).
 *
 * Decken die ACs ab:
 * - AC4: save+findById Round-Trip mit ValueObjects.
 * - AC4: nextPatientennummer startet bei P-001 pro Einsatz.
 * - AC4 / Architecture §D-3: parallele Inserts werden race-resistent
 *   durch Advisory-Lock aufgelöst (P-001 + P-002, kein Doppelvergebnis).
 * - AC4: Einsatz-Isolation der Sequence.
 *
 * Skip bei fehlender DATABASE_URL (lokale Entwicklung ohne Postgres).
 */

import { PrismaClient } from '@/generated/prisma/client';
import { Patient } from '@domain/patienten/aggregates/patient.aggregate';
import { ErfasserRef } from '@domain/patienten/value-objects/erfasser-ref.vo';
import { Patientennummer } from '@domain/patienten/value-objects/patientennummer.vo';
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

/**
 * Eindeutiger Suffix pro Test-Process — `Date.now()` allein kollidiert in
 * Jest-Worker-Parallel-Runs auf demselben Millisekunden-Tick. Kombination aus
 * Millis + PID + Random-Suffix macht das praktisch deterministisch eindeutig.
 */
function makeTestRunId(): string {
  const millis = Date.now().toString(36);
  const pid = (typeof process !== 'undefined' && process.pid ? process.pid : 0).toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${millis}-${pid}-${rand}`;
}

function buildPatient(einsatzId: string, patientennummer: Patientennummer): Patient {
  return Patient.create({
    einsatzId,
    patientennummer,
    erfasserRef: ErfasserRef.user('user-fixture').value!,
    erfasstAm: new Date('2026-05-19T10:00:00Z'),
  }).value!;
}

describe('PatientRepositoryAdapter — Integration', () => {
  let prisma: PrismaClient;
  let repository: PatientRepositoryAdapter;
  let databaseAvailable = false;
  const testRunId = makeTestRunId();
  let testUserId: string;
  let testEinsatzAId: string;
  let testEinsatzBId: string;

  beforeAll(async () => {
    databaseAvailable = await skipIfNoDatabase();
    if (!databaseAvailable) return;

    prisma = createTestPrismaClient();
    // PrismaService nutzt Proxy-Pattern (composition) — direktes Aushändigen
    // des Clients reicht für den Adapter, der nur `patient.*`, `patientEvent.*`
    // und `$queryRaw`/`$executeRawUnsafe` aufruft.
    repository = new PatientRepositoryAdapter(prisma as unknown as PrismaService, new EventSerializer());

    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM patient_events WHERE patient_id IN (SELECT id FROM patienten WHERE einsatz_id IN (SELECT id FROM einsaetze WHERE "createdBy" IN (SELECT id FROM "User" WHERE username LIKE 'patient-repo-it-user-%')))`,
      );
      await prisma.$executeRawUnsafe(`DELETE FROM patienten WHERE einsatz_id IN (SELECT id FROM einsaetze WHERE "createdBy" IN (SELECT id FROM "User" WHERE username LIKE 'patient-repo-it-user-%'))`);
      await prisma.$executeRawUnsafe(`DELETE FROM einsaetze WHERE "createdBy" IN (SELECT id FROM "User" WHERE username LIKE 'patient-repo-it-user-%')`);
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'patient-repo-it-user-%'`);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }

    testUserId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, 'x', 'ADMIN', true, NOW(), NOW())`,
      testUserId,
      `patient-repo-it-user-${testRunId}`,
    );

    testEinsatzAId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO einsaetze (id, "alarmstichwort", nummer, status, "createdAt", "updatedAt", "createdBy") VALUES ($1, 'Patient-Repo-A', $2, 'ANGELEGT', NOW(), NOW(), $3)`,
      testEinsatzAId,
      `PATIENT-A-${testRunId}`,
      testUserId,
    );

    testEinsatzBId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO einsaetze (id, "alarmstichwort", nummer, status, "createdAt", "updatedAt", "createdBy") VALUES ($1, 'Patient-Repo-B', $2, 'ANGELEGT', NOW(), NOW(), $3)`,
      testEinsatzBId,
      `PATIENT-B-${testRunId}`,
      testUserId,
    );
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM patient_events WHERE einsatz_id IN ($1, $2)`, testEinsatzAId, testEinsatzBId);
      await prisma.$executeRawUnsafe(`DELETE FROM patienten WHERE einsatz_id IN ($1, $2)`, testEinsatzAId, testEinsatzBId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM einsaetze WHERE id IN ($1, $2)`, testEinsatzAId, testEinsatzBId);
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = $1`, testUserId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
    await prisma.$disconnect();
  });

  // ===== Tests =====

  it('save + findById liefert das Aggregate 1:1 (User-Erfasser)', async () => {
    if (!databaseAvailable) return;
    const patient = buildPatient(testEinsatzAId, Patientennummer.fromSequence(1).value!);
    const saved = await prisma.$transaction(async (tx) => repository.save(patient, tx));
    expect(saved.isSuccess).toBe(true);

    const loaded = await repository.findById(patient.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id.value).toBe(patient.id.value);
    expect(loaded!.einsatzId).toBe(testEinsatzAId);
    expect(loaded!.patientennummer.value).toBe('P-001');
    expect(loaded!.aktuelleSk.code).toBe('SK_III');
    expect(loaded!.behandlungsstatus.code).toBe('UNVERSORGT');
    expect(loaded!.transportstatus.code).toBe('WARTEND');
    expect(loaded!.erfasserRef.type).toBe('user');
  });

  it('save + findById bewahrt Device-Erfasser samt captureSessionId', async () => {
    if (!databaseAvailable) return;
    const patient = Patient.create({
      einsatzId: testEinsatzAId,
      patientennummer: Patientennummer.fromSequence(1).value!,
      erfasserRef: ErfasserRef.device('tablet-X', 'cs_42').value!,
      erfasstAm: new Date('2026-05-19T11:00:00Z'),
    }).value!;
    await prisma.$transaction(async (tx) => repository.save(patient, tx));
    const loaded = await repository.findById(patient.id);
    expect(loaded!.erfasserRef.type).toBe('device');
    const data = loaded!.erfasserRef.data as { type: 'device'; deviceId: string; captureSessionId?: string };
    expect(data.deviceId).toBe('tablet-X');
    expect(data.captureSessionId).toBe('cs_42');
  });

  it('nextPatientennummer startet bei P-001 pro Einsatz und inkrementiert deterministisch', async () => {
    if (!databaseAvailable) return;
    await prisma.$transaction(async (tx) => {
      const first = await repository.nextPatientennummer(testEinsatzAId, tx);
      expect(first.value?.value).toBe('P-001');
      await repository.save(buildPatient(testEinsatzAId, first.value!), tx);

      const second = await repository.nextPatientennummer(testEinsatzAId, tx);
      expect(second.value?.value).toBe('P-002');
    });
  });

  it('parallele Inserts liefern dank Advisory-Lock luckenlos P-001..P-005 ohne Doppelvergabe', async () => {
    if (!databaseAvailable) return;
    const parallel = 5;
    const results = await Promise.all(
      Array.from({ length: parallel }, () =>
        prisma.$transaction(async (tx) => {
          const next = await repository.nextPatientennummer(testEinsatzAId, tx);
          if (next.isFailure || !next.value) {
            throw new Error(next.error ?? 'nextPatientennummer fehlgeschlagen');
          }
          const patient = buildPatient(testEinsatzAId, next.value);
          const saved = await repository.save(patient, tx);
          if (saved.isFailure) {
            throw new Error(saved.error ?? 'save fehlgeschlagen');
          }
          return patient.patientennummer.value;
        }),
      ),
    );

    expect(results.sort()).toEqual(['P-001', 'P-002', 'P-003', 'P-004', 'P-005']);
  });

  it('save persistiert PatientErfasst-Event in PatientEvent-Tabelle (Story 1.2, Architecture §D-6)', async () => {
    if (!databaseAvailable) return;
    const patient = buildPatient(testEinsatzAId, Patientennummer.fromSequence(1).value!);
    expect(patient.getDomainEvents().length).toBe(1);

    await prisma.$transaction(async (tx) => repository.save(patient, tx));

    const eventRows = await prisma.patientEvent.findMany({
      where: { patientId: patient.id.value },
      orderBy: { eventVersion: 'asc' },
    });
    expect(eventRows.length).toBe(1);
    expect(eventRows[0].eventType).toBe('patient.erfasst');
    expect(eventRows[0].eventVersion).toBe(1);
    expect(eventRows[0].einsatzId).toBe(testEinsatzAId);
    expect(eventRows[0].actorUserId).toBe('user-fixture');
    expect(eventRows[0].outboxRef).toBeNull();
    expect((eventRows[0].payload as { patientennummer?: string }).patientennummer).toBe('P-001');

    // clearDomainEvents wird vom Repository aufgerufen — das Aggregate ist „leer".
    expect(patient.getDomainEvents().length).toBe(0);
  });

  it('save rollt PatientEvent-Insert mit Aggregate-Insert in einer TX zurück', async () => {
    if (!databaseAvailable) return;
    const patient = buildPatient(testEinsatzAId, Patientennummer.fromSequence(1).value!);

    await expect(
      prisma.$transaction(async (tx) => {
        await repository.save(patient, tx);
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');

    const patientRows = await prisma.patient.findMany({ where: { id: patient.id.value } });
    const eventRows = await prisma.patientEvent.findMany({ where: { patientId: patient.id.value } });
    expect(patientRows.length).toBe(0);
    expect(eventRows.length).toBe(0);
  });

  it('parallele Inserts schreiben jedem Patient genau ein PatientErfasst-Event', async () => {
    if (!databaseAvailable) return;
    const parallel = 3;
    await Promise.all(
      Array.from({ length: parallel }, () =>
        prisma.$transaction(async (tx) => {
          const next = await repository.nextPatientennummer(testEinsatzAId, tx);
          const patient = buildPatient(testEinsatzAId, next.value!);
          const saved = await repository.save(patient, tx);
          if (saved.isFailure) {
            throw new Error(saved.error ?? 'save fehlgeschlagen');
          }
        }),
      ),
    );

    const eventCount = await prisma.patientEvent.count({ where: { einsatzId: testEinsatzAId } });
    expect(eventCount).toBe(parallel);
  });

  it('Sequenzen sind pro Einsatz unabhängig (Einsatz A: P-001, Einsatz B: P-001)', async () => {
    if (!databaseAvailable) return;
    await prisma.$transaction(async (tx) => {
      const a = await repository.nextPatientennummer(testEinsatzAId, tx);
      const b = await repository.nextPatientennummer(testEinsatzBId, tx);
      expect(a.value?.value).toBe('P-001');
      expect(b.value?.value).toBe('P-001');
      await repository.save(buildPatient(testEinsatzAId, a.value!), tx);
      await repository.save(buildPatient(testEinsatzBId, b.value!), tx);

      const a2 = await repository.nextPatientennummer(testEinsatzAId, tx);
      const b2 = await repository.nextPatientennummer(testEinsatzBId, tx);
      expect(a2.value?.value).toBe('P-002');
      expect(b2.value?.value).toBe('P-002');
    });
  });
});
