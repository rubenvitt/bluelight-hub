import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { createEtbE2eModule, teardownE2eModule, cleanupTestData, type EtbE2eTestContext } from './etb.e2e-setup';

/**
 * E2E Tests für ETB Versioning & Snapshot Funktionalität
 *
 * Testet die Event-Sourcing-ähnliche Versionierung des Einsatztagebuchs:
 * - Versionsinkrementierung bei Mutationen
 * - Snapshot-Erstellung vor Mutationen (AC2)
 * - Historien-Sortierung nach versionNumber
 * - Stabilität von Sequence Numbers (AC5)
 */
describe('ETB Versioning & Snapshots (E2E)', () => {
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
   * Test 1: Version Inkrementierung nach addEintrag()
   *
   * Given: Ein frisch erstelltes ETB mit Version 1
   * When: Ein neuer Eintrag wird hinzugefügt
   * Then: Die Version wird auf 2 erhöht
   */
  it('should increment version after addEintrag', async () => {
    // Given: ETB mit version = 1
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    await ctx.repository.save(aggregate);

    // When: Eintrag hinzufügen
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    const result = retrieved!.addEintrag('Test entry', userId);
    expect(result.isSuccess).toBe(true);
    await ctx.repository.save(retrieved!);

    // Then: Version ist inkrementiert
    const updated = await ctx.repository.findByEinsatzId(einsatzId);
    expect(updated).not.toBeNull();
    expect(updated!.version.versionNumber).toBe(2);
  });

  /**
   * Test 2: Snapshot-Erstellung VOR updateEintrag() Mutation (AC2)
   *
   * Given: Ein ETB mit einem bestehenden Eintrag
   * When: Der Eintrag wird aktualisiert
   * Then: Der Snapshot enthält den ALTEN Text (vor der Mutation)
   */
  it('should create snapshot BEFORE updateEintrag mutation', async () => {
    // Given: ETB mit einem Eintrag
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Original text', userId);
    await ctx.repository.save(aggregate);

    // When: Eintrag updaten
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.eintraege.length).toBe(1);
    const eintragId = EintragId.create(retrieved!.eintraege[0].id.value).value!;
    const updateResult = retrieved!.updateEintrag(eintragId, 'Updated text', userId);
    expect(updateResult.isSuccess).toBe(true);
    await ctx.repository.save(retrieved!);

    // Then: Snapshot enthält ALTEN Text (vor Mutation)
    const history = await ctx.repository.getHistory(retrieved!.id);
    expect(history.length).toBeGreaterThan(0);
    // Der letzte Snapshot (vor Update) sollte 'Original text' enthalten
    const lastSnapshot = history[history.length - 1];
    const snapshotEintraege = lastSnapshot.eintraege;
    expect(snapshotEintraege.some((e) => e.text === 'Original text')).toBe(true);
  });

  /**
   * Test 3: Historie-Sortierung nach versionNumber ASC
   *
   * Given: Ein ETB mit mehreren aufeinanderfolgenden Mutationen
   * When: Die Historie abgerufen wird
   * Then: Snapshots sind nach versionNumber aufsteigend sortiert
   */
  it('should return snapshots ordered by versionNumber ASC', async () => {
    // Given: ETB mit mehreren Mutationen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry 1', userId);
    await ctx.repository.save(aggregate);

    const retrieved1 = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved1).not.toBeNull();
    retrieved1!.addEintrag('Entry 2', userId);
    await ctx.repository.save(retrieved1!);

    const retrieved2 = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved2).not.toBeNull();
    retrieved2!.addEintrag('Entry 3', userId);
    await ctx.repository.save(retrieved2!);

    // When + Then: History is ordered ASC
    const history = await ctx.repository.getHistory(retrieved2!.id);
    expect(history.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < history.length; i++) {
      expect(history[i].versionNumber).toBeGreaterThan(history[i - 1].versionNumber);
    }
  });

  /**
   * Test 4: Stabilität von Sequence Numbers nach Operationen (AC5)
   *
   * Given: Ein ETB mit 3 Einträgen (seqNum 1, 2, 3)
   * When: Der mittlere Eintrag wird soft-deleted
   * Then: Die Sequence Numbers bleiben unverändert (keine Renummerierung)
   */
  it('should maintain stable sequence numbers', async () => {
    // Given: ETB mit 3 Einträgen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry 1', userId); // seqNum 1
    aggregate.addEintrag('Entry 2', userId); // seqNum 2
    aggregate.addEintrag('Entry 3', userId); // seqNum 3
    await ctx.repository.save(aggregate);

    // When: Eintrag 2 soft-deleten
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.eintraege.length).toBe(3);
    const entry2Id = EintragId.create(retrieved!.eintraege[1].id.value).value!;
    const deleteResult = retrieved!.deleteEintrag(entry2Id, userId);
    expect(deleteResult.isSuccess).toBe(true);
    await ctx.repository.save(retrieved!);

    // Then: Sequence numbers sind unverändert
    const updated = await ctx.repository.findByEinsatzId(einsatzId);
    expect(updated).not.toBeNull();
    const seqNums = updated!.eintraege.map((e) => e.sequenceNumber.value);
    expect(seqNums).toEqual([1, 2, 3]); // Keine Renummerierung!
  });

  /**
   * Test 5: Version Inkrementierung für alle Mutation-Typen
   *
   * Given: Ein frisches ETB (Version 1)
   * When: Add, Update, Delete Operationen durchgeführt werden
   * Then: Version inkrementiert für jeden Schritt (v1 -> v2 -> v3 -> v4)
   */
  it('should increment version for add, update, delete', async () => {
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    await ctx.repository.save(aggregate);

    // v1 -> v2 (add)
    let current = (await ctx.repository.findByEinsatzId(einsatzId))!;
    expect(current).not.toBeNull();
    current.addEintrag('Entry', userId);
    await ctx.repository.save(current);
    expect((await ctx.repository.findByEinsatzId(einsatzId))!.version.versionNumber).toBe(2);

    // v2 -> v3 (update)
    current = (await ctx.repository.findByEinsatzId(einsatzId))!;
    expect(current).not.toBeNull();
    expect(current.eintraege.length).toBe(1);
    const eintragId = EintragId.create(current.eintraege[0].id.value).value!;
    current.updateEintrag(eintragId, 'Updated', userId);
    await ctx.repository.save(current);
    expect((await ctx.repository.findByEinsatzId(einsatzId))!.version.versionNumber).toBe(3);

    // v3 -> v4 (delete)
    current = (await ctx.repository.findByEinsatzId(einsatzId))!;
    expect(current).not.toBeNull();
    current.deleteEintrag(eintragId, userId);
    await ctx.repository.save(current);
    expect((await ctx.repository.findByEinsatzId(einsatzId))!.version.versionNumber).toBe(4);
  });

  /**
   * Test 6: Fortlaufende Sequence Numbers ohne Gaps (AC5)
   *
   * Given: Ein ETB mit einem Eintrag (seqNum 1)
   * When: Der Eintrag wird soft-deleted und ein neuer Eintrag hinzugefügt
   * Then: Der neue Eintrag erhält seqNum 2 (nicht 1)
   */
  it('should continue sequence numbers without gaps', async () => {
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry 1', userId); // seqNum 1
    await ctx.repository.save(aggregate);

    // Soft-delete Entry 1
    let current = (await ctx.repository.findByEinsatzId(einsatzId))!;
    expect(current).not.toBeNull();
    expect(current.eintraege.length).toBe(1);
    const entry1Id = EintragId.create(current.eintraege[0].id.value).value!;
    current.deleteEintrag(entry1Id, userId);
    await ctx.repository.save(current);

    // Add Entry 2 - should be seqNum 2, not 1
    current = (await ctx.repository.findByEinsatzId(einsatzId))!;
    expect(current).not.toBeNull();
    current.addEintrag('Entry 2', userId);
    await ctx.repository.save(current);

    // Then: Entry 2 hat seqNum 2
    const final = (await ctx.repository.findByEinsatzId(einsatzId))!;
    expect(final).not.toBeNull();
    const entry2 = final.eintraege.find((e) => e.text === 'Entry 2');
    expect(entry2).toBeDefined();
    expect(entry2!.sequenceNumber.value).toBe(2);
  });
});
