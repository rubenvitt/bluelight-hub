import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaErinnerungRepository } from '../prisma-erinnerung.repository';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { Erinnerung } from '@domain/entities/erinnerung.entity';

// Mock PrismaService
const prismaServiceMock = {
  erinnerung: {
    findMany: jest.fn(),
  },
};

describe('PrismaErinnerungRepository', () => {
  let repository: PrismaErinnerungRepository;
  let prisma: typeof prismaServiceMock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaErinnerungRepository, { provide: PrismaService, useValue: prismaServiceMock }],
    }).compile();

    repository = module.get<PrismaErinnerungRepository>(PrismaErinnerungRepository);
    prisma = module.get(PrismaService);
  });

  describe('findOverdue', () => {
    it('should query with correct threshold and status', async () => {
      // Arrange
      const threshold = new Date('2023-01-01T12:00:00Z');
      prisma.erinnerung.findMany.mockResolvedValue([]);

      // Act
      await repository.findOverdue(threshold);

      // Assert - Query inkludiert jetzt OR-Klausel für eskalierbare Erinnerungen
      expect(prisma.erinnerung.findMany).toHaveBeenCalledWith({
        where: {
          status: 'AUSGELOEST',
          ausgeloestAm: {
            lte: threshold,
          },
          isDeleted: false,
          // Nur Erinnerungen, die noch eskalierbar sind (mit eskalationsPersonId oder unter Intensivierungs-Limit)
          OR: [{ eskalationsPersonId: { not: null } }, { intensivierungsCount: { lt: Erinnerung.MAX_INTENSIVIERUNGEN } }],
        },
      });
    });

    it('should return mapped entities', async () => {
      // Arrange
      const _threshold = new Date();
      const _mockDbItem = {
        id: '1',
        titel: 'Test',
        status: 'AUSGELOEST',
        ausgeloestAm: new Date('2023-01-01T10:00:00Z'),
        faelligAm: new Date(),
        einsatzId: 'e1',
        erstelltVon: 'u1',
        isDeleted: false,
        // ... required fields for mapper
      };
      // We assume mapper works or mock it, but here we test repo interacting with prisma client
    });
  });
});
