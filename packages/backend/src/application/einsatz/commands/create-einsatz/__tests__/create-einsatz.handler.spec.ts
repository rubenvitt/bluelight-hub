import { Test, type TestingModule } from '@nestjs/testing';
import { CreateEinsatzHandler } from '../create-einsatz.handler';
import { CreateEinsatzCommand } from '../create-einsatz.command';
import { Result } from '@domain/common/result';
import { UserId } from '@domain/value-objects/user-id';
import { PrismaService } from '@/prisma/prisma.service';

describe('CreateEinsatzHandler', () => {
  let handler: CreateEinsatzHandler;
  let mockRepository: {
    save: jest.Mock;
    findById: jest.Mock;
    exists: jest.Mock;
    findActive: jest.Mock;
    findByNummer: jest.Mock;
  };
  let mockPrismaService: {
    $transaction: jest.Mock;
  };
  let mockOutboxRepository: {
    save: jest.Mock;
    findPendingEvents: jest.Mock;
    markAsPublished: jest.Mock;
    markAsFailed: jest.Mock;
    getRetryCount: jest.Mock;
  };

  beforeEach(async () => {
    mockRepository = {
      save: jest.fn().mockResolvedValue(Result.ok(undefined)),
      findById: jest.fn(),
      exists: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
    };

    mockOutboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findPendingEvents: jest.fn(),
      markAsPublished: jest.fn(),
      markAsFailed: jest.fn(),
      getRetryCount: jest.fn(),
    };

    // WICHTIG: $transaction muss die Callback-Funktion ausführen und den Mock Transaction Client übergeben
    mockPrismaService = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        // Erstelle einen minimalen Transaction Mock
        const txMock = {}; // Minimaler TX Mock - Repository bekommt diesen
        return callback(txMock);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateEinsatzHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: 'IOutboxRepository', useValue: mockOutboxRepository },
        { provide: 'IEinsatzRepository', useValue: mockRepository },
      ],
    }).compile();

    handler = module.get<CreateEinsatzHandler>(CreateEinsatzHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('sollte Einsatz erfolgreich erstellen mit gültigen Daten', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Wohnungsbrand', userId.value).value!;

      // Act
      const einsatzId = await handler.execute(command);

      // Assert
      expect(einsatzId).toBeDefined();
      expect(typeof einsatzId).toBe('string');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      // Events werden in Outbox gespeichert, nicht direkt publiziert
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('sollte Einsatznummer im Format E{YEAR}-{CUID-8} generieren', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Verkehrsunfall', userId.value).value!;

      // Act
      const einsatzId = await handler.execute(command);

      // Assert
      expect(einsatzId).toBeDefined();
      // Verify save was called with aggregate that has correct nummer format
      const savedAggregate = mockRepository.save.mock.calls[0][0];
      const currentYear = new Date().getFullYear();
      expect(savedAggregate.nummer).toMatch(new RegExp(`^E${currentYear}-[a-z0-9]{8}$`));
    });

    it('sollte EinsatzCreatedEvent in Outbox speichern mit nummer und alarmstichwort', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const alarmstichwort = 'Großbrand';
      const command = CreateEinsatzCommand.create(alarmstichwort, userId.value).value!;

      // Act
      await handler.execute(command);

      // Assert
      // Events werden in Outbox gespeichert, nicht direkt publiziert
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents.length).toBeGreaterThan(0);
      const createdEvent = savedEvents[0];

      // Validate alarmstichwort
      expect(createdEvent.alarmstichwort).toBe(alarmstichwort);

      // Validate nummer format: E{YEAR}-{CUID-8}
      const currentYear = new Date().getFullYear();
      expect(createdEvent.nummer).toBeDefined();
      expect(createdEvent.nummer).toMatch(new RegExp(`^E${currentYear}-[a-z0-9]{8}$`));

      // Validate einsatzId exists
      expect(createdEvent.einsatzId).toBeDefined();
    });

    it('sollte Status ANGELEGT sein nach Erstellung', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Hilfeleistung', userId.value).value!;

      // Act
      const einsatzId = await handler.execute(command);

      // Assert
      expect(einsatzId).toBeDefined();
      const savedAggregate = mockRepository.save.mock.calls[0][0];
      expect(savedAggregate.status.value).toBe('ANGELEGT');
    });

    it('sollte Exception werfen bei ungültiger User-ID', async () => {
      // Arrange
      const command = CreateEinsatzCommand.create('Wohnungsbrand', 'invalid-user-id-format').value!;

      // Act & Assert
      // Handler wirft jetzt Exceptions statt Result.fail() zurückzugeben
      await expect(handler.execute(command)).rejects.toThrow();
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Exception werfen bei Repository-Fehler', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Wohnungsbrand', userId.value).value!;
      mockRepository.save.mockResolvedValue(Result.fail('Database error'));

      // Act & Assert
      // Handler wirft jetzt Exceptions statt Result.fail() zurückzugeben
      await expect(handler.execute(command)).rejects.toThrow();
      // Repository wurde aufgerufen, aber Fehler führt zu Transaction Rollback
      expect(mockRepository.save).toHaveBeenCalled();
      // Events werden nicht gespeichert bei Fehler
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Command Validation', () => {
    it('sollte Result.fail bei leerem alarmstichwort zurückgeben', () => {
      // Arrange & Act
      const result = CreateEinsatzCommand.create('', 'user-id');

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Alarmstichwort ist erforderlich');
    });

    it('sollte Result.fail bei fehlendem createdBy zurückgeben', () => {
      // Arrange & Act
      const result = CreateEinsatzCommand.create('Wohnungsbrand', '');

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('createdBy ist erforderlich');
    });
  });
});
