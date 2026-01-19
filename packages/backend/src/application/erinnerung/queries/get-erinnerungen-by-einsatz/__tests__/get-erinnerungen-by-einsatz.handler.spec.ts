import { GetErinnerungenByEinsatzHandler } from '../get-erinnerungen-by-einsatz.handler';
import { GetErinnerungenByEinsatzQuery } from '../get-erinnerungen-by-einsatz.query';
import { Result } from '@domain/common/result';
import { Erinnerung } from '@domain/entities/erinnerung.entity';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { ErinnerungStatus } from '@domain/value-objects/erinnerung-status';
import { ErinnerungTitel } from '@domain/value-objects/erinnerung-titel';
import { UserId } from '@domain/value-objects/user-id';
import { ERINNERUNG_ERROR_CODES } from '../../../errors/erinnerung-error.codes';
import type { IErinnerungRepository } from '@domain/repositories/i-erinnerung.repository';
import type { ILogger } from '@domain/ports/i-logger.port';

/**
 * Helper: Erstellt eine Mock-Erinnerung für Tests.
 *
 * Kapseliert die Aggregate-Rekonstruktion um Tests lesbarer zu machen.
 * Nutzt reconstruct() da wir keine Domain-Events emittieren wollen.
 *
 * @param overrides - Optionale Überschreibungen der Default-Werte
 * @returns Erinnerung Entity
 */
function createMockErinnerung(overrides?: {
  id?: ErinnerungId;
  einsatzId?: EinsatzId;
  titel?: string;
  beschreibung?: string | null;
  faelligAm?: Date;
  status?: ErinnerungStatus;
  erstelltVon?: UserId;
  createdAt?: Date;
  updatedAt?: Date;
}): Erinnerung {
  const id = overrides?.id ?? ErinnerungId.create().value!;
  const einsatzId = overrides?.einsatzId ?? EinsatzId.create().value!;
  const titel = ErinnerungTitel.create(overrides?.titel ?? 'Test Erinnerung').value!;
  const erstelltVon = overrides?.erstelltVon ?? UserId.create().value!;
  const now = new Date();

  return Erinnerung.reconstruct({
    id,
    einsatzId,
    titel,
    beschreibung: overrides?.beschreibung ?? null,
    faelligAm: overrides?.faelligAm ?? new Date(Date.now() + 30 * 60 * 1000),
    status: overrides?.status ?? ErinnerungStatus.GEPLANT(),
    erstelltVon,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
  });
}

/**
 * Generiert eine gültige CUID2 ID für Tests.
 * Nutzt EinsatzId.create() um eine echte CUID2 zu generieren.
 */
const generateValidCuid = () => EinsatzId.create().value!.toString();

/**
 * Unit Tests für GetErinnerungenByEinsatzHandler.
 *
 * Testet die Query Handler Orchestrierung gemäß AAA Pattern mit Given-When-Then Kommentaren.
 * Nutzt Mock Repository für Unit Test Isolation (AC6 Compliance).
 *
 * **Test Coverage:**
 * - Happy Path: Erinnerungen für Einsatz abrufen
 * - Empty Result: Keine Erinnerungen vorhanden
 * - Error Handling: Invalid EinsatzId, Repository Errors
 */
