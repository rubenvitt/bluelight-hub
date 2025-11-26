import { GetActiveEinsaetzeQueryHandler } from '../get-active-einsaetze.handler';
import { GetActiveEinsaetzeQuery } from '../get-active-einsaetze.query';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { UserId } from '@domain/value-objects/user-id';
import { Address } from '@domain/value-objects/address';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { Result } from '@domain/common/result';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';

/**
 * Helper: Erstellt einen Mock-Einsatz fuer Tests.
 *
 * Kapseliert die Aggregate-Erstellung um Tests lesbarer zu machen.
 * Ermoeglicht flexible Konfiguration via optionale Parameter.
 *
 * @param overrides - Optionale Ueberschreibungen der Default-Werte
 * @returns Einsatz Aggregate
 */
function createMockEinsatz(overrides?: { alarmstichwort?: string; status?: EinsatzStatus; createdAt?: Date; einsatzort?: Address; bemerkung?: string }): Einsatz {
  const userId = UserId.create().value!;
  const einsatzResult = Einsatz.create({
    alarmstichwort: overrides?.alarmstichwort ?? 'Wohnungsbrand',
    createdBy: userId,
    einsatzort: overrides?.einsatzort,
    bemerkung: overrides?.bemerkung,
  });

  const einsatz = einsatzResult.value!;

  // Status ueberschreiben falls angegeben (via reflection da private)
  if (overrides?.status) {
    // @ts-expect-error - Private field access fuer Test
    einsatz._status = overrides.status;
  }

  // CreatedAt ueberschreiben falls angegeben (via reflection da private)
  if (overrides?.createdAt) {
    // @ts-expect-error - Private field access fuer Test
    einsatz._createdAt = overrides.createdAt;
  }

  return einsatz;
}

/**
 * Unit Tests fuer GetActiveEinsaetzeQueryHandler.
 *
 * Testet Handler-Orchestration gemaess BDD Given-When-Then Pattern.
 * Nutzt Mock Repository fuer Unit Test Isolation.
 *
 * Coverage Target: >90%
 */
