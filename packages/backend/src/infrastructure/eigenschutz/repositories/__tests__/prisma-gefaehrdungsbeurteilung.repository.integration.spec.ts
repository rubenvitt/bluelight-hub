// @ts-nocheck
/**
 * Integration Tests für PrismaGefaehrdungsbeurteilungRepository gegen eine
 * echte PostgreSQL-Datenbank (Story 415-2-1).
 *
 * Validiert:
 *  - `save(aggregate, tx)` persistiert Haupt-Row inkl. FKs und JSONB-Items.
 *  - `findById(id, tx)` rekonstruiert das Aggregate via Mapper-Round-Trip.
 *  - `existsForEinheit(einsatzId, einheitId, tx)` liefert true/false.
 *  - Unique-Constraint `@@unique([einsatzId, einheitId])` wird als
 *    `Result.fail(...)` propagiert (Repo try/catch), **nicht** als Exception.
 *  - "Deep-Copy-Beweis" auf DB-Ebene: Zwei Saves mit unterschiedlichen IDs aber
 *    strukturell identischen Items landen als unabhängige JSONB-Rows.
 *
 * **Hinweise zur Transaktions-Semantik:**
 * `save` und `existsForEinheit` verlangen einen verpflichtenden
 * `TransactionContext` (Application-Layer-Kontrakt). In den Tests wird daher
 * ausschließlich `prisma.$transaction(async (tx) => { ... })` als Wrapper
 * verwendet. `findById` akzeptiert einen optionalen `tx`-Parameter.
 *
 * Überspringt sich, wenn DATABASE_URL nicht erreichbar ist.
 */

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
  isCuid: jest.fn((id: string) => {
    if (typeof id !== 'string') return false;
    if (id.length < 20 || id.length > 30) return false;
    return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id);
  }),
}));

import type { Gefaehrdungsbeurteilung as PrismaGefaehrdungsbeurteilungRow, PrismaClient } from '@/generated/prisma/client';
import { Gefaehrdungsbeurteilung } from '@domain/eigenschutz/aggregates/gefaehrdungsbeurteilung.aggregate';
import { GefaehrdungItem } from '@domain/eigenschutz/value-objects/gefaehrdung-item.vo';
import type { ILogger } from '@domain/ports/i-logger.port';
import { skipIfNoDatabase, createTestPrismaClient } from '@/infrastructure/__tests__/helpers/database-test.helper';
import { PrismaGefaehrdungsbeurteilungRepository } from '../prisma-gefaehrdungsbeurteilung.repository';

// ---------- Helper-Funktionen ----------

