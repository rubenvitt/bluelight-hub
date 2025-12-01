import { Test, type TestingModule } from '@nestjs/testing';
import { UpdateEinsatzHandler } from '../update-einsatz.handler';
import { UpdateEinsatzCommand } from '../update-einsatz.command';
import { Result } from '@domain/common/result';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaOutboxRepository } from '@/infrastructure/outbox/prisma-outbox.repository';

describe('UpdateEinsatzHandler', () => {
  let handler: UpdateEinsatzHandler;
  let mockRepository: {
    save: jest.Mock;
    findById: jest.Mock;
  };
  let mockPrismaService: {
    $transaction: jest.Mock;
  };
  let mockOutboxRepository: {
    save: jest.Mock;
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

    mockPrismaService = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        const txMock = {};
        return callback(txMock);
      }),
    };

    mockOutboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateEinsatzHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PrismaOutboxRepository, useValue: mockOutboxRepository },
        { provide: 'IEinsatzRepository', useValue: mockRepository },
      ],
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

      // Act & Assert
      await expect(handler.execute(command)).resolves.toBeUndefined();
      expect(einsatz.alarmstichwort).toBe('Neues Alarmstichwort');
      expect(einsatz.einsatzort).toBe(originalEinsatzort); // unchanged
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
    });

    it('sollte Exception werfen wenn Einsatz nicht gefunden', async () => {
      // Arrange
      const einsatzId = EinsatzId.create().value!;
      mockRepository.findById.mockResolvedValue(Result.ok(null));

      const command = UpdateEinsatzCommand.create(einsatzId.value, 'Neues Alarmstichwort').value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow('Einsatz not found');
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte EinsatzUpdatedEvent in Outbox persistieren', async () => {
      // Arrange
      const einsatz = createTestEinsatz();
      einsatz.clearDomainEvents(); // Clear creation event
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      const command = UpdateEinsatzCommand.create(einsatz.id.value, 'Großbrand').value!;

      // Act
      await handler.execute(command);

      // Assert
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents.length).toBe(1);
      const updateEvent = savedEvents[0];
      expect(updateEvent.updates.alarmstichwort).toBe('Großbrand');
    });

    it('sollte Exception werfen bei ungültiger Einsatz-ID', async () => {
      // Arrange
      const command = UpdateEinsatzCommand.create('invalid-id', 'Neues Alarmstichwort').value!;

      // Act & Assert
      // EinsatzId.create() wirft "Invalid CUID format" bei ungültiger ID
      await expect(handler.execute(command)).rejects.toThrow('Invalid CUID format');
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockRepository.findById).not.toHaveBeenCalled();
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });

    it('sollte Exception werfen bei Repository-Fehler', async () => {
      // Arrange
      const einsatz = createTestEinsatz();
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.fail('Database error'));

      const command = UpdateEinsatzCommand.create(einsatz.id.value, 'Großbrand').value!;

      // Act & Assert
      // Handler wirft die originale Fehlermeldung vom Repository
      await expect(handler.execute(command)).rejects.toThrow('Database error');
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
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
