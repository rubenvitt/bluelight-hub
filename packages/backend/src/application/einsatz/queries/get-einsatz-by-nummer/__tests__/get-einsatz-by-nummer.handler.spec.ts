import { GetEinsatzByNummerQueryHandler } from '../get-einsatz-by-nummer.handler';
import { GetEinsatzByNummerQuery } from '../get-einsatz-by-nummer.query';
import type { IEinsatzRepository } from '@domain/repositories';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { UserId } from '@domain/value-objects/user-id';
import { Result } from '@domain/common/result';
import { Address } from '@domain/value-objects/address';

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
 * Helper function: Creates a valid test user ID.
 */
function createValidTestUserId(): UserId {
  return UserId.create().value!;
}

/**
 * Helper function: Creates a valid test address.
 */
function createValidTestAddress(): Address {
  return Address.create({
    strasse: 'Musterstr.',
    hausnummer: '42',
    plz: '80331',
    ort: 'München',
  }).value!;
}

/**
 * Unit Tests für GetEinsatzByNummerQueryHandler.
 *
 * Testet Handler-Orchestration gemäß BDD Given-When-Then Pattern.
 * Nutzt jest.fn() für Repository-Mocks (NO NestJS Test Module).
 *
 * Coverage Target: >90%
 */
describe('GetEinsatzByNummerQueryHandler', () => {
  let handler: GetEinsatzByNummerQueryHandler;
  let mockRepo: jest.Mocked<IEinsatzRepository>;

  beforeEach(() => {
    // Create mock repository with all required methods
    mockRepo = {
      findById: jest.fn(),
      findByNummer: jest.fn(),
      findActive: jest.fn(),
      save: jest.fn(),
      exists: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    // Instantiate handler with mock (Direct Instantiation Pattern)
    handler = new GetEinsatzByNummerQueryHandler(mockRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should return DTO when einsatz found by nummer', async () => {
      // Given
      const userId = createValidTestUserId();
      const einsatzort = createValidTestAddress();
      const aggregate = Einsatz.create({
        alarmstichwort: 'Wohnungsbrand',
        createdBy: userId,
        einsatzort,
        bemerkung: 'Dachstuhl brennt',
      }).value!;

      const einsatzNummer = aggregate.nummer;

      mockRepo.findByNummer.mockResolvedValue(Result.ok(aggregate));

      const query = new GetEinsatzByNummerQuery(einsatzNummer);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.nummer).toBe(einsatzNummer);
      expect(result.value!.alarmstichwort).toBe('Wohnungsbrand');
      expect(result.value!.status).toBe('ANGELEGT');
      expect(result.value!.createdBy).toBe(userId.value);
      expect(result.value!.bemerkung).toBe('Dachstuhl brennt');

      // Verify repository called with correct nummer
      expect(mockRepo.findByNummer).toHaveBeenCalledWith(einsatzNummer);
      expect(mockRepo.findByNummer).toHaveBeenCalledTimes(1);
    });

    it('should return null when einsatz not found by nummer', async () => {
      // Given
      const nummer = 'E2024-abc123xy';
      const query = new GetEinsatzByNummerQuery(nummer);

      // Mock: Repository returns null
      mockRepo.findByNummer.mockResolvedValue(Result.ok(null));

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();

      // Verify repository was called
      expect(mockRepo.findByNummer).toHaveBeenCalledWith(nummer);
      expect(mockRepo.findByNummer).toHaveBeenCalledTimes(1);
    });

    it('should map aggregate fields to DTO correctly', async () => {
      // Given
      const userId = createValidTestUserId();
      const einsatzort = createValidTestAddress();
      const aggregate = Einsatz.create({
        alarmstichwort: 'Verkehrsunfall',
        createdBy: userId,
        einsatzort,
      }).value!;

      const einsatzNummer = aggregate.nummer;

      mockRepo.findByNummer.mockResolvedValue(Result.ok(aggregate));

      const query = new GetEinsatzByNummerQuery(einsatzNummer);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();

      const dto = result.value!;

      // Verify all fields mapped correctly
      expect(dto.id).toBe(aggregate.id.value);
      expect(dto.nummer).toBe(aggregate.nummer);
      expect(dto.alarmstichwort).toBe(aggregate.alarmstichwort);
      expect(dto.status).toBe(aggregate.status.value);
      expect(dto.createdBy).toBe(aggregate.createdBy.value);
      expect(dto.createdAt).toEqual(aggregate.createdAt);

      // Verify optional fields
      expect(dto.einsatzort).toBeDefined();
      expect(dto.einsatzort!.strasse).toBe('Musterstr.');
      expect(dto.einsatzort!.hausnummer).toBe('42');
      expect(dto.einsatzort!.plz).toBe('80331');
      expect(dto.einsatzort!.ort).toBe('München');

      expect(dto.bemerkung).toBeUndefined();
      expect(dto.abgeschlossenAt).toBeUndefined();
      expect(dto.archivedAt).toBeUndefined();
    });

    it('should map aggregate with bemerkung correctly', async () => {
      // Given
      const userId = createValidTestUserId();
      const aggregate = Einsatz.create({
        alarmstichwort: 'Wohnungsbrand',
        createdBy: userId,
        bemerkung: 'Person vermisst',
      }).value!;

      const einsatzNummer = aggregate.nummer;

      mockRepo.findByNummer.mockResolvedValue(Result.ok(aggregate));

      const query = new GetEinsatzByNummerQuery(einsatzNummer);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.bemerkung).toBe('Person vermisst');
    });

    it('should map aggregate without einsatzort correctly', async () => {
      // Given
      const userId = createValidTestUserId();
      const aggregate = Einsatz.create({
        alarmstichwort: 'Technische Hilfeleistung',
        createdBy: userId,
      }).value!;

      const einsatzNummer = aggregate.nummer;

      mockRepo.findByNummer.mockResolvedValue(Result.ok(aggregate));

      const query = new GetEinsatzByNummerQuery(einsatzNummer);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.einsatzort).toBeUndefined();
    });
  });

  describe('Failure Cases', () => {
    it('should handle repository error gracefully', async () => {
      // Given
      const nummer = 'E2024-abc123xy';
      const query = new GetEinsatzByNummerQuery(nummer);

      // Mock: Repository returns error
      mockRepo.findByNummer.mockResolvedValue(Result.fail('Database connection failed'));

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Database connection failed');
      expect(result.value).toBeUndefined();

      // Verify repository was called
      expect(mockRepo.findByNummer).toHaveBeenCalledWith(nummer);
      expect(mockRepo.findByNummer).toHaveBeenCalledTimes(1);
    });

    it('should handle repository exception gracefully', async () => {
      // Given
      const nummer = 'E2024-abc123xy';
      const query = new GetEinsatzByNummerQuery(nummer);

      // Mock: Repository throws exception
      mockRepo.findByNummer.mockRejectedValue(new Error('Unexpected database error'));

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Failed to load Einsatz by nummer');
      expect(result.value).toBeUndefined();

      // Verify repository was called
      expect(mockRepo.findByNummer).toHaveBeenCalledTimes(1);
    });

    it('should handle repository exception with non-Error object', async () => {
      // Given
      const nummer = 'E2024-abc123xy';
      const query = new GetEinsatzByNummerQuery(nummer);

      // Mock: Repository throws string
      mockRepo.findByNummer.mockRejectedValue('String error');

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Failed to load Einsatz by nummer');
    });

    it('should handle repository returning Result with undefined value and no error', async () => {
      // Given
      const nummer = 'E2024-abc123xy';
      const query = new GetEinsatzByNummerQuery(nummer);

      // Mock: Repository returns Result.fail without error message
      mockRepo.findByNummer.mockResolvedValue(Result.fail(''));

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Failed to load Einsatz by nummer');
    });
  });

  describe('Orchestration Verification', () => {
    it('should call repository.findByNummer with correct nummer', async () => {
      // Given
      const nummer = 'E2024-test1234';
      const query = new GetEinsatzByNummerQuery(nummer);
      mockRepo.findByNummer.mockResolvedValue(Result.ok(null));

      // When
      await handler.execute(query);

      // Then
      expect(mockRepo.findByNummer).toHaveBeenCalledWith(nummer);
      expect(mockRepo.findByNummer).toHaveBeenCalledTimes(1);
    });

    it('should NOT call save() method (read-only query)', async () => {
      // Given
      const userId = createValidTestUserId();
      const aggregate = Einsatz.create({
        alarmstichwort: 'Wohnungsbrand',
        createdBy: userId,
      }).value!;

      const einsatzNummer = aggregate.nummer;

      mockRepo.findByNummer.mockResolvedValue(Result.ok(aggregate));

      const query = new GetEinsatzByNummerQuery(einsatzNummer);

      // When
      await handler.execute(query);

      // Then: save() should NEVER be called (query is read-only)
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should NOT mutate aggregate during mapping', async () => {
      // Given
      const userId = createValidTestUserId();
      const aggregate = Einsatz.create({
        alarmstichwort: 'Wohnungsbrand',
        createdBy: userId,
        bemerkung: 'Original',
      }).value!;

      const originalAlarmstichwort = aggregate.alarmstichwort;
      const originalBemerkung = aggregate.bemerkung;
      const einsatzNummer = aggregate.nummer;

      mockRepo.findByNummer.mockResolvedValue(Result.ok(aggregate));

      const query = new GetEinsatzByNummerQuery(einsatzNummer);

      // When
      await handler.execute(query);

      // Then: Aggregate should still have original values
      expect(aggregate.alarmstichwort).toBe(originalAlarmstichwort);
      expect(aggregate.bemerkung).toBe(originalBemerkung);
    });
  });

  describe('Edge Cases', () => {
    it('should handle nummer with special characters in format', async () => {
      // Given
      const userId = createValidTestUserId();
      const aggregate = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: userId,
      }).value!;

      // Einsatznummer has consistent format (E{YEAR}-{CUID-8})
      const einsatzNummer = aggregate.nummer;

      mockRepo.findByNummer.mockResolvedValue(Result.ok(aggregate));

      const query = new GetEinsatzByNummerQuery(einsatzNummer);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.nummer).toBe(einsatzNummer);
    });

    it('should handle valid nummer format correctly', async () => {
      // Given
      const userId = createValidTestUserId();
      const aggregate = Einsatz.create({
        alarmstichwort: 'Test',
        createdBy: userId,
      }).value!;

      const einsatzNummer = aggregate.nummer;

      // Verify nummer format: E{YEAR}-{8 chars}
      expect(einsatzNummer).toMatch(/^E\d{4}-[a-z0-9]{8}$/);

      mockRepo.findByNummer.mockResolvedValue(Result.ok(aggregate));

      const query = new GetEinsatzByNummerQuery(einsatzNummer);

      // When
      const result = await handler.execute(query);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.nummer).toBe(einsatzNummer);
    });
  });

  describe('Query Constructor Validation', () => {
    it('should throw error when nummer is empty string', () => {
      // Given
      const emptyNummer = '';

      // When/Then
      expect(() => new GetEinsatzByNummerQuery(emptyNummer)).toThrow('nummer is required');
    });

    it('should throw error when nummer is whitespace-only', () => {
      // Given
      const whitespaceNummer = '   ';

      // When/Then
      expect(() => new GetEinsatzByNummerQuery(whitespaceNummer)).toThrow('nummer is required');
    });

    it('should throw error when nummer is undefined', () => {
      // Given
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const undefinedNummer = undefined as any;

      // When/Then
      expect(() => new GetEinsatzByNummerQuery(undefinedNummer)).toThrow('nummer is required');
    });

    it('should throw error when nummer is null', () => {
      // Given
      // biome-ignore lint/suspicious/noExplicitAny: Testing null/undefined handling
      const nullNummer = null as any;

      // When/Then
      expect(() => new GetEinsatzByNummerQuery(nullNummer)).toThrow('nummer is required');
    });
  });
});