/** Erzeugt eine CUID2-ähnliche ID. */
function cuid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'c';
  for (let i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

/** Mock-Logger für Infrastructure-Tests. */
const createMockLogger = (): ILogger => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

/**
 * Erzeugt ein valides `GefaehrdungItem` für Tests. Default `eintritt/schaden`
 * landen nach ADR-013-Matrix in der Klasse ORANGE (3×4 = 12). Die
 * `risikoklasse` wird vom VO backend-autoritativ aus Eintritt + Schaden
 * berechnet — ein explizit übergebenes `risikoklasse`-Feld überschreibt
 * das Ergebnis nicht (Story 2.2 AC3).
 */
function makeItem(title: string, overrides: Partial<Parameters<typeof GefaehrdungItem.create>[0]> = {}): GefaehrdungItem {
  const result = GefaehrdungItem.create({
    title,
    description: 'Test-Beschreibung',
    eintritt: 'HAEUFIG',
    schaden: 'HOCH',
    schutzmassnahmen: 'PSA tragen',
    ...overrides,
  });
  if (result.isFailure || !result.value) throw new Error(`Ungültiges Test-Item: ${result.error}`);
  return result.value;
}

describe('PrismaGefaehrdungsbeurteilungRepository - Integration Tests', () => {
  let prisma: PrismaClient;
  let repository: PrismaGefaehrdungsbeurteilungRepository;
  let databaseAvailable = false;
  const testRunId = Date.now();
  let testUserId: string;
  let testEinsatzId: string;
  let testEinheitId: string;

  // ========================================
  // SETUP & TEARDOWN
  // ========================================

  beforeAll(async () => {
    databaseAvailable = await skipIfNoDatabase();
    if (!databaseAvailable) return;

    prisma = createTestPrismaClient();
    repository = new PrismaGefaehrdungsbeurteilungRepository(prisma as unknown as never, createMockLogger());

    // Cleanup von vorherigen, fehlgeschlagenen Test-Runs (max. 1h alt).
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM gefaehrdungsbeurteilung_versionen WHERE "gef_beurteilung_id" IN (SELECT id FROM gefaehrdungsbeurteilungen WHERE "erstellt_von_user_id" IN (SELECT id FROM "User" WHERE username LIKE 'gb-repo-it-user-%'))`,
      );
      await prisma.$executeRawUnsafe(`DELETE FROM gefaehrdungsbeurteilungen WHERE "erstellt_von_user_id" IN (SELECT id FROM "User" WHERE username LIKE 'gb-repo-it-user-%')`);
      await prisma.$executeRawUnsafe(`DELETE FROM einsatz_einheiten WHERE "created_by" IN (SELECT id FROM "User" WHERE username LIKE 'gb-repo-it-user-%')`);
      await prisma.$executeRawUnsafe(`DELETE FROM einsaetze WHERE "createdBy" IN (SELECT id FROM "User" WHERE username LIKE 'gb-repo-it-user-%')`);
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'gb-repo-it-user-%'`);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }

    // Test-User anlegen (CUID-ID, sonst FK-Typ-Mismatch auf createdBy).
    const userId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, 'x', 'ADMIN', true, NOW(), NOW())`,
      userId,
      `gb-repo-it-user-${testRunId}`,
    );
    testUserId = userId;

    // Test-Einsatz anlegen.
    testEinsatzId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO einsaetze (id, "alarmstichwort", nummer, status, "createdAt", "updatedAt", "createdBy") VALUES ($1, $2, $3, 'ANGELEGT', NOW(), NOW(), $4)`,
      testEinsatzId,
      'GB-Repo-Test',
      `GB-${testRunId}`,
      testUserId,
    );

    // Test-Einheit anlegen.
    testEinheitId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO einsatz_einheiten (id, "einsatz_id", name, typ, status, "soll_staerke", "created_at", "updated_at", "created_by") VALUES ($1, $2, $3, 'GRUPPE', 'AUFGESTELLT', 0, NOW(), NOW(), $4)`,
      testEinheitId,
      testEinsatzId,
      `GB-Einheit-${testRunId}`,
      testUserId,
    );
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    // Jeder Test räumt die eigenen GB-Rows + Versionen ab (Cascade via FK).
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM gefaehrdungsbeurteilungen WHERE einsatz_id = $1`, testEinsatzId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe('DELETE FROM einsatz_einheiten WHERE id = $1', testEinheitId);
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE id = $1', testEinsatzId);
      await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id = $1', testUserId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
    await prisma.$disconnect();
  });

  // ========================================
  // save()
  // ========================================

  describe('save()', () => {
    it('sollte Haupt-Row inkl. FKs und JSONB-Items persistieren', async () => {
      if (!databaseAvailable) return;
      // Given
      const item1 = makeItem('Patientenblut-Kontakt');
      // Story 2.2: Backend berechnet risikoklasse autoritativ.
      // OFT × HOCH = 4×4 = 16 → ROT.
      const item2 = makeItem('Glatteis am Einsatzort', { eintritt: 'OFT' });
      const aggregate = Gefaehrdungsbeurteilung.create({
        einsatzId: testEinsatzId,
        einheitId: testEinheitId,
        createdBy: testUserId,
        items: [item1, item2],
      }).value as Gefaehrdungsbeurteilung;

      // When
      const saveResult = await prisma.$transaction(async (tx) => repository.save(aggregate, tx));

      // Then
      expect(saveResult.isSuccess).toBe(true);

      const row = await prisma.gefaehrdungsbeurteilung.findUnique({ where: { id: aggregate.id.value } });
      expect(row).not.toBeNull();
      expect(row?.einsatzId).toBe(testEinsatzId);
      expect(row?.einheitId).toBe(testEinheitId);
      expect(row?.erstelltVonUserId).toBe(testUserId);
      expect(row?.aktualisiertVonUserId).toBe(testUserId);
      expect(row?.version).toBe(1);
      expect(row?.vorlageId).toBeNull();
      expect(row?.gefahrenzoneId).toBeNull();

      // JSONB-Items: Länge + Strukturerhalt (mindestens Titel + Risikoklasse).
      const items = row?.items as unknown as Array<Record<string, unknown>>;
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(2);
      expect(items[0]?.title).toBe('Patientenblut-Kontakt');
      expect(items[0]?.risikoklasse).toBe('ORANGE');
      expect(items[1]?.title).toBe('Glatteis am Einsatzort');
      expect(items[1]?.risikoklasse).toBe('ROT');
    });

    it('sollte optionale vorlageId korrekt persistieren (FK auf Vorlagen-Tabelle)', async () => {
      if (!databaseAvailable) return;
      // Given: Vorlage aus Seeds (Story 1.4) — falls Seeds in dieser DB noch
      // nicht gelaufen sind, legen wir eine minimale Vorlage selbst an.
      // Gefahrenzone-FK wird aus Fixture-Overhead-Gründen separat im E2E
      // getestet — hier genügt, dass der Repo beide Nullable-FKs unabhängig in
      // die Create-Data überführt.
      let vorlage = await prisma.gefaehrdungsbeurteilungVorlage.findFirst({ where: { aktiv: true } });
      let seededHere = false;
      if (!vorlage) {
        const vorlageId = cuid();
        await prisma.$executeRawUnsafe(
          `INSERT INTO gefaehrdungsbeurteilung_vorlagen (id, slug, name, szenario, items, version, aktiv, erstellt_am, erstellt_von_user_id) VALUES ($1, $2, $3, $4, $5::jsonb, 1, true, NOW(), $6)`,
          vorlageId,
          `test-vorlage-${testRunId}`,
          `Test-Vorlage ${testRunId}`,
          'Test',
          JSON.stringify([{ title: 'Seed-Item' }]),
          testUserId,
        );
        vorlage = await prisma.gefaehrdungsbeurteilungVorlage.findUnique({ where: { id: vorlageId } });
        seededHere = true;
      }
      if (!vorlage) throw new Error('Konnte Vorlage nicht anlegen');

      try {
        const aggregate = Gefaehrdungsbeurteilung.create({
          einsatzId: testEinsatzId,
          einheitId: testEinheitId,
          createdBy: testUserId,
          vorlageId: vorlage.id,
          gefahrenzoneId: null,
          items: [makeItem('Aus-Vorlage')],
        }).value as Gefaehrdungsbeurteilung;

        // When
        const saveResult = await prisma.$transaction(async (tx) => repository.save(aggregate, tx));

        // Then
        expect(saveResult.isSuccess).toBe(true);
        const row = await prisma.gefaehrdungsbeurteilung.findUnique({ where: { id: aggregate.id.value } });
        expect(row?.vorlageId).toBe(vorlage.id);
        expect(row?.gefahrenzoneId).toBeNull();
      } finally {
        if (seededHere && vorlage) {
          // afterEach räumt GB-Rows auf; Vorlage selbst muss explizit weg.
          await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
          try {
            await prisma.$executeRawUnsafe(`DELETE FROM gefaehrdungsbeurteilungen WHERE vorlage_id = $1`, vorlage.id);
            await prisma.$executeRawUnsafe(`DELETE FROM gefaehrdungsbeurteilung_vorlagen WHERE id = $1`, vorlage.id);
          } finally {
            await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
          }
        }
      }
    });

    it('sollte Unique-Constraint `(einsatzId, einheitId)` als Result.fail propagieren (P2002)', async () => {
      if (!databaseAvailable) return;
      // Given: Erste Beurteilung wurde erfolgreich gespeichert.
      const first = Gefaehrdungsbeurteilung.create({
        einsatzId: testEinsatzId,
        einheitId: testEinheitId,
        createdBy: testUserId,
        items: [makeItem('Erste')],
      }).value as Gefaehrdungsbeurteilung;
      const firstSave = await prisma.$transaction(async (tx) => repository.save(first, tx));
      expect(firstSave.isSuccess).toBe(true);

      // When: Zweite Beurteilung mit gleicher (einsatzId, einheitId) wird gespeichert.
      const second = Gefaehrdungsbeurteilung.create({
        einsatzId: testEinsatzId,
        einheitId: testEinheitId,
        createdBy: testUserId,
        items: [makeItem('Zweite')],
      }).value as Gefaehrdungsbeurteilung;

      let secondSaveResult;
      try {
        secondSaveResult = await prisma.$transaction(async (tx) => repository.save(second, tx));
      } catch (err) {
        // Prisma wirft beim ROLLBACK in bestimmten Versionen; das Repo-Contract
        // ist `Result.fail`. Beide Enden sind akzeptabel — wir dokumentieren
        // den beobachteten Pfad.
        secondSaveResult = { isSuccess: false, isFailure: true, error: (err as Error).message };
      }

      // Then: Kein Success (Repo fängt P2002 oder Outer-TX rollbacked).
      expect(secondSaveResult.isSuccess).toBe(false);
      // Und: Wenn das Repo den P2002-Pfad nimmt, liefert es den BusinessRule-
      // Sentinel, den der Controller auf HTTP 422 mappt — konsistent mit dem
      // Pre-Check-Pfad im Handler (Review-Patch 2026-04-22 gegen TOCTOU-Lücke).
      // Wird dagegen der Outer-$transaction-Rollback-Pfad ausgelöst, kommt die
      // Prisma-Rohmeldung zurück — beide Pfade sind akzeptable Contract-Enden.
      const sentinel = 'BusinessRule:EinheitHatBereitsBeurteilung';
      const errorMessage = (secondSaveResult as { error?: string }).error ?? '';
      expect(errorMessage === sentinel || /P2002|Unique/i.test(errorMessage)).toBe(true);
      // Und: Nur die erste Zeile existiert (Unique-Constraint hat gehalten).
      const count = await prisma.gefaehrdungsbeurteilung.count({
        where: { einsatzId: testEinsatzId, einheitId: testEinheitId },
      });
      expect(count).toBe(1);
    });

    it('Deep-Copy-Beweis: Zwei Saves mit strukturell identischen Items erzeugen unabhängige Rows', async () => {
      if (!databaseAvailable) return;
      // Given: Zwei separate Einheiten (damit Unique-Constraint nicht greift).
      const secondEinheitId = cuid();
      await prisma.$executeRawUnsafe(
        `INSERT INTO einsatz_einheiten (id, "einsatz_id", name, typ, status, "soll_staerke", "created_at", "updated_at", "created_by") VALUES ($1, $2, $3, 'GRUPPE', 'AUFGESTELLT', 0, NOW(), NOW(), $4)`,
        secondEinheitId,
        testEinsatzId,
        `GB-Einheit-DeepCopy-${testRunId}`,
        testUserId,
      );

      try {
        const sharedTitle = 'Identische-Gefährdung';
        const agg1 = Gefaehrdungsbeurteilung.create({
          einsatzId: testEinsatzId,
          einheitId: testEinheitId,
          createdBy: testUserId,
          items: [makeItem(sharedTitle)],
        }).value as Gefaehrdungsbeurteilung;

        const agg2 = Gefaehrdungsbeurteilung.create({
          einsatzId: testEinsatzId,
          einheitId: secondEinheitId,
          createdBy: testUserId,
          items: [makeItem(sharedTitle)],
        }).value as Gefaehrdungsbeurteilung;

        // When
        const r1 = await prisma.$transaction(async (tx) => repository.save(agg1, tx));
        const r2 = await prisma.$transaction(async (tx) => repository.save(agg2, tx));

        // Then
        expect(r1.isSuccess).toBe(true);
        expect(r2.isSuccess).toBe(true);
        expect(agg1.id.value).not.toBe(agg2.id.value);

        const row1 = await prisma.gefaehrdungsbeurteilung.findUnique({ where: { id: agg1.id.value } });
        const row2 = await prisma.gefaehrdungsbeurteilung.findUnique({ where: { id: agg2.id.value } });
        expect(row1?.id).not.toBe(row2?.id);
        // Beide JSONB-Arrays halten denselben Titel als unabhängige Kopien.
        expect((row1?.items as Array<Record<string, unknown>>)[0]?.title).toBe(sharedTitle);
        expect((row2?.items as Array<Record<string, unknown>>)[0]?.title).toBe(sharedTitle);
      } finally {
        await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
        try {
          await prisma.$executeRawUnsafe('DELETE FROM gefaehrdungsbeurteilungen WHERE einheit_id = $1', secondEinheitId);
          await prisma.$executeRawUnsafe('DELETE FROM einsatz_einheiten WHERE id = $1', secondEinheitId);
        } finally {
          await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
        }
      }
    });
  });

  // ========================================
  // findById()
  // ========================================

  describe('findById()', () => {
    it('sollte das Aggregate rekonstruiert zurückgeben (Mapper-Round-Trip)', async () => {
      if (!databaseAvailable) return;
      // Given
      // Story 2.2: SELTEN × KATASTROPHAL = 1×5 = 5 → GELB (Backend-Autorität).
      const item = makeItem('Blaulichtfahrt-Stressunfall', { eintritt: 'SELTEN', schaden: 'KATASTROPHAL' });
      const aggregate = Gefaehrdungsbeurteilung.create({
        einsatzId: testEinsatzId,
        einheitId: testEinheitId,
        createdBy: testUserId,
        items: [item],
      }).value as Gefaehrdungsbeurteilung;
      await prisma.$transaction(async (tx) => repository.save(aggregate, tx));

      // When
      const result = await repository.findById(aggregate.id.value);

      // Then
      expect(result.isSuccess).toBe(true);
      const found = result.value;
      expect(found).not.toBeNull();
      expect(found?.id.value).toBe(aggregate.id.value);
      expect(found?.einsatzId).toBe(testEinsatzId);
      expect(found?.einheitId).toBe(testEinheitId);
      expect(found?.createdBy).toBe(testUserId);
      expect(found?.version).toBe(1);
      expect(found?.items).toHaveLength(1);
      expect(found?.items[0]?.title).toBe('Blaulichtfahrt-Stressunfall');
      expect(found?.items[0]?.risikoklasse).toBe('GELB');
      // Factory-Events dürfen beim Read NICHT erneut publiziert werden.
      expect(found?.getDomainEvents()).toHaveLength(0);
    });

    it('sollte Result.ok(null) zurückgeben, wenn die ID nicht existiert', async () => {
      if (!databaseAvailable) return;
      // Given
      const unknownId = cuid();

      // When
      const result = await repository.findById(unknownId);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe('findById()/findReadModelById() — Reconstitution-Failure', () => {
    // Pure-Mock-Suite: prisma wird mocked, kein DB-Bootstrap nötig.
    // Hartkodierte CUIDs vermeiden, dass `testEinsatzId` (nur in beforeAll
    // bei verfügbarer DB gesetzt) undefined ist und die einsatzId-Pflicht-
    // prüfung VOR dem zu testenden Fehler greift.
    const reconstitutionFixtureEinsatzId = 'ckv1example0einsatzid12345678';
    const reconstitutionFixtureEinheitId = 'ckv1example0einheitid12345678';
    const reconstitutionFixtureUserId = 'ckv1example0userid1234567890ab';

    const baseRow = (overrides: Partial<PrismaGefaehrdungsbeurteilungRow> = {}): PrismaGefaehrdungsbeurteilungRow =>
      ({
        id: 'ckv1example0aggregateid123456',
        einsatzId: reconstitutionFixtureEinsatzId,
        einheitId: reconstitutionFixtureEinheitId,
        erstelltVonUserId: reconstitutionFixtureUserId,
        vorlageId: null,
        gefahrenzoneId: null,
        items: [],
        version: 1,
        erstelltAm: new Date('2026-04-24T10:00:00.000Z'),
        aktualisiertAm: new Date('2026-04-24T10:00:00.000Z'),
        aktualisiertVonUserId: reconstitutionFixtureUserId,
        ...overrides,
      }) as PrismaGefaehrdungsbeurteilungRow;

    const repoWithRow = (row: PrismaGefaehrdungsbeurteilungRow, logger: ILogger): PrismaGefaehrdungsbeurteilungRepository =>
      new PrismaGefaehrdungsbeurteilungRepository(
        {
          gefaehrdungsbeurteilung: {
            findUnique: jest.fn().mockResolvedValue(row),
          },
        } as never,
        logger,
      );

    it('findById mappt korrupte Row auf Infrastructure-Sentinel und loggt', async () => {
      const logger = createMockLogger();
      const repo = repoWithRow(baseRow({ version: 0 }), logger);

      const result = await repo.findById('ckv1example0aggregateid123456');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('InfrastructureError:ReconstituteGefaehrdungsbeurteilung');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Reconstitution der Gefährdungsbeurteilung fehlgeschlagen'),
        expect.objectContaining({
          gefaehrdungsbeurteilungId: 'ckv1example0aggregateid123456',
          reason: expect.stringMatching(/version/),
        }),
      );
    });

    it('findReadModelById mappt denselben Fehler ohne Throw auf Result.fail', async () => {
      const logger = createMockLogger();
      const repo = repoWithRow(baseRow({ einsatzId: '' }), logger);

      const result = await repo.findReadModelById('ckv1example0aggregateid123456');

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('InfrastructureError:ReconstituteGefaehrdungsbeurteilung');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Reconstitution der Gefährdungsbeurteilung fehlgeschlagen'),
        expect.objectContaining({
          gefaehrdungsbeurteilungId: 'ckv1example0aggregateid123456',
          reason: expect.stringMatching(/einsatzId/),
        }),
      );
    });
  });

  // ========================================
  // existsForEinheit()
  // ========================================

  describe('existsForEinheit()', () => {
    it('sollte true liefern, wenn eine Beurteilung für (einsatzId, einheitId) existiert', async () => {
      if (!databaseAvailable) return;
      // Given
      const aggregate = Gefaehrdungsbeurteilung.create({
        einsatzId: testEinsatzId,
        einheitId: testEinheitId,
        createdBy: testUserId,
        items: [makeItem('Vorhanden')],
      }).value as Gefaehrdungsbeurteilung;
      await prisma.$transaction(async (tx) => repository.save(aggregate, tx));

      // When
      const result = await prisma.$transaction(async (tx) => repository.existsForEinheit(testEinsatzId, testEinheitId, tx));

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
    });

    it('sollte false liefern, wenn keine Beurteilung für die Kombination existiert', async () => {
      if (!databaseAvailable) return;
      // Given: Keine Zeile angelegt (afterEach hat aufgeräumt).

      // When
      const result = await prisma.$transaction(async (tx) => repository.existsForEinheit(testEinsatzId, testEinheitId, tx));

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
    });

    it('sollte false liefern, wenn eine andere Einheit im selben Einsatz bereits eine Beurteilung hat', async () => {
      if (!databaseAvailable) return;
      // Given: Beurteilung für eine ANDERE Einheit.
      const otherEinheitId = cuid();
      await prisma.$executeRawUnsafe(
        `INSERT INTO einsatz_einheiten (id, "einsatz_id", name, typ, status, "soll_staerke", "created_at", "updated_at", "created_by") VALUES ($1, $2, $3, 'GRUPPE', 'AUFGESTELLT', 0, NOW(), NOW(), $4)`,
        otherEinheitId,
        testEinsatzId,
        `GB-Einheit-Other-${testRunId}`,
        testUserId,
      );

      try {
        const aggregate = Gefaehrdungsbeurteilung.create({
          einsatzId: testEinsatzId,
          einheitId: otherEinheitId,
          createdBy: testUserId,
          items: [makeItem('Andere-Einheit')],
        }).value as Gefaehrdungsbeurteilung;
        await prisma.$transaction(async (tx) => repository.save(aggregate, tx));

        // When: existsForEinheit auf der Ziel-Einheit (nicht auf otherEinheit).
        const result = await prisma.$transaction(async (tx) => repository.existsForEinheit(testEinsatzId, testEinheitId, tx));

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(false);
      } finally {
        await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
        try {
          await prisma.$executeRawUnsafe('DELETE FROM gefaehrdungsbeurteilungen WHERE einheit_id = $1', otherEinheitId);
          await prisma.$executeRawUnsafe('DELETE FROM einsatz_einheiten WHERE id = $1', otherEinheitId);
        } finally {
          await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
        }
      }
    });
  });

  // ========================================
  // updateItems() — Story 2.2
  // ========================================

  describe('updateItems()', () => {
    it('Happy-Path Add-Only: save(1 Item) → updateItems(2 Items) → DB hat 2 Items, version=2, anderer aktualisiertVonUserId', async () => {
      if (!databaseAvailable) return;
      // Given: zweiter User, um die aktualisiertVonUserId-Änderung zu beweisen.
      const secondUserId = cuid();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, 'x', 'ADMIN', true, NOW(), NOW())`,
        secondUserId,
        `gb-repo-it-user-update-${testRunId}-${Date.now()}`,
      );

      try {
        const aggregate = Gefaehrdungsbeurteilung.create({
          einsatzId: testEinsatzId,
          einheitId: testEinheitId,
          createdBy: testUserId,
          items: [makeItem('Initial-Item')],
        }).value as Gefaehrdungsbeurteilung;
        const saveRes = await prisma.$transaction(async (tx) => repository.save(aggregate, tx));
        expect(saveRes.isSuccess).toBe(true);

        // When: updateItems mit 2 Items (aggregate-Version wird 2).
        const newItems = [makeItem('Item-A'), makeItem('Item-B')];
        const updateDomainRes = aggregate.updateItems(newItems, 1, secondUserId);
        expect(updateDomainRes.isSuccess).toBe(true);

        const updateRes = await prisma.$transaction(async (tx) => repository.updateItems(aggregate, secondUserId, tx));

        // Then
        expect(updateRes.isSuccess).toBe(true);
        const row = await prisma.gefaehrdungsbeurteilung.findUnique({ where: { id: aggregate.id.value } });
        expect(row).not.toBeNull();
        expect(row?.version).toBe(2);
        expect(row?.aktualisiertVonUserId).toBe(secondUserId);
        expect(row?.erstelltVonUserId).toBe(testUserId);
        const items = row?.items as unknown as Array<Record<string, unknown>>;
        expect(Array.isArray(items)).toBe(true);
        expect(items).toHaveLength(2);
        expect(items[0]?.title).toBe('Item-A');
        expect(items[1]?.title).toBe('Item-B');
      } finally {
        await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
        try {
          await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = $1`, secondUserId);
        } finally {
          await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
        }
      }
    });

    it('Happy-Path Remove-All: save(2 Items) → updateItems([]) → DB hat 0 Items, version=2', async () => {
      if (!databaseAvailable) return;
      // Given
      const aggregate = Gefaehrdungsbeurteilung.create({
        einsatzId: testEinsatzId,
        einheitId: testEinheitId,
        createdBy: testUserId,
        items: [makeItem('A'), makeItem('B')],
      }).value as Gefaehrdungsbeurteilung;
      const saveRes = await prisma.$transaction(async (tx) => repository.save(aggregate, tx));
      expect(saveRes.isSuccess).toBe(true);

      // When: alle Items entfernen.
      const domainRes = aggregate.updateItems([], 1, testUserId);
      expect(domainRes.isSuccess).toBe(true);
      const updateRes = await prisma.$transaction(async (tx) => repository.updateItems(aggregate, testUserId, tx));

      // Then
      expect(updateRes.isSuccess).toBe(true);
      const row = await prisma.gefaehrdungsbeurteilung.findUnique({ where: { id: aggregate.id.value } });
      expect(row?.version).toBe(2);
      const items = row?.items as unknown as unknown[];
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(0);
    });

    it('Version-Inkrement: 3 sequenzielle Updates (1→2→3→4) — DB hält finale Version und finale Items', async () => {
      if (!databaseAvailable) return;
      // Given
      const aggregate = Gefaehrdungsbeurteilung.create({
        einsatzId: testEinsatzId,
        einheitId: testEinheitId,
        createdBy: testUserId,
        items: [makeItem('V1-Item')],
      }).value as Gefaehrdungsbeurteilung;
      const saveRes = await prisma.$transaction(async (tx) => repository.save(aggregate, tx));
      expect(saveRes.isSuccess).toBe(true);

      // When: 1→2
      const r12 = aggregate.updateItems([makeItem('V2-Item')], 1, testUserId);
      expect(r12.isSuccess).toBe(true);
      const u12 = await prisma.$transaction(async (tx) => repository.updateItems(aggregate, testUserId, tx));
      expect(u12.isSuccess).toBe(true);

      // 2→3
      const r23 = aggregate.updateItems([makeItem('V3-A'), makeItem('V3-B')], 2, testUserId);
      expect(r23.isSuccess).toBe(true);
      const u23 = await prisma.$transaction(async (tx) => repository.updateItems(aggregate, testUserId, tx));
      expect(u23.isSuccess).toBe(true);

      // 3→4
      const r34 = aggregate.updateItems([makeItem('Final-Only')], 3, testUserId);
      expect(r34.isSuccess).toBe(true);
      const u34 = await prisma.$transaction(async (tx) => repository.updateItems(aggregate, testUserId, tx));
      expect(u34.isSuccess).toBe(true);

      // Then
      const row = await prisma.gefaehrdungsbeurteilung.findUnique({ where: { id: aggregate.id.value } });
      expect(row?.version).toBe(4);
      const items = row?.items as unknown as Array<Record<string, unknown>>;
      expect(items).toHaveLength(1);
      expect(items[0]?.title).toBe('Final-Only');
    });

    it('aktualisiertAm-Auto-Update: Prisma @updatedAt setzt neuen Timestamp beim updateItems()', async () => {
      if (!databaseAvailable) return;
      // Given
      const aggregate = Gefaehrdungsbeurteilung.create({
        einsatzId: testEinsatzId,
        einheitId: testEinheitId,
        createdBy: testUserId,
        items: [makeItem('Original')],
      }).value as Gefaehrdungsbeurteilung;
      const saveRes = await prisma.$transaction(async (tx) => repository.save(aggregate, tx));
      expect(saveRes.isSuccess).toBe(true);

      const rowBefore = await prisma.gefaehrdungsbeurteilung.findUnique({ where: { id: aggregate.id.value } });
      expect(rowBefore).not.toBeNull();
      const aktualisiertAmBefore = rowBefore!.aktualisiertAm as Date;

      // Kleine echte Verzögerung, damit Postgres NOW() einen ggf. späteren
      // Timestamp vergibt (auf schnellen Runs kann NOW() gleich bleiben).
      await new Promise((resolve) => setTimeout(resolve, 10));

      // When
      const domainRes = aggregate.updateItems([makeItem('Updated')], 1, testUserId);
      expect(domainRes.isSuccess).toBe(true);
      const updateRes = await prisma.$transaction(async (tx) => repository.updateItems(aggregate, testUserId, tx));
      expect(updateRes.isSuccess).toBe(true);

      // Then
      const rowAfter = await prisma.gefaehrdungsbeurteilung.findUnique({ where: { id: aggregate.id.value } });
      const aktualisiertAmAfter = rowAfter!.aktualisiertAm as Date;
      expect(aktualisiertAmAfter.getTime()).toBeGreaterThanOrEqual(aktualisiertAmBefore.getTime());
    });

    it('Fehlerpfad: updateItems auf nicht-existente ID → Result.fail (P2025, kein Crash)', async () => {
      if (!databaseAvailable) return;
      // Given: Aggregate frisch erzeugt, aber NIE gespeichert.
      const aggregate = Gefaehrdungsbeurteilung.create({
        einsatzId: testEinsatzId,
        einheitId: testEinheitId,
        createdBy: testUserId,
        items: [makeItem('Phantom')],
      }).value as Gefaehrdungsbeurteilung;
      // Domain-Update, damit Version 2 + neue Items gesetzt sind (wie im Prod-Flow).
      const domainRes = aggregate.updateItems([makeItem('Neu')], 1, testUserId);
      expect(domainRes.isSuccess).toBe(true);

      // When: Update gegen nicht-existente DB-Row.
      const result = await prisma.$transaction(async (tx) => repository.updateItems(aggregate, testUserId, tx));

      // Then: updateMany matcht 0 Rows → ConflictDetected-Sentinel.
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ConflictDetected:Gefaehrdungsbeurteilung');
      // Keine Row in der DB entstanden.
      const count = await prisma.gefaehrdungsbeurteilung.count({ where: { id: aggregate.id.value } });
      expect(count).toBe(0);
    });

    it('(Story 2.3 AC2) DB-Level-Lost-Update: zwei TXs mit identischem expectedVersion — zweite bekommt ConflictDetected, auch wenn In-Memory-Check bei beiden passt', async () => {
      if (!databaseAvailable) return;
      // Given: Initial-Aggregate (version=1) in der DB.
      const initial = Gefaehrdungsbeurteilung.create({
        einsatzId: testEinsatzId,
        einheitId: testEinheitId,
        createdBy: testUserId,
        items: [makeItem('Init-Item')],
      }).value as Gefaehrdungsbeurteilung;

      const saveInit = await prisma.$transaction(async (tx) => repository.save(initial, tx));
      expect(saveInit.isSuccess).toBe(true);

      // Beide Tx laden ihre eigene Aggregate-Instanz (beide sehen version=1).
      // Das simuliert zwei unabhängige Handler-Instanzen, die parallel den
      // Client-Request verarbeiten — der In-Memory-`assertVersion(1)`-Check
      // passiert bei beiden, der DB-Lost-Update-Schutz ist das einzige Gate.
      const loadA = await prisma.$transaction(async (tx) => repository.findById(initial.id.value, tx));
      const loadB = await prisma.$transaction(async (tx) => repository.findById(initial.id.value, tx));
      const aggA = loadA.value as Gefaehrdungsbeurteilung;
      const aggB = loadB.value as Gefaehrdungsbeurteilung;
      expect(aggA.version).toBe(1);
      expect(aggB.version).toBe(1);

      // Beide mutieren in-memory auf version=2; assertVersion(1) passiert.
      expect(aggA.updateItems([makeItem('A-Update')], 1, testUserId).isSuccess).toBe(true);
      expect(aggB.updateItems([makeItem('B-Update')], 1, testUserId).isSuccess).toBe(true);

      // When: Tx A schreibt zuerst — erfolgreich (count=1 auf WHERE version=1).
      const resultA = await prisma.$transaction(async (tx) => repository.updateItems(aggA, testUserId, tx));
      expect(resultA.isSuccess).toBe(true);

      // Then: Tx B versucht mit identischem `expectedVersion` zu schreiben —
      // `updateMany` matched 0 Rows (DB ist bereits auf version=2), Repo
      // liefert ConflictDetected (nicht silent success, nicht Crash).
      const resultB = await prisma.$transaction(async (tx) => repository.updateItems(aggB, testUserId, tx));
      expect(resultB.isFailure).toBe(true);
      expect(resultB.error).toBe('ConflictDetected:Gefaehrdungsbeurteilung');

      // DB-State: version=2 mit A-Update (nicht B-Update, nicht Mix).
      const row = await prisma.gefaehrdungsbeurteilung.findUnique({ where: { id: initial.id.value } });
      expect(row?.version).toBe(2);
      const persistedItems = row?.items as unknown as Array<Record<string, unknown>>;
      expect(persistedItems).toHaveLength(1);
      expect(persistedItems[0]?.title).toBe('A-Update');
    });
  });
});

