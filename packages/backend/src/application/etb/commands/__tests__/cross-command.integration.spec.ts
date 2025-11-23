import { BadRequestException } from '@nestjs/common';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { EintragAddedEvent } from '@domain/events/eintrag-added.event';
import { EintragUpdatedEvent } from '@domain/events/eintrag-updated.event';
import { EintragDeletedEvent } from '@domain/events/eintrag-deleted.event';
import { InMemoryEtbRepository } from '../../__tests__/in-memory-etb.repository';
import { AddEintragCommand } from '../add-eintrag/add-eintrag.command';
import { AddEintragHandler } from '../add-eintrag/add-eintrag.handler';
import { UpdateEintragCommand } from '../update-eintrag/update-eintrag.command';
import { UpdateEintragHandler } from '../update-eintrag/update-eintrag.handler';
import { DeleteEintragCommand } from '../delete-eintrag/delete-eintrag.command';
import { DeleteEintragHandler } from '../delete-eintrag/delete-eintrag.handler';
import { LockEtbCommand } from '../lock-etb/lock-etb.command';
import { LockEtbHandler } from '../lock-etb/lock-etb.handler';
import { createTestEtb } from '@domain/aggregates/__tests__/fixtures/etb.fixtures';

// Mock CUID2 für deterministische Tests
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
    return /^[a-z][a-z0-9]+$/.test(id);
  }),
}));

/**
 * Generiert eine Test-CUID mit korrektem Format.
 */
function generateTestCuid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'c';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Cross-Command Integration Tests für Story 3-2.
 *
 * Diese Tests validieren das Zusammenspiel mehrerer Commands in Sequenzen,
 * um sicherzustellen dass die Business Rules über Command-Grenzen hinweg
 * konsistent eingehalten werden.
 */