describe('GetActiveEinsaetzeQueryHandler', () => {
  let handler: GetActiveEinsaetzeQueryHandler;
  let mockRepository: jest.Mocked<IEinsatzRepository>;

  beforeEach(() => {
    // Mock Repository mit allen benoetigten Methods
    mockRepository = {
      findActive: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByNummer: jest.fn(),
      exists: jest.fn(),
    } as jest.Mocked<IEinsatzRepository>;

    handler = new GetActiveEinsaetzeQueryHandler(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Erfolgreiche Abfragen', () => {
    it('should return empty array when no active einsaetze exist', async () => {
      // Given: Repository returnt leeres Array
      mockRepository.findActive.mockResolvedValue(Result.ok([]));
      const query = new GetActiveEinsaetzeQuery();

      // When
      const result = await handler.execute(query);

      // Then: Leeres Array ist valides Resultat (NICHT Fehler)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual([]);
      expect(result.value!.length).toBe(0);
      expect(mockRepository.findActive).toHaveBeenCalledTimes(1);
    });

    it('should return DTOs sorted by createdAt DESC (newest first)', async () => {
      // Given: 3 Einsaetze mit verschiedenen createdAt Timestamps
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const einsatz1 = createMockEinsatz({
        alarmstichwort: 'Brand Alt',
        createdAt: twoHoursAgo, // Aeltester
      });
      const einsatz2 = createMockEinsatz({
        alarmstichwort: 'Brand Mittel',
        createdAt: oneHourAgo, // Mittlerer
      });
      const einsatz3 = createMockEinsatz({
        alarmstichwort: 'Brand Neu',
        createdAt: now, // Neuester
      });

      // Repository returnt unsortiert
      mockRepository.findActive.mockResolvedValue(Result.ok([einsatz1, einsatz2, einsatz3]));
      const query = new GetActiveEinsaetzeQuery();

      // When
      const result = await handler.execute(query);

      // Then: DTOs sortiert nach createdAt DESC
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);

      const dtos = result.value!;
      // Neuester zuerst
      expect(dtos[0].alarmstichwort).toBe('Brand Neu');
      expect(dtos[0].createdAt).toEqual(now);

      // Mittlerer zweiter
      expect(dtos[1].alarmstichwort).toBe('Brand Mittel');
      expect(dtos[1].createdAt).toEqual(oneHourAgo);

      // Aeltester letzter
      expect(dtos[2].alarmstichwort).toBe('Brand Alt');
      expect(dtos[2].createdAt).toEqual(twoHoursAgo);
    });

    it('should exclude ARCHIVIERT status when findActive filters correctly', async () => {
      // Given: Repository filtert ARCHIVIERT bereits raus
      // Mock returnt nur aktive Einsaetze (ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN)
      const einsatz1 = createMockEinsatz({
        alarmstichwort: 'Aktiv 1',
        status: EinsatzStatus.ANGELEGT(),
      });
      const einsatz2 = createMockEinsatz({
        alarmstichwort: 'Aktiv 2',
        status: EinsatzStatus.IN_BEARBEITUNG(),
      });
      const einsatz3 = createMockEinsatz({
        alarmstichwort: 'Aktiv 3',
        status: EinsatzStatus.ABGESCHLOSSEN(),
      });
      // ARCHIVIERT ist NICHT im Result (Repository filtert)

      mockRepository.findActive.mockResolvedValue(Result.ok([einsatz1, einsatz2, einsatz3]));
      const query = new GetActiveEinsaetzeQuery();

      // When
      const result = await handler.execute(query);

      // Then: Nur aktive Status in DTOs
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(3);

      const statuses = result.value!.map((dto) => dto.status);
      expect(statuses).toContain('ANGELEGT');
      expect(statuses).toContain('IN_BEARBEITUNG');
      expect(statuses).toContain('ABGESCHLOSSEN');
      expect(statuses).not.toContain('ARCHIVIERT');
    });

    it('should handle repository error gracefully (Result.fail)', async () => {
      // Given: Repository-Fehler (z.B. DB Connection Failed)
      mockRepository.findActive.mockResolvedValue(Result.fail('Database connection failed'));
      const query = new GetActiveEinsaetzeQuery();

      // When
      const result = await handler.execute(query);

      // Then: Handler propagiert Fehler via Result.fail()
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Database connection failed');
      expect(result.value).toBeUndefined();
      expect(mockRepository.findActive).toHaveBeenCalledTimes(1);
    });

    it('should map all aggregate fields to DTO correctly', async () => {
      // Given: Einsatz mit allen optionalen Feldern
      const userId = UserId.create().value!;
      const einsatzort = Address.create({
        strasse: 'Musterstr.',
        hausnummer: '42',
        plz: '80331',
        ort: 'München',
      }).value!;

      const einsatz = createMockEinsatz({
        alarmstichwort: 'Grossbrand',
        status: EinsatzStatus.IN_BEARBEITUNG(),
        einsatzort,
        bemerkung: 'Dachstuhl brennt',
      });

      // Setze abgeschlossenAt manuell fuer DTO-Mapping Test
      // @ts-expect-error - Private field access fuer Test
      einsatz._abgeschlossenAt = new Date('2024-01-15T14:00:00Z');

      mockRepository.findActive.mockResolvedValue(Result.ok([einsatz]));
      const query = new GetActiveEinsaetzeQuery();

      // When
      const result = await handler.execute(query);

      // Then: DTO enthaelt alle gemappten Felder
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(1);

      const dto = result.value![0];
      expect(dto.id).toBe(einsatz.id.value);
      expect(dto.nummer).toBe(einsatz.nummer);
      expect(dto.alarmstichwort).toBe('Grossbrand');
      expect(dto.status).toBe('IN_BEARBEITUNG');
      expect(dto.createdBy).toBe(einsatz.createdBy.value);
      expect(dto.createdAt).toBeInstanceOf(Date);
      expect(dto.bemerkung).toBe('Dachstuhl brennt');
      expect(dto.abgeschlossenAt).toEqual(new Date('2024-01-15T14:00:00Z'));

      // Einsatzort-DTO verifizieren
      expect(dto.einsatzort).toBeDefined();
      expect(dto.einsatzort!.strasse).toBe('Musterstr.');
      expect(dto.einsatzort!.hausnummer).toBe('42');
      expect(dto.einsatzort!.plz).toBe('80331');
      expect(dto.einsatzort!.ort).toBe('München');
    });
  });

  describe('Fehlerbehandlung', () => {
    it('should return Result.fail when repository throws unexpected error', async () => {
      // Given: Repository wirft unerwarteten Error
      mockRepository.findActive.mockRejectedValue(new Error('Unexpected database error'));
      const query = new GetActiveEinsaetzeQuery();

      // When
      const result = await handler.execute(query);

      // Then: Handler catcht Error und returnt Result.fail()
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Unexpected database error');
      expect(mockRepository.findActive).toHaveBeenCalledTimes(1);
    });

    it('should return Result.fail when repository returns null error message', async () => {
      // Given: Repository-Fehler ohne Error-Message
      mockRepository.findActive.mockResolvedValue(Result.fail<Einsatz[]>(undefined as unknown as string));
      const query = new GetActiveEinsaetzeQuery();

      // When
      const result = await handler.execute(query);

      // Then: Handler verwendet Fallback-Message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Failed to fetch active einsaetze from repository');
    });
  });

  describe('Orchestrierung-Verifikation', () => {
    it('should call repository.findActive exactly once', async () => {
      // Given
      mockRepository.findActive.mockResolvedValue(Result.ok([]));
      const query = new GetActiveEinsaetzeQuery();

      // When
      await handler.execute(query);

      // Then
      expect(mockRepository.findActive).toHaveBeenCalledTimes(1);
      expect(mockRepository.findActive).toHaveBeenCalledWith(); // Keine Parameter
    });

    it('should NOT call save() method (Read-Only Query)', async () => {
      // Given
      const einsatz = createMockEinsatz();
      mockRepository.findActive.mockResolvedValue(Result.ok([einsatz]));
      const query = new GetActiveEinsaetzeQuery();

      // When
      await handler.execute(query);

      // Then: save() wird NIEMALS aufgerufen (Read-Only)
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle query execution with parameterless Query object', async () => {
      // Given: Query ohne Parameter
      mockRepository.findActive.mockResolvedValue(Result.ok([]));
      const query = new GetActiveEinsaetzeQuery();

      // When
      const result = await handler.execute(query);

      // Then: Handler funktioniert mit parameterloser Query
      expect(result.isSuccess).toBe(true);
      expect(mockRepository.findActive).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sortierung Edge Cases', () => {
    it('should handle einsaetze with same createdAt timestamp', async () => {
      // Given: 2 Einsaetze mit identischem Timestamp
      const now = new Date();
      const einsatz1 = createMockEinsatz({
        alarmstichwort: 'Brand A',
        createdAt: now,
      });
      const einsatz2 = createMockEinsatz({
        alarmstichwort: 'Brand B',
        createdAt: now,
      });

      mockRepository.findActive.mockResolvedValue(Result.ok([einsatz1, einsatz2]));
      const query = new GetActiveEinsaetzeQuery();

      // When
      const result = await handler.execute(query);

      // Then: Beide DTOs sind vorhanden (Reihenfolge bei gleichen Timestamps undefiniert)
      expect(result.isSuccess).toBe(true);
      expect(result.value).toHaveLength(2);
      expect(result.value!.map((dto) => dto.alarmstichwort).sort()).toEqual(['Brand A', 'Brand B']);
    });

    it('should preserve immutability of repository result', async () => {
      // Given: Repository-Result Array
      const einsatz1 = createMockEinsatz({ createdAt: new Date('2024-01-01') });
      const einsatz2 = createMockEinsatz({ createdAt: new Date('2024-01-02') });
      const originalArray = [einsatz1, einsatz2];

      mockRepository.findActive.mockResolvedValue(Result.ok(originalArray));
      const query = new GetActiveEinsaetzeQuery();

      // When
      await handler.execute(query);

      // Then: Original Array wurde NICHT mutiert (Immutability)
      expect(originalArray[0]).toBe(einsatz1);
      expect(originalArray[1]).toBe(einsatz2);
    });
  });
});
