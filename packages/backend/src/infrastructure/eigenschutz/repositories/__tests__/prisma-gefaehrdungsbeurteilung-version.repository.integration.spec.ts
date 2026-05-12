// @ts-nocheck
/**
 * Integration Tests für PrismaGefaehrdungsbeurteilungVersionRepository.
 *
 * Die Version-Zeile ist append-only (Story 2.1 schreibt nur die Initial-
 * version). Wir prüfen:
 *  - `saveInitialVersion` persistiert Zeile mit korrektem Shape.
 *  - `version = 1`, `changedFields = { created: true }`, `gueltigBis = null`.
 *  - JSONB-Items werden per Mapper als Array serialisiert.
 *  - `eventId` wird gesetzt (Unique-Constraint verhindert Outbox-Retry-Doppler).
 *
 * `saveInitialVersion` erwartet einen **verpflichtenden** `TransactionContext`
 * — wir wrappen daher jede Save-Operation in `prisma.$transaction(...)`.
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

import type { PrismaClient } from '@/generated/prisma/client';
import { GefaehrdungItem } from '@domain/eigenschutz/value-objects/gefaehrdung-item.vo';
import type { ILogger } from '@domain/ports/i-logger.port';
import { skipIfNoDatabase, createTestPrismaClient } from '@/infrastructure/__tests__/helpers/database-test.helper';
import { PrismaGefaehrdungsbeurteilungVersionRepository } from '../prisma-gefaehrdungsbeurteilung-version.repository';

function cuid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'c';
  for (let i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

const createMockLogger = (): ILogger => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

function makeItem(title: string): GefaehrdungItem {
  const result = GefaehrdungItem.create({
    title,
    description: 'Test-Beschreibung',
    eintritt: 'OFT',
    schaden: 'MITTEL',
    risikoklasse: 'GELB',
    schutzmassnahmen: 'Handschuhe',
  });
  if (result.isFailure || !result.value) throw new Error(`Ungültiges Item: ${result.error}`);
  return result.value;
}

describe('PrismaGefaehrdungsbeurteilungVersionRepository - Integration Tests', () => {
  let prisma: PrismaClient;
  let repository: PrismaGefaehrdungsbeurteilungVersionRepository;
  let databaseAvailable = false;
  const testRunId = Date.now();
  let testUserId: string;
  let testEinsatzId: string;
  let testEinheitId: string;

  beforeAll(async () => {
    databaseAvailable = await skipIfNoDatabase();
    if (!databaseAvailable) return;

    prisma = createTestPrismaClient();
    // Story 2.4: PrismaService-Injection für `findVersionsByBeurteilung`.
    // Die save-Methoden nutzen `tx` explizit und ignorieren `this.prisma` —
    // der Integration-PrismaClient wird hier als Duck-Typed PrismaService
    // durchgereicht (nur `gefaehrdungsbeurteilungVersion.findMany` wird konsumiert).
    repository = new PrismaGefaehrdungsbeurteilungVersionRepository(createMockLogger(), prisma as never);

    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM gefaehrdungsbeurteilung_versionen WHERE "gef_beurteilung_id" IN (SELECT id FROM gefaehrdungsbeurteilungen WHERE "erstellt_von_user_id" IN (SELECT id FROM "User" WHERE username LIKE 'gb-ver-it-user-%'))`,
      );
      await prisma.$executeRawUnsafe(`DELETE FROM gefaehrdungsbeurteilungen WHERE "erstellt_von_user_id" IN (SELECT id FROM "User" WHERE username LIKE 'gb-ver-it-user-%')`);
      await prisma.$executeRawUnsafe(`DELETE FROM einsatz_einheiten WHERE "created_by" IN (SELECT id FROM "User" WHERE username LIKE 'gb-ver-it-user-%')`);
      await prisma.$executeRawUnsafe(`DELETE FROM einsaetze WHERE "createdBy" IN (SELECT id FROM "User" WHERE username LIKE 'gb-ver-it-user-%')`);
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'gb-ver-it-user-%'`);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }

    testUserId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, 'x', 'ADMIN', true, NOW(), NOW())`,
      testUserId,
      `gb-ver-it-user-${testRunId}`,
    );

    testEinsatzId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO einsaetze (id, "alarmstichwort", nummer, status, "createdAt", "updatedAt", "createdBy") VALUES ($1, 'GB-Ver', $2, 'ANGELEGT', NOW(), NOW(), $3)`,
      testEinsatzId,
      `GBV-${testRunId}`,
      testUserId,
    );

    testEinheitId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO einsatz_einheiten (id, "einsatz_id", name, typ, status, "soll_staerke", "created_at", "updated_at", "created_by") VALUES ($1, $2, $3, 'GRUPPE', 'AUFGESTELLT', 0, NOW(), NOW(), $4)`,
      testEinheitId,
      testEinsatzId,
      `GBV-Einheit-${testRunId}`,
      testUserId,
    );
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    // Cascade-Delete über GB-Row räumt Versionen mit.
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

  /**
   * Helper: Legt eine minimale Gefährdungsbeurteilungs-Row an, damit der FK
   * `gef_beurteilung_id` der Versions-Zeile bedient werden kann.
   */
  async function insertGefaehrdungsbeurteilung(): Promise<string> {
    const gbId = cuid();
    await prisma.$executeRawUnsafe(
      `INSERT INTO gefaehrdungsbeurteilungen (id, einsatz_id, einheit_id, items, version, erstellt_am, erstellt_von_user_id, aktualisiert_am, aktualisiert_von_user_id) VALUES ($1, $2, $3, $4::jsonb, 1, NOW(), $5, NOW(), $5)`,
      gbId,
      testEinsatzId,
      testEinheitId,
      JSON.stringify([{ title: 'State-Item' }]),
      testUserId,
    );
    return gbId;
  }

  describe('saveInitialVersion()', () => {
    it('sollte Zeile mit version=1, changedFields={created:true}, gueltigBis=null, items und eventId persistieren', async () => {
      if (!databaseAvailable) return;
      // Given
      const gbId = await insertGefaehrdungsbeurteilung();
      const gueltigVon = new Date('2026-04-22T10:15:00.000Z');
      const eventId = cuid();
      const items = [makeItem('Initial-Item'), makeItem('Zweites-Item')];

      // When
      const saveResult = await prisma.$transaction(async (tx) =>
        repository.saveInitialVersion(
          {
            gefBeurteilungId: gbId,
            version: 1,
            items,
            changedFields: { created: true },
            gueltigVon,
            changedByUserId: testUserId,
            eventId,
          },
          tx,
        ),
      );

      // Then
      expect(saveResult.isSuccess).toBe(true);

      // Raw-Read via Prisma (eventId @unique).
      const row = await prisma.gefaehrdungsbeurteilungVersion.findUnique({ where: { eventId } });
      expect(row).not.toBeNull();
      expect(row?.gefBeurteilungId).toBe(gbId);
      expect(row?.version).toBe(1);
      expect(row?.gueltigVon.toISOString()).toBe(gueltigVon.toISOString());
      expect(row?.gueltigBis).toBeNull();
      expect(row?.changedByUserId).toBe(testUserId);
      expect(row?.eventId).toBe(eventId);
      expect(row?.changedFields).toEqual({ created: true });

      const persisted = row?.items as unknown as Array<Record<string, unknown>>;
      expect(Array.isArray(persisted)).toBe(true);
      expect(persisted).toHaveLength(2);
      expect(persisted[0]?.title).toBe('Initial-Item');
      expect(persisted[1]?.title).toBe('Zweites-Item');
    });

    it('sollte leeres Items-Array korrekt als JSONB `[]` persistieren', async () => {
      if (!databaseAvailable) return;
      // Given
      const gbId = await insertGefaehrdungsbeurteilung();
      const eventId = cuid();

      // When
      const saveResult = await prisma.$transaction(async (tx) =>
        repository.saveInitialVersion(
          {
            gefBeurteilungId: gbId,
            version: 1,
            items: [],
            changedFields: { created: true },
            gueltigVon: new Date(),
            changedByUserId: testUserId,
            eventId,
          },
          tx,
        ),
      );

      // Then
      expect(saveResult.isSuccess).toBe(true);
      const row = await prisma.gefaehrdungsbeurteilungVersion.findUnique({ where: { eventId } });
      expect(Array.isArray(row?.items)).toBe(true);
      expect(row?.items as unknown as unknown[]).toHaveLength(0);
    });

    it('sollte bei doppeltem `eventId` idempotent Result.ok liefern (Outbox-Retry, Story 2.3 AC8)', async () => {
      if (!databaseAvailable) return;
      // Given: Erste Version mit eventId X ist persistiert.
      const gbId = await insertGefaehrdungsbeurteilung();
      const eventId = cuid();

      const first = await prisma.$transaction(async (tx) =>
        repository.saveInitialVersion(
          {
            gefBeurteilungId: gbId,
            version: 1,
            items: [makeItem('E1')],
            changedFields: { created: true },
            gueltigVon: new Date(),
            changedByUserId: testUserId,
            eventId,
          },
          tx,
        ),
      );
      expect(first.isSuccess).toBe(true);

      // When: Zweite Version mit SELBER eventId (Retry-Szenario). Story 2.3
      // fordert: P2002 auf `event_id` ist ein idempotenter Erfolg.
      let secondResult;
      try {
        secondResult = await prisma.$transaction(async (tx) =>
          repository.saveInitialVersion(
            {
              gefBeurteilungId: gbId,
              version: 2,
              items: [makeItem('E2')],
              changedFields: { created: true },
              gueltigVon: new Date(),
              changedByUserId: testUserId,
              eventId,
            },
            tx,
          ),
        );
      } catch (err) {
        secondResult = { isSuccess: false, isFailure: true, error: (err as Error).message };
      }

      // Then: idempotent erfolgreich, DB enthält weiterhin nur eine Zeile mit
      // dieser eventId (V1 bleibt, V2 wurde nicht persistiert).
      expect(secondResult.isSuccess).toBe(true);
      const count = await prisma.gefaehrdungsbeurteilungVersion.count({ where: { eventId } });
      expect(count).toBe(1);
    });
  });

  // ========================================
  // saveNewVersion() — Story 2.2
  // ========================================

  describe('saveNewVersion()', () => {
    it('Happy-Path mit Chain-Closing: V1 offen → saveNewVersion(V2) schließt V1 und legt V2 an', async () => {
      if (!databaseAvailable) return;
      // Given: Initial-Version (V1) mit gueltigBis=null.
      const gbId = await insertGefaehrdungsbeurteilung();
      const gueltigVonV1 = new Date('2026-04-22T10:00:00.000Z');
      const gueltigVonV2 = new Date('2026-04-22T11:00:00.000Z');
      const eventIdV1 = cuid();
      const eventIdV2 = cuid();

      const initRes = await prisma.$transaction(async (tx) =>
        repository.saveInitialVersion(
          {
            gefBeurteilungId: gbId,
            version: 1,
            items: [makeItem('V1-Item')],
            changedFields: { created: true },
            gueltigVon: gueltigVonV1,
            changedByUserId: testUserId,
            eventId: eventIdV1,
          },
          tx,
        ),
      );
      expect(initRes.isSuccess).toBe(true);

      // When: V2 anlegen — soll V1 schließen (gueltigBis = gueltigVonV2).
      const newRes = await prisma.$transaction(async (tx) =>
        repository.saveNewVersion(
          {
            gefBeurteilungId: gbId,
            version: 2,
            items: [makeItem('V2-Item-A'), makeItem('V2-Item-B')],
            changedFields: { added: ['itm-new'], removed: [], updated: [{ id: 'itm-upd', fields: ['title'] }], unchanged: 0 },
            gueltigVon: gueltigVonV2,
            changedByUserId: testUserId,
            eventId: eventIdV2,
          },
          tx,
        ),
      );

      // Then
      expect(newRes.isSuccess).toBe(true);

      const rows = await prisma.gefaehrdungsbeurteilungVersion.findMany({
        where: { gefBeurteilungId: gbId },
        orderBy: { version: 'asc' },
      });
      expect(rows).toHaveLength(2);

      // V1 geschlossen
      expect(rows[0].version).toBe(1);
      expect(rows[0].gueltigVon.toISOString()).toBe(gueltigVonV1.toISOString());
      expect(rows[0].gueltigBis).not.toBeNull();
      expect((rows[0].gueltigBis as Date).toISOString()).toBe(gueltigVonV2.toISOString());
      expect(rows[0].eventId).toBe(eventIdV1);

      // V2 offen
      expect(rows[1].version).toBe(2);
      expect(rows[1].gueltigVon.toISOString()).toBe(gueltigVonV2.toISOString());
      expect(rows[1].gueltigBis).toBeNull();
      expect(rows[1].eventId).toBe(eventIdV2);
      const v2Items = rows[1].items as unknown as Array<Record<string, unknown>>;
      expect(v2Items).toHaveLength(2);
      expect(v2Items[0]?.title).toBe('V2-Item-A');
    });

    it('Sequenzielle Updates bauen eine konsistente Chain auf (V1→V2→V3)', async () => {
      if (!databaseAvailable) return;
      // Given
      const gbId = await insertGefaehrdungsbeurteilung();
      const gueltigVonV1 = new Date('2026-04-22T09:00:00.000Z');
      const gueltigVonV2 = new Date('2026-04-22T10:00:00.000Z');
      const gueltigVonV3 = new Date('2026-04-22T11:00:00.000Z');
      const eventIdV1 = cuid();
      const eventIdV2 = cuid();
      const eventIdV3 = cuid();

      // V1 (initial)
      const r1 = await prisma.$transaction(async (tx) =>
        repository.saveInitialVersion(
          {
            gefBeurteilungId: gbId,
            version: 1,
            items: [makeItem('V1')],
            changedFields: { created: true },
            gueltigVon: gueltigVonV1,
            changedByUserId: testUserId,
            eventId: eventIdV1,
          },
          tx,
        ),
      );
      expect(r1.isSuccess).toBe(true);

      // V2
      const r2 = await prisma.$transaction(async (tx) =>
        repository.saveNewVersion(
          {
            gefBeurteilungId: gbId,
            version: 2,
            items: [makeItem('V2')],
            changedFields: { added: ['itm-new'], removed: ['itm-rem'], updated: [], unchanged: 0 },
            gueltigVon: gueltigVonV2,
            changedByUserId: testUserId,
            eventId: eventIdV2,
          },
          tx,
        ),
      );
      expect(r2.isSuccess).toBe(true);

      // V3
      const r3 = await prisma.$transaction(async (tx) =>
        repository.saveNewVersion(
          {
            gefBeurteilungId: gbId,
            version: 3,
            items: [makeItem('V3')],
            changedFields: { added: ['itm-new'], removed: ['itm-rem'], updated: [], unchanged: 0 },
            gueltigVon: gueltigVonV3,
            changedByUserId: testUserId,
            eventId: eventIdV3,
          },
          tx,
        ),
      );
      expect(r3.isSuccess).toBe(true);

      // Then: 3 Zeilen mit kohärenter Chain.
      const rows = await prisma.gefaehrdungsbeurteilungVersion.findMany({
        where: { gefBeurteilungId: gbId },
        orderBy: { version: 'asc' },
      });
      expect(rows).toHaveLength(3);

      expect(rows[0].version).toBe(1);
      expect((rows[0].gueltigBis as Date).toISOString()).toBe(gueltigVonV2.toISOString());

      expect(rows[1].version).toBe(2);
      expect((rows[1].gueltigBis as Date).toISOString()).toBe(gueltigVonV3.toISOString());

      expect(rows[2].version).toBe(3);
      expect(rows[2].gueltigBis).toBeNull();
    });

    it('Unique eventId: zweiter saveNewVersion mit gleicher eventId ist idempotent (P2002 → Result.ok), DB hat nur eine Zeile', async () => {
      if (!databaseAvailable) return;
      // Given: V1 initial, dann V2 mit eventId X erfolgreich persistiert.
      const gbId = await insertGefaehrdungsbeurteilung();
      const eventIdV1 = cuid();
      const eventIdV2 = cuid();

      const initRes = await prisma.$transaction(async (tx) =>
        repository.saveInitialVersion(
          {
            gefBeurteilungId: gbId,
            version: 1,
            items: [makeItem('V1')],
            changedFields: { created: true },
            gueltigVon: new Date('2026-04-22T09:00:00.000Z'),
            changedByUserId: testUserId,
            eventId: eventIdV1,
          },
          tx,
        ),
      );
      expect(initRes.isSuccess).toBe(true);

      const firstV2 = await prisma.$transaction(async (tx) =>
        repository.saveNewVersion(
          {
            gefBeurteilungId: gbId,
            version: 2,
            items: [makeItem('V2-first')],
            changedFields: { added: ['itm-new'], removed: [], updated: [], unchanged: 0 },
            gueltigVon: new Date('2026-04-22T10:00:00.000Z'),
            changedByUserId: testUserId,
            eventId: eventIdV2,
          },
          tx,
        ),
      );
      expect(firstV2.isSuccess).toBe(true);

      // When: zweiter saveNewVersion mit GLEICHER eventIdV2 (Retry-Szenario).
      let secondV2Result;
      try {
        secondV2Result = await prisma.$transaction(async (tx) =>
          repository.saveNewVersion(
            {
              gefBeurteilungId: gbId,
              version: 3,
              items: [makeItem('V2-retry')],
              changedFields: { added: [], removed: [], updated: [{ id: 'itm-upd', fields: ['title'] }], unchanged: 0 },
              gueltigVon: new Date('2026-04-22T11:00:00.000Z'),
              changedByUserId: testUserId,
              eventId: eventIdV2,
            },
            tx,
          ),
        );
      } catch (err) {
        // Prisma kann beim TX-Rollback werfen — beide Enden akzeptabel.
        secondV2Result = { isSuccess: false, isFailure: true, error: (err as Error).message };
      }

      // Then (Review-Fix P8): idempotent — P2002 auf eventId wird als Erfolg
      // gemeldet, damit der Outbox-Retry-Pfad konvergiert, statt ein Event
      // pending zu lassen. In der DB bleibt exakt eine Zeile mit eventIdV2.
      expect(secondV2Result.isSuccess).toBe(true);
      const countWithEventId = await prisma.gefaehrdungsbeurteilungVersion.count({ where: { eventId: eventIdV2 } });
      expect(countWithEventId).toBe(1);
    });

    it('saveNewVersion: P2002 auf `(gefBeurteilungId, version)` bleibt Result.fail (echter Concurrency-Bug, Story 2.3 AC8)', async () => {
      if (!databaseAvailable) return;
      // Given: V1 initial, dann V2 mit einer version ist persistiert. Jetzt
      // versuchen wir, eine weitere V2 mit ANDERER eventId anzulegen — das
      // verletzt das `(gefBeurteilungId, version)`-Unique und MUSS als Fehler
      // sichtbar bleiben (nicht als idempotenter Erfolg getarnt).
      const gbId = await insertGefaehrdungsbeurteilung();

      const init = await prisma.$transaction(async (tx) =>
        repository.saveInitialVersion(
          {
            gefBeurteilungId: gbId,
            version: 1,
            items: [makeItem('V1')],
            changedFields: { created: true },
            gueltigVon: new Date('2026-04-22T09:00:00.000Z'),
            changedByUserId: testUserId,
            eventId: cuid(),
          },
          tx,
        ),
      );
      expect(init.isSuccess).toBe(true);

      const firstV2 = await prisma.$transaction(async (tx) =>
        repository.saveNewVersion(
          {
            gefBeurteilungId: gbId,
            version: 2,
            items: [makeItem('V2-first')],
            changedFields: { added: ['itm-new'], removed: [], updated: [], unchanged: 0 },
            gueltigVon: new Date('2026-04-22T10:00:00.000Z'),
            changedByUserId: testUserId,
            eventId: cuid(),
          },
          tx,
        ),
      );
      expect(firstV2.isSuccess).toBe(true);

      // When: Zweiter V2-Write mit anderer eventId aber gleicher `version`.
      let secondV2Result;
      try {
        secondV2Result = await prisma.$transaction(async (tx) =>
          repository.saveNewVersion(
            {
              gefBeurteilungId: gbId,
              version: 2,
              items: [makeItem('V2-second')],
              changedFields: { added: ['itm-new'], removed: [], updated: [], unchanged: 0 },
              gueltigVon: new Date('2026-04-22T11:00:00.000Z'),
              changedByUserId: testUserId,
              eventId: cuid(),
            },
            tx,
          ),
        );
      } catch (err) {
        secondV2Result = { isSuccess: false, isFailure: true, error: (err as Error).message };
      }

      // Then: Kein Success — echter Concurrency-Bug, nicht als Idempotenz-
      // Erfolg verschluckt. Genau eine V2-Zeile für dieses gbId in der DB.
      expect(secondV2Result.isSuccess).toBe(false);
      const v2Count = await prisma.gefaehrdungsbeurteilungVersion.count({
        where: { gefBeurteilungId: gbId, version: 2 },
      });
      expect(v2Count).toBe(1);
    });

    it('(Story 2.4 AC9) Chain-Intervall: 3 sequenzielle Updates → findVersionsByBeurteilung liefert DESC-sortierte Kette mit V_n.gueltigBis === V_{n+1}.gueltigVon', async () => {
      if (!databaseAvailable) return;
      // Given: 3 Versionen in chronologischer Reihenfolge.
      const gbId = await insertGefaehrdungsbeurteilung();
      const gvV1 = new Date('2026-04-22T09:00:00.000Z');
      const gvV2 = new Date('2026-04-22T10:00:00.000Z');
      const gvV3 = new Date('2026-04-22T11:00:00.000Z');

      const r1 = await prisma.$transaction(async (tx) =>
        repository.saveInitialVersion(
          {
            gefBeurteilungId: gbId,
            version: 1,
            items: [makeItem('V1')],
            changedFields: { created: true },
            gueltigVon: gvV1,
            changedByUserId: testUserId,
            eventId: cuid(),
          },
          tx,
        ),
      );
      expect(r1.isSuccess).toBe(true);
      const r2 = await prisma.$transaction(async (tx) =>
        repository.saveNewVersion(
          {
            gefBeurteilungId: gbId,
            version: 2,
            items: [makeItem('V2')],
            changedFields: { added: ['a'], removed: [], updated: [], unchanged: 0 },
            gueltigVon: gvV2,
            changedByUserId: testUserId,
            eventId: cuid(),
          },
          tx,
        ),
      );
      expect(r2.isSuccess).toBe(true);
      const r3 = await prisma.$transaction(async (tx) =>
        repository.saveNewVersion(
          {
            gefBeurteilungId: gbId,
            version: 3,
            items: [makeItem('V3')],
            changedFields: { added: [], removed: ['r'], updated: [], unchanged: 0 },
            gueltigVon: gvV3,
            changedByUserId: testUserId,
            eventId: cuid(),
          },
          tx,
        ),
      );
      expect(r3.isSuccess).toBe(true);

      // When: Timeline-Read-Pfad.
      const result = await repository.findVersionsByBeurteilung(gbId);

      // Then
      expect(result.isSuccess).toBe(true);
      const rows = result.value!;
      expect(rows).toHaveLength(3);
      // DESC-Sortierung: neueste zuerst.
      expect(rows[0].version).toBe(3);
      expect(rows[1].version).toBe(2);
      expect(rows[2].version).toBe(1);
      // Aktive Version: gueltigBis === null.
      expect(rows[0].gueltigBis).toBeNull();
      // Chain-Intervall (AC9): V_n.gueltigBis === V_{n+1}.gueltigVon — in
      // DESC-Sortierung heißt das: rows[i-1].gueltigVon === rows[i].gueltigBis.
      expect((rows[1].gueltigBis as Date).toISOString()).toBe(rows[0].gueltigVon.toISOString());
      expect((rows[2].gueltigBis as Date).toISOString()).toBe(rows[1].gueltigVon.toISOString());
      // Items werden rehydriert (JSONB → Domain-VO).
      expect(rows[0].items).toHaveLength(1);
      expect(rows[0].items[0].toJSON().title).toBe('V3');
      expect(rows[2].items[0].toJSON().title).toBe('V1');
      // changedFields wird 1:1 durchgereicht.
      expect(rows[2].changedFields).toEqual({ created: true });
    });

    it('changedFields wird als JSONB-Struktur persistiert', async () => {
      if (!databaseAvailable) return;
      // Given: V1 initial.
      const gbId = await insertGefaehrdungsbeurteilung();
      const initEventId = cuid();
      const initRes = await prisma.$transaction(async (tx) =>
        repository.saveInitialVersion(
          {
            gefBeurteilungId: gbId,
            version: 1,
            items: [makeItem('V1')],
            changedFields: { created: true },
            gueltigVon: new Date('2026-04-22T09:00:00.000Z'),
            changedByUserId: testUserId,
            eventId: initEventId,
          },
          tx,
        ),
      );
      expect(initRes.isSuccess).toBe(true);

      // When: V2 mit konkretem Diff-Objekt.
      const v2EventId = cuid();
      const diff = { added: 2, removed: 1, updated: 0 };
      const newRes = await prisma.$transaction(async (tx) =>
        repository.saveNewVersion(
          {
            gefBeurteilungId: gbId,
            version: 2,
            items: [makeItem('V2-a'), makeItem('V2-b')],
            changedFields: diff,
            gueltigVon: new Date('2026-04-22T10:00:00.000Z'),
            changedByUserId: testUserId,
            eventId: v2EventId,
          },
          tx,
        ),
      );
      expect(newRes.isSuccess).toBe(true);

      // Then
      const row = await prisma.gefaehrdungsbeurteilungVersion.findUnique({ where: { eventId: v2EventId } });
      expect(row).not.toBeNull();
      expect(row?.changedFields).toEqual(diff);
    });
  });
});

