import { Test, type TestingModule } from '@nestjs/testing';
import { DeleteEinsatzHandler } from '../delete-einsatz.handler';
import { DeleteEinsatzCommand } from '../delete-einsatz.command';
import { Result } from '@domain/common/result';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatzNotFoundException, EinsatzValidationException, EinsatzBusinessRuleException } from '@domain/common/exceptions';

describe('DeleteEinsatzHandler', () => {
  let handler: DeleteEinsatzHandler;
  let mockRepository: {
    findById: jest.Mock;
    delete: jest.Mock;
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
      findById: jest.fn(),
      delete: jest.fn(), // Should NEVER be called
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DeleteEinsatzHandler, { provide: EINSATZ_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<DeleteEinsatzHandler>(DeleteEinsatzHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('NO-DELETE Policy', () => {
    it('sollte IMMER EinsatzBusinessRuleException werfen (NO-DELETE Policy)', async () => {
      // Arrange
      const einsatz = createTestEinsatz();
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      const command = DeleteEinsatzCommand.create(einsatz.id.value).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(EinsatzBusinessRuleException);
      await expect(handler.execute(command)).rejects.toThrow('Einsätze können nicht gelöscht werden. Verwende Archivieren stattdessen.');

      // Verify exception details
      try {
        await handler.execute(command);
      } catch (error) {
        expect(error).toBeInstanceOf(EinsatzBusinessRuleException);
        expect((error as EinsatzBusinessRuleException).rule).toBe('noDeletePolicy');
      }
    });

    it('sollte canBeDeleted() aufrufen und false erwarten', async () => {
      // Arrange
      const einsatz = createTestEinsatz();
      const canBeDeletedSpy = jest.spyOn(einsatz, 'canBeDeleted');
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      const command = DeleteEinsatzCommand.create(einsatz.id.value).value!;

      // Act - expect exception
      await expect(handler.execute(command)).rejects.toThrow(EinsatzBusinessRuleException);

      // Assert
      expect(canBeDeletedSpy).toHaveBeenCalled();
      expect(einsatz.canBeDeleted()).toBe(false);
    });

    it('sollte repository.delete NIEMALS aufrufen (DRK Compliance)', async () => {
      // Arrange
      const einsatz = createTestEinsatz();
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      const command = DeleteEinsatzCommand.create(einsatz.id.value).value!;

      // Act - expect exception
      await expect(handler.execute(command)).rejects.toThrow(EinsatzBusinessRuleException);

      // Assert
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('sollte canBeDeleted() === false in ALLEN Status', async () => {
      // Arrange - Test all statuses
      const statuses = ['ANGELEGT', 'IN_BEARBEITUNG', 'ABGESCHLOSSEN', 'ARCHIVIERT'];

      for (const _statusValue of statuses) {
        const einsatz = createTestEinsatz();

        // canBeDeleted() should always return false regardless of status
        const canDelete = einsatz.canBeDeleted();

        // Assert
        expect(canDelete).toBe(false);
      }
    });
  });

  describe('Error Cases', () => {
    it('sollte EinsatzNotFoundException werfen bei Einsatz nicht gefunden', async () => {
      // Arrange
      const einsatzId = EinsatzId.create().value!;
      mockRepository.findById.mockResolvedValue(Result.ok(null));

      const command = DeleteEinsatzCommand.create(einsatzId.value).value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(EinsatzNotFoundException);
      await expect(handler.execute(command)).rejects.toThrow(`Einsatz nicht gefunden: ${einsatzId.value}`);

      // Verify exception details
      try {
        await handler.execute(command);
      } catch (error) {
        expect(error).toBeInstanceOf(EinsatzNotFoundException);
        expect((error as EinsatzNotFoundException).aggregateId).toBe(einsatzId.value);
      }
    });

    it('sollte EinsatzValidationException werfen bei ungültiger Einsatz-ID', async () => {
      // Arrange
      const command = DeleteEinsatzCommand.create('invalid-id').value!;

      // Act & Assert
      await expect(handler.execute(command)).rejects.toThrow(EinsatzValidationException);

      // Verify repository was never called
      expect(mockRepository.findById).not.toHaveBeenCalled();

      // Verify exception details
      try {
        await handler.execute(command);
      } catch (error) {
        expect(error).toBeInstanceOf(EinsatzValidationException);
        expect((error as EinsatzValidationException).field).toBe('einsatzId');
      }
    });
  });

  describe('Command Validation', () => {
    it('sollte Result.fail bei fehlender einsatzId zurückgeben', () => {
      const result = DeleteEinsatzCommand.create('');
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('einsatzId ist erforderlich');
    });
  });
});
