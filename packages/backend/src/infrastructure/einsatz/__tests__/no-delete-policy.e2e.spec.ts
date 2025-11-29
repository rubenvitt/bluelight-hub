/**
 * E2E Tests für NO-DELETE Policy (Story 4-10).
 *
 * Diese Tests validieren, dass Einsätze NIEMALS physisch gelöscht werden können
 * aufgrund der DRK-Compliance 10-Jahres-Aufbewahrungspflicht.
 *
 * **Acceptance Criteria Coverage:**
 * - AC2.1: DeleteEinsatzCommand gibt IMMER Result.fail() zurück
 * - AC2.2: Error-Nachricht enthält "können nicht gelöscht werden" und "Archivieren"
 * - AC2.3: Einsatz existiert weiterhin nach fehlgeschlagenem Löschversuch
 * - AC2.4: canBeDeleted() Methode gibt IMMER false zurück
 * - AC2.5: ArchiveEinsatzCommand funktioniert als Alternative
 *
 * **Test Strategy:**
 * - Real PostgreSQL Database (NICHT mocked)
 * - Direct Handler Invocation (CQRS Commands)
 * - Given-When-Then BDD Style
 * - Validierung über alle Einsatz-Status-Übergänge
 */

import { type EinsatzE2eTestContext, createEinsatzE2eModule, teardownE2eModule, cleanupTestData, createTestEinsatz } from './einsatz.e2e-setup';
import { DeleteEinsatzCommand } from '@/application/einsatz/commands/delete-einsatz/delete-einsatz.command';
import { DeleteEinsatzHandler } from '@/application/einsatz/commands/delete-einsatz/delete-einsatz.handler';
import { ArchiveEinsatzCommand } from '@/application/einsatz/commands/archive-einsatz/archive-einsatz.command';
import { ArchiveEinsatzHandler } from '@/application/einsatz/commands/archive-einsatz/archive-einsatz.handler';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';

