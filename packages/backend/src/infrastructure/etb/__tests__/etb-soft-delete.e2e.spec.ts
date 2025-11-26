import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { createEtbE2eModule, teardownE2eModule, cleanupTestData, type EtbE2eTestContext } from './etb.e2e-setup';

/**
 * E2E Tests für ETB Soft-Delete Funktionalität (AC4, AC5)
 *
 * Testet das DRK-konforme Soft-Delete Verhalten:
 * - Einträge werden NICHT physisch gelöscht
 * - isDeleted Flag wird gesetzt (Domain Layer)
 * - deletedAt Timestamp wird persistiert (Infrastructure Layer)
 * - Sequence Numbers bleiben stabil (keine Renummerierung)
 * - Gelöschte Einträge bleiben im Aggregate enthalten
 *
 * Compliance: DRK NO-DELETE Policy garantiert lückenlose Audit-Trails
 */
describe('ETB Soft-Delete (E2E)', () => {
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
   * Test 5.2: deleteEintrag() setzt isDeleted=true
   *
   * Given: Ein ETB mit einem Eintrag
   * When: deleteEintrag() aufgerufen wird
   * Then: isDeleted ist true auf dem Eintrag
   */
  it('should set isDeleted=true after deleteEintrag()', async () => {
    // Given: ETB mit Eintrag
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    const addResult = aggregate.addEintrag('Entry to delete', userId);
    expect(addResult.isSuccess).toBe(true);
    const eintragId = EintragId.create(addResult.value!.id.value).value!;
    await ctx.repository.save(aggregate);

    // Verify entry exists and is NOT deleted
    let retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.eintraege[0].isDeleted).toBe(false);

    // When: deleteEintrag
    const deleteResult = retrieved!.deleteEintrag(eintragId, userId);
    expect(deleteResult.isSuccess).toBe(true);
    await ctx.repository.save(retrieved!);

    // Then: isDeleted ist true
    retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.eintraege[0].isDeleted).toBe(true);
  });

  /**
   * Test 5.2b: deletedAt Timestamp wird in DB persistiert
   *
   * Given: Ein ETB mit einem Eintrag
   * When: deleteEintrag() aufgerufen und persistiert wird
   * Then: In der Datenbank ist deletedAt != null
   */
  it('should persist deletedAt timestamp in database', async () => {
    // Given: ETB mit Eintrag
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    const addResult = aggregate.addEintrag('Entry to delete', userId);
    expect(addResult.isSuccess).toBe(true);
    const eintragIdValue = addResult.value!.id.value;
    await ctx.repository.save(aggregate);

    // When: deleteEintrag
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    const eintragId = EintragId.create(retrieved!.eintraege[0].id.value).value!;
    retrieved!.deleteEintrag(eintragId, userId);
    await ctx.repository.save(retrieved!);

    // Then: deletedAt ist in DB nicht null (direkte DB Abfrage)
    const dbEntry = await ctx.prisma.etbEintrag.findUnique({
      where: { id: eintragIdValue },
    });
    expect(dbEntry).not.toBeNull();
    expect(dbEntry!.deletedAt).not.toBeNull();
    expect(dbEntry!.deletedAt).toBeInstanceOf(Date);
  });

  /**
   * Test 5.3/5.4: Gelöschte Einträge bleiben im Aggregate enthalten
   *
   * Given: Ein ETB mit mehreren Einträgen, einer wird gelöscht
   * When: ETB neu geladen wird
   * Then: Alle Einträge (inkl. gelöschte) sind im Aggregate
   *
   * Hinweis: Kein `includeDeleted` Flag - Repository lädt immer ALLE Einträge
   */
  it('should include deleted entries in loaded aggregate', async () => {
    // Given: ETB mit 3 Einträgen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry 1', userId);
    aggregate.addEintrag('Entry 2', userId);
    aggregate.addEintrag('Entry 3', userId);
    await ctx.repository.save(aggregate);

    // Delete Entry 2
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.eintraege).toHaveLength(3);
    const entry2Id = EintragId.create(retrieved!.eintraege[1].id.value).value!;
    retrieved!.deleteEintrag(entry2Id, userId);
    await ctx.repository.save(retrieved!);

    // When: Neu laden
    const reloaded = await ctx.repository.findByEinsatzId(einsatzId);

    // Then: Alle 3 Einträge sind noch da (inkl. gelöschter)
    expect(reloaded).not.toBeNull();
    expect(reloaded!.eintraege).toHaveLength(3);

    // Entry 2 ist als gelöscht markiert
    const deletedEntry = reloaded!.eintraege.find((e) => e.text === 'Entry 2');
    expect(deletedEntry).toBeDefined();
    expect(deletedEntry!.isDeleted).toBe(true);

    // Entry 1 und 3 sind nicht gelöscht
    expect(reloaded!.eintraege[0].isDeleted).toBe(false);
    expect(reloaded!.eintraege[2].isDeleted).toBe(false);
  });

  /**
   * Test 5.5: Sequence Numbers bleiben stabil nach Soft-Delete (AC5)
   *
   * Given: Ein ETB mit 3 Einträgen (seqNum 1, 2, 3)
   * When: Entry 2 soft-deleted wird
   * Then: Sequence Numbers sind unverändert (1, 2, 3)
   */
  it('should maintain stable sequence numbers after soft-delete (AC5)', async () => {
    // Given: ETB mit 3 Einträgen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry 1', userId); // seqNum 1
    aggregate.addEintrag('Entry 2', userId); // seqNum 2
    aggregate.addEintrag('Entry 3', userId); // seqNum 3
    await ctx.repository.save(aggregate);

    // When: Delete Entry 2
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    const entry2Id = EintragId.create(retrieved!.eintraege[1].id.value).value!;
    retrieved!.deleteEintrag(entry2Id, userId);
    await ctx.repository.save(retrieved!);

    // Then: Sequence numbers sind unverändert
    const reloaded = await ctx.repository.findByEinsatzId(einsatzId);
    expect(reloaded).not.toBeNull();
    const seqNums = reloaded!.eintraege.map((e) => e.sequenceNumber.value);
    expect(seqNums).toEqual([1, 2, 3]); // Keine Renummerierung!
  });

  /**
   * Test 5.6: Version inkrementiert bei delete
   *
   * Given: Ein ETB mit Version 2 (nach addEintrag)
   * When: deleteEintrag() aufgerufen wird
   * Then: Version ist 3
   */
  it('should increment version on delete', async () => {
    // Given: ETB mit Eintrag (Version 2 nach add)
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry', userId);
    await ctx.repository.save(aggregate);

    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.version.versionNumber).toBe(2);

    // When: deleteEintrag
    const eintragId = EintragId.create(retrieved!.eintraege[0].id.value).value!;
    retrieved!.deleteEintrag(eintragId, userId);
    await ctx.repository.save(retrieved!);

    // Then: Version ist 3
    const updated = await ctx.repository.findByEinsatzId(einsatzId);
    expect(updated).not.toBeNull();
    expect(updated!.version.versionNumber).toBe(3);
  });

  /**
   * Test: Neuer Eintrag nach Soft-Delete bekommt nächste Sequence Number
   *
   * Given: ETB mit Entry 1 (seqNum 1), Entry 1 gelöscht
   * When: Neuer Eintrag hinzugefügt wird
   * Then: Neuer Eintrag hat seqNum 2 (nicht 1!)
   */
  it('should assign next sequence number after soft-delete', async () => {
    // Given: ETB mit einem Eintrag, der gelöscht wird
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry 1', userId);
    await ctx.repository.save(aggregate);

    // Delete Entry 1
    let retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    const entry1Id = EintragId.create(retrieved!.eintraege[0].id.value).value!;
    retrieved!.deleteEintrag(entry1Id, userId);
    await ctx.repository.save(retrieved!);

    // When: Neuen Eintrag hinzufügen
    retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    retrieved!.addEintrag('Entry 2', userId);
    await ctx.repository.save(retrieved!);

    // Then: Entry 2 hat seqNum 2 (nicht 1!)
    const final = await ctx.repository.findByEinsatzId(einsatzId);
    expect(final).not.toBeNull();
    const entry2 = final!.eintraege.find((e) => e.text === 'Entry 2');
    expect(entry2).toBeDefined();
    expect(entry2!.sequenceNumber.value).toBe(2);
  });

  /**
   * Test: Delete Operation ist idempotent bei bereits gelöschtem Eintrag
   *
   * Given: Ein bereits gelöschter Eintrag
   * When: deleteEintrag() erneut aufgerufen wird
   * Then: Operation ist erfolgreich (idempotent), isDeleted bleibt true
   *
   * Hinweis: Aktuelles Verhalten ist idempotent - keine Fehler bei erneutem Delete
   */
  it('should be idempotent when deleting already deleted entry', async () => {
    // Given: ETB mit gelöschtem Eintrag
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry', userId);
    await ctx.repository.save(aggregate);

    // Delete
    let retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    const eintragId = EintragId.create(retrieved!.eintraege[0].id.value).value!;
    retrieved!.deleteEintrag(eintragId, userId);
    await ctx.repository.save(retrieved!);

    // When: Erneut löschen versuchen
    retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    const secondDeleteResult = retrieved!.deleteEintrag(eintragId, userId);

    // Then: Operation ist erfolgreich (idempotent)
    expect(secondDeleteResult.isSuccess).toBe(true);
    // isDeleted bleibt true
    expect(retrieved!.eintraege.find((e) => e.id.equals(eintragId))?.isDeleted).toBe(true);
  });

  /**
   * Test: Snapshot wird VOR Soft-Delete erstellt (AC2)
   *
   * Given: ETB mit einem Eintrag
   * When: Eintrag soft-deleted wird
   * Then: Der Snapshot enthält den Eintrag mit isDeleted=false
   */
  it('should create snapshot BEFORE soft-delete mutation', async () => {
    // Given: ETB mit Eintrag
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry to delete', userId);
    await ctx.repository.save(aggregate);

    // When: Delete
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    const eintragId = EintragId.create(retrieved!.eintraege[0].id.value).value!;
    retrieved!.deleteEintrag(eintragId, userId);
    await ctx.repository.save(retrieved!);

    // Then: Snapshot enthält Eintrag als NICHT gelöscht
    const history = await ctx.repository.getHistory(retrieved!.id);
    expect(history.length).toBeGreaterThan(0);
    const lastSnapshot = history[history.length - 1];
    const snapshotEntry = lastSnapshot.eintraege.find((e) => e.text === 'Entry to delete');
    expect(snapshotEntry).toBeDefined();
    // Der Snapshot VOR dem Delete sollte isDeleted=false zeigen
    expect(snapshotEntry!.isDeleted).toBe(false);
  });
});
