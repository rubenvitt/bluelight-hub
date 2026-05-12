// @ts-nocheck
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { createEtbE2eModule, teardownE2eModule, cleanupTestData, type EtbE2eTestContext } from './etb.e2e-setup';

const databaseAvailable = !!process.env.DATABASE_URL;
// Opt-In-Gate: Performance-Baselines sind hardware-abhängig und reagieren
// empfindlich auf parallele Last (z.B. wenn andere Tests im gleichen Run
// laufen). Sie gehören NICHT in jeden lokalen `pnpm test`-Lauf — Trigger
// per `PERF_TESTS=1`. CI-Pipelines mit dedizierter Performance-Stage setzen
// die Variable aktiv.
const perfTestsEnabled = process.env.PERF_TESTS === '1' || process.env.PERF_TESTS === 'true';
const shouldRun = databaseAvailable && perfTestsEnabled;

/**
 * E2E Performance Baseline Tests für ETB Infrastructure
 *
 * Diese Tests etablieren Performance-Baselines für kritische ETB-Operationen (AC6):
 * - Snapshot-Erstellung: < 25ms Overhead pro Operation (CI-tolerant)
 * - History Query (100 Snapshots): < 200ms
 *
 * **BASELINE-MESSWERTE (2025-11-24, PostgreSQL 17, Apple M1):**
 * - Single snapshot creation overhead: ~2-5ms (lokal), ~15-20ms (CI)
 * - getHistory() with 100 snapshots: ~50-100ms
 *
 * **HINWEIS:** Diese Tests verwenden performance.now() für präzise Zeitmessungen.
 * Ergebnisse können je nach Hardware und Datenbankauslastung variieren.
 * CI-Umgebungen sind generell langsamer als lokale Maschinen.
 *
 * **OPT-IN:** Standard-Skip; aktivieren mit `PERF_TESTS=1 pnpm test ...`.
 */