// ========================================
// Mock-basierte Unit-Tests für P2002-Target-Narrowing (Story 2.3 AC8)
// ========================================
//
// Hintergrund: Der Outbox-Retry-Pfad darf nur idempotent auf einen
// `event_id`-Unique-Conflict reagieren. Ein Unique-Conflict auf
// `(gefBeurteilungId, version)` ist ein echter Concurrency-Bug (zwei parallele
// Writes auf dieselbe Versionsnummer) und MUSS als `Result.fail` bleiben,
// damit der Fehler nicht verschluckt wird.
//
// Der Integration-Test oben deckt die `event_id`-Idempotenz über Postgres ab,
// aber das `(gefBeurteilungId, version)`-Ende ist über echte DB-Wege schwer
// gezielt auszulösen, ohne `event_id` gleichzeitig zu kollidieren. Deswegen
// mocken wir hier den Prisma-Client deterministisch mit den exakten
// `meta.target`-Shapes, die Prisma in Produktion liefert.
describe('PrismaGefaehrdungsbeurteilungVersionRepository — P2002-Target-Narrowing (Mock)', () => {
  const createMockLoggerUnit = (): ILogger => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  });

  /**
   * Baut einen P2002-Mock mit klassischem `meta.target`-Shape (ältere Prisma-
   * Versionen / Nicht-Driver-Adapter-Treiber). `isPrismaP2002` prüft nur
   * `code === 'P2002'`, kein instanceof-Check — daher reicht duck-typed
   * Object.assign.
   */
  const buildP2002 = (target: unknown): Error =>
    Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      clientVersion: 'mock',
      meta: { target },
    });

  /**
   * Baut einen P2002-Mock im Prisma-7-Driver-Adapter-Shape. Die relevanten
   * Felder liegen tief in `meta.driverAdapterError.cause.*` — das ist der
   * Shape, den der PostgreSQL-Treiber in Produktion tatsächlich liefert.
   */
  const buildP2002DriverAdapter = (cause: { fields?: string[]; originalMessage?: string }): Error =>
    Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      clientVersion: 'mock',
      meta: {
        modelName: 'GefaehrdungsbeurteilungVersion',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            originalCode: '23505',
            kind: 'UniqueConstraintViolation',
            originalMessage: cause.originalMessage,
            constraint: cause.fields ? { fields: cause.fields } : undefined,
          },
        },
      },
    });

  /**
   * Mock-TransactionClient für `saveInitialVersion`-Pfad: `create` wirft den
   * konfigurierten Error.
   */
  const mockTxInitialReject = (error: unknown) =>
    ({
      gefaehrdungsbeurteilungVersion: {
        create: jest.fn().mockRejectedValue(error),
      },
    }) as never;

  /**
   * Mock-TransactionClient für `saveNewVersion`-Pfad: `updateMany` passt
   * erfolgreich (Chain-Closing), `create` wirft den konfigurierten Error.
   */
  const mockTxNewVersionReject = (error: unknown) =>
    ({
      gefaehrdungsbeurteilungVersion: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockRejectedValue(error),
      },
    }) as never;

  const baseArgs = () => ({
    gefBeurteilungId: 'clw3h8x9y0000qwertyui00001',
    version: 2,
    items: [makeItem('Mock-Item')],
    changedFields: { added: [], removed: [], updated: [{ id: 'itm-upd', fields: ['title'] }], unchanged: 0 },
    gueltigVon: new Date('2026-04-22T12:00:00.000Z'),
    changedByUserId: 'clw3h8x9y0000qwertyui00099',
    eventId: 'clw3h8x9y0000qwertyui00999',
  });

  describe('saveNewVersion', () => {
    it('P2002 mit target=["gefaehrdungsbeurteilung_versionen_event_id_key"] → Result.ok (idempotent)', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);
      const err = buildP2002(['gefaehrdungsbeurteilung_versionen_event_id_key']);

      const result = await repo.saveNewVersion(baseArgs(), mockTxNewVersionReject(err));

      expect(result.isSuccess).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Idempotenter Retry'), expect.objectContaining({ eventId: baseArgs().eventId }));
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('P2002 mit target als bare String "event_id" → Result.ok (defensive Prisma-Version-Abdeckung)', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);
      const err = buildP2002('event_id');

      const result = await repo.saveNewVersion(baseArgs(), mockTxNewVersionReject(err));

      expect(result.isSuccess).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('P2002 mit target=["gefaehrdungsbeurteilung_versionen_gefBeurteilungId_version_key"] → Result.fail (echter Concurrency-Bug)', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);
      const err = buildP2002(['gefaehrdungsbeurteilung_versionen_gefBeurteilungId_version_key']);

      const result = await repo.saveNewVersion(baseArgs(), mockTxNewVersionReject(err));

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Unique constraint failed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Fehler beim Speichern der neuen Version'), expect.objectContaining({ eventId: baseArgs().eventId }));
    });

    it('P2002 mit target=undefined (kein meta) → Result.fail (konservativ, kein Silent-Success)', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);
      const err = buildP2002(undefined);

      const result = await repo.saveNewVersion(baseArgs(), mockTxNewVersionReject(err));

      expect(result.isFailure).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it('Nicht-Prisma-Error (z. B. Connection-Error) → Result.fail', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);

      const result = await repo.saveNewVersion(baseArgs(), mockTxNewVersionReject(new Error('Connection reset')));

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Connection reset');
      expect(logger.error).toHaveBeenCalled();
    });

    it('Driver-Adapter-Shape P2002 mit constraint.fields=["event_id"] → Result.ok (Produktions-Shape)', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);
      const err = buildP2002DriverAdapter({
        fields: ['event_id'],
        originalMessage: 'duplicate key value violates unique constraint "gefaehrdungsbeurteilung_versionen_event_id_key"',
      });

      const result = await repo.saveNewVersion(baseArgs(), mockTxNewVersionReject(err));

      expect(result.isSuccess).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('Driver-Adapter-Shape P2002 mit constraint.fields=["gef_beurteilung_id","version"] → Result.fail (Produktions-Shape)', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);
      const err = buildP2002DriverAdapter({
        fields: ['gef_beurteilung_id', 'version'],
        originalMessage: 'duplicate key value violates unique constraint "gefaehrdungsbeurteilung_versionen_gefBeurteilungId_version_key"',
      });

      const result = await repo.saveNewVersion(baseArgs(), mockTxNewVersionReject(err));

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Unique constraint failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('saveInitialVersion', () => {
    it('P2002 mit target=["gefaehrdungsbeurteilung_versionen_event_id_key"] → Result.ok (idempotent)', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);
      const err = buildP2002(['gefaehrdungsbeurteilung_versionen_event_id_key']);

      const result = await repo.saveInitialVersion({ ...baseArgs(), version: 1 }, mockTxInitialReject(err));

      expect(result.isSuccess).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Idempotenter Retry'), expect.objectContaining({ eventId: baseArgs().eventId }));
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('P2002 mit target=["gefaehrdungsbeurteilung_versionen_gefBeurteilungId_version_key"] → Result.fail (echter Concurrency-Bug)', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);
      const err = buildP2002(['gefaehrdungsbeurteilung_versionen_gefBeurteilungId_version_key']);

      const result = await repo.saveInitialVersion({ ...baseArgs(), version: 1 }, mockTxInitialReject(err));

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Unique constraint failed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Fehler beim Speichern der Initial-Version'), expect.objectContaining({ eventId: baseArgs().eventId }));
    });

    it('Nicht-Prisma-Error → Result.fail (kein Idempotenz-Fang)', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);

      const result = await repo.saveInitialVersion({ ...baseArgs(), version: 1 }, mockTxInitialReject(new Error('Connection reset')));

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Connection reset');
      expect(logger.error).toHaveBeenCalled();
    });

    it('Driver-Adapter-Shape P2002 mit constraint.fields=["event_id"] → Result.ok (Produktions-Shape)', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);
      const err = buildP2002DriverAdapter({
        fields: ['event_id'],
        originalMessage: 'duplicate key value violates unique constraint "gefaehrdungsbeurteilung_versionen_event_id_key"',
      });

      const result = await repo.saveInitialVersion({ ...baseArgs(), version: 1 }, mockTxInitialReject(err));

      expect(result.isSuccess).toBe(true);
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('Driver-Adapter-Shape P2002 mit constraint.fields=["gef_beurteilung_id","version"] → Result.fail (Produktions-Shape)', async () => {
      const logger = createMockLoggerUnit();
      // Story 2.4: Constructor nimmt jetzt PrismaService als zweites Argument —
      // für die `tx`-basierten save-Pfade ist er nicht relevant, wir übergeben
      // ein minimales `undefined`-Placeholder (TypeScript-Bypass via `@ts-nocheck`).
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, undefined as never);
      const err = buildP2002DriverAdapter({
        fields: ['gef_beurteilung_id', 'version'],
        originalMessage: 'duplicate key value violates unique constraint "gefaehrdungsbeurteilung_versionen_gefBeurteilungId_version_key"',
      });

      const result = await repo.saveInitialVersion({ ...baseArgs(), version: 1 }, mockTxInitialReject(err));

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Unique constraint failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ========================================
  // findVersionsByBeurteilung — Story 2.4 (Mock)
  // ========================================
  //
  // Die DB-Chain-Invariante ist im Integration-Test oben verifiziert; hier
  // decken wir den DI-Call-Shape und den Error-Fallback ab.
  describe('findVersionsByBeurteilung', () => {
    const BEURTEILUNG_ID = 'clw3h8x9y0000qwertyui00abc';

    it('reicht die gefBeurteilungId 1:1 an Prisma durch und sortiert DESC nach (gueltigVon, version)', async () => {
      const logger = createMockLoggerUnit();
      const mockRows = [
        {
          version: 3,
          items: [{ title: 'V3-Item' }],
          changedFields: { added: [], removed: ['r'], updated: [], unchanged: 1 },
          gueltigVon: new Date('2026-04-22T11:00:00.000Z'),
          gueltigBis: null,
          changedByUserId: 'user-1',
          eventId: 'evt-3',
        },
        {
          version: 2,
          items: [{ title: 'V2-Item' }],
          changedFields: { added: ['a'], removed: [], updated: [], unchanged: 0 },
          gueltigVon: new Date('2026-04-22T10:00:00.000Z'),
          gueltigBis: new Date('2026-04-22T11:00:00.000Z'),
          changedByUserId: 'user-2',
          eventId: 'evt-2',
        },
      ];
      const findMany = jest.fn().mockResolvedValue(mockRows);
      const prismaMock = {
        gefaehrdungsbeurteilungVersion: { findMany },
      };
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, prismaMock as never);

      const result = await repo.findVersionsByBeurteilung(BEURTEILUNG_ID);

      expect(findMany).toHaveBeenCalledWith({
        where: { gefBeurteilungId: BEURTEILUNG_ID },
        orderBy: [{ gueltigVon: 'desc' }, { version: 'desc' }],
      });
      expect(result.isSuccess).toBe(true);
      const rows = result.value!;
      expect(rows).toHaveLength(2);
      expect(rows[0].version).toBe(3);
      expect(rows[0].gueltigBis).toBeNull();
      expect(rows[1].version).toBe(2);
      expect(rows[1].gueltigBis).toEqual(new Date('2026-04-22T11:00:00.000Z'));
      // Items werden via Mapper rehydriert (JSONB → GefaehrdungItem[]).
      expect(rows[0].items).toHaveLength(1);
      expect(rows[0].items[0].toJSON().title).toBe('V3-Item');
      // changedFields wird 1:1 propagiert.
      expect(rows[0].changedFields).toEqual({ added: [], removed: ['r'], updated: [], unchanged: 1 });
    });

    it('liefert Result.ok([]), wenn Prisma keine Zeilen liefert (Defensive: gar keine Versionen — in der Praxis unerreichbar, da V1 immer existiert)', async () => {
      const logger = createMockLoggerUnit();
      const findMany = jest.fn().mockResolvedValue([]);
      const prismaMock = { gefaehrdungsbeurteilungVersion: { findMany } };
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, prismaMock as never);

      const result = await repo.findVersionsByBeurteilung(BEURTEILUNG_ID);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('mapped Prisma-Fehler auf Sentinel "InfrastructureError:LoadVersions" und loggt Fehler-Message', async () => {
      const logger = createMockLoggerUnit();
      const findMany = jest.fn().mockRejectedValue(new Error('Connection reset by peer'));
      const prismaMock = { gefaehrdungsbeurteilungVersion: { findMany } };
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, prismaMock as never);

      const result = await repo.findVersionsByBeurteilung(BEURTEILUNG_ID);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('InfrastructureError:LoadVersions');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Fehler beim Laden der Versions-Chain'),
        expect.objectContaining({ gefBeurteilungId: BEURTEILUNG_ID, error: 'Connection reset by peer' }),
      );
    });
  });

  describe('findVersionAtTimeForEinheit() (Story 5.2 AC4)', () => {
    const SNAPSHOT_AT = new Date('2026-05-06T10:00:00.000Z');

    it('führt Where mit halb-offenem Intervall + einsatz/einheit-Scoping aus', async () => {
      const logger = createMockLoggerUnit();
      const findFirst = jest.fn().mockResolvedValue(null);
      const tx = { gefaehrdungsbeurteilungVersion: { findFirst } };
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, {} as never);

      await repo.findVersionAtTimeForEinheit('einsatz-1', 'einheit-1', SNAPSHOT_AT, tx as never);

      expect(findFirst).toHaveBeenCalledWith({
        where: {
          gueltigVon: { lte: SNAPSHOT_AT },
          OR: [{ gueltigBis: null }, { gueltigBis: { gt: SNAPSHOT_AT } }],
          gefBeurteilung: { einsatzId: 'einsatz-1', einheitId: 'einheit-1' },
        },
      });
    });

    it('liefert Result.ok(null) wenn keine Treffer (kein Fehler)', async () => {
      const logger = createMockLoggerUnit();
      const findFirst = jest.fn().mockResolvedValue(null);
      const tx = { gefaehrdungsbeurteilungVersion: { findFirst } };
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, {} as never);

      const result = await repo.findVersionAtTimeForEinheit('einsatz-1', 'einheit-1', SNAPSHOT_AT, tx as never);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
    });

    it('mappt Treffer auf VersionRow + gefBeurteilungId + versionId', async () => {
      const logger = createMockLoggerUnit();
      // `id` (Versions-PK) und `gefBeurteilungId` (Parent-PK) sind bewusst
      // unterschiedlich — der Snapshot-FK `EigenschutzVorfall.gefBeurteilungVersionId`
      // muss die Versions-PK referenzieren (`references: [id]`), nicht den Parent.
      const row = {
        id: 'version-pk-2',
        gefBeurteilungId: 'beurteilung-1',
        version: 2,
        items: [{ title: 'Eis' }],
        changedFields: { added: [], removed: [], updated: [], unchanged: 1 },
        gueltigVon: new Date('2026-05-01T08:00:00.000Z'),
        gueltigBis: null,
        changedByUserId: 'user-1',
        eventId: 'evt-2',
      };
      const findFirst = jest.fn().mockResolvedValue(row);
      const tx = { gefaehrdungsbeurteilungVersion: { findFirst } };
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, {} as never);

      const result = await repo.findVersionAtTimeForEinheit('einsatz-1', 'einheit-1', SNAPSHOT_AT, tx as never);

      expect(result.isSuccess).toBe(true);
      expect(result.value?.gefBeurteilungId).toBe('beurteilung-1');
      expect(result.value?.versionId).toBe('version-pk-2');
      expect(result.value?.version).toBe(2);
      expect(result.value?.items).toHaveLength(1);
    });

    it('mapped DB-Fehler auf Sentinel InfrastructureError:LoadVersionAtTime', async () => {
      const logger = createMockLoggerUnit();
      const findFirst = jest.fn().mockRejectedValue(new Error('db-down'));
      const tx = { gefaehrdungsbeurteilungVersion: { findFirst } };
      const repo = new PrismaGefaehrdungsbeurteilungVersionRepository(logger, {} as never);

      const result = await repo.findVersionAtTimeForEinheit('einsatz-1', 'einheit-1', SNAPSHOT_AT, tx as never);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('InfrastructureError:LoadVersionAtTime');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
