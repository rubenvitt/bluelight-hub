import { GetLagekarteExistsQueryHandler } from '../get-lagekarte-exists.handler';
import { GetLagekarteExistsQuery } from '../get-lagekarte-exists.query';
import type { ILagekarteRepository } from '@domain/repositories';
import { createValidTestId } from './helpers/test-id.helper';

// Mock cuid2 for deterministic test IDs
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
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    // Instantiate handler with mock (Direct Instantiation Pattern)
    handler = new GetLagekarteExistsQueryHandler(mockRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should return Result.ok(true) when Lagekarte exists', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
      expect(mockRepo.exists).toHaveBeenCalledTimes(1);
      expect(mockRepo.exists).toHaveBeenCalledWith(expect.objectContaining({ value: einsatzId }));
    });

    it('should return Result.ok(false) when Lagekarte does not exist', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(false);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
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
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
      expect(mockRepo.exists).toHaveBeenCalledWith(expect.objectContaining({ value: validNanoid }));
    });

    it('should call repository.exists with correct EinsatzId value object', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      const call = mockRepo.exists.mock.calls[0][0];
      expect(call.value).toBe(einsatzId);
      expect(mockRepo.exists).toHaveBeenCalledTimes(1);
    });
  });

  describe('Failure Cases', () => {
    it('should throw error when repository throws error (unerwarteter Fehler)', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);

      // Mock: Repository throws error (unerwarteter Infrastruktur-Fehler)
      mockRepo.exists.mockRejectedValue(new Error('Database connection failed'));

      // When/Then: Error should propagate (NOT caught by handler - unerwarteter Fehler)
      await expect(handler.execute(query)).rejects.toThrow('Database connection failed');

      // Verify repository was called
      expect(mockRepo.exists).toHaveBeenCalledTimes(1);
    });

    it('should throw error when repository throws non-Error object', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);

      // Mock: Repository throws string (unerwarteter Fehler)
      mockRepo.exists.mockRejectedValue('String error');

      // When/Then: Error should propagate (NOT caught by handler)
      await expect(handler.execute(query)).rejects.toEqual('String error');

      // Verify repository was called
      expect(mockRepo.exists).toHaveBeenCalledTimes(1);
    });

    it('should return Result.fail when EinsatzId creation fails', async () => {
      // Given: Invalid EinsatzId (empty string)
      const invalidId = '';
      const query = new GetLagekarteExistsQuery('clw3h8x9y0000qwertyui00001'); // Valid CUID2 format

      // Override query.einsatzId to trigger EinsatzId.create() failure
      Object.defineProperty(query, 'einsatzId', {
        value: invalidId,
        writable: false,
      });

      // When
      const result = await handler.execute(query);

      // Then: Should return Result.fail() (erwarteter Validierungsfehler)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeTruthy();

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
    it('should handle einsatzId with all valid cuid2 characters', async () => {
      // Given
      const complexEinsatzId = 'clw3h8x9y0000qwertyuiazaz0'; // Valid CUID2 format
      const query = new GetLagekarteExistsQuery(complexEinsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
      expect(mockRepo.exists).toHaveBeenCalledWith(expect.objectContaining({ value: complexEinsatzId }));
    });

    it('should handle repository returning null-like values', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);

      // Mock: Repository returns undefined (type mismatch, but testing runtime)
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      mockRepo.exists.mockResolvedValue(undefined as any);

      // When
      const result = await handler.execute(query);

      // Then: Result wraps undefined (falsy) value
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(undefined);
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
      expect(result1.isSuccess).toBe(true);
      expect(result1.value).toBe(true);
      expect(result2.isSuccess).toBe(true);
      expect(result2.value).toBe(false);
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

  describe('Return Type Verification (Result Pattern)', () => {
    it('should return Result<boolean> type (not plain boolean)', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(true);

      // When
      const result = await handler.execute(query);

      // Then: Result is Result<boolean> object
      expect(result).toHaveProperty('isSuccess');
      expect(result).toHaveProperty('isFailure');
      expect(result).toHaveProperty('value');
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return Result.ok(false) when not exists', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const query = new GetLagekarteExistsQuery(einsatzId);
      mockRepo.exists.mockResolvedValue(false);

      // When
      const result = await handler.execute(query);

      // Then: Result.ok() with false value
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should return Result.fail() on validation error', async () => {
      // Given: Invalid EinsatzId
      const invalidId = '';
      const query = new GetLagekarteExistsQuery('clw3h8x9y0000qwertyui00001');
      Object.defineProperty(query, 'einsatzId', {
        value: invalidId,
        writable: false,
      });

      // When
      const result = await handler.execute(query);

      // Then: Result.fail() with error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.value).toBeUndefined();
    });
  });
});
