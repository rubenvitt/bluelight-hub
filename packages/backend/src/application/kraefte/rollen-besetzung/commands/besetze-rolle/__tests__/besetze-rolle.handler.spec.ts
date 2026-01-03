import { Test, type TestingModule } from '@nestjs/testing';
import { createId } from '@paralleldrive/cuid2';
import { Result } from '@domain/common/result';
import { KRAEFTE_REPOSITORIES, LOGGER, OUTBOX_REPOSITORY } from '@infrastructure/di-tokens';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { ROLLEN_BESETZUNG_ERROR_CODES } from '@domain/kraefte/common/rollen-besetzung-error-codes';
import { BesetzeRolleHandler } from '../besetze-rolle.handler';
import { BesetzeRolleCommand } from '../besetze-rolle.command';
import { RolleBesetzt } from '@domain/kraefte/events/rolle-besetzt.event';
import { RolleFreigegeben } from '@domain/kraefte/events/rolle-freigegeben.event';

describe('BesetzeRolleHandler', () => {
  let handler: BesetzeRolleHandler;

  // Mock Repositories - Using jest.Mocked<T> for type safety (AC6)
  let mockRollenBesetzungRepository: jest.Mocked<{
    save: jest.Mock;
    findById: jest.Mock;
    findByEinsatzId: jest.Mock;
    findByEinsatzIdAndRolleId: jest.Mock;
    delete: jest.Mock;
  }>;
  let mockEinsatzPersonRepository: jest.Mocked<{
    save: jest.Mock;
    findById: jest.Mock;
    findByEinsatzId: jest.Mock;
    existsByEinsatzIdAndStammId: jest.Mock;
  }>;
  let mockRollenDefinitionRepository: jest.Mocked<{
    findById: jest.Mock;
    findAll: jest.Mock;
    save: jest.Mock;
    exists: jest.Mock;
    existsByName: jest.Mock;
  }>;
  let mockOutboxRepository: jest.Mocked<{
    save: jest.Mock;
    findPendingEvents: jest.Mock;
    markAsPublished: jest.Mock;
    markAsFailed: jest.Mock;
    getRetryCount: jest.Mock;
  }>;
  let mockPrismaService: jest.Mocked<{
    $transaction: jest.Mock;
  }>;
  let mockLogger: jest.Mocked<{
    log: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
  }>;

  // Test Data - Deterministic test fixtures (AC6)
  const validEinsatzId = createId();
  const validEinsatzPersonId = createId();
  const validRollenDefinitionId = createId();
  const validBesetztVon = createId();
  const validQualifikationId = createId();

  /**
   * Erstellt ein Mock EinsatzPerson-Objekt
   */
  function createMockEinsatzPerson(overrides?: { id?: string; vorname?: string; nachname?: string; qualifikationIds?: string[] }) {
    return {
      id: { value: overrides?.id ?? validEinsatzPersonId },
      vorname: overrides?.vorname ?? 'Max',
      nachname: overrides?.nachname ?? 'Mustermann',
      qualifikationIds: overrides?.qualifikationIds ?? [validQualifikationId],
      funktion: 'Gruppenführer',
      stammId: createId(),
    };
  }

  /**
   * Erstellt ein Mock RollenDefinition-Objekt
   */
  function createMockRollenDefinition(overrides?: { id?: string; name?: string; erforderlicheQualifikationen?: Array<{ qualifikationId: string; istPflicht: boolean }> }) {
    return {
      id: { value: overrides?.id ?? validRollenDefinitionId },
      name: overrides?.name ?? 'Organisatorischer Leiter (OrgL)',
      kuerzel: 'OrgL',
      beschreibung: 'Organisatorische Einsatzleitung',
      erforderlicheQualifikationen: overrides?.erforderlicheQualifikationen ?? [{ qualifikationId: validQualifikationId, istPflicht: true }],
      isActive: true,
    };
  }

  beforeEach(async () => {
    // Mock Repositories initialisieren
    mockRollenBesetzungRepository = {
      save: jest.fn().mockResolvedValue(Result.ok(undefined)),
      findById: jest.fn(),
      findByEinsatzId: jest.fn(),
      findByEinsatzIdAndRolleId: jest.fn().mockResolvedValue(Result.ok(null)),
      delete: jest.fn().mockResolvedValue(Result.ok(undefined)),
    } as jest.Mocked<typeof mockRollenBesetzungRepository>;

    mockEinsatzPersonRepository = {
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(Result.ok(createMockEinsatzPerson())),
      findByEinsatzId: jest.fn(),
      existsByEinsatzIdAndStammId: jest.fn(),
    } as jest.Mocked<typeof mockEinsatzPersonRepository>;

    mockRollenDefinitionRepository = {
      findById: jest.fn().mockResolvedValue(Result.ok(createMockRollenDefinition())),
      findAll: jest.fn(),
      save: jest.fn(),
      exists: jest.fn(),
      existsByName: jest.fn(),
    } as jest.Mocked<typeof mockRollenDefinitionRepository>;

    mockOutboxRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findPendingEvents: jest.fn(),
      markAsPublished: jest.fn(),
      markAsFailed: jest.fn(),
      getRetryCount: jest.fn(),
    } as jest.Mocked<typeof mockOutboxRepository>;

    mockPrismaService = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        const txMock = {};
        return callback(txMock);
      }),
    } as jest.Mocked<typeof mockPrismaService>;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as jest.Mocked<typeof mockLogger>;

    // AC6: Clear mocks AFTER mock creation
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BesetzeRolleHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OUTBOX_REPOSITORY, useValue: mockOutboxRepository },
        { provide: KRAEFTE_REPOSITORIES.ROLLEN_BESETZUNG, useValue: mockRollenBesetzungRepository },
        { provide: KRAEFTE_REPOSITORIES.EINSATZ_PERSON, useValue: mockEinsatzPersonRepository },
        { provide: KRAEFTE_REPOSITORIES.ROLLEN_DEFINITION, useValue: mockRollenDefinitionRepository },
        { provide: LOGGER, useValue: mockLogger },
      ],
    }).compile();

    handler = module.get<BesetzeRolleHandler>(BesetzeRolleHandler);
  });

  describe('execute - Success Cases', () => {
    it('sollte Rolle erfolgreich besetzen wenn Person qualifiziert ist (AC1)', async () => {
      // Given (Arrange)
      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(mockRollenBesetzungRepository.save).toHaveBeenCalledTimes(1);
    });

    it('sollte RolleBesetzt Event in Outbox speichern (AC3)', async () => {
      // Given (Arrange)
      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(mockOutboxRepository.save).toHaveBeenCalledTimes(1);

      const events = mockOutboxRepository.save.mock.calls[0][0];
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(1);
      expect(events[0]).toBeInstanceOf(RolleBesetzt);
    });

    it('sollte Snapshot-Daten im Event speichern (AC3)', async () => {
      // Given (Arrange)
      mockEinsatzPersonRepository.findById.mockResolvedValue(Result.ok(createMockEinsatzPerson({ vorname: 'Anna', nachname: 'Schmidt' })));
      mockRollenDefinitionRepository.findById.mockResolvedValue(Result.ok(createMockRollenDefinition({ name: 'Leitender Notarzt (LNA)' })));

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);

      const savedBesetzung = mockRollenBesetzungRepository.save.mock.calls[0][0];
      expect(savedBesetzung.personVorname).toBe('Anna');
      expect(savedBesetzung.personNachname).toBe('Schmidt');
      expect(savedBesetzung.rollenName).toBe('Leitender Notarzt (LNA)');
    });

    it('sollte bestehende Besetzung automatisch freigeben (AC4)', async () => {
      // Given (Arrange)
      const existingBesetzungId = createId();
      const existingBesetzung = {
        id: { value: existingBesetzungId },
        einsatzId: { value: validEinsatzId },
        einsatzPersonId: { value: createId() },
        rolleId: { value: validRollenDefinitionId },
        rollenName: 'OrgL',
        personVorname: 'Alter',
        personNachname: 'Besetzter',
        createdBy: createId(),
        freigeben: jest.fn().mockReturnValue(Result.ok(undefined)),
        getDomainEvents: jest.fn().mockReturnValue([]),
        clearDomainEvents: jest.fn(),
      };

      mockRollenBesetzungRepository.findByEinsatzIdAndRolleId.mockResolvedValue(Result.ok(existingBesetzung));

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(existingBesetzung.freigeben).toHaveBeenCalledWith(validBesetztVon);
      expect(mockRollenBesetzungRepository.delete).toHaveBeenCalledWith(expect.objectContaining({ value: existingBesetzungId }), expect.anything());
      expect(mockRollenBesetzungRepository.save).toHaveBeenCalledTimes(1);
    });

    it('sollte RolleFreigegeben Event bei Auto-Freigabe emittieren (AC4)', async () => {
      // Given (Arrange)
      const freigegebenEvent = new RolleFreigegeben(validEinsatzId, createId(), validRollenDefinitionId, 'OrgL', 'Alt', 'Person', validBesetztVon);

      const existingBesetzung = {
        id: { value: createId() },
        einsatzId: { value: validEinsatzId },
        einsatzPersonId: { value: createId() },
        rolleId: { value: validRollenDefinitionId },
        rollenName: 'OrgL',
        personVorname: 'Alt',
        personNachname: 'Person',
        createdBy: createId(),
        freigeben: jest.fn().mockReturnValue(Result.ok(undefined)),
        getDomainEvents: jest.fn().mockReturnValue([freigegebenEvent]),
        clearDomainEvents: jest.fn(),
      };

      mockRollenBesetzungRepository.findByEinsatzIdAndRolleId.mockResolvedValue(Result.ok(existingBesetzung));

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);

      const events = mockOutboxRepository.save.mock.calls[0][0];
      expect(events.length).toBe(2); // RolleFreigegeben + RolleBesetzt
      expect(events[0]).toBeInstanceOf(RolleFreigegeben);
      expect(events[1]).toBeInstanceOf(RolleBesetzt);
    });
  });

  describe('execute - Qualifikationsprüfung (AC1)', () => {
    it('sollte fehlschlagen wenn Person Pflicht-Qualifikation nicht hat', async () => {
      // Given (Arrange)
      const requiredQualifikation = createId();
      mockRollenDefinitionRepository.findById.mockResolvedValue(
        Result.ok(
          createMockRollenDefinition({
            erforderlicheQualifikationen: [{ qualifikationId: requiredQualifikation, istPflicht: true }],
          }),
        ),
      );
      mockEinsatzPersonRepository.findById.mockResolvedValue(
        Result.ok(createMockEinsatzPerson({ qualifikationIds: [] })), // Keine Qualifikationen
      );

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ROLLEN_BESETZUNG_ERROR_CODES.PERSON_NOT_QUALIFIED);
      expect(mockRollenBesetzungRepository.save).not.toHaveBeenCalled();
    });

    it('sollte erfolgreich sein wenn Person alle Pflicht-Qualifikationen hat', async () => {
      // Given (Arrange)
      const requiredQuali1 = createId();
      const requiredQuali2 = createId();
      mockRollenDefinitionRepository.findById.mockResolvedValue(
        Result.ok(
          createMockRollenDefinition({
            erforderlicheQualifikationen: [
              { qualifikationId: requiredQuali1, istPflicht: true },
              { qualifikationId: requiredQuali2, istPflicht: true },
            ],
          }),
        ),
      );
      mockEinsatzPersonRepository.findById.mockResolvedValue(Result.ok(createMockEinsatzPerson({ qualifikationIds: [requiredQuali1, requiredQuali2] })));

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
    });

    it('sollte optionale Qualifikationen ignorieren', async () => {
      // Given (Arrange)
      const pflichtQuali = createId();
      const optionalQuali = createId();
      mockRollenDefinitionRepository.findById.mockResolvedValue(
        Result.ok(
          createMockRollenDefinition({
            erforderlicheQualifikationen: [
              { qualifikationId: pflichtQuali, istPflicht: true },
              { qualifikationId: optionalQuali, istPflicht: false }, // Optional
            ],
          }),
        ),
      );
      mockEinsatzPersonRepository.findById.mockResolvedValue(
        Result.ok(createMockEinsatzPerson({ qualifikationIds: [pflichtQuali] })), // Nur Pflicht
      );

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('execute - Error Cases', () => {
    it('sollte fehlschlagen wenn EinsatzPerson nicht gefunden', async () => {
      // Given (Arrange)
      mockEinsatzPersonRepository.findById.mockResolvedValue(Result.ok(null));

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ROLLEN_BESETZUNG_ERROR_CODES.PERSON_NOT_FOUND);
      expect(mockRollenBesetzungRepository.save).not.toHaveBeenCalled();
    });

    it('sollte fehlschlagen wenn RollenDefinition nicht gefunden', async () => {
      // Given (Arrange)
      mockRollenDefinitionRepository.findById.mockResolvedValue(Result.ok(null));

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ROLLEN_BESETZUNG_ERROR_CODES.ROLLE_NOT_FOUND);
      expect(mockRollenBesetzungRepository.save).not.toHaveBeenCalled();
    });

    it('sollte fehlschlagen wenn EinsatzPersonRepository Fehler zurückgibt', async () => {
      // Given (Arrange)
      // Repository-Fehler werden als PERSON_NOT_FOUND abstrahiert (vereinfachtes Error-Handling)
      mockEinsatzPersonRepository.findById.mockResolvedValue(Result.fail('Datenbankfehler'));

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      // Handler abstrahiert DB-Fehler zu domänenspezifischem Error-Code
      expect(result.error).toBe(ROLLEN_BESETZUNG_ERROR_CODES.PERSON_NOT_FOUND);
    });

    it('sollte fehlschlagen wenn Repository.save fehlschlägt', async () => {
      // Given (Arrange)
      mockRollenBesetzungRepository.save.mockResolvedValue(Result.fail('UNIQUE_CONSTRAINT_VIOLATION'));

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('UNIQUE_CONSTRAINT_VIOLATION');
    });
  });

  describe('Transaction Behavior (AC3)', () => {
    it('sollte $transaction aufrufen', async () => {
      // Given (Arrange)
      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('sollte Repositories mit Transaction Context aufrufen', async () => {
      // Given (Arrange)
      let capturedTxContext: unknown;
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const txMock = { _type: 'TransactionContext' };
        capturedTxContext = txMock;
        return callback(txMock);
      });

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      await handler.execute(command);

      // Then (Assert)
      expect(mockEinsatzPersonRepository.findById).toHaveBeenCalledWith(expect.anything(), capturedTxContext);
      expect(mockRollenDefinitionRepository.findById).toHaveBeenCalledWith(expect.anything(), capturedTxContext);
      expect(mockRollenBesetzungRepository.save).toHaveBeenCalledWith(expect.anything(), capturedTxContext);
    });
  });

  describe('Event Properties (TD2.7 - AC1)', () => {
    it('sollte RolleBesetzt Event mit korrekten Properties erstellen', async () => {
      // Given (Arrange)
      mockEinsatzPersonRepository.findById.mockResolvedValue(Result.ok(createMockEinsatzPerson({ vorname: 'Anna', nachname: 'Schmidt' })));
      mockRollenDefinitionRepository.findById.mockResolvedValue(Result.ok(createMockRollenDefinition({ name: 'Leitender Notarzt (LNA)' })));

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);

      const events = mockOutboxRepository.save.mock.calls[0][0];
      expect(events.length).toBe(1);

      const rolleBesetztEvent = events[0] as RolleBesetzt;
      expect(rolleBesetztEvent.einsatzId).toBe(validEinsatzId);
      expect(rolleBesetztEvent.einsatzPersonId).toBe(validEinsatzPersonId);
      expect(rolleBesetztEvent.rollenDefinitionId).toBe(validRollenDefinitionId);
      expect(rolleBesetztEvent.rollenName).toBe('Leitender Notarzt (LNA)');
      expect(rolleBesetztEvent.personVorname).toBe('Anna');
      expect(rolleBesetztEvent.personNachname).toBe('Schmidt');
      expect(rolleBesetztEvent.besetztVon).toBe(validBesetztVon);
    });

    it('sollte RolleFreigegeben Event Properties bei Auto-Freigabe korrekt setzen', async () => {
      // Given (Arrange)
      const altPersonId = createId();
      const freigegebenEvent = new RolleFreigegeben(validEinsatzId, altPersonId, validRollenDefinitionId, 'OrgL', 'Alt', 'Person', validBesetztVon);

      const existingBesetzung = {
        id: { value: createId() },
        einsatzId: { value: validEinsatzId },
        einsatzPersonId: { value: altPersonId },
        rolleId: { value: validRollenDefinitionId },
        rollenName: 'OrgL',
        personVorname: 'Alt',
        personNachname: 'Person',
        createdBy: createId(),
        freigeben: jest.fn().mockReturnValue(Result.ok(undefined)),
        getDomainEvents: jest.fn().mockReturnValue([freigegebenEvent]),
        clearDomainEvents: jest.fn(),
      };

      mockRollenBesetzungRepository.findByEinsatzIdAndRolleId.mockResolvedValue(Result.ok(existingBesetzung));

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);

      const events = mockOutboxRepository.save.mock.calls[0][0];
      expect(events.length).toBe(2);

      // Erstes Event: RolleFreigegeben (alte Besetzung)
      const freigegebenEvt = events[0] as RolleFreigegeben;
      expect(freigegebenEvt.einsatzId).toBe(validEinsatzId);
      expect(freigegebenEvt.einsatzPersonId).toBe(altPersonId);
      expect(freigegebenEvt.rollenDefinitionId).toBe(validRollenDefinitionId);
      expect(freigegebenEvt.rollenName).toBe('OrgL');
      expect(freigegebenEvt.personVorname).toBe('Alt');
      expect(freigegebenEvt.personNachname).toBe('Person');
      expect(freigegebenEvt.freigegebenVon).toBe(validBesetztVon);

      // Zweites Event: RolleBesetzt (neue Besetzung)
      const besetztEvt = events[1] as RolleBesetzt;
      expect(besetztEvt.einsatzId).toBe(validEinsatzId);
      expect(besetztEvt.einsatzPersonId).toBe(validEinsatzPersonId);
      expect(besetztEvt.besetztVon).toBe(validBesetztVon);
    });

    it('sollte Event-Reihenfolge einhalten: RolleFreigegeben vor RolleBesetzt', async () => {
      // Given (Arrange)
      const freigegebenEvent = new RolleFreigegeben(validEinsatzId, createId(), validRollenDefinitionId, 'OrgL', 'Alt', 'Person', validBesetztVon);

      const existingBesetzung = {
        id: { value: createId() },
        einsatzId: { value: validEinsatzId },
        einsatzPersonId: { value: createId() },
        rolleId: { value: validRollenDefinitionId },
        rollenName: 'OrgL',
        personVorname: 'Alt',
        personNachname: 'Person',
        createdBy: createId(),
        freigeben: jest.fn().mockReturnValue(Result.ok(undefined)),
        getDomainEvents: jest.fn().mockReturnValue([freigegebenEvent]),
        clearDomainEvents: jest.fn(),
      };

      mockRollenBesetzungRepository.findByEinsatzIdAndRolleId.mockResolvedValue(Result.ok(existingBesetzung));

      const command = BesetzeRolleCommand.create({
        einsatzId: validEinsatzId,
        einsatzPersonId: validEinsatzPersonId,
        rollenDefinitionId: validRollenDefinitionId,
        besetztVon: validBesetztVon,
      }).value!;

      // When (Act)
      const result = await handler.execute(command);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);

      const events = mockOutboxRepository.save.mock.calls[0][0];

      // Reihenfolge kritisch fuer ETB-Eintraege: Freigabe vor Neubesetzung
      expect(events[0].constructor.name).toBe('RolleFreigegeben');
      expect(events[1].constructor.name).toBe('RolleBesetzt');
    });
  });
});
