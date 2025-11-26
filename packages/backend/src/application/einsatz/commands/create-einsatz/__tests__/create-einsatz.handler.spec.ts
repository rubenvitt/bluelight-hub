import { Test, type TestingModule } from '@nestjs/testing';
import { CreateEinsatzHandler } from '../create-einsatz.handler';
import { CreateEinsatzCommand } from '../create-einsatz.command';
import { Result } from '@domain/common/result';
import { UserId } from '@domain/value-objects/user-id';

describe('CreateEinsatzHandler', () => {
  let handler: CreateEinsatzHandler;
  let mockRepository: {
    save: jest.Mock;
    findById: jest.Mock;
    exists: jest.Mock;
    findActive: jest.Mock;
    findByNummer: jest.Mock;
  };
  let mockEventPublisher: {
    publish: jest.Mock;
    publishAll: jest.Mock;
  };

  beforeEach(async () => {
    mockRepository = {
      save: jest.fn().mockResolvedValue(Result.ok(undefined)),
      findById: jest.fn(),
      exists: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
      publishAll: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CreateEinsatzHandler, { provide: 'IEinsatzRepository', useValue: mockRepository }, { provide: 'IEventPublisher', useValue: mockEventPublisher }],
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
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(1);
    });

    it('sollte Einsatznummer im Format E{YEAR}-{CUID-8} generieren', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Verkehrsunfall', userId.value).value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      // Verify save was called with aggregate that has correct nummer format
      const savedAggregate = mockRepository.save.mock.calls[0][0];
      const currentYear = new Date().getFullYear();
      expect(savedAggregate.nummer).toMatch(new RegExp(`^E${currentYear}-[a-z0-9]{8}$`));
    });

    it('sollte EinsatzCreatedEvent publizieren mit nummer und alarmstichwort', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const alarmstichwort = 'Großbrand';
      const command = CreateEinsatzCommand.create(alarmstichwort, userId.value).value!;

      // Act
      await handler.execute(command);

      // Assert
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(1);
      const publishedEvents = mockEventPublisher.publishAll.mock.calls[0][0];
      expect(publishedEvents.length).toBeGreaterThan(0);
      const createdEvent = publishedEvents[0];

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
      await handler.execute(command);

      // Assert
      const savedAggregate = mockRepository.save.mock.calls[0][0];
      expect(savedAggregate.status.value).toBe('ANGELEGT');
    });

    it('sollte Result.fail zurückgeben bei ungültiger User-ID', async () => {
      // Arrange
      const command = CreateEinsatzCommand.create('Wohnungsbrand', 'invalid-user-id-format').value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Result.fail zurückgeben bei Repository-Fehler', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Wohnungsbrand', userId.value).value!;
      mockRepository.save.mockResolvedValue(Result.fail('Database error'));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error');
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
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
