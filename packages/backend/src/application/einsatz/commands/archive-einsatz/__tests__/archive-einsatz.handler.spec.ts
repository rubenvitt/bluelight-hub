import { Result } from '@domain/common/result';
import { ArchiveEinsatzHandler } from '../archive-einsatz.handler';
import { ArchiveEinsatzCommand } from '../archive-einsatz.command';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import type { EinsatzArchivalPolicy } from '@domain/services/einsatz-archival.policy';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzArchivedEvent } from '@domain/events/einsatz-archived.event';

/**
 * Helper: Erstellt Mock-Einsatz mit spezifischem Status und abgeschlossenAt Date.
 *
 * @param options - Konfiguration für Status und Abschluss-Datum
 * @returns Einsatz Aggregate mit konfiguriertem Zustand
 */
const createMockEinsatz = (options: { status?: EinsatzStatus; abgeschlossenYearsAgo?: number } = {}) => {
  const userId = UserId.create().value!;
  const einsatz = Einsatz.create({
    alarmstichwort: 'Testbrand',
    createdBy: userId,
  }).value!;

  // Transition zu IN_BEARBEITUNG dann ABGESCHLOSSEN wenn nötig
  if (options.status?.equals(EinsatzStatus.ABGESCHLOSSEN()) || options.status?.equals(EinsatzStatus.ARCHIVIERT())) {
    einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
    einsatz.complete(userId);

    // Mock abgeschlossenAt date falls spezifiziert
    if (options.abgeschlossenYearsAgo !== undefined) {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - options.abgeschlossenYearsAgo);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (einsatz as any)._abgeschlossenAt = pastDate;
    }
  } else if (options.status) {
    if (!options.status.equals(EinsatzStatus.ANGELEGT())) {
      einsatz.updateStatus(options.status);
    }
  }

  einsatz.clearDomainEvents();
  return einsatz;
};

describe('ArchiveEinsatzHandler', () => {
  let handler: ArchiveEinsatzHandler;
  let mockRepository: jest.Mocked<IEinsatzRepository>;
  let mockEventPublisher: jest.Mocked<IEventPublisher>;
  let mockArchivalPolicy: jest.Mocked<EinsatzArchivalPolicy>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
      exists: jest.fn(),
    };

    mockEventPublisher = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    };

    mockArchivalPolicy = {
      canBeArchived: jest.fn(),
      getArchivalDate: jest.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    handler = new ArchiveEinsatzHandler(mockRepository, mockEventPublisher, mockArchivalPolicy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('sollte Einsatz erfolgreich archivieren wenn Status ABGESCHLOSSEN und 10 Jahre alt', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockArchivalPolicy.canBeArchived.mockReturnValue(true);
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz);
      expect(einsatz.status.value).toBe('ARCHIVIERT');
      expect(einsatz.archivedAt).toBeDefined();
    });

    it('sollte Result.fail() zurückgeben wenn Einsatz nicht gefunden', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create('clxxxxxxxxxxxxxxxxxx01', userId.value).value!;
      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('nicht gefunden');
    });

    it('sollte Result.fail() zurückgeben wenn Status != ABGESCHLOSSEN', async () => {
      // Arrange
      const einsatz = createMockEinsatz({ status: EinsatzStatus.IN_BEARBEITUNG() });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockArchivalPolicy.canBeArchived.mockReturnValue(false);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ABGESCHLOSSEN');
    });

    it('sollte Result.fail() zurückgeben wenn 10-Jahres-Frist nicht abgelaufen', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 5,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockArchivalPolicy.canBeArchived.mockReturnValue(false);

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('10-Jahres');
    });

    it('sollte Result.fail() zurückgeben wenn Einsatz bereits ARCHIVIERT', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockArchivalPolicy.canBeArchived.mockReturnValue(true);
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Einsatz archivieren (erster Aufruf)
      await handler.execute(command);
      einsatz.clearDomainEvents();

      // Act: Versuche erneut zu archivieren
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('bereits archiviert');
    });

    it('sollte EinsatzArchivedEvent nach save() publizieren', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockArchivalPolicy.canBeArchived.mockReturnValue(true);
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Act
      await handler.execute(command);

      // Assert
      expect(mockEventPublisher.publishAll).toHaveBeenCalledTimes(1);
      const events = mockEventPublisher.publishAll.mock.calls[0][0];
      expect(events.some((e) => e instanceof EinsatzArchivedEvent)).toBe(true);
    });

    it('sollte Repository.save() mit archiviertem Einsatz aufrufen', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockArchivalPolicy.canBeArchived.mockReturnValue(true);
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Act
      await handler.execute(command);

      // Assert
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith(einsatz);
    });

    it('sollte archivedAt Timestamp setzen bei erfolgreicher Archivierung', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockArchivalPolicy.canBeArchived.mockReturnValue(true);
      mockRepository.save.mockResolvedValue(Result.ok(undefined));
      mockEventPublisher.publishAll.mockResolvedValue(undefined);

      // Act
      const beforeArchive = new Date();
      await handler.execute(command);

      // Assert
      expect(einsatz.archivedAt).toBeDefined();
      expect(einsatz.archivedAt!.getTime()).toBeGreaterThanOrEqual(beforeArchive.getTime());
    });

    it('sollte Result.fail() zurückgeben bei Repository save Fehler', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, userId.value).value!;

      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));
      mockArchivalPolicy.canBeArchived.mockReturnValue(true);
      mockRepository.save.mockResolvedValue(Result.fail('Database error'));

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database error');
      expect(mockEventPublisher.publishAll).not.toHaveBeenCalled();
    });

    it('sollte Result.fail() zurückgeben bei ungültiger EinsatzId', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const command = ArchiveEinsatzCommand.create('invalid-id', userId.value).value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeTruthy();
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('sollte Result.fail() zurückgeben bei ungültiger UserId', async () => {
      // Arrange
      const einsatz = createMockEinsatz({
        status: EinsatzStatus.ABGESCHLOSSEN(),
        abgeschlossenYearsAgo: 11,
      });
      const command = ArchiveEinsatzCommand.create(einsatz.id.value, 'invalid-user-id').value!;

      // Act
      const result = await handler.execute(command);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBeTruthy();
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });
  });
});