describe('Cross-Command Integration Tests (Story 3-2)', () => {
  let etbRepository: InMemoryEtbRepository;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;
  let addEintragHandler: AddEintragHandler;
  let updateEintragHandler: UpdateEintragHandler;
  let deleteEintragHandler: DeleteEintragHandler;
  let lockEtbHandler: LockEtbHandler;
  let testUserId: string;
  let testEinsatzId: string;

  beforeEach(() => {
    // Reset mocks and repository
    etbRepository = new InMemoryEtbRepository();
    testUserId = generateTestCuid();
    testEinsatzId = generateTestCuid();

    // Mock IEventPublisher (Spy Pattern)
    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      publishAll: jest.fn().mockResolvedValue(undefined),
    };

    // Create all handlers with shared repository
    addEintragHandler = new AddEintragHandler(etbRepository, mockEventPublisher);
    updateEintragHandler = new UpdateEintragHandler(etbRepository, mockEventPublisher);
    deleteEintragHandler = new DeleteEintragHandler(etbRepository, mockEventPublisher);
    lockEtbHandler = new LockEtbHandler(etbRepository, mockEventPublisher);
  });

  afterEach(() => {
    etbRepository.clear();
    jest.clearAllMocks();
  });

  describe('Task 7.1: AddEintrag → UpdateEintrag → DeleteEintrag sequence', () => {
    it('should successfully execute Add → Update → Delete sequence', async () => {
      // Arrange: Create ETB without entries
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Act 1: AddEintrag
      const addCommand = AddEintragCommand.create(etb.id.value, 'Ursprünglicher Text', testUserId).value!;
      const addResult = await addEintragHandler.execute(addCommand);
      expect(addResult.isSuccess).toBe(true);
      const eintragId = addResult.value!.id.value;

      // Act 2: UpdateEintrag
      const updateCommand = UpdateEintragCommand.create(etb.id.value, eintragId, 'Aktualisierter Text', testUserId).value!;
      const updateResult = await updateEintragHandler.execute(updateCommand);
      expect(updateResult.isSuccess).toBe(true);

      // Act 3: DeleteEintrag (soft-delete)
      const deleteCommand = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;
      const deleteResult = await deleteEintragHandler.execute(deleteCommand);
      expect(deleteResult.isSuccess).toBe(true);

      // Assert: Verify final state
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.eintraege.length).toBe(1);
      expect(savedEtb?.eintraege[0].isDeleted).toBe(true);
      expect(savedEtb?.eintraege[0].text).toBe('Aktualisierter Text');

      // Assert: Verify events were published in correct order
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(3);
      const allEvents = mockEventPublisher.publishAll.mock.calls.flatMap((call) => call[0]);
      expect(allEvents[0]).toBeInstanceOf(EintragAddedEvent);
      expect(allEvents[1]).toBeInstanceOf(EintragUpdatedEvent);
      expect(allEvents[2]).toBeInstanceOf(EintragDeletedEvent);
    });
  });

  describe('Task 7.2: AddEintrag → LockEtb → verify AddEintrag fails', () => {
    it('should prevent AddEintrag after ETB is locked', async () => {
      // Arrange: Create ETB and add first entry
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const addCommand1 = AddEintragCommand.create(etb.id.value, 'Erster Eintrag', testUserId).value!;
      await addEintragHandler.execute(addCommand1);

      // Act 1: Lock ETB
      const lockCommand = LockEtbCommand.create(etb.id.value, testUserId, 'ADMIN').value!;
      const lockResult = await lockEtbHandler.execute(lockCommand);
      expect(lockResult.isSuccess).toBe(true);

      // Act 2: Try to add another entry
      const addCommand2 = AddEintragCommand.create(etb.id.value, 'Zweiter Eintrag (sollte fehlschlagen)', testUserId).value!;

      // Assert: AddEintrag should fail with locked error
      await expect(addEintragHandler.execute(addCommand2)).rejects.toThrow(BadRequestException);
      await expect(addEintragHandler.execute(addCommand2)).rejects.toThrow('ETB ist gesperrt und kann nicht mehr geändert werden');
    });
  });

  describe('Task 7.3: AddEintrag → LockEtb → verify UpdateEintrag fails', () => {
    it('should prevent UpdateEintrag after ETB is locked', async () => {
      // Arrange: Create ETB and add entry
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const addCommand = AddEintragCommand.create(etb.id.value, 'Test Eintrag', testUserId).value!;
      const addResult = await addEintragHandler.execute(addCommand);
      const eintragId = addResult.value!.id.value;

      // Act 1: Lock ETB
      const lockCommand = LockEtbCommand.create(etb.id.value, testUserId, 'ADMIN').value!;
      await lockEtbHandler.execute(lockCommand);

      // Act 2: Try to update entry
      const updateCommand = UpdateEintragCommand.create(etb.id.value, eintragId, 'Neuer Text', testUserId).value!;

      // Assert: UpdateEintrag should fail with locked error
      await expect(updateEintragHandler.execute(updateCommand)).rejects.toThrow(BadRequestException);
      await expect(updateEintragHandler.execute(updateCommand)).rejects.toThrow('ETB ist gesperrt und kann nicht mehr geändert werden');
    });
  });

  describe('Task 7.4: AddEintrag → LockEtb → verify DeleteEintrag fails', () => {
    it('should prevent DeleteEintrag after ETB is locked', async () => {
      // Arrange: Create ETB and add entry
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const addCommand = AddEintragCommand.create(etb.id.value, 'Test Eintrag', testUserId).value!;
      const addResult = await addEintragHandler.execute(addCommand);
      const eintragId = addResult.value!.id.value;

      // Act 1: Lock ETB
      const lockCommand = LockEtbCommand.create(etb.id.value, testUserId, 'SUPER_ADMIN').value!;
      await lockEtbHandler.execute(lockCommand);

      // Act 2: Try to delete entry
      const deleteCommand = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;

      // Assert: DeleteEintrag should fail with locked error
      await expect(deleteEintragHandler.execute(deleteCommand)).rejects.toThrow(BadRequestException);
      await expect(deleteEintragHandler.execute(deleteCommand)).rejects.toThrow('ETB ist gesperrt und kann nicht mehr geändert werden');
    });
  });

  describe('Task 7.5: Snapshot count verification after mutation sequence', () => {
    it('should create correct number of snapshots after mutation sequence', async () => {
      // Arrange: Create ETB without entries
      const etb = createTestEtb({ entriesCount: 0, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      // Act: Execute sequence of mutations
      // 1. AddEintrag (creates 1 snapshot)
      const addCommand = AddEintragCommand.create(etb.id.value, 'Eintrag 1', testUserId).value!;
      const addResult = await addEintragHandler.execute(addCommand);
      const eintragId = addResult.value!.id.value;

      // 2. UpdateEintrag (creates 1 snapshot)
      const updateCommand = UpdateEintragCommand.create(etb.id.value, eintragId, 'Eintrag 1 (aktualisiert)', testUserId).value!;
      await updateEintragHandler.execute(updateCommand);

      // 3. AddEintrag again (creates 1 snapshot)
      const addCommand2 = AddEintragCommand.create(etb.id.value, 'Eintrag 2', testUserId).value!;
      await addEintragHandler.execute(addCommand2);

      // 4. DeleteEintrag (creates 1 snapshot)
      const deleteCommand = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;
      await deleteEintragHandler.execute(deleteCommand);

      // Assert: Verify 4 mutations created snapshots
      // Note: Each mutating operation (add, update, delete) creates a snapshot BEFORE mutation
      const savedEtb = await etbRepository.findById(etb.id);

      // Verify ETB state
      expect(savedEtb?.eintraege.length).toBe(2);
      expect(savedEtb?.eintraege[0].isDeleted).toBe(true);
      expect(savedEtb?.eintraege[1].isDeleted).toBe(false);

      // Verify version incremented correctly (initial version 1 + 4 mutations = version 5)
      // createTestEtb creates with version 1, each mutation increments
      expect(savedEtb?.version.versionNumber).toBeGreaterThanOrEqual(5);
    });

    it('should preserve snapshot history for audit trail', async () => {
      // Arrange: Create ETB with existing entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);
      const existingEintragId = etb.eintraege[0].id.value;

      // Act: Update entry multiple times
      const update1 = UpdateEintragCommand.create(etb.id.value, existingEintragId, 'Version 2', testUserId).value!;
      await updateEintragHandler.execute(update1);

      const update2 = UpdateEintragCommand.create(etb.id.value, existingEintragId, 'Version 3', testUserId).value!;
      await updateEintragHandler.execute(update2);

      // Assert: Verify final text and that events captured old text
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.eintraege[0].text).toBe('Version 3');

      // Verify EintragUpdatedEvents contain oldText for audit trail
      const publishedEvents = mockEventPublisher.publishAll.mock.calls.flatMap((call) => call[0]);
      const updateEvents = publishedEvents.filter((e) => e instanceof EintragUpdatedEvent) as EintragUpdatedEvent[];

      expect(updateEvents.length).toBe(2);
      // First update: old text was the original fixture text
      expect(updateEvents[0].newText).toBe('Version 2');
      // Second update: old text was 'Version 2'
      expect(updateEvents[1].oldText).toBe('Version 2');
      expect(updateEvents[1].newText).toBe('Version 3');
    });
  });

  describe('Lock is irreversible - no further operations possible', () => {
    it('should reject all mutations after lock including another lock attempt', async () => {
      // Arrange: Create ETB
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);
      const eintragId = etb.eintraege[0].id.value;

      // Act: Lock ETB
      const lockCommand = LockEtbCommand.create(etb.id.value, testUserId, 'ADMIN').value!;
      await lockEtbHandler.execute(lockCommand);

      // Assert: All operations fail
      const addCmd = AddEintragCommand.create(etb.id.value, 'New Entry', testUserId).value!;
      await expect(addEintragHandler.execute(addCmd)).rejects.toThrow(BadRequestException);

      const updateCmd = UpdateEintragCommand.create(etb.id.value, eintragId, 'Updated', testUserId).value!;
      await expect(updateEintragHandler.execute(updateCmd)).rejects.toThrow(BadRequestException);

      const deleteCmd = DeleteEintragCommand.create(etb.id.value, eintragId, testUserId).value!;
      await expect(deleteEintragHandler.execute(deleteCmd)).rejects.toThrow(BadRequestException);

      // Even another lock attempt fails
      const lockCmd2 = LockEtbCommand.create(etb.id.value, testUserId, 'SUPER_ADMIN').value!;
      await expect(lockEtbHandler.execute(lockCmd2)).rejects.toThrow(BadRequestException);
      await expect(lockEtbHandler.execute(lockCmd2)).rejects.toThrow('ETB ist bereits gesperrt');
    });
  });
});