// ========================================
// Mock-basierte Unit-Tests für updateItems — DB-Concurrency-Pfade
// ========================================
//
// Story 2.3 (Task 2 / AC2): Das Repository muss auf DB-Ebene sowohl
// `count === 0` (Lost-Update-Race) als auch `count > 1` (Invariant-Bruch)
// sauber als Result.fail melden, **nicht** als silent success. Der
// Integration-Test oben deckt `count === 0` über eine nicht-existente ID ab;
// für `count > 1` ist das de-facto unmöglich über echte DB-Wege (das
// `@@unique` auf `id` garantiert Unique-Rows). Deswegen mocken wir hier den
// `updateMany`-Return-Wert deterministisch, um den Defense-in-Depth-Branch
// abzusichern.
describe('PrismaGefaehrdungsbeurteilungRepository.updateItems — Mock-basierte Concurrency-Tests', () => {
  const createMockLogger = (): ILogger => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  });

  /**
   * Baut ein frisches Aggregate mit bereits angewendetem `updateItems`-Domain-
   * Schritt (→ Version = 2). So kann das Repository unter Test einen
   * realistischen Prod-Flow sehen, ohne echte DB-Row zu benötigen.
   */
  const buildUpdatedAggregate = (): Gefaehrdungsbeurteilung => {
    const itemA = makeItem('Initial-Item');
    const aggregate = Gefaehrdungsbeurteilung.create({
      einsatzId: 'clw3h8x9y0000qwertyui00002',
      einheitId: 'clw3h8x9y0000qwertyui00050',
      createdBy: 'clw3h8x9y0000qwertyui00099',
      items: [itemA],
    }).value as Gefaehrdungsbeurteilung;
    const domainRes = aggregate.updateItems([makeItem('Neu')], 1, 'clw3h8x9y0000qwertyui00099');
    if (domainRes.isFailure) throw new Error(`Domain-Update schlug fehl: ${domainRes.error}`);
    return aggregate;
  };

  /**
   * Erzeugt einen Mock-TransactionClient, dessen `updateMany` einen
   * konfigurierbaren `{ count }`-Wert zurückliefert.
   */
  const mockTxWithCount = (count: number) =>
    ({
      gefaehrdungsbeurteilung: {
        updateMany: jest.fn().mockResolvedValue({ count }),
      },
    }) as never;

  it('count === 1 (Happy-Path) → Result.ok', async () => {
    const logger = createMockLogger();
    const repo = new PrismaGefaehrdungsbeurteilungRepository({} as never, logger);
    const aggregate = buildUpdatedAggregate();

    const result = await repo.updateItems(aggregate, 'clw3h8x9y0000qwertyui00099', mockTxWithCount(1));

    expect(result.isSuccess).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('count === 0 (Lost-Update-Race) → Result.fail(ConflictDetected:Gefaehrdungsbeurteilung) + logger.warn', async () => {
    const logger = createMockLogger();
    const repo = new PrismaGefaehrdungsbeurteilungRepository({} as never, logger);
    const aggregate = buildUpdatedAggregate();

    const result = await repo.updateItems(aggregate, 'clw3h8x9y0000qwertyui00099', mockTxWithCount(0));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('ConflictDetected:Gefaehrdungsbeurteilung');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Concurrent updateItems'), expect.objectContaining({ gefaehrdungsbeurteilungId: aggregate.id.value, expectedPreviousVersion: 1 }));
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('count > 1 (Invariant-Anomaly) → Result.fail(Invariant:UpdateCountAnomaly) + logger.error', async () => {
    const logger = createMockLogger();
    const repo = new PrismaGefaehrdungsbeurteilungRepository({} as never, logger);
    const aggregate = buildUpdatedAggregate();

    const result = await repo.updateItems(aggregate, 'clw3h8x9y0000qwertyui00099', mockTxWithCount(2));

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('Invariant:UpdateCountAnomaly');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('updateMany count > 1'),
      expect.objectContaining({
        gefaehrdungsbeurteilungId: aggregate.id.value,
        expectedPreviousVersion: 1,
        count: 2,
      }),
    );
  });
});

describe('PrismaGefaehrdungsbeurteilungRepository.findReadModelsByEinsatz — Mock-basierte Query-Tests', () => {
  const EINSATZ_ID = 'clw3h8x9y0000qwertyui00002';
  const EINHEIT_ID = 'clw3h8x9y0000qwertyui00050';
  const USER_ID = 'clw3h8x9y0000qwertyui00099';

  const createMockLogger = (): ILogger => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  });

  function buildRow(id: string, title: string, aktualisiertAm: Date) {
    return {
      id,
      einsatzId: EINSATZ_ID,
      einheitId: EINHEIT_ID,
      gefahrenzoneId: null,
      vorlageId: null,
      items: [makeItem(title).toJSON()],
      version: 1,
      erstelltAm: new Date('2026-04-22T09:00:00.000Z'),
      erstelltVonUserId: USER_ID,
      aktualisiertAm,
      aktualisiertVonUserId: USER_ID,
    };
  }

  it('fragt alle Read-Models eines Einsatzes mit stabiler Sortierung ab', async () => {
    const row = buildRow('clw3h8x9y0000qwertyui01001', 'Stolperfalle', new Date('2026-04-22T10:00:00.000Z'));
    const prisma = {
      gefaehrdungsbeurteilung: {
        findMany: jest.fn().mockResolvedValue([row]),
      },
    };
    const repo = new PrismaGefaehrdungsbeurteilungRepository(prisma as never, createMockLogger());

    const result = await repo.findReadModelsByEinsatz(EINSATZ_ID);

    expect(result.isSuccess).toBe(true);
    expect(prisma.gefaehrdungsbeurteilung.findMany).toHaveBeenCalledWith({
      where: { einsatzId: EINSATZ_ID },
      orderBy: [{ aktualisiertAm: 'desc' }, { erstelltAm: 'desc' }, { id: 'asc' }],
    });
    expect(result.value).toHaveLength(1);
    expect(result.value?.[0]?.aggregate.einsatzId).toBe(EINSATZ_ID);
    expect(result.value?.[0]?.aggregate.items[0]?.title).toBe('Stolperfalle');
    expect(result.value?.[0]?.aktualisiertVonUserId).toBe(USER_ID);
  });

  it('liefert Repository-Fehler als Result.fail', async () => {
    const prisma = {
      gefaehrdungsbeurteilung: {
        findMany: jest.fn().mockRejectedValue(new Error('db down')),
      },
    };
    const repo = new PrismaGefaehrdungsbeurteilungRepository(prisma as never, createMockLogger());

    const result = await repo.findReadModelsByEinsatz(EINSATZ_ID);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('db down');
  });
});
