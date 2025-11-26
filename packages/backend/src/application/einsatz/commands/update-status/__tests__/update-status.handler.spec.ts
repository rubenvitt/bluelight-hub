import { Result } from '@domain/common/result';
import { UpdateEinsatzStatusHandler } from '../update-status.handler';
import { UpdateEinsatzStatusCommand } from '../update-status.command';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzId } from '@domain/value-objects/einsatz-id';

/**
 * Helper: Erstellt Mock-Einsatz mit spezifischem Status.
 * Führt korrekte State Machine Transitions durch um gewünschten Status zu erreichen.
 */
const createMockEinsatz = (status: EinsatzStatus = EinsatzStatus.ANGELEGT()): Einsatz => {
  const userId = UserId.create().value!;
  const einsatz = Einsatz.create({
    alarmstichwort: 'Testbrand',
    createdBy: userId,
  }).value!;

  // Set status through valid transitions
  if (status.equals(EinsatzStatus.IN_BEARBEITUNG())) {
    einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
  } else if (status.equals(EinsatzStatus.ABGESCHLOSSEN())) {
    einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
    einsatz.complete(userId);
  } else if (status.equals(EinsatzStatus.ARCHIVIERT())) {
    einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
    einsatz.complete(userId);
    einsatz.archive(userId);
  }

  einsatz.clearDomainEvents();
  return einsatz;
};

describe('UpdateEinsatzStatusHandler', () => {
  let handler: UpdateEinsatzStatusHandler;
  let mockRepository: jest.Mocked<IEinsatzRepository>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
      exists: jest.fn(),
    } as jest.Mocked<IEinsatzRepository>;

    mockEventPublisher = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as jest.Mocked<IEventPublisher>;

    handler = new UpdateEinsatzStatusHandler(mockRepository, mockEventPublisher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute - gültige Transitions', () => {
    it('sollte ANGELEGT → IN_BEARBEITUNG erfolgreich durchführen', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('IN_BEARBEITUNG');
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz);
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(1);
    });

    it('sollte IN_BEARBEITUNG → ABGESCHLOSSEN erfolgreich durchführen', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.IN_BEARBEITUNG());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ABGESCHLOSSEN').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz);
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(1);
    });

    it('sollte ABGESCHLOSSEN → ARCHIVIERT erfolgreich durchführen', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ABGESCHLOSSEN());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ARCHIVIERT').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ARCHIVIERT');
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz);
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(1);
    });

    it('sollte ANGELEGT → ABGESCHLOSSEN direkt durchführen (Skip-Transition)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ABGESCHLOSSEN').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(einsatz.status.value).toBe('ABGESCHLOSSEN');
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz);
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute - ungültige Transitions', () => {
    it('sollte ABGESCHLOSSEN → ANGELEGT ablehnen (Rückwärts-Transition)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ABGESCHLOSSEN());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ANGELEGT').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültige Status-Transition');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('sollte ABGESCHLOSSEN → IN_BEARBEITUNG ablehnen (Rückwärts-Transition)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ABGESCHLOSSEN());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültige Status-Transition');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('sollte ARCHIVIERT → IN_BEARBEITUNG ablehnen (immutable)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ARCHIVIERT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Archivierte Einsätze');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('sollte ARCHIVIERT → ABGESCHLOSSEN ablehnen (immutable)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ARCHIVIERT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'ABGESCHLOSSEN').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Archivierte Einsätze');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('sollte ungültigen Status-String ablehnen', async () => {
      // Arrange
      const einsatz = createMockEinsatz();
      const einsatzId = einsatz.id.value;
      const command = UpdateEinsatzStatusCommand.create(einsatzId, 'INVALID_STATUS').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültiger Status');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });
  });

  describe('execute - Fehlerbehandlung', () => {
    it('sollte Result.fail() zurückgeben wenn Einsatz nicht gefunden', async () => {
      // Arrange
      const validEinsatzId = EinsatzId.create().value!.value;
      const command = UpdateEinsatzStatusCommand.create(validEinsatzId, 'IN_BEARBEITUNG').value!;
      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('nicht gefunden');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('sollte Result.fail() zurückgeben bei ungültiger EinsatzId', async () => {
      // Arrange
      const command = UpdateEinsatzStatusCommand.create('invalid-id-format', 'IN_BEARBEITUNG').value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      // EinsatzId.create() gibt "Invalid CUID format" zurück
      expect(result.error).toMatch(/Invalid CUID format|Ungültige Einsatz-ID/);
      expect(mockRepository.findById).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('sollte Result.fail() zurückgeben bei Repository.save() Fehler', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.fail('Database connection error'));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database connection error');
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('sollte Result.fail() zurückgeben bei Repository.findById() Fehler', async () => {
      // Arrange
      const einsatz = createMockEinsatz();
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.fail('Database connection error'));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database connection error');
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });
  });

  describe('execute - Event Publishing', () => {
    it('sollte EinsatzStatusChangedEvent nach save() publizieren', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Act
      await handler.execute(command);

      // Assert
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(1);
      const events = mockEventPublisher.publishAll.mock.calls[0][0];
      expect(events).toHaveLength(1);
      expect(events[0].constructor.name).toBe('EinsatzStatusChangedEvent');
    });

    it('sollte Events nach save() publizieren, nicht vorher', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Act
      await handler.execute(command);

      // Assert - Reihenfolge wichtig: save() vor publishAll()
      const { calls } = mockRepository.save.mock;
      const publishCalls = mockEventPublisher.publishAll.mock.invocationCallOrder;
      const saveCalls = mockRepository.save.mock.invocationCallOrder;
      expect(saveCalls[0]).toBeLessThan(publishCalls[0]);
    });

    it('sollte keine Events publizieren bei save() Fehler', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.fail('Database error'));

      // Act
      await handler.execute(command);

      // Assert
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('sollte Domain Events nach Publish leeren', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.ANGELEGT());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Act
      await handler.execute(command);

      // Assert
      expect(einsatz.getDomainEvents()).toHaveLength(0);
    });
  });

  describe('execute - No-Op Szenarien', () => {
    it('sollte No-Op durchführen bei gleichem Status (keine Events)', async () => {
      // Arrange
      const einsatz = createMockEinsatz(EinsatzStatus.IN_BEARBEITUNG());
      const command = UpdateEinsatzStatusCommand.create(einsatz.id.value, 'IN_BEARBEITUNG').value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz);
      // No-Op: Aggregate erzeugt kein Event bei gleichem Status
      expect(einsatz.getDomainEvents()).toHaveLength(0);
    });
  });
});