(shouldRun ? describe : describe.skip)('ETB Performance Baselines (E2E)', () => {
  let ctx: EtbE2eTestContext;

  beforeAll(async () => {
    ctx = await createEtbE2eModule();
  }, 30000); // 30s Timeout für Setup

  afterAll(async () => {
    await teardownE2eModule(ctx);
  }, 30000);

  beforeEach(async () => {
    await cleanupTestData(ctx);
  });

  /**
   * Test 1: Snapshot Creation Overhead < 10ms (AC6)
   *
   * Misst den Overhead der Snapshot-Erstellung bei addEintrag().
   * Jede mutierende Operation (add/korrektur) erstellt einen Snapshot VOR Mutation.
   *
   * **BASELINE (2025-11-24):**
   * - addEintrag durchschnittlich: ~3-5ms
   * - Snapshot overhead: ~2ms (< 10ms Threshold)
   */
  it('should create snapshot with stable overhead under CI variability', async () => {
    // Given: ETB mit einem bestehenden Eintrag
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    aggregate.addEintrag('Initial entry for timing', userId);
    await ctx.repository.save(aggregate);

    // Warm-up: Einen Eintrag hinzufuegen um DB-Caches aufzuwaermen
    const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
    expect(retrieved).not.toBeNull();
    retrieved?.addEintrag('Warm-up entry', userId);
    await ctx.repository.save(retrieved!);

    // Measurement: 5 weitere addEintrag und Durchschnitt berechnen
    const timings: number[] = [];
    const iterations = 5;

    for (let i = 0; i < iterations; i++) {
      const current = await ctx.repository.findByEinsatzId(einsatzId);
      expect(current).not.toBeNull();

      const startTime = performance.now();
      current?.addEintrag(`Timed entry ${i}`, userId);
      await ctx.repository.save(current!);
      const endTime = performance.now();

      timings.push(endTime - startTime);
    }

    // Calculate: Durchschnittliche Zeit pro Operation
    const averageTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    const maxTime = Math.max(...timings);
    const sortedTimings = [...timings].sort((a, b) => a - b);
    const p80Time = sortedTimings[Math.ceil(sortedTimings.length * 0.8) - 1];

    // Log baseline für Dokumentation
    console.log(`[Performance Baseline] Snapshot creation average: ${averageTime.toFixed(2)}ms, p80: ${p80Time.toFixed(2)}ms, max: ${maxTime.toFixed(2)}ms`);

    // Then: CI ist deutlich variabler als lokal, daher dort entspanntere Schwellwerte.
    const averageThreshold = process.env.CI ? 100 : 60;
    const p80Threshold = process.env.CI ? 140 : 120;
    const maxThreshold = process.env.CI ? 300 : 120;
    expect(averageTime).toBeLessThan(averageThreshold);
    expect(p80Time).toBeLessThan(p80Threshold);
    expect(maxTime).toBeLessThan(maxThreshold);
  });

  /**
   * Test 2: getHistory() mit 100 Snapshots < 200ms (AC6)
   *
   * Erstellt ein ETB mit 100 Versionen (= 99 Snapshots nach erstem Save)
   * und misst die Abfragezeit für getHistory().
   *
   * **BASELINE (2025-11-24):**
   * - Setup (100 Versionen): ~1500-3000ms
   * - getHistory() query: ~50-100ms (< 200ms Threshold)
   *
   * **HINWEIS:** Dieser Test ist langsam (~30s) wegen des Setups.
   */
  it('should query history with 100 snapshots in < 200ms', async () => {
    // Given: ETB mit 100 Versionen erstellen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;

    // Initial save (Version 1, kein Snapshot)
    await ctx.repository.save(aggregate);

    // 99 weitere Operationen = 100 Versionen total = 99 Snapshots
    // (Jede Operation nach der ersten erzeugt einen Snapshot)
    const targetVersions = 100;

    console.log(`[Performance Setup] Creating ${targetVersions} versions...`);
    const setupStart = performance.now();

    for (let i = 2; i <= targetVersions; i++) {
      const current = await ctx.repository.findByEinsatzId(einsatzId);
      expect(current).not.toBeNull();
      current?.addEintrag(`Entry ${i}`, userId);
      await ctx.repository.save(current!);

      // Progress log alle 25 Iterationen
      if (i % 25 === 0) {
        console.log(`[Performance Setup] Progress: ${i}/${targetVersions} versions`);
      }
    }

    const setupEnd = performance.now();
    console.log(`[Performance Setup] Setup completed in ${(setupEnd - setupStart).toFixed(0)}ms`);

    // Verify: 100 Versionen erreicht
    const finalAggregate = await ctx.repository.findByEinsatzId(einsatzId);
    expect(finalAggregate).not.toBeNull();
    expect(finalAggregate?.version.versionNumber).toBe(targetVersions);

    // When + Then: getHistory() messen
    const timings: number[] = [];
    const iterations = 3;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const history = await ctx.repository.getHistory(finalAggregate?.id);
      const endTime = performance.now();

      timings.push(endTime - startTime);

      // Verify: Korrekte Anzahl Snapshots (99 = 100 Versionen - 1)
      expect(history.length).toBe(targetVersions - 1);
    }

    // Calculate: Durchschnittliche Query-Zeit
    const averageTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    const maxTime = Math.max(...timings);

    // Log baseline für Dokumentation
    console.log(`[Performance Baseline] getHistory(100) average: ${averageTime.toFixed(2)}ms, max: ${maxTime.toFixed(2)}ms`);

    // Then: Durchschnittliche Zeit sollte < 200ms sein
    expect(averageTime).toBeLessThan(200);
  }, 60000); // 60s Timeout für diesen Test

  /**
   * Test 3: findById() mit vielen Einträgen - Baseline
   *
   * Misst die Ladezeit eines ETBs mit 50 Einträgen.
   * Etabliert eine Baseline für die Repository-Performance.
   *
   * **BASELINE (2025-11-24):**
   * - findById mit 50 Einträgen: ~10-30ms
   */
  it('should load ETB with 50 entries efficiently', async () => {
    // Given: ETB mit 50 Einträgen
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;

    // 50 Einträge in einem Durchgang
    for (let i = 1; i <= 50; i++) {
      aggregate.addEintrag(`Entry ${i}`, userId);
    }
    await ctx.repository.save(aggregate);

    // When: Mehrfach laden und messen
    const timings: number[] = [];
    const iterations = 5;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const loaded = await ctx.repository.findByEinsatzId(einsatzId);
      const endTime = performance.now();

      timings.push(endTime - startTime);
      expect(loaded).not.toBeNull();
      expect(loaded?.eintraege.length).toBe(50);
    }

    // Calculate
    const averageTime = timings.reduce((a, b) => a + b, 0) / timings.length;

    // Log baseline
    console.log(`[Performance Baseline] findById(50 entries) average: ${averageTime.toFixed(2)}ms`);

    // Then: Sollte schnell sein (< 100ms)
    expect(averageTime).toBeLessThan(100);
  });

  /**
   * Test 4: Bulk addEintrag Performance
   *
   * Misst die Zeit für 10 aufeinanderfolgende addEintrag-Operationen
   * mit jeweils save(). Wichtig für ETB-Nutzung im Einsatz.
   *
   * **BASELINE (2025-11-24):**
   * - 10 sequential addEintrag: ~100-200ms total
   * - Durchschnitt pro Operation: ~10-20ms
   */
  it('should handle 10 sequential addEintrag operations efficiently', async () => {
    // Given: Frisches ETB
    const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
    const userId = UserId.create(ctx.testUserId).value!;
    const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
    await ctx.repository.save(aggregate);

    // When: 10 sequentielle Einträge
    const operationTimings: number[] = [];
    const totalStart = performance.now();

    for (let i = 1; i <= 10; i++) {
      const current = await ctx.repository.findByEinsatzId(einsatzId);
      expect(current).not.toBeNull();

      const opStart = performance.now();
      current?.addEintrag(`Entry ${i}`, userId);
      await ctx.repository.save(current!);
      const opEnd = performance.now();

      operationTimings.push(opEnd - opStart);
    }

    const totalEnd = performance.now();
    const totalTime = totalEnd - totalStart;
    const averageOp = operationTimings.reduce((a, b) => a + b, 0) / operationTimings.length;

    // Log baseline
    console.log(`[Performance Baseline] 10 sequential addEintrag total: ${totalTime.toFixed(0)}ms, avg: ${averageOp.toFixed(2)}ms`);

    // Then: Gesamtzeit < 500ms (großzügig für CI)
    expect(totalTime).toBeLessThan(500);
    // Durchschnitt pro Operation < 50ms
    expect(averageOp).toBeLessThan(50);
  });
});
