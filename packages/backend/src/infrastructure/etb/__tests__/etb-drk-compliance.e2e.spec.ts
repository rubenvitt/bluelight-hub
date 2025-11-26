import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { createEtbE2eModule, teardownE2eModule, cleanupTestData, type EtbE2eTestContext } from './etb.e2e-setup';

/**
 * E2E Tests für DRK NO-DELETE Compliance Triggers (AC7)
 *
 * Testet die PostgreSQL Trigger, die physisches Löschen verhindern:
 * - etb_eintrag_no_delete: Blockiert DELETE auf etb_eintraege
 * - einsatz_no_delete: Blockiert DELETE auf einsaetze
 *
 * DRK Compliance: 10-Jahres-Aufbewahrungspflicht erfordert,
 * dass keine Datensätze physisch gelöscht werden können.
 *
 * Hinweis: Die Tests MÜSSEN die Trigger temporär deaktivieren,
 * wenn sie Test-Daten aufräumen (siehe etb.e2e-setup.ts).
 */
describe('DRK Compliance NO-DELETE Triggers (E2E)', () => {
  let ctx: EtbE2eTestContext;

  beforeAll(async () => {
    ctx = await createEtbE2eModule();
  });

  afterAll(async () => {
    await teardownE2eModule(ctx);
  });

  beforeEach(async () => {
    await cleanupTestData(ctx);
  });

  /**
   * Test 6.2/6.3: Raw SQL DELETE auf etb_eintraege wird blockiert
   *
   * Given: Ein ETB mit einem Eintrag in der Datenbank
   * When: Raw SQL DELETE auf etb_eintraege ausgeführt wird
   * Then: PostgreSQL Exception mit "DRK Compliance Violation"
   */
  it('should block DELETE on etb_eintraege with DRK Compliance error', async () => {
    // Given: ETB mit Eintrag erstellen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry to protect', userId);
    await ctx.repository.save(aggregate);

    // Eintrag ID holen
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.eintraege).toHaveLength(1);
    const eintragId = retrieved!.eintraege[0].id.value;

    // When + Then: DELETE wird blockiert
    await expect(ctx.prisma.$executeRawUnsafe(`DELETE FROM etb_eintraege WHERE id = '${eintragId}'`)).rejects.toThrow('DRK Compliance Violation');
  });

  /**
   * Test 6.4: Exception Message enthält "DRK Compliance Violation"
   *
   * Given: Ein Eintrag in der Datenbank
   * When: DELETE versucht wird
   * Then: Error Message enthält exakt "DRK Compliance Violation"
   */
  it('should include "DRK Compliance Violation" in error message', async () => {
    // Given: ETB mit Eintrag
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry', userId);
    await ctx.repository.save(aggregate);

    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    const eintragId = retrieved!.eintraege[0].id.value;

    // When + Then: Error enthält spezifische Compliance Message
    try {
      await ctx.prisma.$executeRawUnsafe(`DELETE FROM etb_eintraege WHERE id = '${eintragId}'`);
      fail('Expected DELETE to throw an error');
    } catch (error: unknown) {
      expect(error).toBeDefined();
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).toContain('DRK Compliance Violation');
      expect(errorMessage).toContain('ETB Einträge cannot be deleted');
    }
  });

  /**
   * Test 6.5: Trigger ist aktiv in pg_trigger
   *
   * Given: Die Datenbank mit Trigger-Migration
   * When: pg_trigger abgefragt wird für etb_eintraege
   * Then: Trigger "etb_eintrag_no_delete" existiert
   */
  it('should have etb_eintrag_no_delete trigger active in pg_trigger', async () => {
    // When: Trigger abfragen
    const result = await ctx.prisma.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'etb_eintraege'::regclass
      AND tgname = 'etb_eintrag_no_delete'
    `;

    // Then: Trigger existiert
    expect(result).toHaveLength(1);
    expect(result[0].tgname).toBe('etb_eintrag_no_delete');
  });

  /**
   * Test: Trigger für einsaetze ist ebenfalls aktiv
   *
   * Given: Die Datenbank mit Trigger-Migration
   * When: pg_trigger abgefragt wird für einsaetze
   * Then: Trigger "einsatz_no_delete" existiert
   */
  it('should have einsatz_no_delete trigger active in pg_trigger', async () => {
    // When: Trigger abfragen
    const result = await ctx.prisma.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'einsaetze'::regclass
      AND tgname = 'einsatz_no_delete'
    `;

    // Then: Trigger existiert
    expect(result).toHaveLength(1);
    expect(result[0].tgname).toBe('einsatz_no_delete');
  });

  /**
   * Test: DELETE auf einsaetze wird blockiert
   *
   * Given: Ein Einsatz in der Datenbank
   * When: Raw SQL DELETE auf einsaetze ausgeführt wird
   * Then: PostgreSQL Exception mit "DRK Compliance Violation"
   *
   * Hinweis: Wir testen mit einem SEPARATEN Einsatz (nicht testEinsatzId),
   * weil der Test-Einsatz für den Teardown benötigt wird.
   */
  it('should block DELETE on einsaetze with DRK Compliance error', async () => {
    // Given: Separaten Test-Einsatz erstellen
    const separateEinsatzId = `test-delete-${Date.now()}`;
    await ctx.prisma.$executeRaw`
      INSERT INTO einsaetze (id, alarmstichwort, einsatzort, status, "createdBy", "updatedBy", "createdAt", "updatedAt")
      VALUES (
        ${separateEinsatzId},
        'DELETE TEST',
        'Test-Ort',
        'ANGELEGT'::"EinsatzStatus",
        ${ctx.testUserId},
        ${ctx.testUserId},
        NOW(),
        NOW()
      )
    `;

    // When + Then: DELETE wird blockiert
    await expect(ctx.prisma.$executeRawUnsafe(`DELETE FROM einsaetze WHERE id = '${separateEinsatzId}'`)).rejects.toThrow('DRK Compliance Violation');

    // Cleanup: Mit disabled Trigger aufräumen (afterAll macht das sowieso)
  });

  /**
   * Test: Bulk DELETE wird auch blockiert
   *
   * Given: Mehrere Einträge in der Datenbank
   * When: Bulk DELETE versucht wird
   * Then: Exception wird geworfen (auch wenn keine Zeilen betroffen wären)
   */
  it('should block bulk DELETE on etb_eintraege', async () => {
    // Given: ETB mit mehreren Einträgen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry 1', userId);
    aggregate.addEintrag('Entry 2', userId);
    aggregate.addEintrag('Entry 3', userId);
    await ctx.repository.save(aggregate);

    // When + Then: Bulk DELETE wird blockiert
    await expect(ctx.prisma.$executeRawUnsafe(`DELETE FROM etb_eintraege WHERE "etbId" = '${aggregate.id.value}'`)).rejects.toThrow('DRK Compliance Violation');
  });

  /**
   * Test: Trigger kann temporär deaktiviert werden (Cleanup Pattern)
   *
   * Given: Ein Eintrag der gelöscht werden soll für Cleanup
   * When: session_replication_role = replica gesetzt wird
   * Then: DELETE funktioniert (Trigger sind deaktiviert)
   *
   * WICHTIG: Dies dokumentiert das Cleanup-Pattern für Tests!
   * In Produktion sollte session_replication_role NIEMALS geändert werden.
   */
  it('should allow DELETE when session_replication_role = replica (cleanup pattern)', async () => {
    // Given: ETB mit Eintrag
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry to cleanup', userId);
    await ctx.repository.save(aggregate);

    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    const eintragId = retrieved!.eintraege[0].id.value;

    // When: Trigger deaktivieren und DELETE ausführen
    await ctx.prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // DELETE sollte jetzt funktionieren
      const deleteCount = await ctx.prisma.$executeRawUnsafe(`DELETE FROM etb_eintraege WHERE id = '${eintragId}'`);
      expect(deleteCount).toBe(1);

      // Verify: Eintrag ist gelöscht
      const dbCheck = await ctx.prisma.etbEintrag.findUnique({
        where: { id: eintragId },
      });
      expect(dbCheck).toBeNull();
    } finally {
      // WICHTIG: Immer re-enablen!
      await ctx.prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
  });
});
