import { Test, type TestingModule } from '@nestjs/testing';
import { Result } from '@domain/common/result';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { Address } from '@domain/value-objects/address';
import { GetEinsatzByIdQueryHandler } from '../get-einsatz-by-id.handler';
import { GetEinsatzByIdQuery } from '../get-einsatz-by-id.query';
import { EINSATZ_REPOSITORY } from '@/infrastructure/di-tokens';

describe('GetEinsatzByIdQueryHandler', () => {
  let handler: GetEinsatzByIdQueryHandler;
  let mockRepository: {
    save: jest.Mock;
    findById: jest.Mock;
    exists: jest.Mock;
    findActive: jest.Mock;
    findByNummer: jest.Mock;
  };

  beforeEach(async () => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GetEinsatzByIdQueryHandler, { provide: EINSATZ_REPOSITORY, useValue: mockRepository }],
    }).compile();

    handler = module.get<GetEinsatzByIdQueryHandler>(GetEinsatzByIdQueryHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('sollte null zurückgeben wenn Einsatz nicht gefunden wurde', async () => {
      // Arrange
      const einsatzId = EinsatzId.create().value!;
      const query = new GetEinsatzByIdQuery(einsatzId.value);
      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeNull();
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
      expect(mockRepository.findById).toHaveBeenCalledWith(expect.objectContaining({ value: einsatzId.value }));
    });

    it('sollte DTO zurückgeben wenn Einsatz gefunden wurde', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const einsatz = Einsatz.create({
        alarmstichwort: 'Wohnungsbrand',
        createdBy: userId,
      }).value!;

      const query = new GetEinsatzByIdQuery(einsatz.id.value);
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();
      expect(result.value?.id).toBe(einsatz.id.value);
      expect(result.value?.nummer).toBe(einsatz.nummer);
      expect(result.value?.alarmstichwort).toBe('Wohnungsbrand');
      expect(result.value?.status).toBe('ANGELEGT');
      expect(result.value?.createdBy).toBe(userId.value);
    });

    it('sollte Result.fail zurückgeben bei ungültiger einsatzId', async () => {
      // Arrange
      const validButNonExistentId = EinsatzId.create().value!;
      const query = new GetEinsatzByIdQuery(validButNonExistentId.value);

      // Simuliere dass EinsatzId.create() im Handler fehlschlägt (z.B. durch corrupted DB data)
      mockRepository.findById.mockResolvedValue(Result.fail('Ungueltige einsatzId'));

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Ungueltige einsatzId');
    });

    it('sollte Repository-Fehler behandeln', async () => {
      // Arrange
      const einsatzId = EinsatzId.create().value!;
      const query = new GetEinsatzByIdQuery(einsatzId.value);
      mockRepository.findById.mockResolvedValue(Result.fail('Database connection failed'));

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Database connection failed');
    });

    it('sollte einsatzId über EinsatzId.create() validieren', async () => {
      // Arrange
      const einsatzId = EinsatzId.create().value!;
      const query = new GetEinsatzByIdQuery(einsatzId.value);
      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act
      await handler.execute(query);

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledWith(expect.any(EinsatzId));
      const calledWithId = mockRepository.findById.mock.calls[0][0];
      expect(calledWithId.value).toBe(einsatzId.value);
    });

    it('sollte alle Aggregate-Felder korrekt zu DTO mappen', async () => {
      // Arrange
      const userId = UserId.create().value!;
      const address = Address.create({
        strasse: 'Musterstraße',
        hausnummer: '42',
        plz: '80331',
        ort: 'München',
      }).value!;

      const einsatz = Einsatz.create({
        alarmstichwort: 'Großbrand',
        createdBy: userId,
        einsatzort: address,
        bemerkung: 'Dachstuhl brennt, Personen evakuiert',
      }).value!;

      const query = new GetEinsatzByIdQuery(einsatz.id.value);
      mockRepository.findById.mockResolvedValue(Result.ok(einsatz));

      // Act
      const result = await handler.execute(query);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).not.toBeNull();

      const dto = result.value!;
      // Required fields
      expect(dto.id).toBe(einsatz.id.value);
      expect(dto.nummer).toBe(einsatz.nummer);
      expect(dto.alarmstichwort).toBe('Großbrand');
      expect(dto.status).toBe('ANGELEGT');
      expect(dto.createdBy).toBe(userId.value);
      expect(dto.createdAt).toBeInstanceOf(Date);

      // Optional fields
      expect(dto.einsatzort).toBeDefined();
      expect(dto.einsatzort?.strasse).toBe('Musterstraße');
      expect(dto.einsatzort?.hausnummer).toBe('42');
      expect(dto.einsatzort?.plz).toBe('80331');
      expect(dto.einsatzort?.ort).toBe('München');
      expect(dto.bemerkung).toBe('Dachstuhl brennt, Personen evakuiert');

      // Not set yet (Status = ANGELEGT)
      expect(dto.abgeschlossenAt).toBeUndefined();
      expect(dto.archivedAt).toBeUndefined();
    });
  });

  describe('Query Validation', () => {
    it('sollte Error werfen bei leerer einsatzId', () => {
      // Arrange & Act & Assert
      expect(() => {
        new GetEinsatzByIdQuery('');
      }).toThrow('einsatzId is required');
    });

    it('sollte Error werfen bei ungültigem CUID2-Format', () => {
      // Arrange & Act & Assert
      expect(() => {
        new GetEinsatzByIdQuery('invalid-id');
      }).toThrow('einsatzId must be a valid CUID2 format');
    });

    it('sollte valide Query bei gültigem CUID2 erstellen', () => {
      // Arrange
      const validId = EinsatzId.create().value!;

      // Act & Assert
      expect(() => {
        new GetEinsatzByIdQuery(validId.value);
      }).not.toThrow();
    });
  });
});
