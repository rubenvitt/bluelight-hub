import { GetLagekarteExistsQueryHandler } from '../get-lagekarte-exists.handler';
import { GetLagekarteExistsQuery } from '../get-lagekarte-exists.query';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';

// Mock nanoid for deterministic test IDs
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn((length?: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    const targetLength = length || 21;
    let result = '';
    for (let i = 0; i < targetLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

/**
 * Helper function: Generates valid 21-character nanoid for testing.
 */
function createValidTestId(prefix = 'test'): string {
  const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = prefix;
  while (id.length < 21) {
    id += validChars.charAt(Math.floor(Math.random() * validChars.length));
  }
  return id.substring(0, 21);
}

/**
 * Unit Tests für GetLagekarteExistsQueryHandler.
 *
 * Testet Handler-Orchestration gemäß BDD Given-When-Then Pattern.
 * Nutzt jest.fn() für Repository-Mocks (NO NestJS Test Module).
 *
 * Coverage Target: >90%
 */
describe('GetLagekarteExistsQueryHandler', () => {
  let handler: GetLagekarteExistsQueryHandler;
  let mockRepo: jest.Mocked<ILagekarteRepository>;

  beforeEach(() => {
    // Create mock repository with all required methods
    mockRepo = {
      findByEinsatzId: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn(),
    } as any;

    // Instantiate handler with mock (Direct Instantiation Pattern)
    handler = new GetLagekarteExistsQueryHandler(mockRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should return true when Lagekarte exists', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result).toBe(true);
      expect(mockRepo.exists).toHaveBeenCalledTimes(1);
      expect(mockRepo.exists).toHaveBeenCalledWith(expect.objectContaining({ value: einsatzId }));
    });

    it('should return false when Lagekarte does not exist', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(false);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result).toBe(false);
      expect(mockRepo.exists).toHaveBeenCalledTimes(1);
      expect(mockRepo.exists).toHaveBeenCalledWith(expect.objectContaining({ value: einsatzId }));
    });

    it('should handle valid nanoid format as einsatzId', async () => {
      // Given: Query with valid nanoid format (21 URL-safe characters)
      const validNanoid = createValidTestId('test');
      const query = new GetLagekarteExistsQuery(validNanoid);
      mockRepo.exists.mockResolvedValue(false);

      // When
      const result = await handler.execute(query);

      // Then: Handler should work with any valid nanoid
      expect(result).toBe(false);
      expect(mockRepo.exists).toHaveBeenCalledWith(expect.objectContaining({ value: validNanoid }));
    });

    it('should call repository.exists with correct EinsatzId value object', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      await handler.execute(query);

      // Then
      const call = mockRepo.exists.mock.calls[0][0];
      expect(call.value).toBe(einsatzId);
      expect(mockRepo.exists).toHaveBeenCalledTimes(1);
    });
  });

  describe('Failure Cases', () => {
    it('should throw error when repository throws error', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);

      // Mock: Repository throws error
      mockRepo.exists.mockRejectedValue(new Error('Database connection failed'));

      // When/Then: Error should propagate (NOT caught by handler)
      await expect(handler.execute(query)).rejects.toThrow('Database connection failed');

      // Verify repository was called
      expect(mockRepo.exists).toHaveBeenCalledTimes(1);
    });

    it('should throw error when repository throws non-Error object', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);

      // Mock: Repository throws string
      mockRepo.exists.mockRejectedValue('String error');

      // When/Then: Error should propagate (NOT caught by handler)
      await expect(handler.execute(query)).rejects.toEqual('String error');

      // Verify repository was called
      expect(mockRepo.exists).toHaveBeenCalledTimes(1);
    });

    it('should throw error when EinsatzId creation fails', async () => {
      // Given: Invalid EinsatzId (empty string)
      const invalidId = '';
      const query = new GetLagekarteExistsQuery('valid-einsatz-id-21');

      // Override query.einsatzId to trigger EinsatzId.create() failure
      Object.defineProperty(query, 'einsatzId', {
        value: invalidId,
        writable: false,
      });

      // When/Then: EinsatzId.create() should fail
      await expect(handler.execute(query)).rejects.toThrow();

      // Repository should NOT be called (validation fails first)
      expect(mockRepo.exists).not.toHaveBeenCalled();
    });
  });

  describe('Orchestration Verification', () => {
    it('should NOT call save() method (read-only query)', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      await handler.execute(query);

      // Then: save() should NEVER be called (query is read-only)
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should NOT call findById() method', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      await handler.execute(query);

      // Then: exists() is more efficient than findById()
      expect(mockRepo.findById).not.toHaveBeenCalled();
    });

    it('should NOT call findByEinsatzId() method', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      await handler.execute(query);

      // Then: exists() is more efficient than findByEinsatzId()
      expect(mockRepo.findByEinsatzId).not.toHaveBeenCalled();
    });

    it('should call exists() exactly once per execution', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      await handler.execute(query);
      await handler.execute(query);
      await handler.execute(query);

      // Then: 3 executions = 3 repository calls
      expect(mockRepo.exists).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle einsatzId with all valid nanoid characters', async () => {
      // Given
      const complexEinsatzId = 'AZaz09_-0123456789XYZ'; // All valid chars
      const query = new GetLagekarteExistsQuery(complexEinsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result).toBe(true);
      expect(mockRepo.exists).toHaveBeenCalledWith(expect.objectContaining({ value: complexEinsatzId }));
    });

    it('should handle repository returning null-like values', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);

      // Mock: Repository returns undefined (type mismatch, but testing runtime)
      mockRepo.exists.mockResolvedValue(undefined as any);

      // When
      const result = await handler.execute(query);

      // Then: undefined is falsy
      expect(result).toBe(undefined);
    });

    it('should handle multiple concurrent executions', async () => {
      // Given
      const einsatzId1 = createValidTestId('ein1');
      const einsatzId2 = createValidTestId('ein2');
      const query1 = new GetLagekarteExistsQuery(einsatzId1);
      const query2 = new GetLagekarteExistsQuery(einsatzId2);

      mockRepo.exists.mockImplementation(async (id) => {
        // Simulate different results for different IDs
        return id.value === einsatzId1;
      });

      // When: Execute concurrently
      const [result1, result2] = await Promise.all([handler.execute(query1), handler.execute(query2)]);

      // Then
      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(mockRepo.exists).toHaveBeenCalledTimes(2);
    });

    it('should handle repository timeout gracefully', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);

      // Mock: Repository times out
      mockRepo.exists.mockRejectedValue(new Error('Query timeout after 30s'));

      // When/Then: Timeout error should propagate
      await expect(handler.execute(query)).rejects.toThrow('Query timeout after 30s');
    });
  });

  describe('Return Type Verification', () => {
    it('should return boolean type (not Result<boolean>)', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      const result = await handler.execute(query);

      // Then: Result is plain boolean, NOT Result<T> object
      expect(typeof result).toBe('boolean');
      expect(result).toBe(true);
      expect(result).not.toHaveProperty('isSuccess');
      expect(result).not.toHaveProperty('isFailure');
      expect(result).not.toHaveProperty('value');
      expect(result).not.toHaveProperty('error');
    });

    it('should return boolean false (not null or undefined)', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(false);

      // When
      const result = await handler.execute(query);

      // Then: Result is boolean false, NOT null or undefined
      expect(result).toBe(false);
      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
    });
  });
});
