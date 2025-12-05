import { ArchiveOldEinsaetzeCommand } from '../archive-old-einsaetze.command';

describe('ArchiveOldEinsaetzeCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create factory method', () => {
    it('should create command with default dryRun=true', () => {
      // Given
      const dto = { archivedBy: 'admin-123' };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.dryRun).toBe(true);
    });

    it('should create command with default olderThanYears=10', () => {
      // Given
      const dto = { archivedBy: 'admin-123' };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.olderThanYears).toBe(10);
    });

    it('should calculate olderThan date correctly for 10 years', () => {
      // Given
      const dto = { archivedBy: 'admin-123', olderThanYears: 10 };
      const now = new Date();
      const expectedYear = now.getFullYear() - 10;

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.olderThan.getFullYear()).toBe(expectedYear);
    });

    it('should allow explicit dryRun=false', () => {
      // Given
      const dto = { archivedBy: 'admin-123', dryRun: false };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.dryRun).toBe(false);
    });

    it('should allow custom olderThanYears', () => {
      // Given
      const dto = { archivedBy: 'admin-123', olderThanYears: 5 };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.olderThanYears).toBe(5);
    });

    it('should calculate olderThan date correctly for custom years', () => {
      // Given
      const dto = { archivedBy: 'admin-123', olderThanYears: 5 };
      const now = new Date();
      const expectedYear = now.getFullYear() - 5;

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.olderThan.getFullYear()).toBe(expectedYear);
    });

    it('should fail when archivedBy is missing', () => {
      // Given
      const dto = {} as any;

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('archivedBy');
    });

    it('should fail when archivedBy is empty string', () => {
      // Given
      const dto = { archivedBy: '' };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('archivedBy');
    });

    it('should fail when archivedBy is only whitespace', () => {
      // Given
      const dto = { archivedBy: '   ' };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('archivedBy');
    });

    it('should trim archivedBy whitespace', () => {
      // Given
      const dto = { archivedBy: '  admin-123  ' };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.archivedBy).toBe('admin-123');
    });

    it('should fail when olderThanYears is less than 1', () => {
      // Given
      const dto = { archivedBy: 'admin-123', olderThanYears: 0 };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('olderThanYears');
      expect(result.error).toContain('1 und 100');
    });

    it('should fail when olderThanYears exceeds 100', () => {
      // Given
      const dto = { archivedBy: 'admin-123', olderThanYears: 101 };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('olderThanYears');
      expect(result.error).toContain('1 und 100');
    });

    it('should accept olderThanYears at boundary value 1', () => {
      // Given
      const dto = { archivedBy: 'admin-123', olderThanYears: 1 };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.olderThanYears).toBe(1);
    });

    it('should accept olderThanYears at boundary value 100', () => {
      // Given
      const dto = { archivedBy: 'admin-123', olderThanYears: 100 };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.olderThanYears).toBe(100);
    });

    it('should handle dryRun=true explicitly set', () => {
      // Given
      const dto = { archivedBy: 'admin-123', dryRun: true };

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value!.dryRun).toBe(true);
    });

    it('should calculate olderThan preserving time of day', () => {
      // Given
      const dto = { archivedBy: 'admin-123', olderThanYears: 10 };
      const beforeCreate = new Date();

      // When
      const result = ArchiveOldEinsaetzeCommand.create(dto);

      // Then
      expect(result.isSuccess).toBe(true);
      const olderThan = result.value!.olderThan;

      // Check that month and day are similar to current date (within same execution)
      expect(olderThan.getMonth()).toBe(beforeCreate.getMonth());
      expect(olderThan.getDate()).toBe(beforeCreate.getDate());
    });
  });
});
