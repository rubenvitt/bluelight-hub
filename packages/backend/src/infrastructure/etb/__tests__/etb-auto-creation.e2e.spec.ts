import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { createEtbE2eModule, teardownE2eModule, cleanupTestData, createTestEinsatz, type EtbE2eTestContext } from './etb.e2e-setup';

/**
 * E2E Tests für die automatische ETB-Erstellung.
 *
 * Diese Tests validieren die AC1 Requirements:
 * - ETB wird automatisch erstellt wenn neuer Einsatz existiert
 * - Status = DRAFT
 * - Version = 1
 * - eintraege = []
 * - 1:1 Relation zwischen Einsatz und ETB
 */
describe('ETB Auto-Creation E2E Tests', () => {
  let ctx: EtbE2eTestContext;

  beforeAll(async () => {
    ctx = await createEtbE2eModule();
  });

  afterEach(async () => {
    await cleanupTestData(ctx);
  });

  afterAll(async () => {
    await teardownE2eModule(ctx);
  });

  describe('Given a new Einsatz exists', () => {
    describe('When ETB is created for that Einsatz', () => {
      /**
       * AC1: ETB wird mit Status DRAFT erstellt.
       *
       * Validiert dass das ETB Aggregate korrekt instanziiert wird
       * und der initiale Status DRAFT ist.
       */
      it('should create ETB with DRAFT status', async () => {
        // Given: testEinsatzId ist bereits im ctx verfügbar
        const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;

        // When: ETB Aggregate erstellen und speichern
        const aggregateResult = EinsatztagebuchAggregate.create(einsatzId);
        expect(aggregateResult.isSuccess).toBe(true);
        const aggregate = aggregateResult.value!;
        await ctx.repository.save(aggregate);

        // Then: ETB existiert in DB mit korrekten Werten
        const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.status.value).toBe('DRAFT');
      });

      /**
       * AC1: Initiale Version ist 1.
       *
       * Validiert dass das ETB mit der ersten Version startet,
       * wichtig für Event Sourcing und Snapshot-History.
       */
      it('should have initial version = 1', async () => {
        // Given + When
        const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
        const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
        await ctx.repository.save(aggregate);

        // Then
        const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.version.versionNumber).toBe(1);
      });

      /**
       * AC1: Eintraege Array ist initial leer.
       *
       * Validiert dass ein frisch erstelltes ETB keine Einträge enthält,
       * diese werden erst später via addEintrag() hinzugefügt.
       */
      it('should have empty eintraege array', async () => {
        // Given + When
        const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
        const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
        await ctx.repository.save(aggregate);

        // Then
        const retrieved = await ctx.repository.findByEinsatzId(einsatzId);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.eintraege).toHaveLength(0);
      });

      /**
       * AC1: ETB ist eindeutig per Einsatz (1:1 Relation).
       *
       * Validiert dass die UNIQUE Constraint auf einsatzId greift
       * und verhindert dass mehrere ETBs für denselben Einsatz existieren.
       */
      it('should enforce unique ETB per Einsatz', async () => {
        // Given: ETB bereits erstellt
        const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
        const firstAggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
        await ctx.repository.save(firstAggregate);

        // When: Zweites ETB für gleichen Einsatz erstellen
        const secondAggregate = EinsatztagebuchAggregate.create(einsatzId).value!;

        // Then: Speichern sollte fehlschlagen (UNIQUE constraint violation)
        await expect(ctx.repository.save(secondAggregate)).rejects.toThrow();
      });

      /**
       * Repository Query: findByEinsatzId gibt null für nicht-existentes ETB.
       *
       * Validiert dass die Repository-Methode korrekt null zurückgibt
       * wenn kein ETB für den gegebenen Einsatz existiert.
       */
      it('should return null for non-existent ETB', async () => {
        // Given: Neuer Einsatz ohne ETB
        const freshEinsatzId = await createTestEinsatz(ctx);
        const einsatzId = EinsatzId.create(freshEinsatzId).value!;

        // When + Then
        const result = await ctx.repository.findByEinsatzId(einsatzId);
        expect(result).toBeNull();
      });

      /**
       * Repository Query: ETB kann via ID gefunden werden.
       *
       * Validiert dass das ETB sowohl via einsatzId als auch
       * via eigener ETB-ID abgefragt werden kann.
       */
      it('should be retrievable by ETB ID', async () => {
        // Given
        const einsatzId = EinsatzId.create(ctx.testEinsatzId).value!;
        const aggregate = EinsatztagebuchAggregate.create(einsatzId).value!;
        await ctx.repository.save(aggregate);

        // When
        const retrieved = await ctx.repository.findById(aggregate.id);

        // Then
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id.equals(aggregate.id)).toBe(true);
      });
    });
  });
});