describe('GetErinnerungenByEinsatzHandler', () => {
  let handler: GetErinnerungenByEinsatzHandler;
  let mockRepository: jest.Mocked<IErinnerungRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Repository mit allen benötigten Methods
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEinsatzId: jest.fn(),
      exists: jest.fn(),
    } as jest.Mocked<IErinnerungRepository>;

    // Mock Logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<ILogger>;

    handler = new GetErinnerungenByEinsatzHandler(mockRepository, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return erinnerungen for einsatz', async () => {
      // Given (Arrange)
      const einsatzId = EinsatzId.create().value!;
      const erinnerung1 = createMockErinnerung({
        einsatzId,
        titel: 'Lagebesprechung',
        faelligAm: new Date(Date.now() + 30 * 60 * 1000),
      });
      const erinnerung2 = createMockErinnerung({
        einsatzId,
        titel: 'Ablösung',
        faelligAm: new Date(Date.now() + 60 * 60 * 1000),
      });

      mockRepository.findByEinsatzId.mockResolvedValue(Result.ok([erinnerung1, erinnerung2]));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId: einsatzId.toString(),
      });
      expect(queryResult.isSuccess).toBe(true);
      const query = queryResult.value!;

      // When (Act)
      const result = await handler.execute(query);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);

      const dtos = result.value!;
      expect(dtos[0].titel).toBe('Lagebesprechung');
      expect(dtos[1].titel).toBe('Ablösung');

      expect(mockRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should return empty array when no erinnerungen exist', async () => {
      // Given (Arrange)
      const einsatzId = generateValidCuid();
      mockRepository.findByEinsatzId.mockResolvedValue(Result.ok([]));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId,
      });
      const query = queryResult.value!;

      // When (Act)
      const result = await handler.execute(query);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
      expect(result.value!.length).toBe(0);
      expect(mockRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
    });

    it('should fail when einsatzId is invalid', async () => {
      // Given (Arrange)
      const invalidEinsatzId = 'invalid-id';

      // Query Validation sollte bereits fehlschlagen
      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId: invalidEinsatzId,
      });

      // Then (Assert)
      expect(queryResult.isFailure).toBe(true);
      expect(queryResult.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
    });

    it('should fail when einsatzId is empty', async () => {
      // Given (Arrange)
      const emptyEinsatzId = '';

      // Query Validation sollte bereits fehlschlagen
      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId: emptyEinsatzId,
      });

      // Then (Assert)
      expect(queryResult.isFailure).toBe(true);
      expect(queryResult.error).toBe(ERINNERUNG_ERROR_CODES.QUERY_EINSATZ_ID_REQUIRED);
    });

    it('should fail when repository returns error', async () => {
      // Given (Arrange)
      const einsatzId = generateValidCuid();
      mockRepository.findByEinsatzId.mockResolvedValue(Result.fail('Database connection failed'));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId,
      });
      const query = queryResult.value!;

      // When (Act)
      const result = await handler.execute(query);

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should let unexpected errors bubble up (AC4 compliance)', async () => {
      // Given (Arrange)
      // AC4: Unerwartete Fehler (DB-Fehler, Netzwerk) sollen hochblubbern,
      // damit der NestJS Exception Filter sie behandelt.
      const einsatzId = generateValidCuid();
      mockRepository.findByEinsatzId.mockRejectedValue(new Error('Unexpected DB error'));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId,
      });
      const query = queryResult.value!;

      // When & Then (Act & Assert)
      // Exception soll hochblubbern, nicht in Result.fail() konvertiert werden
      await expect(handler.execute(query)).rejects.toThrow('Unexpected DB error');
    });
  });

  describe('DTO Mapping', () => {
    it('should map all entity fields to DTO correctly', async () => {
      // Given (Arrange)
      const einsatzId = EinsatzId.create().value!;
      const faelligAm = new Date(Date.now() + 30 * 60 * 1000);
      const createdAt = new Date('2026-01-19T10:00:00.000Z');
      const updatedAt = new Date('2026-01-19T10:30:00.000Z');

      const erinnerung = createMockErinnerung({
        einsatzId,
        titel: 'Wichtige Besprechung',
        beschreibung: 'Im Führungsraum',
        faelligAm,
        status: ErinnerungStatus.GEPLANT(),
        createdAt,
        updatedAt,
      });

      mockRepository.findByEinsatzId.mockResolvedValue(Result.ok([erinnerung]));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId: einsatzId.toString(),
      });
      const query = queryResult.value!;

      // When (Act)
      const result = await handler.execute(query);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      const dto = result.value![0];
      expect(dto.id).toBe(erinnerung.id.toString());
      expect(dto.einsatzId).toBe(einsatzId.toString());
      expect(dto.titel).toBe('Wichtige Besprechung');
      expect(dto.beschreibung).toBe('Im Führungsraum');
      expect(dto.faelligAm).toBe(faelligAm.toISOString());
      expect(dto.status).toBe('GEPLANT');
      expect(dto.erstelltVon).toBe(erinnerung.erstelltVon.toString());
      expect(dto.createdAt).toBe(createdAt.toISOString());
      expect(dto.updatedAt).toBe(updatedAt.toISOString());
    });

    it('should handle null beschreibung correctly', async () => {
      // Given (Arrange)
      const einsatzId = EinsatzId.create().value!;

      const erinnerung = createMockErinnerung({
        einsatzId,
        beschreibung: null,
      });

      mockRepository.findByEinsatzId.mockResolvedValue(Result.ok([erinnerung]));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId: einsatzId.toString(),
      });
      const query = queryResult.value!;

      // When (Act)
      const result = await handler.execute(query);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].beschreibung).toBeNull();
    });
  });

  describe('Orchestrierung-Verifikation', () => {
    it('should call repository.findByEinsatzId exactly once', async () => {
      // Given (Arrange)
      const einsatzId = generateValidCuid();
      mockRepository.findByEinsatzId.mockResolvedValue(Result.ok([]));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId,
      });
      const query = queryResult.value!;

      // When (Act)
      await handler.execute(query);

      // Then (Assert)
      expect(mockRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
    });

    it('should pass correct EinsatzId to repository', async () => {
      // Given (Arrange)
      // Nutze EinsatzId.create() für konsistentes CUID Format
      const einsatzIdResult = EinsatzId.create();
      expect(einsatzIdResult.isSuccess).toBe(true);
      const einsatzId = einsatzIdResult.value!;

      mockRepository.findByEinsatzId.mockResolvedValue(Result.ok([]));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId: einsatzId.toString(),
      });
      expect(queryResult.isSuccess).toBe(true);
      const query = queryResult.value!;

      // When (Act)
      await handler.execute(query);

      // Then (Assert)
      expect(mockRepository.findByEinsatzId).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            value: einsatzId.value,
          }),
        }),
      );
    });

    it('should NOT call save() method (Read-Only Query)', async () => {
      // Given (Arrange)
      const einsatzId = generateValidCuid();
      mockRepository.findByEinsatzId.mockResolvedValue(Result.ok([]));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId,
      });
      const query = queryResult.value!;

      // When (Act)
      await handler.execute(query);

      // Then (Assert)
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('Query Validation', () => {
    it('should accept valid CUID2 einsatzId', () => {
      // Given & When (Arrange & Act)
      const validEinsatzId = generateValidCuid();
      const result = GetErinnerungenByEinsatzQuery.create({
        einsatzId: validEinsatzId,
      });

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.einsatzId).toBe(validEinsatzId);
    });

    it('should reject short einsatzId', () => {
      // Given & When (Arrange & Act)
      const shortId = 'abc123'; // Zu kurz für CUID2
      const result = GetErinnerungenByEinsatzQuery.create({
        einsatzId: shortId,
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
    });

    it('should reject einsatzId with uppercase', () => {
      // Given & When (Arrange & Act)
      const uppercaseId = 'ABCDEFGHIJKLMNOPQRSTUVWXY'; // CUID2 ist lowercase
      const result = GetErinnerungenByEinsatzQuery.create({
        einsatzId: uppercaseId,
      });

      // Then (Assert)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
    });

    it('should trim whitespace from einsatzId', () => {
      // Given & When (Arrange & Act)
      const validIdWithWhitespace = `  ${generateValidCuid()}  `;
      const result = GetErinnerungenByEinsatzQuery.create({
        einsatzId: validIdWithWhitespace,
      });

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value!.einsatzId).not.toContain(' ');
    });
  });

  describe('Logging', () => {
    it('should log successful query execution', async () => {
      // Given (Arrange)
      const einsatzId = generateValidCuid();
      mockRepository.findByEinsatzId.mockResolvedValue(Result.ok([]));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId,
      });
      const query = queryResult.value!;

      // When (Act)
      await handler.execute(query);

      // Then (Assert)
      expect(mockLogger.log).toHaveBeenCalled();
      const logCall = mockLogger.log.mock.calls[0][0];
      expect(logCall).toContain('Erinnerungen abgerufen');
      expect(logCall).toContain(einsatzId);
    });

    it('should log error on repository failure', async () => {
      // Given (Arrange)
      const einsatzId = generateValidCuid();
      mockRepository.findByEinsatzId.mockResolvedValue(Result.fail('DB error'));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId,
      });
      const query = queryResult.value!;

      // When (Act)
      await handler.execute(query);

      // Then (Assert)
      expect(mockLogger.error).toHaveBeenCalled();
      const errorCall = mockLogger.error.mock.calls[0][0];
      expect(errorCall).toContain('Failed to load Erinnerungen');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple erinnerungen with different statuses', async () => {
      // Given (Arrange)
      const einsatzId = EinsatzId.create().value!;

      const erinnerung1 = createMockErinnerung({
        einsatzId,
        titel: 'Geplant',
        status: ErinnerungStatus.GEPLANT(),
      });
      const erinnerung2 = createMockErinnerung({
        einsatzId,
        titel: 'Ausgelöst',
        status: ErinnerungStatus.AUSGELOEST(),
      });
      const erinnerung3 = createMockErinnerung({
        einsatzId,
        titel: 'Erledigt',
        status: ErinnerungStatus.ERLEDIGT(),
      });

      mockRepository.findByEinsatzId.mockResolvedValue(Result.ok([erinnerung1, erinnerung2, erinnerung3]));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId: einsatzId.toString(),
      });
      const query = queryResult.value!;

      // When (Act)
      const result = await handler.execute(query);

      // Then (Assert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);

      const statuses = result.value!.map((dto) => dto.status);
      expect(statuses).toContain('GEPLANT');
      expect(statuses).toContain('AUSGELOEST');
      expect(statuses).toContain('ERLEDIGT');
    });

    it('should handle repository returning null value in Result', async () => {
      // Given (Arrange)
      const einsatzId = generateValidCuid();
      // Repository gibt Result.ok mit undefined value zurück
      mockRepository.findByEinsatzId.mockResolvedValue(Result.ok<Erinnerung[]>(undefined as unknown as Erinnerung[]));

      const queryResult = GetErinnerungenByEinsatzQuery.create({
        einsatzId,
      });
      const query = queryResult.value!;

      // When (Act)
      const result = await handler.execute(query);

      // Then (Assert)
      // Handler sollte null/undefined als leeres Array behandeln
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
    });
  });
});
