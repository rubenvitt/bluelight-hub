import { GetEinsatzTeilnehmerHandler } from '../get-einsatz-teilnehmer.handler';
import { GetEinsatzTeilnehmerQuery } from '../get-einsatz-teilnehmer.query';
import type { PrismaService } from '@infrastructure/database/prisma.service';
import type { ILogger } from '@domain/ports/i-logger.port';

describe('GetEinsatzTeilnehmerHandler', () => {
  let handler: GetEinsatzTeilnehmerHandler;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockLogger: jest.Mocked<ILogger>;

  const testEinsatzId = 'clw3h8x9y0001abcdefghijkl';
  const testUserId1 = 'clw3h8x9y0002user1xxxxxx';
  const testUserId2 = 'clw3h8x9y0003user2xxxxxx';

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      einsatz: {
        findUnique: jest.fn(),
      },
      einsatzTeilnehmer: {
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    handler = new GetEinsatzTeilnehmerHandler(mockPrisma, mockLogger);
  });

  describe('execute', () => {
    it('should return empty array when no teilnehmer exist', async () => {
      // Given
      mockPrisma.einsatz.findUnique.mockResolvedValue({ id: testEinsatzId } as never);
      mockPrisma.einsatzTeilnehmer.findMany.mockResolvedValue([]);

      const queryResult = GetEinsatzTeilnehmerQuery.create({ einsatzId: testEinsatzId });
      expect(queryResult.isSuccess).toBe(true);

      // When
      const result = await handler.execute(queryResult.value!);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
      expect(mockPrisma.einsatzTeilnehmer.findMany).toHaveBeenCalledWith({
        where: {
          einsatzId: testEinsatzId,
          leftAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: {
          joinedAt: 'asc',
        },
      });
    });

    it('should return active teilnehmer with user data', async () => {
      // Given
      const joinedAt1 = new Date('2026-01-23T08:00:00Z');
      const joinedAt2 = new Date('2026-01-23T09:00:00Z');

      mockPrisma.einsatz.findUnique.mockResolvedValue({ id: testEinsatzId } as never);
      mockPrisma.einsatzTeilnehmer.findMany.mockResolvedValue([
        {
          id: 'teilnehmer-1',
          einsatzId: testEinsatzId,
          userId: testUserId1,
          funkrufname: 'Florian 11/40',
          joinedAt: joinedAt1,
          leftAt: null,
          user: {
            id: testUserId1,
            username: 'tschmidt',
          },
        },
        {
          id: 'teilnehmer-2',
          einsatzId: testEinsatzId,
          userId: testUserId2,
          funkrufname: 'Florian 11/41',
          joinedAt: joinedAt2,
          leftAt: null,
          user: {
            id: testUserId2,
            username: 'amueller',
          },
        },
      ] as never);

      const queryResult = GetEinsatzTeilnehmerQuery.create({ einsatzId: testEinsatzId });

      // When
      const result = await handler.execute(queryResult.value!);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(result.value![0]).toEqual({
        userId: testUserId1,
        username: 'tschmidt',
        funkrufname: 'Florian 11/40',
        joinedAt: joinedAt1.toISOString(),
      });
      expect(result.value![1]).toEqual({
        userId: testUserId2,
        username: 'amueller',
        funkrufname: 'Florian 11/41',
        joinedAt: joinedAt2.toISOString(),
      });
    });

    it('should fail when einsatz does not exist', async () => {
      // Given
      mockPrisma.einsatz.findUnique.mockResolvedValue(null);

      const queryResult = GetEinsatzTeilnehmerQuery.create({ einsatzId: testEinsatzId });

      // When
      const result = await handler.execute(queryResult.value!);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('nicht gefunden');
      expect(mockPrisma.einsatzTeilnehmer.findMany).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Given
      mockPrisma.einsatz.findUnique.mockResolvedValue({ id: testEinsatzId } as never);
      mockPrisma.einsatzTeilnehmer.findMany.mockRejectedValue(new Error('Database connection failed'));

      const queryResult = GetEinsatzTeilnehmerQuery.create({ einsatzId: testEinsatzId });

      // When
      const result = await handler.execute(queryResult.value!);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});

describe('GetEinsatzTeilnehmerQuery', () => {
  it('should create query with valid einsatzId', () => {
    // When
    const result = GetEinsatzTeilnehmerQuery.create({ einsatzId: 'valid-id' });

    // Then
    expect(result.isSuccess).toBe(true);
    expect(result.value?.einsatzId).toBe('valid-id');
  });

  it('should fail with empty einsatzId', () => {
    // When
    const result = GetEinsatzTeilnehmerQuery.create({ einsatzId: '' });

    // Then
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('einsatzId ist erforderlich');
  });

  it('should fail with whitespace-only einsatzId', () => {
    // When
    const result = GetEinsatzTeilnehmerQuery.create({ einsatzId: '   ' });

    // Then
    expect(result.isFailure).toBe(true);
  });
});
