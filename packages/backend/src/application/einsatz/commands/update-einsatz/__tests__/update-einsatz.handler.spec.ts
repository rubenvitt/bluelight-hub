import { Test, type TestingModule } from '@nestjs/testing';
import { UpdateEinsatzHandler } from '../update-einsatz.handler';
import { UpdateEinsatzCommand } from '../update-einsatz.command';
import { Result } from '@domain/common/result';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';

describe('UpdateEinsatzHandler', () => {
  let handler: UpdateEinsatzHandler;
  let mockRepository: {
    save: jest.Mock;
    findById: jest.Mock;
  };
  let mockEventPublisher: {
    publishAll: jest.Mock;
  };

  // Helper to create a valid Einsatz for tests
  const createTestEinsatz = () => {
    const userId = UserId.create().value!;
    return Einsatz.create({
      alarmstichwort: 'Testbrand',
      createdBy: userId,
    }).value!;
  };

  beforeEach(async () => {
    mockRepository = {
      save: jest.fn().mockResolvedValue(Result.ok(undefined)),
      findById: jest.fn(),
    };

    mockEventPublisher = {
      publishAll: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UpdateEinsatzHandler, { provide: 'IEinsatzRepository', useValue: mockRepository }, { provide: 'IEventPublisher', useValue: mockEventPublisher }],
    }).compile();

    handler = module.get<UpdateEinsatzHandler>(UpdateEinsatzHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('sollte nur alarmstichwort aktualisieren (Partial Update)', async () => {
      // Arrange
      const einsatz = createTestEinsatz();
      const originalEinsatzort = einsatz.einsatzort;
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      const command = UpdateEinsatzCommand.create(
        einsatz.id.value,
        'Neues Alarmstichwort',
        undefined, // einsatzort bleibt unverändert
        undefined, // bemerkung bleibt unverändert
      ).value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(einsatz.alarmstichwort).toBe('Neues Alarmstichwort');
      expect(einsatz.einsatzort).toBe(originalEinsatzort); // unchanged
    });

    it('sollte Result.fail zurückgeben wenn Einsatz nicht gefunden', async () => {
      // Arrange
      const einsatzId = EinsatzId.create().value!;
      mockRepository.findById.mockResolvedValue(Result.ok(null));

      const command = UpdateEinsatzCommand.create(einsatzId.value, 'Neues Alarmstichwort').value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Einsatz not found');
    });

    it('sollte EinsatzUpdatedEvent mit Delta publizieren', async () => {
      // Arrange
      const einsatz = createTestEinsatz();
      einsatz.clearDomainEvents(); // Clear creation event
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      const command = UpdateEinsatzCommand.create(einsatz.id.value, 'Großbrand').value!;

      // Act
      await handler.execute(command);

      // Assert
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(1);
      const publishedEvents = mockEventPublisher.publishAll.mock.calls[0][0];
      expect(publishedEvents.length).toBe(1);
      const updateEvent = publishedEvents[0];
      expect(updateEvent.updates.alarmstichwort).toBe('Großbrand');
    });

    it('sollte Result.fail bei ungültiger Einsatz-ID zurückgeben', async () => {
      // Arrange
      const command = UpdateEinsatzCommand.create('invalid-id', 'Neues Alarmstichwort').value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('Command Validation', () => {
    it('sollte Result.fail bei fehlender einsatzId zurückgeben', () => {
      const result = UpdateEinsatzCommand.create('', 'Alarmstichwort');
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('einsatzId ist erforderlich');
    });

    it('sollte Result.fail wenn keine Felder aktualisiert werden', () => {
      const einsatzId = EinsatzId.create().value!;
      const result = UpdateEinsatzCommand.create(einsatzId.value);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Mindestens ein Feld muss aktualisiert werden');
    });

    it('sollte Result.fail bei leerem alarmstichwort zurückgeben', () => {
      const einsatzId = EinsatzId.create().value!;
      const result = UpdateEinsatzCommand.create(einsatzId.value, '');
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Alarmstichwort darf nicht leer sein');
    });
  });
});
