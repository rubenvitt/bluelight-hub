import { Result } from '@domain/common/result';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { EtbId } from '@domain/value-objects/etb-id';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { EtbCreatedEvent } from '@domain/events/etb-created.event';
import { InMemoryEtbRepository } from '../../__tests__/in-memory-etb.repository';
import { CreateEtbCommand } from '../create-etb/create-etb.command';
import { CreateEtbHandler } from '../create-etb/create-etb.handler';
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

describe('CreateEtbHandler', () => {
  let handler: CreateEtbHandler;
  let etbRepository: InMemoryEtbRepository;
  let mockEinsatzRepository: jest.Mocked<IEinsatzRepository>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;
  let testEinsatzId: EinsatzId;
  let testEinsatzIdString: string;

  beforeEach(() => {
    // Reset mocks and repository
    etbRepository = new InMemoryEtbRepository();
    testEinsatzIdString = generateTestCuid();
    const einsatzIdResult = EinsatzId.create(testEinsatzIdString);
    testEinsatzId = einsatzIdResult.value!;

    // Mock IEinsatzRepository
    mockEinsatzRepository = {
      exists: jest.fn(),
      findById: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
      save: jest.fn(),
    };

    // Mock IEventPublisher (Spy Pattern)
    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      publishAll: jest.fn().mockResolvedValue(undefined),
    };

    // Create handler with dependencies
    handler = new CreateEtbHandler(mockEinsatzRepository, etbRepository, mockEventPublisher);
  });

  afterEach(() => {
    etbRepository.clear();
    jest.clearAllMocks();
  });

  describe('AC1: CreateEtb for valid EinsatzId succeeds with Result.ok', () => {
    it('should create ETB successfully when Einsatz exists', async () => {
      // Arrange
      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      const commandResult = CreateEtbCommand.create(testEinsatzId.value);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();

      // Verify ETB was saved
      expect(etbRepository.count()).toBe(1);
      const savedEtb = etbRepository.getAll()[0];
      expect(savedEtb.einsatzId.equals(testEinsatzId)).toBe(true);
    });

    it('should return EtbId in Result.ok', async () => {
      // Arrange
      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      const commandResult = CreateEtbCommand.create(testEinsatzId.value);
      const command = commandResult.value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      const etbId = result.value as EtbId;
      expect(etbId).toBeDefined();
      expect(typeof etbId.value).toBe('string');

      // Verify returned ID matches saved ETB
      const savedEtb = await etbRepository.findById(etbId);
      expect(savedEtb).not.toBeNull();
    });
  });

  describe('AC1: CreateEtb for non-existent EinsatzId fails with Result.fail', () => {
    it('should fail when Einsatz does not exist', async () => {
      // Arrange
      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(false));

      const commandResult = CreateEtbCommand.create(testEinsatzId.value);
      const command = commandResult.value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Einsatz nicht gefunden');

      // Verify no ETB was created
      expect(etbRepository.count()).toBe(0);
    });

    it('should fail when EinsatzRepository.exists fails', async () => {
      // Arrange
      mockEinsatzRepository.exists.mockResolvedValue(Result.fail('Database connection error'));

      const commandResult = CreateEtbCommand.create(testEinsatzId.value);
      const command = commandResult.value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Database connection error');
    });
  });

  describe('AC1: CreateEtb for already-existing ETB fails (duplicate prevention)', () => {
    it('should fail when ETB for Einsatz already exists', async () => {
      // Arrange: Pre-create ETB for the Einsatz
      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));
      const testUserId = generateTestCuid();
      const existingEtb = createTestEtb({ einsatzId: testEinsatzIdString, userId: testUserId });
      await etbRepository.save(existingEtb);

      const commandResult = CreateEtbCommand.create(testEinsatzIdString);
      const command = commandResult.value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ETB für diesen Einsatz existiert bereits');

      // Verify only 1 ETB exists (the pre-created one)
      expect(etbRepository.count()).toBe(1);
    });
  });

  describe('AC1: EtbCreatedEvent emitted on success', () => {
    it('should publish EtbCreatedEvent after successful save', async () => {
      // Arrange
      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      const commandResult = CreateEtbCommand.create(testEinsatzId.value);
      const command = commandResult.value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);

      // Verify event was published
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = mockEventPublisher.publish.mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(EtbCreatedEvent);
      expect((publishedEvent as EtbCreatedEvent).etbId.value).toBe(result.value!.value);
      expect((publishedEvent as EtbCreatedEvent).einsatzId.equals(testEinsatzId)).toBe(true);
    });

    it('should NOT publish event when creation fails', async () => {
      // Arrange
      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(false));

      const commandResult = CreateEtbCommand.create(testEinsatzId.value);
      const command = commandResult.value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });
  });

  describe('Command Validation', () => {
    it('should fail command creation with empty einsatzId', () => {
      // Act
      const result = CreateEtbCommand.create('');

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('einsatzId is required');
    });

    it('should fail command creation with whitespace-only einsatzId', () => {
      // Act
      const result = CreateEtbCommand.create('   ');

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('einsatzId is required');
    });
  });
});
