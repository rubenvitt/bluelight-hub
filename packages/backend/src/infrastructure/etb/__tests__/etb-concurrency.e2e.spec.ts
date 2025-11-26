import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { createEtbE2eModule, teardownE2eModule, cleanupTestData, type EtbE2eTestContext } from './etb.e2e-setup';

/**
 * E2E Tests für ETB Concurrency & Optimistic Locking (AC8)
 *
 * HINWEIS: Optimistic Locking ist im Repository NICHT implementiert (Stand Epic 3).
 * Die README dokumentiert das gewünschte Verhalten, aber save() macht einfach UPSERT
 * ohne Version-Prüfung.
 *
 * Diese Tests dokumentieren das AKTUELLE Verhalten:
 * - Last-Write-Wins: Parallele Saves überschreiben sich gegenseitig
 * - Kein ConflictException bei Version-Mismatch
 *
 * Zukünftige Implementierung (Epic 4+) sollte:
 * - SELECT version vor UPDATE
 * - WHERE version = expectedVersion im UPDATE
 * - ConflictException bei Mismatch
 */
describe('ETB Concurrency & Optimistic Locking (E2E)', () => {
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
   * Test: Version wird korrekt persistiert und erhöht
   *
   * Given: Ein ETB mit Version 1
   * When: addEintrag() aufgerufen und persistiert wird
   * Then: Version ist 2 in der Datenbank
   */
  it('should persist version correctly in database', async () => {
    // Given: ETB erstellen (Version 1)
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    await ctx.repository.save(aggregate);

    // When: Eintrag hinzufügen (Version 2)
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    retrieved!.addEintrag('Entry', userId);
    await ctx.repository.save(retrieved!);

    // Then: Version ist 2 in DB
    const dbEtb = await ctx.prisma.einsatztagebuch.findUnique({
      where: { einsatzId: ctx.testEinsatzId },
    });
    expect(dbEtb).not.toBeNull();
    expect(dbEtb!.version).toBe(2);
  });

  /**
   * Test: Reload nach Save liefert aktuelle Version
   *
   * Given: ETB Version 1 wird auf Version 3 geändert (mehrere Mutations)
   * When: ETB neu geladen wird
   * Then: Geladenes ETB hat Version 3
   */
  it('should reload fresh version after save', async () => {
    // Given: ETB erstellen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    await ctx.repository.save(aggregate);

    // Mehrere Mutations (v1 -> v2 -> v3)
    let current = (await ctx.repository.findByEinsatzId(einsatzId))!;
    current.addEintrag('Entry 1', userId);
    await ctx.repository.save(current);

    current = (await ctx.repository.findByEinsatzId(einsatzId))!;
    current.addEintrag('Entry 2', userId);
    await ctx.repository.save(current);

    // When: Neu laden
    const reloaded = await ctx.repository.findByEinsatzId(einsatzId);

    // Then: Version ist 3
    expect(reloaded).not.toBeNull();
    expect(reloaded!.version.versionNumber).toBe(3);
  });

  /**
   * Test: Concurrent Saves werden durch Snapshot Unique Constraint erkannt (AC8)
   *
   * Given: ETB wird zweimal parallel geladen (beide haben Version 1)
   * When: Beide Instanzen werden modifiziert und nacheinander gespeichert
   * Then: Erster Save erfolgreich, zweiter Save schlägt fehl (Snapshot Conflict)
   *
   * IMPLEMENTIERUNG: Der Unique Constraint auf etb_snapshots(etbId, versionNumber)
   * wirkt als Optimistic Locking - beide Clients versuchen Snapshot v2 zu erstellen.
   */
  it('should detect concurrent saves via snapshot version conflict (AC8)', async () => {
    // Given: ETB erstellen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    await ctx.repository.save(aggregate);

    // Beide Clients laden dieselbe Version (v1)
    const client1 = await ctx.repository.findByEinsatzId(einsatzId);
    const client2 = await ctx.repository.findByEinsatzId(einsatzId);

    expect(client1).not.toBeNull();
    expect(client2).not.toBeNull();
    expect(client1!.version.versionNumber).toBe(1);
    expect(client2!.version.versionNumber).toBe(1);

    // Client 1 modifiziert und speichert erfolgreich (v1 -> v2)
    client1!.addEintrag('Entry from Client 1', userId);
    await ctx.repository.save(client1!);

    // Client 2 modifiziert und versucht zu speichern (v1 -> v2 im Speicher)
    // ERWARTET: Fehler wegen Snapshot Version Conflict
    client2!.addEintrag('Entry from Client 2', userId);
    await expect(ctx.repository.save(client2!)).rejects.toThrow('Unique constraint failed');
  });

  /**
   * Test: Version in Domain stimmt mit DB überein nach Reload
   *
   * Given: ETB wird verändert und gespeichert
   * When: ETB neu geladen wird
   * Then: Domain Version === DB Version
   */
  it('should have consistent version between domain and database', async () => {
    // Given: ETB mit Änderungen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Entry', userId);
    await ctx.repository.save(aggregate);

    // When: Reload
    const reloaded = await ctx.repository.findByEinsatzId(einsatzId);

    // Then: Versionen stimmen überein
    const dbVersion = await ctx.prisma.einsatztagebuch.findUnique({
      where: { einsatzId: ctx.testEinsatzId },
      select: { version: true },
    });

    expect(reloaded).not.toBeNull();
    expect(dbVersion).not.toBeNull();
    expect(reloaded!.version.versionNumber).toBe(dbVersion!.version);
  });

  /**
   * Test: Direkte DB-Manipulation wird erkannt (Szenario für Optimistic Locking)
   *
   * Given: ETB Version 1 geladen
   * When: DB-Version wird extern auf 2 geändert, dann wird v1 gespeichert
   * Then: AKTUELL: Save erfolgreich (überschreibt DB-Version)
   *       GEWÜNSCHT: ConflictException
   *
   * Dieser Test dokumentiert das AKTUELLE Verhalten und kann als
   * Basis für die Optimistic Locking Implementierung dienen.
   */
  it('should document behavior when DB version changes externally (CURRENT: overwrites)', async () => {
    // Given: ETB erstellen und laden
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    await ctx.repository.save(aggregate);

    const loaded = await ctx.repository.findByEinsatzId(einsatzId);
    expect(loaded).not.toBeNull();
    expect(loaded!.version.versionNumber).toBe(1);

    // Externe DB-Änderung: Version direkt auf 5 setzen
    await ctx.prisma.einsatztagebuch.update({
      where: { einsatzId: ctx.testEinsatzId },
      data: { version: 5 },
    });

    // When: Aggregate (noch v1 im Speicher) wird modifiziert und gespeichert
    loaded!.addEintrag('Entry after external change', userId);
    // loaded!.version ist jetzt 2 im Speicher (v1 + increment)

    // AKTUELLES VERHALTEN: Save erfolgreich - überschreibt DB-Version
    await expect(ctx.repository.save(loaded!)).resolves.not.toThrow();

    // DB-Version ist jetzt 2 (nicht 5, nicht 6)
    const dbAfter = await ctx.prisma.einsatztagebuch.findUnique({
      where: { einsatzId: ctx.testEinsatzId },
      select: { version: true },
    });
    expect(dbAfter!.version).toBe(2); // CURRENT: Überschrieben
    // GEWÜNSCHT wäre: ConflictException und DB bleibt bei 5
  });

  /**
   * Test: Reload nach Conflict gibt aktuelle Version zurück (AC8)
   *
   * Given: Conflict durch concurrent save
   * When: Client 2 neu lädt nach Conflict
   * Then: Client 2 sieht aktuelle Version von Client 1
   */
  it('should reload fresh version after conflict (AC8)', async () => {
    // Given: ETB mit initialem Zustand
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    await ctx.repository.save(aggregate);

    // Zwei Clients laden (beide sehen Version 1)
    const client1 = (await ctx.repository.findByEinsatzId(einsatzId))!;
    const client2 = (await ctx.repository.findByEinsatzId(einsatzId))!;

    // Client 1 speichert erfolgreich (v1 -> v2)
    client1.addEintrag('Client 1 Entry', userId);
    await ctx.repository.save(client1);

    // Client 2 bekommt Conflict
    client2.addEintrag('Client 2 Entry', userId);
    await expect(ctx.repository.save(client2)).rejects.toThrow();

    // When: Client 2 lädt neu
    const reloaded = (await ctx.repository.findByEinsatzId(einsatzId))!;

    // Then: Sieht aktuelle Version mit Client 1's Eintrag
    expect(reloaded.version.versionNumber).toBe(2);
    expect(reloaded.eintraege).toHaveLength(1);
    expect(reloaded.eintraege[0].text).toBe('Client 1 Entry');
  });
});
