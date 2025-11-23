import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { EintragUpdatedEvent } from '@domain/events/eintrag-updated.event';
import { InMemoryEtbRepository } from '../../__tests__/in-memory-etb.repository';
import { UpdateEintragCommand } from '../update-eintrag/update-eintrag.command';
import { UpdateEintragHandler } from '../update-eintrag/update-eintrag.handler';
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
 * Format: 25 Zeichen, beginnt mit 'c', nur lowercase a-z und 0-9.
 */
function generateTestCuid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'c';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

describe('UpdateEintragHandler', () => {
  let handler: UpdateEintragHandler;
  let etbRepository: InMemoryEtbRepository;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;
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

    // Create handler with dependencies
    handler = new UpdateEintragHandler(etbRepository, mockEventPublisher);
  });

  afterEach(() => {
    etbRepository.clear();
    jest.clearAllMocks();
  });

  describe('AC3: UpdateEintrag successfully updates entry text', () => {
    it('should update entry text successfully', async () => {
      // Arrange: Create ETB with 1 entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const eintragId = etb.eintraege[0].id.value;
      const newText = 'Aktualisierter Eintrag Text';

      const command = UpdateEintragCommand.create(etb.id.value, eintragId, newText, testUserId).value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);

      // Verify entry was updated
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.eintraege[0].text).toBe(newText);
    });

    it('should set updatedAt timestamp on entry after update', async () => {
      // Arrange: Create ETB with 1 entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      const originalUpdatedAt = etb.eintraege[0].updatedAt;
      await etbRepository.save(etb);

      const eintragId = etb.eintraege[0].id.value;
      const newText = 'Text mit neuem Timestamp';

      // Wait a small amount to ensure timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 10));

      const command = UpdateEintragCommand.create(etb.id.value, eintragId, newText, testUserId).value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);

      const savedEtb = await etbRepository.findById(etb.id);
      const updatedEntry = savedEtb?.eintraege[0];

      // Verify updatedAt is set (was undefined before first update)
      expect(updatedEntry?.updatedAt).toBeDefined();
      expect(updatedEntry?.updatedAt).toBeInstanceOf(Date);

      // Verify updatedAt is different from original (if original was set)
      if (originalUpdatedAt) {
        expect(updatedEntry?.updatedAt?.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      }
    });

    it('should update only the target entry when multiple entries exist', async () => {
      // Arrange: Create ETB with 3 entries
      const etb = createTestEtb({ entriesCount: 3, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const eintragId = etb.eintraege[1].id.value; // Update middle entry
      const originalTexts = etb.eintraege.map((e) => e.text);
      const newText = 'Updated Middle Entry';

      const command = UpdateEintragCommand.create(etb.id.value, eintragId, newText, testUserId).value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);

      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.eintraege[0].text).toBe(originalTexts[0]); // Unchanged
      expect(savedEtb?.eintraege[1].text).toBe(newText); // Updated
      expect(savedEtb?.eintraege[2].text).toBe(originalTexts[2]); // Unchanged
    });
  });

  describe('AC3: UpdateEintrag creates snapshot before mutation', () => {
    it('should create snapshot before updating entry', async () => {
      // Arrange: Create ETB with 1 entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      const originalText = etb.eintraege[0].text;
      await etbRepository.save(etb);

      const eintragId = etb.eintraege[0].id.value;
      const newText = 'Neuer Text nach Update';

      const command = UpdateEintragCommand.create(etb.id.value, eintragId, newText, testUserId).value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);

      // Verify snapshot was created
      const savedEtb = await etbRepository.findById(etb.id);
      expect(savedEtb?.hasUncommittedSnapshots()).toBe(true);

      // Verify snapshot contains pre-mutation state (old text)
      const snapshots = savedEtb?.getUncommittedSnapshots();
      expect(snapshots?.length).toBeGreaterThanOrEqual(1);
      const latestSnapshot = snapshots?.[snapshots.length - 1];
      expect(latestSnapshot?.eintraege[0].text).toBe(originalText);
    });
  });

  describe('AC3: UpdateEintrag preserves oldText in EintragUpdatedEvent', () => {
    it('should capture oldText before mutation', async () => {
      // Arrange: Create ETB with 1 entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      const originalText = etb.eintraege[0].text;
      await etbRepository.save(etb);

      const eintragId = etb.eintraege[0].id.value;
      const newText = 'Komplett neuer Inhalt';

      const command = UpdateEintragCommand.create(etb.id.value, eintragId, newText, testUserId).value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(1);

      const publishedEvents = mockEventPublisher.publishAll.mock.calls[0][0];
      expect(publishedEvents.length).toBe(1);
      expect(publishedEvents[0]).toBeInstanceOf(EintragUpdatedEvent);

      const event = publishedEvents[0] as EintragUpdatedEvent;
      expect(event.oldText).toBe(originalText);
      expect(event.newText).toBe(newText);
    });
  });

  describe('AC3: EintragUpdatedEvent contains etbId, eintragId, oldText, newText, userId', () => {
    it('should publish event with all required fields', async () => {
      // Arrange: Create ETB with 1 entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      const originalText = etb.eintraege[0].text;
      await etbRepository.save(etb);

      const eintragId = etb.eintraege[0].id.value;
      const newText = 'Updated entry text';

      const command = UpdateEintragCommand.create(etb.id.value, eintragId, newText, testUserId).value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);

      const publishedEvents = mockEventPublisher.publishAll.mock.calls[0][0];
      const event = publishedEvents[0] as EintragUpdatedEvent;

      expect(event.etbId.value).toBe(etb.id.value);
      expect(event.eintragId.value).toBe(eintragId);
      expect(event.oldText).toBe(originalText);
      expect(event.newText).toBe(newText);
      expect(event.updatedBy.value).toBe(testUserId);
    });
  });

  describe('AC3: UpdateEintrag fails if ETB is locked', () => {
    it('should throw BadRequestException when ETB is locked', async () => {
      // Arrange: Create locked ETB with 1 entry
      const etb = createTestEtb({ status: 'LOCKED', entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const eintragId = etb.eintraege[0].id.value;
      const command = UpdateEintragCommand.create(etb.id.value, eintragId, 'Neuer Text', testUserId).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      await expect(handler.execute(command)).rejects.toThrow('ETB ist gesperrt und kann nicht mehr geändert werden');
    });
  });

  describe('AC3: UpdateEintrag fails if Eintrag not found', () => {
    it('should throw BadRequestException when Eintrag does not exist', async () => {
      // Arrange: Create ETB with 1 entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const nonExistentEintragId = generateTestCuid();
      const command = UpdateEintragCommand.create(etb.id.value, nonExistentEintragId, 'Neuer Text', testUserId).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      await expect(handler.execute(command)).rejects.toThrow('Eintrag nicht gefunden');
    });
  });

  describe('AC3: UpdateEintrag fails if Eintrag is deleted (soft-deleted)', () => {
    it('should throw BadRequestException when Eintrag is soft-deleted', async () => {
      // Arrange: Create ETB with 1 entry
      const etb = createTestEtb({ entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      const eintragId = etb.eintraege[0].id;

      // Soft-delete the entry via aggregate
      const userIdResult = (await import('@domain/value-objects/user-id')).UserId.create(testUserId);
      etb.deleteEintrag(eintragId, userIdResult.value!);
      etb.clearDomainEvents(); // Clean up events from delete

      await etbRepository.save(etb);

      const command = UpdateEintragCommand.create(etb.id.value, eintragId.value, 'Neuer Text', testUserId).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      await expect(handler.execute(command)).rejects.toThrow('Gelöschte Einträge können nicht bearbeitet werden');
    });
  });

  describe('Error Handling', () => {
    it('should throw NotFoundException when ETB not found', async () => {
      // Arrange: Create command for non-existent ETB
      const fakeEtbId = generateTestCuid();
      const fakeEintragId = generateTestCuid();
      const command = UpdateEintragCommand.create(fakeEtbId, fakeEintragId, 'Test Text', testUserId).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
      await expect(handler.execute(command)).rejects.toThrow('ETB nicht gefunden');
    });

    it('should NOT publish events when operation fails', async () => {
      // Arrange: Non-existent ETB
      const fakeEtbId = generateTestCuid();
      const fakeEintragId = generateTestCuid();
      const command = UpdateEintragCommand.create(fakeEtbId, fakeEintragId, 'Test Text', testUserId).value!;

      // Act
      try {
        await handler.execute(command);
      } catch {
        // Expected
      }

      // Assert
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('should NOT publish events when domain validation fails (ETB locked)', async () => {
      // Arrange: Create locked ETB
      const etb = createTestEtb({ status: 'LOCKED', entriesCount: 1, userId: testUserId, einsatzId: testEinsatzId });
      await etbRepository.save(etb);

      const eintragId = etb.eintraege[0].id.value;
      const command = UpdateEintragCommand.create(etb.id.value, eintragId, 'Neuer Text', testUserId).value!;

      // Act
      try {
        await handler.execute(command);
      } catch {
        // Expected
      }

      // Assert
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });
  });

  describe('Command Validation', () => {
    it('should fail command creation with empty etbId', () => {
      const result = UpdateEintragCommand.create('', generateTestCuid(), 'Valid Text', testUserId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('etbId is required');
    });

    it('should fail command creation with whitespace-only etbId', () => {
      const result = UpdateEintragCommand.create('   ', generateTestCuid(), 'Valid Text', testUserId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('etbId is required');
    });

    it('should fail command creation with empty eintragId', () => {
      const result = UpdateEintragCommand.create(generateTestCuid(), '', 'Valid Text', testUserId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('eintragId is required');
    });

    it('should fail command creation with whitespace-only eintragId', () => {
      const result = UpdateEintragCommand.create(generateTestCuid(), '   ', 'Valid Text', testUserId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('eintragId is required');
    });

    it('should fail command creation with empty newText', () => {
      const result = UpdateEintragCommand.create(generateTestCuid(), generateTestCuid(), '', testUserId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('newText is required and cannot be empty');
    });

    it('should fail command creation with whitespace-only newText', () => {
      const result = UpdateEintragCommand.create(generateTestCuid(), generateTestCuid(), '   ', testUserId);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('newText is required and cannot be empty');
    });

    it('should fail command creation with empty userId', () => {
      const result = UpdateEintragCommand.create(generateTestCuid(), generateTestCuid(), 'Valid Text', '');
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('userId is required');
    });

    it('should fail command creation with whitespace-only userId', () => {
      const result = UpdateEintragCommand.create(generateTestCuid(), generateTestCuid(), 'Valid Text', '   ');
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('userId is required');
    });
  });
});
