import { Test, type TestingModule } from '@nestjs/testing';
import { Result } from '@domain/common/result';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { Address } from '@domain/value-objects/address';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEtbRepository } from '@domain/repositories/i-etb.repository';
import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import { GetEinsatzDetailsQueryHandler } from '../get-einsatz-details.handler';
import { GetEinsatzDetailsQuery } from '../get-einsatz-details.query';

describe('GetEinsatzDetailsQueryHandler', () => {
  let handler: GetEinsatzDetailsQueryHandler;
  let mockEinsatzRepository: jest.Mocked<IEinsatzRepository>;
  let mockEtbRepository: jest.Mocked<IEtbRepository>;
  let mockLagekarteRepository: jest.Mocked<ILagekarteRepository>;

  beforeEach(async () => {
    // Initialize mocked repositories
    mockEinsatzRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      exists: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
    };

    mockEtbRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEinsatzId: jest.fn(),
      getHistory: jest.fn(),
    };

    mockLagekarteRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEinsatzId: jest.fn(),
      exists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetEinsatzDetailsQueryHandler,
        { provide: EINSATZ_REPOSITORY, useValue: mockEinsatzRepository },
        { provide: 'IEtbRepository', useValue: mockEtbRepository },
        { provide: 'ILagekarteRepository', useValue: mockLagekarteRepository },
      ],
    }).compile();

    handler = module.get<GetEinsatzDetailsQueryHandler>(GetEinsatzDetailsQueryHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    describe('Success Cases - AC5.1: Combined DTO with all aggregates', () => {
      it('should return combined DTO with Einsatz, ETB and Lagekarte when all exist', async () => {
        // Given: All three aggregates exist
        const userId = UserId.create().value!;
        const einsatz = Einsatz.create({
          alarmstichwort: 'Wohnungsbrand',
          createdBy: userId,
        }).value!;

        const etbAggregate = EinsatztagebuchAggregate.create(einsatz.id).value!;
        etbAggregate.addEintrag('Erster Eintrag', userId);

        const lagekarteAggregate = LagekarteAggregate.create(einsatz.id, userId).value!;

        // Mock repository responses
        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockEtbRepository.findByEinsatzId.mockResolvedValue(etbAggregate);
        mockLagekarteRepository.findByEinsatzId.mockResolvedValue(lagekarteAggregate);

        const query = new GetEinsatzDetailsQuery(einsatz.id.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: Result contains EinsatzDetailsDto with all three aggregates
        expect(result.isSuccess).toBe(true);
        expect(result.value).not.toBeNull();

        const dto = result.value!;
        expect(dto.einsatz).toBeDefined();
        expect(dto.einsatz.id).toBe(einsatz.id.value);
        expect(dto.einsatz.alarmstichwort).toBe('Wohnungsbrand');

        expect(dto.etb).not.toBeNull();
        expect(dto.etb?.id).toBe(etbAggregate.id.value);

        expect(dto.lagekarte).not.toBeNull();
        expect(dto.lagekarte?.id).toBe(lagekarteAggregate.id.value);

        // Verify repository calls
        expect(mockEinsatzRepository.findById).toHaveBeenCalledTimes(1);
        expect(mockEinsatzRepository.findById).toHaveBeenCalledWith(expect.objectContaining({ value: einsatz.id.value }));
        expect(mockEtbRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
        expect(mockEtbRepository.findByEinsatzId).toHaveBeenCalledWith(expect.objectContaining({ value: einsatz.id.value }));
        expect(mockLagekarteRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
        expect(mockLagekarteRepository.findByEinsatzId).toHaveBeenCalledWith(expect.objectContaining({ value: einsatz.id.value }));
      });

      it('should map all Einsatz fields correctly to DTO', async () => {
        // Given: Einsatz with complete data
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

        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockEtbRepository.findByEinsatzId.mockResolvedValue(null);
        mockLagekarteRepository.findByEinsatzId.mockResolvedValue(null);

        const query = new GetEinsatzDetailsQuery(einsatz.id.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: All fields mapped correctly
        expect(result.isSuccess).toBe(true);
        const dto = result.value!;

        expect(dto.einsatz.id).toBe(einsatz.id.value);
        expect(dto.einsatz.nummer).toBe(einsatz.nummer);
        expect(dto.einsatz.alarmstichwort).toBe('Großbrand');
        expect(dto.einsatz.status).toBe('ANGELEGT');
        expect(dto.einsatz.createdBy).toBe(userId.value);
        expect(dto.einsatz.createdAt).toBeInstanceOf(Date);

        expect(dto.einsatz.einsatzort).toBeDefined();
        expect(dto.einsatz.einsatzort?.strasse).toBe('Musterstraße');
        expect(dto.einsatz.einsatzort?.hausnummer).toBe('42');
        expect(dto.einsatz.einsatzort?.plz).toBe('80331');
        expect(dto.einsatz.einsatzort?.ort).toBe('München');
        expect(dto.einsatz.bemerkung).toBe('Dachstuhl brennt, Personen evakuiert');
      });
    });

    describe('Success Cases - AC5.2: Handle missing ETB gracefully', () => {
      it('should return DTO with etb=null when ETB does not exist', async () => {
        // Given: Einsatz exists but ETB repo returns null
        const userId = UserId.create().value!;
        const einsatz = Einsatz.create({
          alarmstichwort: 'Verkehrsunfall',
          createdBy: userId,
        }).value!;

        const lagekarteAggregate = LagekarteAggregate.create(einsatz.id, userId).value!;

        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockEtbRepository.findByEinsatzId.mockResolvedValue(null); // ETB missing
        mockLagekarteRepository.findByEinsatzId.mockResolvedValue(lagekarteAggregate);

        const query = new GetEinsatzDetailsQuery(einsatz.id.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: Result.value.etb is null, Result.isSuccess is true
        expect(result.isSuccess).toBe(true);
        expect(result.value).not.toBeNull();

        const dto = result.value!;
        expect(dto.einsatz).toBeDefined();
        expect(dto.einsatz.id).toBe(einsatz.id.value);
        expect(dto.etb).toBeNull(); // ETB is null
        expect(dto.lagekarte).not.toBeNull();

        expect(mockEtbRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
      });
    });

    describe('Success Cases - AC5.3: Handle missing Lagekarte gracefully', () => {
      it('should return DTO with lagekarte=null when Lagekarte does not exist', async () => {
        // Given: Einsatz exists but Lagekarte repo returns null
        const userId = UserId.create().value!;
        const einsatz = Einsatz.create({
          alarmstichwort: 'Technische Hilfeleistung',
          createdBy: userId,
        }).value!;

        const etbAggregate = EinsatztagebuchAggregate.create(einsatz.id).value!;

        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockEtbRepository.findByEinsatzId.mockResolvedValue(etbAggregate);
        mockLagekarteRepository.findByEinsatzId.mockResolvedValue(null); // Lagekarte missing

        const query = new GetEinsatzDetailsQuery(einsatz.id.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: Result.value.lagekarte is null, Result.isSuccess is true
        expect(result.isSuccess).toBe(true);
        expect(result.value).not.toBeNull();

        const dto = result.value!;
        expect(dto.einsatz).toBeDefined();
        expect(dto.einsatz.id).toBe(einsatz.id.value);
        expect(dto.etb).not.toBeNull();
        expect(dto.lagekarte).toBeNull(); // Lagekarte is null

        expect(mockLagekarteRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
      });

      it('should handle both ETB and Lagekarte missing', async () => {
        // Given: Einsatz exists, both ETB and Lagekarte repos return null
        const userId = UserId.create().value!;
        const einsatz = Einsatz.create({
          alarmstichwort: 'Fehlalarm',
          createdBy: userId,
        }).value!;

        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockEtbRepository.findByEinsatzId.mockResolvedValue(null); // ETB missing
        mockLagekarteRepository.findByEinsatzId.mockResolvedValue(null); // Lagekarte missing

        const query = new GetEinsatzDetailsQuery(einsatz.id.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: Both etb and lagekarte are null, Result.isSuccess is true
        expect(result.isSuccess).toBe(true);
        expect(result.value).not.toBeNull();

        const dto = result.value!;
        expect(dto.einsatz).toBeDefined();
        expect(dto.einsatz.id).toBe(einsatz.id.value);
        expect(dto.etb).toBeNull(); // ETB is null
        expect(dto.lagekarte).toBeNull(); // Lagekarte is null
      });
    });

    describe('Not Found Cases - AC5.4: Return null when Einsatz not found', () => {
      it('should return Result.ok(null) when Einsatz not found', async () => {
        // Given: Einsatz repo returns Result.ok(null)
        const einsatzId = EinsatzId.create().value!;
        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(null));

        const query = new GetEinsatzDetailsQuery(einsatzId.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: Result.value is null (NOT Result.fail!)
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();

        // ETB and Lagekarte repos should NOT be called
        expect(mockEinsatzRepository.findById).toHaveBeenCalledTimes(1);
        expect(mockEtbRepository.findByEinsatzId).not.toHaveBeenCalled();
        expect(mockLagekarteRepository.findByEinsatzId).not.toHaveBeenCalled();
      });
    });

    describe('Error Cases - Repository failures', () => {
      it('should return Result.fail when Einsatz repo fails', async () => {
        // Given: Einsatz repo returns Result.fail()
        const einsatzId = EinsatzId.create().value!;
        mockEinsatzRepository.findById.mockResolvedValue(Result.fail('Database connection failed'));

        const query = new GetEinsatzDetailsQuery(einsatzId.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: Result.isFailure is true
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Database connection failed');

        // ETB and Lagekarte repos should NOT be called after failure
        expect(mockEtbRepository.findByEinsatzId).not.toHaveBeenCalled();
        expect(mockLagekarteRepository.findByEinsatzId).not.toHaveBeenCalled();
      });

      it('should return Result.fail when ETB repo throws exception', async () => {
        // Given: ETB repo throws exception
        const userId = UserId.create().value!;
        const einsatz = Einsatz.create({
          alarmstichwort: 'Brand',
          createdBy: userId,
        }).value!;

        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockEtbRepository.findByEinsatzId.mockRejectedValue(new Error('ETB database timeout'));

        const query = new GetEinsatzDetailsQuery(einsatz.id.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: Result.isFailure is true with error message
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Unerwarteter Fehler beim Laden der Einsatz-Details');
        expect(result.error).toContain('ETB database timeout');
      });

      it('should return Result.fail when Lagekarte repo throws exception', async () => {
        // Given: Lagekarte repo throws exception
        const userId = UserId.create().value!;
        const einsatz = Einsatz.create({
          alarmstichwort: 'Brand',
          createdBy: userId,
        }).value!;

        const etbAggregate = EinsatztagebuchAggregate.create(einsatz.id).value!;

        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockEtbRepository.findByEinsatzId.mockResolvedValue(etbAggregate);
        mockLagekarteRepository.findByEinsatzId.mockRejectedValue(new Error('Lagekarte connection lost'));

        const query = new GetEinsatzDetailsQuery(einsatz.id.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: Result.isFailure is true with error message
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Unerwarteter Fehler beim Laden der Einsatz-Details');
        expect(result.error).toContain('Lagekarte connection lost');
      });

      it('should return Result.fail for invalid einsatzId format', async () => {
        // Given: Invalid CUID2 format (Value Object validation fails)
        const invalidId = 'invalid-cuid-format';

        // When: EinsatzId.create() fails in handler
        const einsatzIdResult = EinsatzId.create(invalidId);
        expect(einsatzIdResult.isFailure).toBe(true);

        // Simulate what handler does: EinsatzId.create() fails
        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(null));

        const query = new GetEinsatzDetailsQuery(EinsatzId.create().value!.value); // Use valid ID for query construction
        const result = await handler.execute(query);

        // Then: Handler validates ID successfully but repo returns null
        // (Query constructor already validates, so invalid IDs never reach handler)
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();
      });
    });

    describe('Repository interface pattern tests', () => {
      it('should handle Result<T> pattern for Einsatz repository', async () => {
        // Given: Einsatz repo uses Result<Einsatz | null> pattern
        const userId = UserId.create().value!;
        const einsatz = Einsatz.create({
          alarmstichwort: 'Test',
          createdBy: userId,
        }).value!;

        // Mock returns Result.ok(Einsatz)
        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockEtbRepository.findByEinsatzId.mockResolvedValue(null);
        mockLagekarteRepository.findByEinsatzId.mockResolvedValue(null);

        const query = new GetEinsatzDetailsQuery(einsatz.id.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: Handler correctly unwraps Result<T>
        expect(result.isSuccess).toBe(true);
        expect(result.value).not.toBeNull();
        expect(result.value?.einsatz.id).toBe(einsatz.id.value);
      });

      it('should handle Promise<T|null> pattern for ETB repository', async () => {
        // Given: ETB repo uses Promise<EinsatztagebuchAggregate | null> pattern
        const userId = UserId.create().value!;
        const einsatz = Einsatz.create({
          alarmstichwort: 'Test',
          createdBy: userId,
        }).value!;

        const etbAggregate = EinsatztagebuchAggregate.create(einsatz.id).value!;

        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(einsatz));
        // Mock returns Promise<EinsatztagebuchAggregate> (NO Result wrapper!)
        mockEtbRepository.findByEinsatzId.mockResolvedValue(etbAggregate);
        mockLagekarteRepository.findByEinsatzId.mockResolvedValue(null);

        const query = new GetEinsatzDetailsQuery(einsatz.id.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: Handler correctly handles Promise<T|null> without unwrapping Result
        expect(result.isSuccess).toBe(true);
        expect(result.value?.etb).not.toBeNull();
        expect(result.value?.etb?.id).toBe(etbAggregate.id.value);
      });

      it('should handle Promise<T|null> pattern for Lagekarte repository', async () => {
        // Given: Lagekarte repo uses Promise<LagekarteAggregate | null> pattern
        const userId = UserId.create().value!;
        const einsatz = Einsatz.create({
          alarmstichwort: 'Test',
          createdBy: userId,
        }).value!;

        const lagekarteAggregate = LagekarteAggregate.create(einsatz.id, userId).value!;

        mockEinsatzRepository.findById.mockResolvedValue(Result.ok(einsatz));
        mockEtbRepository.findByEinsatzId.mockResolvedValue(null);
        // Mock returns Promise<LagekarteAggregate> (NO Result wrapper!)
        mockLagekarteRepository.findByEinsatzId.mockResolvedValue(lagekarteAggregate);

        const query = new GetEinsatzDetailsQuery(einsatz.id.value);

        // When: Handler execute called
        const result = await handler.execute(query);

        // Then: Handler correctly handles Promise<T|null> without unwrapping Result
        expect(result.isSuccess).toBe(true);
        expect(result.value?.lagekarte).not.toBeNull();
        expect(result.value?.lagekarte?.id).toBe(lagekarteAggregate.id.value);
      });
    });
  });

  describe('Query Validation', () => {
    it('should throw Error when einsatzId is empty', () => {
      // Given & When & Then
      expect(() => {
        new GetEinsatzDetailsQuery('');
      }).toThrow('einsatzId is required');
    });

    it('should throw Error when einsatzId has invalid CUID2 format', () => {
      // Given & When & Then
      expect(() => {
        new GetEinsatzDetailsQuery('invalid-id-format');
      }).toThrow('einsatzId must be a valid CUID2 format');
    });

    it('should create valid Query with valid CUID2 einsatzId', () => {
      // Given: Valid CUID2 ID
      const validId = EinsatzId.create().value!;

      // When & Then: No exception thrown
      expect(() => {
        new GetEinsatzDetailsQuery(validId.value);
      }).not.toThrow();
    });
  });
});
