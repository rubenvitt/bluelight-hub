import { Test, type TestingModule } from '@nestjs/testing';
import { CreateEinsatzHandler } from '../create-einsatz.handler';
import { CreateEinsatzCommand } from '../create-einsatz.command';
import { Result } from '@domain/common/result';
import { UserId } from '@domain/value-objects/user-id';
import { PrismaService } from '@/prisma/prisma.service';
import { EinsatzValidationException, EinsatzPersistenceException } from '@domain/common/exceptions';
import { Address } from '@domain/value-objects/address';
import { EINSATZ_FIELD_LIMITS } from '@application/common/validators/string-validator';
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import { EINSATZ_REPOSITORY, OUTBOX_REPOSITORY } from '@/infrastructure/di-tokens';

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
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: EINSATZ_REPOSITORY, useValue: mockRepository },
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

    it('sollte Einsatz mit optionalen Feldern erstellen (einsatzort, bemerkung)', async () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const einsatzort = Address.create({
        strasse: 'Musterstraße',
        hausnummer: '42',
        plz: '80331',
        ort: 'München',
      }).value!;
      const bemerkung = 'Dachstuhl brennt';
      const command = CreateEinsatzCommand.create('Wohnungsbrand', userId.value, einsatzort, bemerkung).value!;

      // Act (When)
      const einsatzId = await handler.execute(command);

      // Assert (Then)
      expect(einsatzId).toBeDefined();
      const savedAggregate = mockRepository.save.mock.calls[0][0];
      expect(savedAggregate.einsatzort).toBeDefined();
      expect(savedAggregate.einsatzort.strasse).toBe('Musterstraße');
      expect(savedAggregate.bemerkung).toBe('Dachstuhl brennt');
    });

    it('sollte Repository.save() einmal aufrufen mit Aggregate und Transaction-Context', async () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Brand', userId.value).value!;

      // Act (When)
      await handler.execute(command);

      // Assert (Then)
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      // Erster Parameter ist das Aggregate
      const savedAggregate = mockRepository.save.mock.calls[0][0];
      expect(savedAggregate.alarmstichwort).toBe('Brand');
      // Zweiter Parameter ist der tx-Context (leeres Objekt in Mock)
      const txContext = mockRepository.save.mock.calls[0][1];
      expect(txContext).toBeDefined();
    });

    it('sollte OutboxRepository.save() einmal aufrufen mit Domain Events und tx-Context', async () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Verkehrsunfall', userId.value).value!;

      // Act (When)
      await handler.execute(command);

      // Assert (Then)
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      // Erster Parameter ist das Event-Array
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(Array.isArray(savedEvents)).toBe(true);
      expect(savedEvents.length).toBe(1);
      // Zweiter Parameter ist der tx-Context
      const txContext = mockOutboxRepository.save.mock.calls[0][1];
      expect(txContext).toBeDefined();
    });

    it('sollte EinsatzCreatedEvent mit korrektem Payload erstellen', async () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const alarmstichwort = 'THL Ölspur';
      const command = CreateEinsatzCommand.create(alarmstichwort, userId.value).value!;

      // Act (When)
      await handler.execute(command);

      // Assert (Then)
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents.length).toBe(1);
      const createdEvent = savedEvents[0];

      // Event-Typ prüfen
      expect(createdEvent).toBeInstanceOf(EinsatzCreatedEvent);

      // Event-Payload prüfen
      expect(createdEvent.einsatzId).toBeDefined();
      expect(createdEvent.createdBy).toBeDefined();
      expect(createdEvent.createdBy.value).toBe(userId.value);
      expect(createdEvent.alarmstichwort).toBe(alarmstichwort);
      expect(createdEvent.nummer).toBeDefined();

      // Nummer-Format prüfen
      const currentYear = new Date().getFullYear();
      expect(createdEvent.nummer).toMatch(new RegExp(`^E${currentYear}-[a-z0-9]{8}$`));
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

    it('sollte Result.fail bei zu langem alarmstichwort zurückgeben', () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const tooLongAlarmstichwort = 'A'.repeat(EINSATZ_FIELD_LIMITS.ALARMSTICHWORT_MAX_LENGTH + 1);

      // Act (When)
      const result = CreateEinsatzCommand.create(tooLongAlarmstichwort, userId.value);

      // Assert (Then)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(`Alarmstichwort darf maximal ${EINSATZ_FIELD_LIMITS.ALARMSTICHWORT_MAX_LENGTH} Zeichen lang sein`);
    });

    it('sollte Result.fail bei zu langer bemerkung zurückgeben', () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const tooLongBemerkung = 'B'.repeat(EINSATZ_FIELD_LIMITS.BEMERKUNG_MAX_LENGTH + 1);

      // Act (When)
      const result = CreateEinsatzCommand.create('Wohnungsbrand', userId.value, undefined, tooLongBemerkung);

      // Assert (Then)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(`Bemerkung darf maximal ${EINSATZ_FIELD_LIMITS.BEMERKUNG_MAX_LENGTH} Zeichen lang sein`);
    });

    it('sollte Result.fail bei whitespace-only alarmstichwort zurückgeben', () => {
      // Arrange (Given)
      const userId = UserId.create().value!;

      // Act (When)
      const result = CreateEinsatzCommand.create('   ', userId.value);

      // Assert (Then)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Alarmstichwort ist erforderlich');
    });

    it('sollte Command erfolgreich erstellen bei maximal erlaubter alarmstichwort Länge', () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const maxLengthAlarmstichwort = 'A'.repeat(EINSATZ_FIELD_LIMITS.ALARMSTICHWORT_MAX_LENGTH);

      // Act (When)
      const result = CreateEinsatzCommand.create(maxLengthAlarmstichwort, userId.value);

      // Assert (Then)
      expect(result.isSuccess).toBe(true);
      expect(result.value?.alarmstichwort).toBe(maxLengthAlarmstichwort);
    });
  });

  describe('Error Handling', () => {
    describe('Validation Errors', () => {
      it('sollte EinsatzValidationException bei ungültiger User-ID werfen', async () => {
        // Arrange
        const command = CreateEinsatzCommand.create('Wohnungsbrand', 'invalid-user-id-format').value!;

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzValidationException);
        await expect(handler.execute(command)).rejects.toMatchObject({
          name: 'EinsatzValidationException',
          field: 'createdBy',
        });
        expect(mockRepository.save).not.toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte Command Validation fehlschlagen bei leerem alarmstichwort', () => {
        // Arrange & Act - Command Validation sollte bereits fehlschlagen
        const userId = UserId.create().value!;
        const result = CreateEinsatzCommand.create('   ', userId.value);

        // Assert - Command creation fails before handler execution
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Alarmstichwort ist erforderlich');
      });
    });

    describe('Repository/DB Errors', () => {
      it('sollte EinsatzPersistenceException bei Repository.save Fehler werfen', async () => {
        // Arrange
        const userId = UserId.create().value!;
        const command = CreateEinsatzCommand.create('Wohnungsbrand', userId.value).value!;
        mockRepository.save.mockResolvedValue(Result.fail('DB connection error'));

        // Act & Assert
        await expect(handler.execute(command)).rejects.toThrow(EinsatzPersistenceException);
        await expect(handler.execute(command)).rejects.toMatchObject({
          name: 'EinsatzPersistenceException',
        });
        // Repository wurde aufgerufen, aber Fehler führt zu Transaction Rollback
        expect(mockRepository.save).toHaveBeenCalled();
        // Events werden nicht gespeichert bei Fehler
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });

      it('sollte EinsatzPersistenceException mit einsatzId bei DB Fehler werfen', async () => {
        // Arrange
        const userId = UserId.create().value!;
        const command = CreateEinsatzCommand.create('Verkehrsunfall', userId.value).value!;
        mockRepository.save.mockResolvedValue(Result.fail('Database write failed'));

        // Act & Assert
        const error = await handler.execute(command).catch((e) => e);
        expect(error).toBeInstanceOf(EinsatzPersistenceException);
        expect(error.aggregateId).toBeDefined();
        expect(error.operation).toBe('persist');
      });

      it('sollte Outbox.save() NICHT aufrufen bei Repository Fehler', async () => {
        // Arrange (Given)
        const userId = UserId.create().value!;
        const command = CreateEinsatzCommand.create('Wohnungsbrand', userId.value).value!;
        mockRepository.save.mockResolvedValue(Result.fail('Database error'));

        // Act (When)
        await handler.execute(command).catch(() => {});

        // Assert (Then)
        expect(mockRepository.save).toHaveBeenCalled();
        expect(mockOutboxRepository.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('Transaction Behavior', () => {
    it('sollte prisma.$transaction() einmal aufrufen', async () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Wohnungsbrand', userId.value).value!;

      // Act (When)
      await handler.execute(command);

      // Assert (Then)
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('sollte Transaction-Callback mit tx-Context ausführen', async () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Verkehrsunfall', userId.value).value!;
      let receivedTxContext: unknown;
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const txMock = { isTxMock: true };
        receivedTxContext = txMock;
        return callback(txMock);
      });

      // Act (When)
      await handler.execute(command);

      // Assert (Then)
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(receivedTxContext).toBeDefined();
      expect((receivedTxContext as { isTxMock: boolean }).isTxMock).toBe(true);
    });

    it('sollte Repository.save() mit tx-Context als zweiten Parameter aufrufen', async () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Brand', userId.value).value!;
      const txMarker = { txMarker: 'test-tx' };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

      // Act (When)
      await handler.execute(command);

      // Assert (Then)
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const txContext = mockRepository.save.mock.calls[0][1];
      expect(txContext).toBe(txMarker);
    });

    it('sollte OutboxRepository.save() mit tx-Context als zweiten Parameter aufrufen', async () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Hilfeleistung', userId.value).value!;
      const txMarker = { txMarker: 'outbox-tx' };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

      // Act (When)
      await handler.execute(command);

      // Assert (Then)
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);
      const txContext = mockOutboxRepository.save.mock.calls[0][1];
      expect(txContext).toBe(txMarker);
    });

    it('sollte bei Exception keine Events speichern (Transaction Rollback)', async () => {
      // Arrange (Given)
      const command = CreateEinsatzCommand.create('Wohnungsbrand', 'invalid-user-id').value!;

      // Act (When)
      await handler.execute(command).catch(() => {});

      // Assert (Then)
      // Bei Validation-Fehler wird Transaction abgebrochen
      expect(mockOutboxRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Outbox Integration', () => {
    it('sollte genau ein EinsatzCreatedEvent im Event-Array haben', async () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Brand', userId.value).value!;

      // Act (When)
      await handler.execute(command);

      // Assert (Then)
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      expect(savedEvents.length).toBe(1);
      expect(savedEvents[0]).toBeInstanceOf(EinsatzCreatedEvent);
    });

    it('sollte Event mit aggregateId speichern', async () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Verkehrsunfall', userId.value).value!;

      // Act (When)
      const einsatzId = await handler.execute(command);

      // Assert (Then)
      const savedEvents = mockOutboxRepository.save.mock.calls[0][0];
      const createdEvent = savedEvents[0] as EinsatzCreatedEvent;
      expect(createdEvent.einsatzId.value).toBe(einsatzId);
    });

    it('sollte Event innerhalb der gleichen Transaction speichern', async () => {
      // Arrange (Given)
      const userId = UserId.create().value!;
      const command = CreateEinsatzCommand.create('Hilfeleistung', userId.value).value!;
      const txMarker = { txId: 'same-tx' };
      mockPrismaService.$transaction.mockImplementation(async (callback) => callback(txMarker));

      // Act (When)
      await handler.execute(command);

      // Assert (Then)
      // Beide Saves sollten den gleichen tx-Context erhalten
      const repoTxContext = mockRepository.save.mock.calls[0][1];
      const outboxTxContext = mockOutboxRepository.save.mock.calls[0][1];
      expect(repoTxContext).toBe(txMarker);
      expect(outboxTxContext).toBe(txMarker);
    });
  });
});
