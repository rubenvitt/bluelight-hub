import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { createEtbE2eModule, teardownE2eModule, cleanupTestData, type EtbE2eTestContext } from './etb.e2e-setup';

/**
 * E2E Tests für ETB Locking & Mutation Prevention (AC3)
 *
 * Testet die Sperr-Funktionalität des Einsatztagebuchs:
 * - Lock-Statusübergang (DRAFT/ACTIVE → LOCKED)
 * - Mutation Prevention nach Lock
 * - Idempotenz der Lock-Operation
 *
 * State Machine: DRAFT → ACTIVE → LOCKED (irreversibel!)
 */
describe('ETB Locking & Mutation Prevention (E2E)', () => {
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
   * Test 4.2: lock() setzt Status auf LOCKED
   *
   * Given: Ein ETB im DRAFT-Status
   * When: lock() aufgerufen wird
   * Then: Status ist LOCKED, isLocked() gibt true zurück
   */
  it('should set status to LOCKED after lock()', async () => {
    // Given: ETB im DRAFT-Status
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    await ctx.repository.save(aggregate);

    // When: lock() aufrufen
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.isLocked()).toBe(false);

    const lockResult = retrieved!.lock(userId);
    expect(lockResult.isSuccess).toBe(true);
    await ctx.repository.save(retrieved!);

    // Then: Status ist LOCKED
    const updated = await ctx.repository.findByEinsatzId(einsatzId);
    expect(updated).not.toBeNull();
    expect(updated!.isLocked()).toBe(true);
  });

  /**
   * Test 4.3: addEintrag() nach lock → Result.isFailure
   *
   * Given: Ein gesperrtes ETB
   * When: addEintrag() aufgerufen wird
   * Then: Operation schlägt mit Fehlermeldung fehl
   */
  it('should fail addEintrag() on locked ETB', async () => {
    // Given: Gesperrtes ETB
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.lock(userId);
    await ctx.repository.save(aggregate);

    // When + Then: addEintrag schlägt fehl
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.isLocked()).toBe(true);

    const addResult = retrieved!.addEintrag('Should fail', userId);
    expect(addResult.isFailure).toBe(true);
    expect(addResult.error).toContain('gesperrt');
  });

  /**
   * Test 4.4: updateEintrag() nach lock → Result.isFailure
   *
   * Given: Ein ETB mit einem Eintrag, das dann gesperrt wird
   * When: updateEintrag() aufgerufen wird
   * Then: Operation schlägt fehl
   */
  it('should fail updateEintrag() on locked ETB', async () => {
    // Given: ETB mit Eintrag
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    const addResult = aggregate.addEintrag('Original text', userId);
    expect(addResult.isSuccess).toBe(true);
    const eintragId = EintragId.create(addResult.value!.id.value).value!;
    await ctx.repository.save(aggregate);

    // Lock the ETB
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    retrieved!.lock(userId);
    await ctx.repository.save(retrieved!);

    // When + Then: updateEintrag schlägt fehl
    const locked = await ctx.repository.findByEinsatzId(einsatzId);
    expect(locked).not.toBeNull();
    expect(locked!.isLocked()).toBe(true);

    const updateResult = locked!.updateEintrag(eintragId, 'Should fail', userId);
    expect(updateResult.isFailure).toBe(true);
    expect(updateResult.error).toContain('gesperrt');
  });

  /**
   * Test 4.5: deleteEintrag() nach lock → Result.isFailure
   *
   * Given: Ein ETB mit einem Eintrag, das dann gesperrt wird
   * When: deleteEintrag() aufgerufen wird
   * Then: Operation schlägt fehl
   */
  it('should fail deleteEintrag() on locked ETB', async () => {
    // Given: ETB mit Eintrag
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    const addResult = aggregate.addEintrag('Entry to delete', userId);
    expect(addResult.isSuccess).toBe(true);
    const eintragId = EintragId.create(addResult.value!.id.value).value!;
    await ctx.repository.save(aggregate);

    // Lock the ETB
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    retrieved!.lock(userId);
    await ctx.repository.save(retrieved!);

    // When + Then: deleteEintrag schlägt fehl
    const locked = await ctx.repository.findByEinsatzId(einsatzId);
    expect(locked).not.toBeNull();
    expect(locked!.isLocked()).toBe(true);

    const deleteResult = locked!.deleteEintrag(eintragId, userId);
    expect(deleteResult.isFailure).toBe(true);
    expect(deleteResult.error).toContain('gesperrt');
  });

  /**
   * Test 4.6: lock() ist idempotent (zweiter Aufruf gibt Fehler, keine Exception)
   *
   * Given: Ein bereits gesperrtes ETB
   * When: lock() erneut aufgerufen wird
   * Then: Result.isFailure (kein Crash), Fehlermeldung "bereits gesperrt"
   */
  it('should return failure on second lock attempt (idempotent, no throw)', async () => {
    // Given: Gesperrtes ETB
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.lock(userId);
    await ctx.repository.save(aggregate);

    // When: Zweiter lock-Versuch
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.isLocked()).toBe(true);

    // Then: Fehler, aber keine Exception
    const secondLockResult = retrieved!.lock(userId);
    expect(secondLockResult.isFailure).toBe(true);
    expect(secondLockResult.error).toContain('bereits gesperrt');
  });

  /**
   * Test: Lock persists after save/reload cycle
   *
   * Given: Ein ETB das gelockt und gespeichert wird
   * When: ETB neu geladen wird
   * Then: isLocked() gibt immer noch true zurück
   */
  it('should persist lock status after save/reload', async () => {
    // Given: ETB locken und speichern
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.lock(userId);
    await ctx.repository.save(aggregate);

    // When: Neu laden
    const reloaded = await ctx.repository.findByEinsatzId(einsatzId);

    // Then: Status ist immer noch LOCKED
    expect(reloaded).not.toBeNull();
    expect(reloaded!.isLocked()).toBe(true);
  });

  /**
   * Test: Eintraege bleiben nach Lock erhalten (nur lesbar)
   *
   * Given: Ein ETB mit Einträgen das gelockt wird
   * When: ETB neu geladen wird
   * Then: Alle Einträge sind noch vorhanden und lesbar
   */
  it('should preserve entries after lock (read-only access)', async () => {
    // Given: ETB mit Einträgen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry 1', userId);
    aggregate.addEintrag('Entry 2', userId);
    aggregate.addEintrag('Entry 3', userId);
    aggregate.lock(userId);
    await ctx.repository.save(aggregate);

    // When: Neu laden
    const reloaded = await ctx.repository.findByEinsatzId(einsatzId);

    // Then: Einträge sind noch da
    expect(reloaded).not.toBeNull();
    expect(reloaded!.isLocked()).toBe(true);
    expect(reloaded!.eintraege).toHaveLength(3);
    expect(reloaded!.eintraege[0].text).toBe('Entry 1');
    expect(reloaded!.eintraege[1].text).toBe('Entry 2');
    expect(reloaded!.eintraege[2].text).toBe('Entry 3');
  });
});