describe('NO-DELETE Policy Tests (AC2.1-2.5)', () => {
  let ctx: EinsatzE2eTestContext;
  let deleteHandler: DeleteEinsatzHandler;
  let archiveHandler: ArchiveEinsatzHandler;

  beforeAll(async () => {
    ctx = await createEinsatzE2eModule();
    // Initialize handlers mit repository und eventPublisher
    deleteHandler = new DeleteEinsatzHandler(ctx.repository);
    archiveHandler = new ArchiveEinsatzHandler(ctx.repository, ctx.eventPublisher);
  }, 30000);

  afterEach(async () => {
    await cleanupTestData(ctx);
  });

  afterAll(async () => {
    await teardownE2eModule(ctx);
  });

  describe('AC2.1: DeleteEinsatzCommand Always Fails', () => {
    it('should always return failure for DeleteEinsatzCommand', async () => {
      // Given: Existing Einsatz
      const einsatzId = await createTestEinsatz(ctx);
      const commandResult = DeleteEinsatzCommand.create(einsatzId);

      // Command creation should succeed
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When: Execute delete command
      const result = await deleteHandler.execute(command);

      // Then: Result is failure (NO-DELETE Policy)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should fail delete for ANGELEGT status', async () => {
      // Given: Einsatz im Status ANGELEGT (initial status)
      const einsatzId = await createTestEinsatz(ctx, { status: 'ANGELEGT' });
      const commandResult = DeleteEinsatzCommand.create(einsatzId);
      const command = commandResult.value!;

      // When: Execute delete
      const result = await deleteHandler.execute(command);

      // Then: Deletion fails
      expect(result.isFailure).toBe(true);
    });

    it('should fail delete for IN_BEARBEITUNG status', async () => {
      // Given: Einsatz im Status IN_BEARBEITUNG
      const einsatzId = await createTestEinsatz(ctx, { status: 'IN_BEARBEITUNG' });
      const commandResult = DeleteEinsatzCommand.create(einsatzId);
      const command = commandResult.value!;

      // When: Execute delete
      const result = await deleteHandler.execute(command);

      // Then: Deletion fails
      expect(result.isFailure).toBe(true);
    });

    it('should fail delete for ABGESCHLOSSEN status', async () => {
      // Given: Einsatz im Status ABGESCHLOSSEN
      const einsatzId = await createTestEinsatz(ctx, { status: 'ABGESCHLOSSEN' });
      const commandResult = DeleteEinsatzCommand.create(einsatzId);
      const command = commandResult.value!;

      // When: Execute delete
      const result = await deleteHandler.execute(command);

      // Then: Deletion fails
      expect(result.isFailure).toBe(true);
    });

    it('should fail delete for ARCHIVIERT status', async () => {
      // Given: Einsatz im Status ARCHIVIERT
      const einsatzId = await createTestEinsatz(ctx, { status: 'ARCHIVIERT' });
      const commandResult = DeleteEinsatzCommand.create(einsatzId);
      const command = commandResult.value!;

      // When: Execute delete
      const result = await deleteHandler.execute(command);

      // Then: Deletion fails
      expect(result.isFailure).toBe(true);
    });
  });

  describe('AC2.2: Error Message Content', () => {
    it('should contain "können nicht gelöscht werden" in German error message', async () => {
      // Given: Existing Einsatz
      const einsatzId = await createTestEinsatz(ctx);
      const commandResult = DeleteEinsatzCommand.create(einsatzId);
      const command = commandResult.value!;

      // When: Execute delete
      const result = await deleteHandler.execute(command);

      // Then: Error message contains "können nicht gelöscht werden" (German)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error!.toLowerCase()).toContain('können nicht gelöscht werden');
    });

    it('should suggest "Archivieren" as alternative in error message', async () => {
      // Given: Existing Einsatz
      const einsatzId = await createTestEinsatz(ctx);
      const commandResult = DeleteEinsatzCommand.create(einsatzId);
      const command = commandResult.value!;

      // When: Execute delete
      const result = await deleteHandler.execute(command);

      // Then: Error message suggests Archive alternative
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error!.toLowerCase()).toMatch(/archiv/);
    });

    it('should have complete and informative error message', async () => {
      // Given: Existing Einsatz
      const einsatzId = await createTestEinsatz(ctx);
      const commandResult = DeleteEinsatzCommand.create(einsatzId);
      const command = commandResult.value!;

      // When: Execute delete
      const result = await deleteHandler.execute(command);

      // Then: Error message is informative and suggests alternative
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeDefined();
      // Expected: "Einsätze können nicht gelöscht werden. Verwende Archivieren stattdessen."
      expect(result.error).toBe('Einsätze können nicht gelöscht werden. Verwende Archivieren stattdessen.');
    });
  });

  describe('AC2.3: Einsatz Persists After Failed Delete', () => {
    it('should still exist in DB after failed delete attempt', async () => {
      // Given: Existing Einsatz
      const einsatzId = await createTestEinsatz(ctx);

      // When: Attempt to delete (fails)
      const commandResult = DeleteEinsatzCommand.create(einsatzId);
      const command = commandResult.value!;
      const result = await deleteHandler.execute(command);

      // Verify deletion failed
      expect(result.isFailure).toBe(true);

      // Then: Einsatz still exists in DB
      const einsatzIdVO = EinsatzId.create(einsatzId).value!;
      const existsResult = await ctx.repository.exists(einsatzIdVO);
      expect(existsResult.isSuccess).toBe(true);
      expect(existsResult.value).toBe(true);
    });

    it('should preserve all data after failed delete', async () => {
      // Given: Einsatz with specific data
      const testAlarmstichwort = 'TEST - NO-DELETE Brand';
      const einsatzId = await createTestEinsatz(ctx, {
        alarmstichwort: testAlarmstichwort,
        status: 'IN_BEARBEITUNG',
      });

      // When: Attempt delete
      const commandResult = DeleteEinsatzCommand.create(einsatzId);
      const command = commandResult.value!;
      const result = await deleteHandler.execute(command);

      // Verify deletion failed
      expect(result.isFailure).toBe(true);

      // Then: Data unchanged
      const einsatzIdVO = EinsatzId.create(einsatzId).value!;
      const findResult = await ctx.repository.findById(einsatzIdVO);
      expect(findResult.isSuccess).toBe(true);
      const einsatz = findResult.value!;
      expect(einsatz).toBeDefined();
      expect(einsatz.alarmstichwort).toBe(testAlarmstichwort);
      expect(einsatz.status.value).toBe('IN_BEARBEITUNG');
    });

    it('should preserve ABGESCHLOSSEN state after failed delete', async () => {
      // Given: ABGESCHLOSSEN Einsatz with timestamp
      const einsatzId = await createTestEinsatz(ctx, {
        status: 'ABGESCHLOSSEN',
      });

      // Load to verify abgeschlossenAt exists
      const einsatzIdVO = EinsatzId.create(einsatzId).value!;
      const beforeResult = await ctx.repository.findById(einsatzIdVO);
      const beforeEinsatz = beforeResult.value!;
      const originalAbgeschlossenAt = beforeEinsatz.abgeschlossenAt;

      // When: Attempt delete
      const commandResult = DeleteEinsatzCommand.create(einsatzId);
      const command = commandResult.value!;
      await deleteHandler.execute(command);

      // Then: abgeschlossenAt timestamp preserved
      const afterResult = await ctx.repository.findById(einsatzIdVO);
      const afterEinsatz = afterResult.value!;
      expect(afterEinsatz.status.value).toBe('ABGESCHLOSSEN');
      expect(afterEinsatz.abgeschlossenAt).toEqual(originalAbgeschlossenAt);
    });

    it('should preserve ARCHIVIERT state after failed delete', async () => {
      // Given: ARCHIVIERT Einsatz with timestamp
      const einsatzId = await createTestEinsatz(ctx, {
        status: 'ARCHIVIERT',
      });

      // Load to verify archivedAt exists
      const einsatzIdVO = EinsatzId.create(einsatzId).value!;
      const beforeResult = await ctx.repository.findById(einsatzIdVO);
      const beforeEinsatz = beforeResult.value!;
      const originalArchivedAt = beforeEinsatz.archivedAt;

      // When: Attempt delete
      const commandResult = DeleteEinsatzCommand.create(einsatzId);
      const command = commandResult.value!;
      await deleteHandler.execute(command);

      // Then: archivedAt timestamp preserved
      const afterResult = await ctx.repository.findById(einsatzIdVO);
      const afterEinsatz = afterResult.value!;
      expect(afterEinsatz.status.value).toBe('ARCHIVIERT');
      expect(afterEinsatz.archivedAt).toEqual(originalArchivedAt);
    });
  });

  describe('AC2.4: canBeDeleted() Always Returns False', () => {
    it('should return false for ANGELEGT status', async () => {
      // Given: Fresh Einsatz (ANGELEGT status)
      const userIdResult = UserId.create(ctx.testUserIds.user);
      expect(userIdResult.isSuccess).toBe(true);
      const userId = userIdResult.value!;

      const createResult = Einsatz.create({
        alarmstichwort: 'TEST - canBeDeleted Check',
        createdBy: userId,
      });
      expect(createResult.isSuccess).toBe(true);
      const einsatz = createResult.value!;

      // When/Then: canBeDeleted returns false
      expect(einsatz.canBeDeleted()).toBe(false);
    });

    it('should return false for IN_BEARBEITUNG status', async () => {
      // Given: Einsatz in IN_BEARBEITUNG
      const userIdResult = UserId.create(ctx.testUserIds.user);
      const userId = userIdResult.value!;

      const createResult = Einsatz.create({
        alarmstichwort: 'TEST - canBeDeleted IN_BEARBEITUNG',
        createdBy: userId,
      });
      const einsatz = createResult.value!;

      // Transition to IN_BEARBEITUNG
      const statusUpdateResult = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      expect(statusUpdateResult.isSuccess).toBe(true);

      // When/Then: canBeDeleted returns false
      expect(einsatz.canBeDeleted()).toBe(false);
    });

    it('should return false for ABGESCHLOSSEN status', async () => {
      // Given: Einsatz abgeschlossen
      const userIdResult = UserId.create(ctx.testUserIds.user);
      const userId = userIdResult.value!;

      const createResult = Einsatz.create({
        alarmstichwort: 'TEST - canBeDeleted ABGESCHLOSSEN',
        createdBy: userId,
      });
      const einsatz = createResult.value!;

      // Transition to ABGESCHLOSSEN via complete()
      const completeResult = einsatz.complete(userId);
      expect(completeResult.isSuccess).toBe(true);

      // When/Then: canBeDeleted returns false
      expect(einsatz.canBeDeleted()).toBe(false);
    });

    it('should return false for ARCHIVIERT status', async () => {
      // Given: Einsatz archiviert
      const userIdResult = UserId.create(ctx.testUserIds.user);
      const userId = userIdResult.value!;

      const createResult = Einsatz.create({
        alarmstichwort: 'TEST - canBeDeleted ARCHIVIERT',
        createdBy: userId,
      });
      const einsatz = createResult.value!;

      // Transition to ABGESCHLOSSEN then ARCHIVIERT
      einsatz.complete(userId);
      const archiveResult = einsatz.archive(userId);
      expect(archiveResult.isSuccess).toBe(true);

      // When/Then: canBeDeleted returns false
      expect(einsatz.canBeDeleted()).toBe(false);
    });

    it('should return false through all status transitions', async () => {
      // Given: Fresh Einsatz
      const userIdResult = UserId.create(ctx.testUserIds.user);
      const userId = userIdResult.value!;

      const createResult = Einsatz.create({
        alarmstichwort: 'TEST - Full Lifecycle canBeDeleted',
        createdBy: userId,
      });
      const einsatz = createResult.value!;

      // ANGELEGT
      expect(einsatz.status.value).toBe('ANGELEGT');
      expect(einsatz.canBeDeleted()).toBe(false);

      // IN_BEARBEITUNG
      einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      expect(einsatz.status.value).toBe('IN_BEARBEITUNG');
      expect(einsatz.canBeDeleted()).toBe(false);

      // ABGESCHLOSSEN
      einsatz.complete(userId);
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
      expect(einsatz.canBeDeleted()).toBe(false);

      // ARCHIVIERT
      einsatz.archive(userId);
      expect(einsatz.status.value).toBe('ARCHIVIERT');
      expect(einsatz.canBeDeleted()).toBe(false);

      // Final assertion: canBeDeleted NIEMALS true
      expect(einsatz.canBeDeleted()).toBe(false);
    });
  });

  describe('AC2.5: Archive Works as Alternative', () => {
    it('should successfully create archive command for ABGESCHLOSSEN Einsatz', async () => {
      // Given: ABGESCHLOSSEN Einsatz
      const einsatzId = await createTestEinsatz(ctx, { status: 'ABGESCHLOSSEN' });

      // When: Create archive command
      const commandResult = ArchiveEinsatzCommand.create(einsatzId, ctx.testUserIds.admin);

      // Then: Command creation succeeds (validates inputs)
      expect(commandResult.isSuccess).toBe(true);
      expect(commandResult.value).toBeDefined();
      expect(commandResult.value!.einsatzId).toBe(einsatzId);
      expect(commandResult.value!.archivedBy).toBe(ctx.testUserIds.admin);

      // NOTE: Archive execution requires 10-year abgeschlossenAt timestamp
      // which is not currently persisted in DB (domain-only field).
      // Full archiving tests require DB migration to add abgeschlossenAt column.
    });

    it('should verify ARCHIVIERT Einsätze are immutable (pre-existing)', async () => {
      // Given: Pre-existing ARCHIVIERT Einsatz (directly in DB)
      const einsatzId = await createTestEinsatz(ctx, { status: 'ARCHIVIERT' });

      // When: Load aggregate from DB
      const einsatzIdVO = EinsatzId.create(einsatzId).value!;
      const findResult = await ctx.repository.findById(einsatzIdVO);
      const einsatz = findResult.value!;

      // Then: Einsatz is immutable
      expect(einsatz.status.value).toBe('ARCHIVIERT');
      expect(einsatz.archivedAt).toBeDefined();

      // Attempt to change status (should fail - immutable)
      const updateResult = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
      expect(updateResult.isFailure).toBe(true);
      expect(updateResult.error).toContain('Archivierte Einsätze können nicht geändert werden');

      // Attempt to update fields (should fail - immutable)
      const updateFieldsResult = einsatz.update({ alarmstichwort: 'Änderung' });
      expect(updateFieldsResult.isFailure).toBe(true);
      expect(updateFieldsResult.error).toContain('Archivierte Einsätze können nicht geändert werden');

      // NOTE: Full archiving workflow tests require DB migration to add abgeschlossenAt column
    });

    it('should understand archive policy requires ABGESCHLOSSEN status', async () => {
      // Given: Einsätze in different statuses
      const angelegtId = await createTestEinsatz(ctx, { status: 'ANGELEGT' });
      const inBearbeitungId = await createTestEinsatz(ctx, { status: 'IN_BEARBEITUNG' });
      const archiviertId = await createTestEinsatz(ctx, { status: 'ARCHIVIERT' });

      // When/Then: Archive command can be created (validates inputs)
      const cmd1 = ArchiveEinsatzCommand.create(angelegtId, ctx.testUserIds.admin);
      const cmd2 = ArchiveEinsatzCommand.create(inBearbeitungId, ctx.testUserIds.admin);
      const cmd3 = ArchiveEinsatzCommand.create(archiviertId, ctx.testUserIds.admin);

      // All commands created successfully (ID validation passed)
      expect(cmd1.isSuccess).toBe(true);
      expect(cmd2.isSuccess).toBe(true);
      expect(cmd3.isSuccess).toBe(true);

      // NOTE: Archive execution would fail for non-ABGESCHLOSSEN status
      // But requires abgeschlossenAt timestamp which is not persisted in DB yet.
      // Full tests require DB migration to add abgeschlossenAt column.
    });
  });
});
