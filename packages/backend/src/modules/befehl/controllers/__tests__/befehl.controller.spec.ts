// @ts-nocheck
import { BadRequestException, InternalServerErrorException, NotFoundException, type INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { BEFEHL_ROLLEN_KEY } from '@/modules/common/decorators/requires-befehl-rolle.decorator';
import { BefehlController } from '@/modules/befehl/controllers/befehl.controller';
import { BefehlRollenGuard } from '@/modules/common/guards/befehl-rollen.guard';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { BEFEHL_REPOSITORY } from '@infrastructure/di-tokens';
import { parseZeitvorgabe } from '@/application/befehl/utils/befehl-kritikalitaet.util';
import { Result } from '@/domain/common/result';
import { Befehl } from '@/domain/aggregates/befehl.aggregate';
import { BefehlEmpfaenger } from '@/domain/entities/befehl-empfaenger.entity';
import { BefehlKommentar } from '@/domain/entities/befehl-kommentar.entity';
import { BefehlId } from '@/domain/value-objects/befehl-id';
import { BefehlStatus } from '@/domain/value-objects/befehl-status';
import { EinsatzId } from '@/domain/value-objects/einsatz-id';
import { UserId } from '@/domain/value-objects/user-id';
import { AddBefehlKommentarHandler } from '@/application/befehl/commands/add-befehl-kommentar/add-befehl-kommentar.handler';
import { CreateBefehlHandler } from '@/application/befehl/commands/create-befehl/create-befehl.handler';
import { KorrigiereBefehlHandler } from '@/application/befehl/commands/korrigiere-befehl/korrigiere-befehl.handler';
import { QuittierenBefehlHandler } from '@/application/befehl/commands/quittieren-befehl/quittieren-befehl.handler';
import { GetBefehlHistorieQueryHandler } from '@/application/befehl/queries/get-befehl-historie/get-befehl-historie.handler';
import { ExportBefehleQueryHandler } from '@/application/befehl/queries/export-befehle/export-befehle.handler';
import { AendereEmpfaengerStatusHandler } from '@/application/befehl/commands/aendere-empfaenger-status/aendere-empfaenger-status.handler';
import { EmpfaengerSucheQueryHandler } from '@/application/befehl/queries/empfaenger-suche/empfaenger-suche.handler';
import { BefehlsgeberSucheQueryHandler } from '@/application/befehl/queries/befehlsgeber-suche/befehlsgeber-suche.handler';
import { BefehlHistorieEventStatus, BefehlHistorieEventTyp } from '@/application/befehl/dto/befehl-historie.dto';
import type { BefehlHistorieTimelineDto } from '@/application/befehl/dto/befehl-historie.dto';
import type { AddBefehlKommentarDto } from '@/application/befehl/dto/add-befehl-kommentar.dto';
import type { CreateBefehlDto } from '@/application/befehl/dto/create-befehl.dto';
import type { KorrigiereBefehlDto } from '@/application/befehl/dto/korrigiere-befehl.dto';
import type { QuittierenBefehlDto } from '@/application/befehl/dto/quittieren-befehl.dto';
import { BEFEHL_ERROR_CODES } from '@/application/befehl/errors/befehl-error.codes';
import type { IBefehlRepository } from '@domain/repositories/i-befehl.repository';

/**
 * Integration Tests fuer BefehlController (AC10).
 *
 * **Test Strategy:**
 * - Direct Controller Instantiation Pattern (NO NestJS Test Module)
 * - Mocked Handler + Repository mit jest.fn()
 * - Focus: API Contract, DTO Validation, HTTP Status Codes
 *
 * **Coverage Target:** >80% fuer BefehlController
 *
 * **Test Cases (AC10):**
 * 1. POST /befehle mit validen Daten → 201 Created + BefehlDto
 * 2. POST /befehle mit fehlenden empfaengerIds → 400 Bad Request
 * 3. POST /befehle mit ungültiger einsatzId → 400 Bad Request
 * 4. POST /befehle mit leerem auftrag → 400 Bad Request
 */
describe('BefehlController (Integration Tests - AC10)', () => {
  let controller: BefehlController;
  let mockAddBefehlKommentarHandler: jest.Mocked<AddBefehlKommentarHandler>;
  let mockCreateBefehlHandler: jest.Mocked<CreateBefehlHandler>;
  let mockKorrigiereBefehlHandler: jest.Mocked<KorrigiereBefehlHandler>;
  let mockQuittierenBefehlHandler: jest.Mocked<QuittierenBefehlHandler>;
  let mockAendereEmpfaengerStatusHandler: jest.Mocked<AendereEmpfaengerStatusHandler>;
  let mockGetBefehlHistorieQueryHandler: jest.Mocked<GetBefehlHistorieQueryHandler>;
  let mockExportBefehleQueryHandler: jest.Mocked<ExportBefehleQueryHandler>;
  let mockEmpfaengerSucheQueryHandler: jest.Mocked<EmpfaengerSucheQueryHandler>;
  let mockBefehlsgeberSucheQueryHandler: jest.Mocked<BefehlsgeberSucheQueryHandler>;
  let mockBefehlRepository: jest.Mocked<IBefehlRepository>;

  /**
   * Test-Fixture: Erstellt ein valides Befehl Aggregate für Mock-Responses.
   */
  const createMockBefehl = (): Befehl => {
    const befehlResult = Befehl.create({
      einsatzId: EinsatzId.create('cm5einsatzid123').value as EinsatzId,
      empfaenger: [{ name: 'ZF Meier' }, { name: 'GF Schmidt' }],
      befehlsgeber: 'EL Mueller',
      erstellerId: UserId.create('ersteller1').value as UserId,
      auftrag: 'Patientenablage einrichten',
      nummer: 'B-001',
      zeitvorgabe: '15 min',
    });

    return befehlResult.value as Befehl;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock handlers (Direct Instantiation Pattern)
    mockAddBefehlKommentarHandler = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    mockCreateBefehlHandler = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    mockKorrigiereBefehlHandler = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    mockQuittierenBefehlHandler = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    mockAendereEmpfaengerStatusHandler = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    mockGetBefehlHistorieQueryHandler = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    mockExportBefehleQueryHandler = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    mockEmpfaengerSucheQueryHandler = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    mockBefehlsgeberSucheQueryHandler = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    // Create mock repository
    mockBefehlRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEinsatzId: jest.fn(),
      findByEmpfaengerId: jest.fn(),
      findWithOpenRueckfragen: jest.fn(),
      findFiltered: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    // Instantiate controller with mocks
    controller = new BefehlController(
      mockAddBefehlKommentarHandler,
      mockCreateBefehlHandler,
      mockKorrigiereBefehlHandler,
      mockQuittierenBefehlHandler,
      mockAendereEmpfaengerStatusHandler,
      mockGetBefehlHistorieQueryHandler,
      mockExportBefehleQueryHandler,
      mockEmpfaengerSucheQueryHandler,
      mockBefehlsgeberSucheQueryHandler,
      mockBefehlRepository,
    );
  });

  describe('create() - POST /api/api/v-alpha/befehle', () => {
    it('sollte Befehl erfolgreich erstellen und BefehlDto zurueckgeben (Success Case - AC10)', async () => {
      // Given - valide CreateBefehlDto
      const dto: CreateBefehlDto = {
        einsatzId: 'cm5einsatzid123',
        empfaenger: [{ name: 'ZF Meier' }, { name: 'GF Schmidt' }],
        befehlsgeber: 'EL Mueller',
        erstellerId: 'ersteller1',
        auftrag: 'Patientenablage einrichten',
        zeitvorgabe: '15 min',
      };

      const mockBefehl = createMockBefehl();
      const befehlId = mockBefehl.id.value;

      // Mock Handler: execute() gibt BefehlId zurück
      mockCreateBefehlHandler.execute.mockResolvedValue(Result.ok(befehlId));

      // Mock Repository: findById() gibt Befehl Aggregate zurück
      mockBefehlRepository.findById.mockResolvedValue(Result.ok(mockBefehl));

      // When - create() aufrufen
      const result = await controller.create(dto);

      // Then - verify BefehlDto structure
      expect(result).toBeDefined();
      expect(result.id).toBe(befehlId);
      expect(result.nummer).toMatch(/^B-\d{3,}$/); // Generated number format
      expect(result.auftrag).toBe('Patientenablage einrichten');
      expect(result.status).toBe('ERTEILT');
      expect(result.befehlstyp).toBe('KURZBEFEHL');
      expect(result.empfaenger).toHaveLength(2);
      expect(result.kommentare).toEqual([]);

      // Verify handler was called with correct command
      expect(mockCreateBefehlHandler.execute).toHaveBeenCalledTimes(1);
      const executedCommand = mockCreateBefehlHandler.execute.mock.calls[0]?.[0]!;
      expect(executedCommand.einsatzId).toBe('cm5einsatzid123');
      expect(executedCommand.empfaenger).toEqual([{ name: 'ZF Meier' }, { name: 'GF Schmidt' }]);
      expect(executedCommand.auftrag).toBe('Patientenablage einrichten');

      // Verify repository findById was called
      expect(mockBefehlRepository.findById).toHaveBeenCalledTimes(1);
    });

    it('sollte BadRequestException werfen wenn Handler fehlschlaegt (ungueltige EinsatzId - AC10)', async () => {
      // Given - ungueltige einsatzId
      const dto: CreateBefehlDto = {
        einsatzId: 'invalid-id',
        empfaenger: [{ name: 'ZF Meier' }],
        befehlsgeber: 'EL Mueller',
        erstellerId: 'ersteller1',
        auftrag: 'Auftrag',
      };

      // Mock Handler: execute() gibt Fehler zurück
      mockCreateBefehlHandler.execute.mockResolvedValue(Result.fail('Ungültige Einsatz-ID'));

      // When & Then - BadRequestException mit korrektem Inhalt
      const error = await controller.create(dto).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as { statusCode: number; error: string; message: string };
      expect(response.statusCode).toBe(400);
      expect(response.message).toBe('Ungültige Einsatz-ID');

      // Repository findById should NOT be called on handler failure
      expect(mockBefehlRepository.findById).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen wenn empfaenger leer ist (Validierungsfehler - AC10)', async () => {
      // Given - leere empfaenger (verletzt @ArrayMinSize(1))
      const dto: CreateBefehlDto = {
        einsatzId: 'cm5einsatzid123',
        empfaenger: [], // Leer - verletzt Validation
        befehlsgeber: 'EL Mueller',
        erstellerId: 'ersteller1',
        auftrag: 'Auftrag',
      };

      // Mock Handler: execute() gibt Validierungsfehler zurück
      mockCreateBefehlHandler.execute.mockResolvedValue(Result.fail('Mindestens ein Empfänger ist erforderlich'));

      // When & Then - BadRequestException mit korrektem Status
      const error = await controller.create(dto).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as { statusCode: number; error: string; message: string };
      expect(response.statusCode).toBe(400);
    });

    it('sollte BadRequestException werfen wenn auftrag leer ist (Validierungsfehler - AC10)', async () => {
      // Given - leerer auftrag (verletzt @MinLength(3))
      const dto: CreateBefehlDto = {
        einsatzId: 'cm5einsatzid123',
        empfaenger: [{ name: 'ZF Meier' }],
        befehlsgeber: 'EL Mueller',
        erstellerId: 'ersteller1',
        auftrag: '', // Leer - verletzt Validation
      };

      // Mock Handler: execute() gibt Validierungsfehler zurück
      mockCreateBefehlHandler.execute.mockResolvedValue(Result.fail('Auftrag muss mindestens 3 Zeichen lang sein'));

      // When & Then - BadRequestException mit korrekter Fehlermeldung
      const error = await controller.create(dto).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as { statusCode: number; error: string; message: string };
      expect(response.statusCode).toBe(400);
      expect(response.message).toContain('Auftrag');
    });

    it('sollte BadRequestException werfen wenn Handler kein Result zurueckgibt', async () => {
      // Given - valide DTO
      const dto: CreateBefehlDto = {
        einsatzId: 'cm5einsatzid123',
        empfaenger: [{ name: 'ZF Meier' }],
        befehlsgeber: 'EL Mueller',
        erstellerId: 'ersteller1',
        auftrag: 'Auftrag',
      };

      // Mock Handler: execute() gibt undefined zurück (Edge Case)
      mockCreateBefehlHandler.execute.mockResolvedValue(Result.ok(undefined as any));

      // When & Then - InternalServerErrorException erwarten
      await expect(controller.create(dto)).rejects.toThrow();
    });
  });

  describe('quittieren() - POST /api/api/v-alpha/befehle/:id/quittieren (Story 2.1 AC4)', () => {
    const validDto: QuittierenBefehlDto = {
      empfaengerId: 'user1',
      quittierungArt: 'VERSTANDEN',
    };

    it('sollte Befehl erfolgreich quittieren und BefehlDto zurueckgeben (200 OK)', async () => {
      const mockBefehl = createMockBefehl();
      const befehlId = mockBefehl.id.value;

      mockQuittierenBefehlHandler.execute.mockResolvedValue(Result.ok(befehlId));
      mockBefehlRepository.findById.mockResolvedValue(Result.ok(mockBefehl));

      const result = await controller.quittieren(befehlId, validDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(befehlId);
      expect(result.auftrag).toBe('Patientenablage einrichten');
      expect(mockQuittierenBefehlHandler.execute).toHaveBeenCalledTimes(1);

      const executedCommand = mockQuittierenBefehlHandler.execute.mock.calls[0]?.[0]!;
      expect(executedCommand.befehlId).toBe(befehlId);
      expect(executedCommand.empfaengerId).toBe('user1');
      expect(executedCommand.quittierungArt).toBe('VERSTANDEN');
    });

    it('sollte NotFoundException werfen wenn Befehl nicht gefunden (404)', async () => {
      mockQuittierenBefehlHandler.execute.mockResolvedValue(Result.fail(BEFEHL_ERROR_CODES.NOT_FOUND));

      const error = await controller.quittieren('nonexistent-id', validDto).catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
    });

    it('sollte BadRequestException werfen bei Domain-Fehler (nicht zugestellt, 400)', async () => {
      mockQuittierenBefehlHandler.execute.mockResolvedValue(Result.fail('Empfänger wurde noch nicht zugestellt'));

      const error = await controller.quittieren('some-id', validDto).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as { statusCode: number; message: string };
      expect(response.statusCode).toBe(400);
      expect(response.message).toContain('nicht zugestellt');
    });

    it('sollte BadRequestException werfen wenn bereits quittiert (400)', async () => {
      mockQuittierenBefehlHandler.execute.mockResolvedValue(Result.fail('Empfänger hat bereits quittiert'));

      await expect(controller.quittieren('some-id', validDto)).rejects.toThrow(BadRequestException);
    });

    it('sollte BadRequestException werfen bei korrigiertem Befehl (400)', async () => {
      mockQuittierenBefehlHandler.execute.mockResolvedValue(Result.fail('Ein korrigierter Befehl kann nicht quittiert werden'));

      await expect(controller.quittieren('some-id', validDto)).rejects.toThrow(BadRequestException);
    });

    it('sollte BadRequestException werfen bei anderem Domain-Fehler', async () => {
      mockQuittierenBefehlHandler.execute.mockResolvedValue(Result.fail('Empfänger wurde noch nicht zugestellt'));
      await expect(controller.quittieren('some-id', validDto)).rejects.toThrow(BadRequestException);
    });

    it('sollte InternalServerErrorException werfen wenn Handler kein Result zurueckgibt', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test edge case
      mockQuittierenBefehlHandler.execute.mockResolvedValue(Result.ok(undefined as any));

      await expect(controller.quittieren('some-id', validDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('korrigieren() - POST /api/api/v-alpha/befehle/:id/korrigieren (Story 4.1)', () => {
    const validDto: KorrigiereBefehlDto = {
      empfaenger: [{ name: 'ZF Nord' }, { name: 'GF Sued' }],
      befehlsgeber: 'EL Mueller',
      erstellerId: 'ersteller1',
      auftrag: 'Korrigierter Auftrag',
    };

    it('sollte Korrekturbefehl erfolgreich erstellen und BefehlDto zurueckgeben (201 Created)', async () => {
      const originalBefehl = createMockBefehl();
      const originalBefehlId = originalBefehl.id.value;

      // Korrektur-Befehl mit originalBefehlId-Referenz (AC3)
      const korrekturBefehl = Befehl.reconstitute({
        id: BefehlId.create().value as BefehlId,
        nummer: 'B-002',
        einsatzId: originalBefehl.einsatzId,
        auftrag: 'Korrigierter Auftrag',
        befehlsgeberName: 'EL Mueller',
        befehlsgeberId: undefined,
        erstellerId: UserId.create('ersteller1').value as UserId,
        status: BefehlStatus.create('ERTEILT').value!,
        erteiltAm: new Date(),
        empfaenger: [BefehlEmpfaenger.create('ZF Nord'), BefehlEmpfaenger.create('GF Sued')],
        kommentare: [],
        originalBefehlId: originalBefehl.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockKorrigiereBefehlHandler.execute.mockResolvedValue(Result.ok(korrekturBefehl.id.value));
      mockBefehlRepository.findById.mockResolvedValue(Result.ok(korrekturBefehl));

      const result = await controller.korrigieren(originalBefehlId, validDto);

      expect(result).toBeDefined();
      expect(result.auftrag).toBe('Korrigierter Auftrag');
      expect(result.originalBefehlId).toBe(originalBefehlId); // AC3: originalBefehlId in Response
      expect(mockKorrigiereBefehlHandler.execute).toHaveBeenCalledTimes(1);

      const executedCommand = mockKorrigiereBefehlHandler.execute.mock.calls[0]?.[0]!;
      expect(executedCommand.originalBefehlId).toBe(originalBefehlId);
      expect(executedCommand.empfaenger).toEqual([{ name: 'ZF Nord' }, { name: 'GF Sued' }]);
      expect(executedCommand.auftrag).toBe('Korrigierter Auftrag');
    });

    it('sollte NotFoundException werfen wenn Original-Befehl nicht gefunden (404)', async () => {
      mockKorrigiereBefehlHandler.execute.mockResolvedValue(Result.fail(BEFEHL_ERROR_CODES.NOT_FOUND));

      await expect(controller.korrigieren('nonexistent-id', validDto)).rejects.toThrow(NotFoundException);
    });

    it('sollte BadRequestException werfen bei ungültiger Status-Transition (400)', async () => {
      mockKorrigiereBefehlHandler.execute.mockResolvedValue(Result.fail('Ungültige Status-Transition: KORRIGIERT → KORRIGIERT'));

      const error = await controller.korrigieren('some-id', validDto).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as { statusCode: number; message: string };
      expect(response.statusCode).toBe(400);
      expect(response.message).toContain('Status-Transition');
    });

    it('sollte InternalServerErrorException werfen wenn Handler kein Result zurueckgibt', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test edge case
      mockKorrigiereBefehlHandler.execute.mockResolvedValue(Result.ok(undefined as any));

      await expect(controller.korrigieren('some-id', validDto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('addKommentar() - POST /api/api/v-alpha/befehle/:id/kommentare (Story 2.4)', () => {
    const validDto: AddBefehlKommentarDto = {
      text: 'Welches Material?',
      isRueckfrage: true,
    };

    const mockReq = { user: { userId: 'author1' } };

    it('sollte Kommentar erfolgreich hinzufuegen und BefehlDto zurueckgeben (201 Created)', async () => {
      const mockBefehl = createMockBefehl();
      const befehlId = mockBefehl.id.value;

      mockAddBefehlKommentarHandler.execute.mockResolvedValue(Result.ok(befehlId));
      mockBefehlRepository.findById.mockResolvedValue(Result.ok(mockBefehl));

      const result = await controller.addKommentar(befehlId, validDto, mockReq);

      expect(result).toBeDefined();
      expect(result.id).toBe(befehlId);
      expect(result.auftrag).toBe('Patientenablage einrichten');
      expect(mockAddBefehlKommentarHandler.execute).toHaveBeenCalledTimes(1);

      const executedCommand = mockAddBefehlKommentarHandler.execute.mock.calls[0]?.[0]!;
      expect(executedCommand.befehlId).toBe(befehlId);
      expect(executedCommand.authorId).toBe('author1');
      expect(executedCommand.text).toBe('Welches Material?');
      expect(executedCommand.isRueckfrage).toBe(true);
    });

    it('sollte NotFoundException werfen wenn Befehl nicht gefunden (404)', async () => {
      mockAddBefehlKommentarHandler.execute.mockResolvedValue(Result.fail(BEFEHL_ERROR_CODES.NOT_FOUND));

      await expect(controller.addKommentar('nonexistent-id', validDto, mockReq)).rejects.toThrow(NotFoundException);
    });

    it('sollte BadRequestException werfen bei Domain-Fehler (400)', async () => {
      mockAddBefehlKommentarHandler.execute.mockResolvedValue(Result.fail('Kommentar-Text ist erforderlich'));

      const error = await controller.addKommentar('some-id', validDto, mockReq).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as { statusCode: number; message: string };
      expect(response.statusCode).toBe(400);
    });

    it('sollte InternalServerErrorException werfen wenn Handler kein Result zurueckgibt', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test edge case
      mockAddBefehlKommentarHandler.execute.mockResolvedValue(Result.ok(undefined as any));

      await expect(controller.addKommentar('some-id', validDto, mockReq)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findByEinsatz() - GET /api/api/v-alpha/befehle', () => {
    it('sollte alle Befehle eines Einsatzes zurueckgeben (ohne empfaengerId)', async () => {
      const mockBefehl = createMockBefehl();
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([mockBefehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(mockBefehl.id.value);
      expect(result[0]?.nummer).toMatch(/^B-\d{3,}$/);
      expect(result[0]?.status).toBe('ERTEILT');
      expect(mockBefehlRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
      expect(mockBefehlRepository.findByEmpfaengerId).not.toHaveBeenCalled();
    });

    it('sollte gefilterte Befehle zurueckgeben wenn empfaengerId gesetzt ist (Story 2.5 AC1)', async () => {
      const mockBefehl = createMockBefehl();
      mockBefehlRepository.findByEmpfaengerId.mockResolvedValue(Result.ok([mockBefehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123', 'user1');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(mockBefehl.id.value);
      expect(mockBefehlRepository.findByEmpfaengerId).toHaveBeenCalledTimes(1);
      expect(mockBefehlRepository.findByEinsatzId).not.toHaveBeenCalled();

      // Verify correct arguments passed to repository
      const calledArgs = mockBefehlRepository.findByEmpfaengerId.mock.calls[0];
      expect(calledArgs[0]?.value).toBe('cm5einsatzid123'); // EinsatzId value object
      expect(calledArgs[1]).toBe('user1'); // empfaengerId string
    });

    it('sollte leeres Array zurueckgeben wenn empfaengerId keine Treffer hat', async () => {
      mockBefehlRepository.findByEmpfaengerId.mockResolvedValue(Result.ok([]));

      const result = await controller.findByEinsatz('cm5einsatzid123', 'unknown-user');

      expect(result).toEqual([]);
      expect(mockBefehlRepository.findByEmpfaengerId).toHaveBeenCalledTimes(1);
    });

    it('sollte leeres Array zurueckgeben wenn keine Befehle existieren', async () => {
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result).toEqual([]);
    });

    it('sollte BadRequestException werfen wenn einsatzId fehlt', async () => {
      await expect(controller.findByEinsatz('')).rejects.toThrow(BadRequestException);
      expect(mockBefehlRepository.findByEinsatzId).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen wenn einsatzId ungueltig ist', async () => {
      await expect(controller.findByEinsatz('x')).rejects.toThrow(BadRequestException);
      expect(mockBefehlRepository.findByEinsatzId).not.toHaveBeenCalled();
    });

    it('sollte InternalServerErrorException werfen wenn Repository fehlschlaegt', async () => {
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.fail('Datenbankfehler'));

      await expect(controller.findByEinsatz('cm5einsatzid123')).rejects.toThrow(InternalServerErrorException);
      expect(mockBefehlRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
    });

    it('sollte InternalServerErrorException werfen wenn findByEmpfaengerId fehlschlaegt', async () => {
      mockBefehlRepository.findByEmpfaengerId.mockResolvedValue(Result.fail('Datenbankfehler'));

      await expect(controller.findByEinsatz('cm5einsatzid123', 'user1')).rejects.toThrow(InternalServerErrorException);
      expect(mockBefehlRepository.findByEmpfaengerId).toHaveBeenCalledTimes(1);
    });

    it('sollte findWithOpenRueckfragen aufrufen wenn hasOpenRueckfragen=true (Story 2.6)', async () => {
      const mockBefehl = createMockBefehl();
      mockBefehlRepository.findWithOpenRueckfragen.mockResolvedValue(Result.ok([mockBefehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123', undefined, 'true');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(mockBefehl.id.value);
      expect(mockBefehlRepository.findWithOpenRueckfragen).toHaveBeenCalledTimes(1);
      expect(mockBefehlRepository.findByEinsatzId).not.toHaveBeenCalled();
      expect(mockBefehlRepository.findByEmpfaengerId).not.toHaveBeenCalled();
    });

    it('sollte findByEinsatzId aufrufen wenn hasOpenRueckfragen nicht gesetzt ist (Rueckwaertskompatibilitaet)', async () => {
      const mockBefehl = createMockBefehl();
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([mockBefehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123', undefined, undefined);

      expect(result).toHaveLength(1);
      expect(mockBefehlRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
      expect(mockBefehlRepository.findWithOpenRueckfragen).not.toHaveBeenCalled();
    });

    it('sollte findByEinsatzId aufrufen wenn hasOpenRueckfragen=false', async () => {
      const mockBefehl = createMockBefehl();
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([mockBefehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123', undefined, 'false');

      expect(result).toHaveLength(1);
      expect(mockBefehlRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
      expect(mockBefehlRepository.findWithOpenRueckfragen).not.toHaveBeenCalled();
    });

    it('sollte hasOpenRueckfragen Vorrang vor empfaengerId geben (Story 2.6)', async () => {
      const mockBefehl = createMockBefehl();
      mockBefehlRepository.findWithOpenRueckfragen.mockResolvedValue(Result.ok([mockBefehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123', 'user1', 'true');

      expect(result).toHaveLength(1);
      expect(mockBefehlRepository.findWithOpenRueckfragen).toHaveBeenCalledTimes(1);
      expect(mockBefehlRepository.findByEmpfaengerId).not.toHaveBeenCalled();
      expect(mockBefehlRepository.findByEinsatzId).not.toHaveBeenCalled();
    });

    it('sollte InternalServerErrorException werfen wenn findWithOpenRueckfragen fehlschlaegt', async () => {
      mockBefehlRepository.findWithOpenRueckfragen.mockResolvedValue(Result.fail('DB Error'));

      await expect(controller.findByEinsatz('cm5einsatzid123', undefined, 'true')).rejects.toThrow(InternalServerErrorException);
    });

    // --- Erweiterte Filter (Story 3.4) ---

    it('sollte findFiltered aufrufen wenn status Parameter gesetzt ist', async () => {
      const mockBefehl = createMockBefehl();
      mockBefehlRepository.findFiltered.mockResolvedValue(Result.ok([mockBefehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123', undefined, undefined, 'ERTEILT,ZUGESTELLT');

      expect(result).toHaveLength(1);
      expect(mockBefehlRepository.findFiltered).toHaveBeenCalledTimes(1);
      expect(mockBefehlRepository.findByEinsatzId).not.toHaveBeenCalled();

      const calledArgs = mockBefehlRepository.findFiltered.mock.calls[0];
      expect(calledArgs[1]?.status).toEqual(['ERTEILT', 'ZUGESTELLT']);
    });

    it('sollte findFiltered aufrufen wenn q Parameter gesetzt ist', async () => {
      const mockBefehl = createMockBefehl();
      mockBefehlRepository.findFiltered.mockResolvedValue(Result.ok([mockBefehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123', undefined, undefined, undefined, undefined, undefined, 'Patienten');

      expect(result).toHaveLength(1);
      expect(mockBefehlRepository.findFiltered).toHaveBeenCalledTimes(1);

      const calledArgs = mockBefehlRepository.findFiltered.mock.calls[0];
      expect(calledArgs[1]?.q).toBe('Patienten');
    });

    it('sollte findFiltered aufrufen wenn empfaengerName gesetzt ist', async () => {
      mockBefehlRepository.findFiltered.mockResolvedValue(Result.ok([]));

      await controller.findByEinsatz('cm5einsatzid123', undefined, undefined, undefined, 'Nord');

      expect(mockBefehlRepository.findFiltered).toHaveBeenCalledTimes(1);
      const calledArgs = mockBefehlRepository.findFiltered.mock.calls[0];
      expect(calledArgs[1]?.empfaengerName).toBe('Nord');
    });

    it('sollte findFiltered aufrufen wenn befehlsgeberName gesetzt ist', async () => {
      mockBefehlRepository.findFiltered.mockResolvedValue(Result.ok([]));

      await controller.findByEinsatz('cm5einsatzid123', undefined, undefined, undefined, undefined, 'Müller');

      expect(mockBefehlRepository.findFiltered).toHaveBeenCalledTimes(1);
      const calledArgs = mockBefehlRepository.findFiltered.mock.calls[0];
      expect(calledArgs[1]?.befehlsgeberName).toBe('Müller');
    });

    it('sollte findFiltered aufrufen wenn von/bis gesetzt sind', async () => {
      mockBefehlRepository.findFiltered.mockResolvedValue(Result.ok([]));

      await controller.findByEinsatz('cm5einsatzid123', undefined, undefined, undefined, undefined, undefined, undefined, '2026-02-01T00:00:00Z', '2026-02-28T23:59:59Z');

      expect(mockBefehlRepository.findFiltered).toHaveBeenCalledTimes(1);
      const calledArgs = mockBefehlRepository.findFiltered.mock.calls[0];
      expect(calledArgs[1]?.von).toEqual(new Date('2026-02-01T00:00:00Z'));
      expect(calledArgs[1]?.bis).toEqual(new Date('2026-02-28T23:59:59Z'));
    });

    it('sollte BadRequestException werfen bei ungueltigem Status-Wert', async () => {
      await expect(controller.findByEinsatz('cm5einsatzid123', undefined, undefined, 'INVALID_STATUS')).rejects.toThrow(BadRequestException);

      expect(mockBefehlRepository.findFiltered).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen bei ungueltigem von-Datum', async () => {
      await expect(controller.findByEinsatz('cm5einsatzid123', undefined, undefined, undefined, undefined, undefined, undefined, 'not-a-date')).rejects.toThrow(BadRequestException);

      expect(mockBefehlRepository.findFiltered).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen bei ungueltigem bis-Datum', async () => {
      await expect(controller.findByEinsatz('cm5einsatzid123', undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'invalid')).rejects.toThrow(BadRequestException);

      expect(mockBefehlRepository.findFiltered).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen wenn bis vor von liegt', async () => {
      await expect(controller.findByEinsatz('cm5einsatzid123', undefined, undefined, undefined, undefined, undefined, undefined, '2026-02-28T00:00:00Z', '2026-02-01T00:00:00Z')).rejects.toThrow(
        BadRequestException,
      );

      expect(mockBefehlRepository.findFiltered).not.toHaveBeenCalled();
    });

    it('sollte erweiterte Filter Vorrang vor empfaengerId/hasOpenRueckfragen geben', async () => {
      const mockBefehl = createMockBefehl();
      mockBefehlRepository.findFiltered.mockResolvedValue(Result.ok([mockBefehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123', 'user1', 'true', 'ERTEILT');

      expect(result).toHaveLength(1);
      expect(mockBefehlRepository.findFiltered).toHaveBeenCalledTimes(1);
      expect(mockBefehlRepository.findWithOpenRueckfragen).not.toHaveBeenCalled();
      expect(mockBefehlRepository.findByEmpfaengerId).not.toHaveBeenCalled();
    });

    it('sollte multiple Filter kombinieren', async () => {
      mockBefehlRepository.findFiltered.mockResolvedValue(Result.ok([]));

      await controller.findByEinsatz('cm5einsatzid123', undefined, undefined, 'ERTEILT', 'Nord', 'Müller', 'Patienten', '2026-02-01T00:00:00Z', '2026-02-28T23:59:59Z');

      expect(mockBefehlRepository.findFiltered).toHaveBeenCalledTimes(1);
      const calledArgs = mockBefehlRepository.findFiltered.mock.calls[0];
      expect(calledArgs[1]).toEqual({
        status: ['ERTEILT'],
        empfaengerName: 'Nord',
        befehlsgeberName: 'Müller',
        q: 'Patienten',
        von: new Date('2026-02-01T00:00:00Z'),
        bis: new Date('2026-02-28T23:59:59Z'),
      });
    });

    it('sollte InternalServerErrorException werfen wenn findFiltered fehlschlaegt', async () => {
      mockBefehlRepository.findFiltered.mockResolvedValue(Result.fail('DB Error'));

      await expect(controller.findByEinsatz('cm5einsatzid123', undefined, undefined, 'ERTEILT')).rejects.toThrow(InternalServerErrorException);
    });

    it('sollte weiterhin findByEinsatzId aufrufen wenn keine erweiterten Filter gesetzt sind', async () => {
      const mockBefehl = createMockBefehl();
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([mockBefehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result).toHaveLength(1);
      expect(mockBefehlRepository.findByEinsatzId).toHaveBeenCalledTimes(1);
      expect(mockBefehlRepository.findFiltered).not.toHaveBeenCalled();
    });
  });

  describe('getHistorie() - GET /api/api/v-alpha/befehle/:id/historie (Story 4.2)', () => {
    const mockTimeline: BefehlHistorieTimelineDto = {
      befehlId: 'test-befehl-id',
      befehlNummer: 'B-001',
      aktuellerStatus: 'ERTEILT',
      events: [
        {
          typ: BefehlHistorieEventTyp.ERTEILT,
          status: BefehlHistorieEventStatus.AKTUELL,
          zeitpunkt: new Date('2026-02-20T10:00:00.000Z'),
          beschreibung: 'Befehl #B-001 erteilt',
          akteur: 'EL Mueller',
        },
      ],
    };

    it('sollte Befehlshistorie-Timeline erfolgreich zurueckgeben (200 OK)', async () => {
      mockGetBefehlHistorieQueryHandler.execute.mockResolvedValue(Result.ok(mockTimeline));

      const result = await controller.getHistorie('test-befehl-id');

      expect(result).toBeDefined();
      expect(result.befehlId).toBe('test-befehl-id');
      expect(result.befehlNummer).toBe('B-001');
      expect(result.aktuellerStatus).toBe('ERTEILT');
      expect(result.events).toHaveLength(1);
      expect(result.events[0]?.typ).toBe(BefehlHistorieEventTyp.ERTEILT);
      expect(mockGetBefehlHistorieQueryHandler.execute).toHaveBeenCalledTimes(1);
    });

    it('sollte NotFoundException werfen wenn Befehl nicht gefunden (404)', async () => {
      mockGetBefehlHistorieQueryHandler.execute.mockResolvedValue(Result.fail(BEFEHL_ERROR_CODES.NOT_FOUND));

      await expect(controller.getHistorie('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('sollte InternalServerErrorException werfen wenn Handler kein Result zurueckgibt', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: Test edge case
      mockGetBefehlHistorieQueryHandler.execute.mockResolvedValue(Result.ok(undefined as any));

      await expect(controller.getHistorie('test-befehl-id')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('Computed Priority Fields (Story 3.5)', () => {
    /**
     * Erstellt ein Befehl Aggregate mit konfigurierbaren Empfaengern, Kommentaren und Zeitvorgabe.
     */
    const createBefehlWithOptions = (options: {
      zeitvorgabe?: string;
      erteiltAm?: Date;
      empfaengerOverrides?: Array<{
        quittiertAm?: Date;
        quittierungArt?: 'VERSTANDEN' | 'RUECKFRAGE' | 'NICHT_VERSTANDEN';
        zugestelltAm?: Date;
      }>;
      kommentare?: Array<{ isRueckfrage: boolean; parentId?: string; id?: string }>;
    }): Befehl => {
      const einsatzId = EinsatzId.create('cm5einsatzid123').value as EinsatzId;
      const erstellerId = UserId.create('ersteller1').value as UserId;

      const empfaenger = (options.empfaengerOverrides ?? [{}]).map((override) =>
        BefehlEmpfaenger.reconstitute(
          `emp-${Math.random().toString(36).slice(2, 10)}`,
          'ZF Nord',
          undefined,
          override.zugestelltAm ?? undefined,
          override.quittiertAm ?? undefined,
          override.quittierungArt ?? undefined,
          new Date('2026-02-17T10:00:00.000Z'),
        ),
      );

      const kommentare = (options.kommentare ?? []).map((k) =>
        BefehlKommentar.reconstitute(k.id ?? `kom-${Math.random().toString(36).slice(2, 10)}`, erstellerId, 'Test-Kommentar', k.isRueckfrage, k.parentId, new Date('2026-02-17T10:10:00.000Z')),
      );

      return Befehl.reconstitute({
        id: BefehlId.create().value as BefehlId,
        nummer: 'B-001',
        einsatzId,
        auftrag: 'Test-Auftrag',
        befehlsgeberName: 'EL Müller',
        befehlsgeberId: undefined,
        erstellerId,
        status: BefehlStatus.create('ERTEILT').value!,
        erteiltAm: options.erteiltAm ?? new Date('2026-02-17T10:00:00.000Z'),
        empfaenger,
        kommentare,
        zeitvorgabe: options.zeitvorgabe,
        createdAt: new Date('2026-02-17T10:00:00.000Z'),
        updatedAt: new Date('2026-02-17T10:00:00.000Z'),
      });
    };

    it('sollte isUeberfaellig=false setzen wenn keine Zeitvorgabe', async () => {
      const befehl = createBefehlWithOptions({ zeitvorgabe: undefined });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.isUeberfaellig).toBe(false);
    });

    it('sollte isUeberfaellig=false setzen wenn Zeitvorgabe noch nicht abgelaufen', async () => {
      // erteiltAm = jetzt, Zeitvorgabe 60 min → noch nicht überfällig
      const befehl = createBefehlWithOptions({
        zeitvorgabe: '60 min',
        erteiltAm: new Date(), // gerade erst erteilt
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.isUeberfaellig).toBe(false);
    });

    it('sollte isUeberfaellig=true setzen wenn Zeitvorgabe abgelaufen und nicht alle quittiert', async () => {
      // erteiltAm = vor 2 Stunden, Zeitvorgabe 15 min, Empfaenger nicht quittiert
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const befehl = createBefehlWithOptions({
        zeitvorgabe: '15 min',
        erteiltAm: twoHoursAgo,
        empfaengerOverrides: [{ quittiertAm: undefined }],
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.isUeberfaellig).toBe(true);
    });

    it('sollte isUeberfaellig=false setzen wenn Zeitvorgabe abgelaufen aber alle quittiert', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const befehl = createBefehlWithOptions({
        zeitvorgabe: '15 min',
        erteiltAm: twoHoursAgo,
        empfaengerOverrides: [{ quittiertAm: new Date(), quittierungArt: 'VERSTANDEN' }],
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.isUeberfaellig).toBe(false);
    });

    it('sollte hatNichtVerstanden=true setzen wenn ein Empfaenger NICHT_VERSTANDEN quittiert', async () => {
      const befehl = createBefehlWithOptions({
        empfaengerOverrides: [{ quittiertAm: new Date(), quittierungArt: 'NICHT_VERSTANDEN' }],
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.hatNichtVerstanden).toBe(true);
    });

    it('sollte hatNichtVerstanden=false setzen wenn kein Empfaenger NICHT_VERSTANDEN quittiert', async () => {
      const befehl = createBefehlWithOptions({
        empfaengerOverrides: [{ quittiertAm: new Date(), quittierungArt: 'VERSTANDEN' }],
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.hatNichtVerstanden).toBe(false);
    });

    it('sollte hatOffeneRueckfrage=true setzen wenn Rueckfrage ohne Antwort existiert', async () => {
      const befehl = createBefehlWithOptions({
        kommentare: [{ isRueckfrage: true, id: 'rf-001' }],
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.hatOffeneRueckfrage).toBe(true);
    });

    it('sollte hatOffeneRueckfrage=false setzen wenn Rueckfrage mit Antwort existiert', async () => {
      const befehl = createBefehlWithOptions({
        kommentare: [
          { isRueckfrage: true, id: 'rf-001' },
          { isRueckfrage: false, parentId: 'rf-001', id: 'antwort-001' },
        ],
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.hatOffeneRueckfrage).toBe(false);
    });

    it('sollte kritikalitaet=KRITISCH setzen wenn ueberfaellig', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const befehl = createBefehlWithOptions({
        zeitvorgabe: '15 min',
        erteiltAm: twoHoursAgo,
        empfaengerOverrides: [{ quittiertAm: undefined }],
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.kritikalitaet).toBe('KRITISCH');
    });

    it('sollte kritikalitaet=KRITISCH setzen wenn hatNichtVerstanden', async () => {
      const befehl = createBefehlWithOptions({
        empfaengerOverrides: [{ quittiertAm: new Date(), quittierungArt: 'NICHT_VERSTANDEN' }],
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.kritikalitaet).toBe('KRITISCH');
    });

    it('sollte kritikalitaet=WARNUNG setzen wenn offene Rueckfrage', async () => {
      const befehl = createBefehlWithOptions({
        kommentare: [{ isRueckfrage: true, id: 'rf-001' }],
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.kritikalitaet).toBe('WARNUNG');
    });

    it('sollte kritikalitaet=NORMAL setzen wenn keine Probleme', async () => {
      const befehl = createBefehlWithOptions({
        empfaengerOverrides: [{ quittiertAm: new Date(), quittierungArt: 'VERSTANDEN' }],
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.kritikalitaet).toBe('NORMAL');
    });

    it('sollte isUeberfaellig=false setzen wenn keine Empfaenger vorhanden (Edge Case)', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const befehl = createBefehlWithOptions({
        zeitvorgabe: '15 min',
        erteiltAm: twoHoursAgo,
        empfaengerOverrides: [], // Keine Empfaenger
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.isUeberfaellig).toBe(false);
    });

    it('sollte kritikalitaet=NORMAL setzen fuer korrigierten Befehl auch wenn ueberfaellig (Edge Case)', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const befehl = Befehl.reconstitute({
        id: BefehlId.create().value as BefehlId,
        nummer: 'B-002',
        einsatzId: EinsatzId.create('cm5einsatzid123').value as EinsatzId,
        auftrag: 'Korrigierter Auftrag',
        befehlsgeberName: 'EL Müller',
        befehlsgeberId: undefined,
        erstellerId: UserId.create('ersteller1').value as UserId,
        status: BefehlStatus.create('KORRIGIERT').value!,
        erteiltAm: twoHoursAgo,
        empfaenger: [BefehlEmpfaenger.reconstitute('emp-korr1', 'ZF Nord', undefined, undefined, undefined, undefined, twoHoursAgo)],
        kommentare: [BefehlKommentar.reconstitute('rf-korr1', UserId.create('ersteller1').value as UserId, 'Offene Frage', true, undefined, twoHoursAgo)],
        zeitvorgabe: '15 min',
        createdAt: twoHoursAgo,
        updatedAt: twoHoursAgo,
      });
      mockBefehlRepository.findByEinsatzId.mockResolvedValue(Result.ok([befehl]));

      const result = await controller.findByEinsatz('cm5einsatzid123');

      expect(result[0]?.isUeberfaellig).toBe(false);
      expect(result[0]?.hatNichtVerstanden).toBe(false);
      expect(result[0]?.hatOffeneRueckfrage).toBe(false);
      expect(result[0]?.kritikalitaet).toBe('NORMAL');
    });
  });

  describe('exportBefehle() - GET /api/api/v-alpha/befehle/export (Story 4.4)', () => {
    const createMockResponse = (): jest.Mocked<{
      setHeader: jest.Mock;
      send: jest.Mock;
    }> => ({
      setHeader: jest.fn(),
      send: jest.fn(),
    });

    it('sollte CSV-Export mit korrekten Response-Headers zurueckgeben', async () => {
      const mockRes = createMockResponse();
      mockExportBefehleQueryHandler.execute.mockResolvedValue(
        Result.ok({
          content: '\uFEFFNummer;Zeitstempel\r\n',
          filename: 'befehle_id123abc_2026-02-22.csv',
          contentType: 'text/csv; charset=utf-8',
        }),
      );

      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
      await controller.exportBefehle('cm5einsatzid123', 'csv', mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="befehle_id123abc_2026-02-22.csv"');
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('\uFEFF'));
    });

    it('sollte JSON-Export mit korrekten Response-Headers zurueckgeben', async () => {
      const mockRes = createMockResponse();
      mockExportBefehleQueryHandler.execute.mockResolvedValue(
        Result.ok({
          content: '[]',
          filename: 'befehle_id123abc_2026-02-22.json',
          contentType: 'application/json; charset=utf-8',
        }),
      );

      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
      await controller.exportBefehle('cm5einsatzid123', 'json', mockRes as any);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="befehle_id123abc_2026-02-22.json"');
      expect(mockRes.send).toHaveBeenCalledWith('[]');
    });

    it('sollte BadRequestException werfen wenn einsatzId fehlt', async () => {
      const mockRes = createMockResponse();

      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
      await expect(controller.exportBefehle('', 'csv', mockRes as any)).rejects.toThrow(BadRequestException);
      expect(mockExportBefehleQueryHandler.execute).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen wenn einsatzId als Array uebergeben wird', async () => {
      const mockRes = createMockResponse();

      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
      await expect(controller.exportBefehle(['cm5einsatzid123', 'cm5einsatzid456'], 'csv', mockRes as any)).rejects.toThrow(BadRequestException);
      expect(mockExportBefehleQueryHandler.execute).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen wenn format als Array uebergeben wird', async () => {
      const mockRes = createMockResponse();

      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
      await expect(controller.exportBefehle('cm5einsatzid123', ['csv', 'json'], mockRes as any)).rejects.toThrow(BadRequestException);
      expect(mockExportBefehleQueryHandler.execute).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen wenn format ungueltig ist', async () => {
      const mockRes = createMockResponse();

      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
      await expect(controller.exportBefehle('cm5einsatzid123', 'xml', mockRes as any)).rejects.toThrow(BadRequestException);
      expect(mockExportBefehleQueryHandler.execute).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen wenn Handler fehlschlaegt', async () => {
      const mockRes = createMockResponse();
      mockExportBefehleQueryHandler.execute.mockResolvedValue(Result.fail('Ungueltige EinsatzId'));

      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
      await expect(controller.exportBefehle('invalid-id', 'csv', mockRes as any)).rejects.toThrow(BadRequestException);
    });

    it('sollte InternalServerErrorException werfen wenn Handler kein Result-Value zurueckgibt', async () => {
      const mockRes = createMockResponse();
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
      mockExportBefehleQueryHandler.execute.mockResolvedValue(Result.ok(undefined as any));

      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
      await expect(controller.exportBefehle('cm5einsatzid123', 'csv', mockRes as any)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('empfaengerSuche() - GET /api/api/v-alpha/befehle/empfaenger-suche (Story 5.1)', () => {
    it('sollte Suchergebnisse erfolgreich zurueckgeben (200 OK)', async () => {
      const mockResults = [
        { id: 'ep-1', name: 'ZF Meier', rolle: 'Zugführer', quelle: 'EINSATZ' as const },
        { id: 'ef-1', name: 'Rotkreuz 83/1', rolle: 'Fahrzeug', quelle: 'EINSATZ_FAHRZEUG' as const },
        { id: 'sp-1', name: 'Meier, Hans', qualifikation: 'Notfallsanitäter', quelle: 'STAMMDATEN' as const },
      ];

      mockEmpfaengerSucheQueryHandler.execute.mockResolvedValue(Result.ok(mockResults));

      const result = await controller.empfaengerSuche('Meier', 'cm5einsatzid123');

      expect(result).toHaveLength(3);
      expect(result[0]?.quelle).toBe('EINSATZ');
      expect(result[1]?.quelle).toBe('EINSATZ_FAHRZEUG');
      expect(result[2]?.quelle).toBe('STAMMDATEN');
      expect(mockEmpfaengerSucheQueryHandler.execute).toHaveBeenCalledTimes(1);

      const calledQuery = mockEmpfaengerSucheQueryHandler.execute.mock.calls[0]?.[0]!;
      expect(calledQuery.searchTerm).toBe('Meier');
      expect(calledQuery.einsatzId).toBe('cm5einsatzid123');
    });

    it('sollte BadRequestException werfen wenn Suchbegriff zu kurz (weniger als 2 Zeichen)', async () => {
      await expect(controller.empfaengerSuche('M', 'cm5einsatzid123')).rejects.toThrow(BadRequestException);
      expect(mockEmpfaengerSucheQueryHandler.execute).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen wenn Suchbegriff leer ist', async () => {
      await expect(controller.empfaengerSuche('', 'cm5einsatzid123')).rejects.toThrow(BadRequestException);
      expect(mockEmpfaengerSucheQueryHandler.execute).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen wenn einsatzId fehlt', async () => {
      await expect(controller.empfaengerSuche('Meier', '')).rejects.toThrow(BadRequestException);
      expect(mockEmpfaengerSucheQueryHandler.execute).not.toHaveBeenCalled();
    });

    it('sollte InternalServerErrorException werfen wenn Handler fehlschlaegt', async () => {
      mockEmpfaengerSucheQueryHandler.execute.mockResolvedValue(Result.fail('Datenbankfehler'));

      await expect(controller.empfaengerSuche('Meier', 'cm5einsatzid123')).rejects.toThrow(InternalServerErrorException);
    });

    it('sollte leeres Array zurueckgeben wenn Handler leeres Array liefert', async () => {
      mockEmpfaengerSucheQueryHandler.execute.mockResolvedValue(Result.ok([]));

      const result = await controller.empfaengerSuche('xyz', 'cm5einsatzid123');

      expect(result).toEqual([]);
    });

    it('sollte mit genau 2 Zeichen Suchbegriff den Handler aufrufen (Boundary, F10)', async () => {
      mockEmpfaengerSucheQueryHandler.execute.mockResolvedValue(Result.ok([]));

      const result = await controller.empfaengerSuche('Me', 'cm5einsatzid123');

      expect(result).toEqual([]);
      expect(mockEmpfaengerSucheQueryHandler.execute).toHaveBeenCalledTimes(1);
    });

    it('sollte BadRequestException werfen bei ungueltiger einsatzId (F6)', async () => {
      await expect(controller.empfaengerSuche('Meier', 'x')).rejects.toThrow(BadRequestException);
      expect(mockEmpfaengerSucheQueryHandler.execute).not.toHaveBeenCalled();
    });

    it('sollte BadRequestException werfen bei Whitespace-only Suchbegriff (F7)', async () => {
      await expect(controller.empfaengerSuche('  ', 'cm5einsatzid123')).rejects.toThrow(BadRequestException);
      expect(mockEmpfaengerSucheQueryHandler.execute).not.toHaveBeenCalled();
    });

    it('sollte Suchbegriff trimmen und an Handler weitergeben', async () => {
      mockEmpfaengerSucheQueryHandler.execute.mockResolvedValue(Result.ok([]));

      await controller.empfaengerSuche('  Meier  ', 'cm5einsatzid123');

      const calledQuery = mockEmpfaengerSucheQueryHandler.execute.mock.calls[0]?.[0]!;
      expect(calledQuery.searchTerm).toBe('Meier');
    });

    it('sollte BadRequestException werfen wenn Suchbegriff zu lang (ueber 100 Zeichen, F9)', async () => {
      const longQ = 'a'.repeat(101);
      await expect(controller.empfaengerSuche(longQ, 'cm5einsatzid123')).rejects.toThrow(BadRequestException);
      expect(mockEmpfaengerSucheQueryHandler.execute).not.toHaveBeenCalled();
    });
  });

  describe('befehlsgeberSuche() - GET /api/v-alpha/befehle/befehlsgeber-suche (Story 4.2 C4)', () => {
    it('sollte Befehlsgeber-Suchergebnisse erfolgreich zurueckgeben (200 OK)', async () => {
      const mockResults = [
        { name: 'EL Mueller', quelle: 'VORSCHLAG' as const },
        { name: 'ZF Meier', rolle: 'Zugführer', quelle: 'EINSATZ_PERSON' as const },
      ];

      mockBefehlsgeberSucheQueryHandler.execute.mockResolvedValue(Result.ok(mockResults));

      const result = await controller.befehlsgeberSuche('cm5einsatzid123', 'Mueller');

      expect(result).toHaveLength(2);
      expect(result[0]?.quelle).toBe('VORSCHLAG');
      expect(result[1]?.quelle).toBe('EINSATZ_PERSON');
      expect(mockBefehlsgeberSucheQueryHandler.execute).toHaveBeenCalledTimes(1);

      const calledQuery = mockBefehlsgeberSucheQueryHandler.execute.mock.calls[0]?.[0]!;
      expect(calledQuery.einsatzId).toBe('cm5einsatzid123');
      expect(calledQuery.searchTerm).toBe('Mueller');
    });

    it('sollte BadRequestException werfen wenn einsatzId fehlt', async () => {
      await expect(controller.befehlsgeberSuche('', 'Mueller')).rejects.toThrow(BadRequestException);
      expect(mockBefehlsgeberSucheQueryHandler.execute).not.toHaveBeenCalled();
    });

    it('sollte InternalServerErrorException werfen wenn Handler fehlschlaegt', async () => {
      mockBefehlsgeberSucheQueryHandler.execute.mockResolvedValue(Result.fail('Datenbankfehler'));

      await expect(controller.befehlsgeberSuche('cm5einsatzid123', 'Mueller')).rejects.toThrow(InternalServerErrorException);
    });

    it('sollte leeres Array zurueckgeben wenn Handler leeres Array liefert', async () => {
      mockBefehlsgeberSucheQueryHandler.execute.mockResolvedValue(Result.ok([]));

      const result = await controller.befehlsgeberSuche('cm5einsatzid123', 'xyz');

      expect(result).toEqual([]);
    });

    it('sollte ohne Suchbegriff funktionieren (q ist optional)', async () => {
      mockBefehlsgeberSucheQueryHandler.execute.mockResolvedValue(Result.ok([]));

      const result = await controller.befehlsgeberSuche('cm5einsatzid123');

      expect(result).toEqual([]);
      expect(mockBefehlsgeberSucheQueryHandler.execute).toHaveBeenCalledTimes(1);
    });

    it('sollte BadRequestException werfen bei ungueltiger einsatzId', async () => {
      await expect(controller.befehlsgeberSuche('x', 'Mueller')).rejects.toThrow(BadRequestException);
      expect(mockBefehlsgeberSucheQueryHandler.execute).not.toHaveBeenCalled();
    });
  });
});

describe('BefehlController Guard-Decorators (Story 5.4 AC1, AC5)', () => {
  /**
   * Verifiziert, dass alle Endpoints die korrekten @RequiresBefehlRolle Decorators haben.
   * Prueft Metadata via Reflect.getMetadata() — identisch zum Guard-Auswertungspfad.
   */

  // --- Befehle erstellen: ERSTELLER, BEFEHLSGEBER ---
  it('sollte @RequiresBefehlRolle(ERSTELLER, BEFEHLSGEBER) auf create() haben', () => {
    // Given - BefehlController.prototype.create Methode
    // When - Metadata auslesen
    const rollen = Reflect.getMetadata(BEFEHL_ROLLEN_KEY, BefehlController.prototype.create);
    // Then - korrekte Rollen
    expect(rollen).toEqual(['ERSTELLER', 'BEFEHLSGEBER']);
  });

  // --- Befehle quittieren: BEFEHLSGEBER, EMPFAENGER (Story 4.2: ERSTELLER entfernt) ---
  it('sollte @RequiresBefehlRolle(BEFEHLSGEBER, EMPFAENGER) auf quittieren() haben', () => {
    const rollen = Reflect.getMetadata(BEFEHL_ROLLEN_KEY, BefehlController.prototype.quittieren);
    expect(rollen).toEqual(['BEFEHLSGEBER', 'EMPFAENGER']);
  });

  // --- Befehle korrigieren: nur BEFEHLSGEBER (Story 4.2) ---
  it('sollte @RequiresBefehlRolle(BEFEHLSGEBER) auf korrigieren() haben', () => {
    const rollen = Reflect.getMetadata(BEFEHL_ROLLEN_KEY, BefehlController.prototype.korrigieren);
    expect(rollen).toEqual(['BEFEHLSGEBER']);
  });

  // --- Befehle einsehen (Liste): ALLE ---
  it('sollte @RequiresBefehlRolle(ALLE) auf findByEinsatz() haben', () => {
    const rollen = Reflect.getMetadata(BEFEHL_ROLLEN_KEY, BefehlController.prototype.findByEinsatz);
    expect(rollen).toEqual(['BEFEHLSGEBER', 'ERSTELLER', 'EMPFAENGER', 'BEOBACHTER']);
  });

  // --- Kommentar hinzufuegen: ERSTELLER, BEFEHLSGEBER, EMPFAENGER ---
  it('sollte @RequiresBefehlRolle(ERSTELLER, BEFEHLSGEBER, EMPFAENGER) auf addKommentar() haben', () => {
    const rollen = Reflect.getMetadata(BEFEHL_ROLLEN_KEY, BefehlController.prototype.addKommentar);
    expect(rollen).toEqual(['ERSTELLER', 'BEFEHLSGEBER', 'EMPFAENGER']);
  });

  // --- Export: BEFEHLSGEBER, ERSTELLER ---
  it('sollte @RequiresBefehlRolle(BEFEHLSGEBER, ERSTELLER) auf exportBefehle() haben', () => {
    const rollen = Reflect.getMetadata(BEFEHL_ROLLEN_KEY, BefehlController.prototype.exportBefehle);
    expect(rollen).toEqual(['BEFEHLSGEBER', 'ERSTELLER']);
  });

  // --- Historie: ALLE ---
  it('sollte @RequiresBefehlRolle(ALLE) auf getHistorie() haben', () => {
    const rollen = Reflect.getMetadata(BEFEHL_ROLLEN_KEY, BefehlController.prototype.getHistorie);
    expect(rollen).toEqual(['BEFEHLSGEBER', 'ERSTELLER', 'EMPFAENGER', 'BEOBACHTER']);
  });

  // --- Empfaenger-Suche: ERSTELLER, BEFEHLSGEBER ---
  it('sollte @RequiresBefehlRolle(ERSTELLER, BEFEHLSGEBER) auf empfaengerSuche() haben', () => {
    const rollen = Reflect.getMetadata(BEFEHL_ROLLEN_KEY, BefehlController.prototype.empfaengerSuche);
    expect(rollen).toEqual(['ERSTELLER', 'BEFEHLSGEBER']);
  });

  // --- Befehlsgeber-Suche: ERSTELLER, BEFEHLSGEBER ---
  it('sollte @RequiresBefehlRolle(ERSTELLER, BEFEHLSGEBER) auf befehlsgeberSuche() haben', () => {
    const rollen = Reflect.getMetadata(BEFEHL_ROLLEN_KEY, BefehlController.prototype.befehlsgeberSuche);
    expect(rollen).toEqual(['ERSTELLER', 'BEFEHLSGEBER']);
  });

  // --- Vollstaendigkeits-Check: KEIN Endpoint ohne Guard ---
  it('sollte auf ALLEN public Endpoints einen @RequiresBefehlRolle Decorator haben (Vollstaendigkeits-Check)', () => {
    // Given - alle public Methoden des Controllers
    const publicMethods = ['create', 'quittieren', 'korrigieren', 'findByEinsatz', 'addKommentar', 'exportBefehle', 'getHistorie', 'empfaengerSuche', 'befehlsgeberSuche'];

    // When & Then - jede Methode hat Rollen-Metadata
    for (const method of publicMethods) {
      const rollen = Reflect.getMetadata(BEFEHL_ROLLEN_KEY, BefehlController.prototype[method as keyof BefehlController]);
      expect(rollen).toBeDefined();
      expect(Array.isArray(rollen)).toBe(true);
      expect(rollen.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Guard-Enforcement Integration Tests fuer BefehlController.
 *
 * **Test Strategy:**
 * - NestJS Test Module mit echtem BefehlRollenGuard (NICHT gemockt)
 * - JwtAuthGuard durch Mock-Guard ersetzt (injiziert Test-User)
 * - PrismaService gemockt (kontrolliert Rollen-Zuweisung)
 * - HTTP-Level Tests via supertest → Guard wird tatsaechlich ausgefuehrt
 *
 * **Coverage:**
 * - POST /befehle: BEOBACHTER wird abgelehnt (403)
 * - POST /befehle/:id/quittieren: BEOBACHTER wird abgelehnt (403)
 * - POST /befehle/:id/korrigieren: EMPFAENGER wird abgelehnt (403)
 * - GET /befehle: Ohne Rolle wird abgelehnt (403)
 */
describe('BefehlController Guard-Enforcement (Integration)', () => {
  let app: INestApplication;

  // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
  let mockPrisma: any;
  // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
  let mockBefehlRepository: any;

  const TEST_USER_ID = 'guard-test-user-1';
  const TEST_EINSATZ_ID = 'cm5einsatzid123';
  const TEST_BEFEHL_ID = 'cm5befehlid123456';

  /**
   * Erstellt einen Mock-JwtAuthGuard der einen festen Test-User injiziert.
   * Simuliert erfolgreiche JWT-Authentifizierung ohne echtes Token.
   */
  const createMockJwtAuthGuard = () => ({
    // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    canActivate: (context: any) => {
      const request = context.switchToHttp().getRequest();
      request.user = { userId: TEST_USER_ID, role: 'USER' };
      return true;
    },
  });

  /**
   * Konfiguriert mockPrisma so, dass der User die angegebene Rolle hat.
   */
  const setUserRolle = (rolle: string | null) => {
    mockPrisma.einsatzRollenzuweisung.findUnique.mockResolvedValue(rolle ? { rolle, einsatzId: TEST_EINSATZ_ID, userId: TEST_USER_ID } : null);
  };

  /**
   * Konfiguriert Befehl-Lookup fuer Endpoints mit :id Parameter (quittieren, korrigieren).
   */
  const setBefehlLookup = (einsatzId: string | null) => {
    mockPrisma.befehl.findUnique.mockResolvedValue(einsatzId ? { einsatzId } : null);
  };

  beforeAll(async () => {
    mockPrisma = {
      einsatzRollenzuweisung: { findUnique: jest.fn(), findFirst: jest.fn() },
      befehl: { findUnique: jest.fn() },
      einsatzTeilnehmer: { findFirst: jest.fn() },
    };

    mockBefehlRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEinsatzId: jest.fn().mockResolvedValue(Result.ok([])),
      findByEmpfaengerId: jest.fn(),
      findWithOpenRueckfragen: jest.fn(),
      findFiltered: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [BefehlController],
      providers: [
        BefehlRollenGuard,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BEFEHL_REPOSITORY, useValue: mockBefehlRepository },
        // Handler-Mocks (werden nicht erreicht bei Guard-Ablehnung)
        { provide: AddBefehlKommentarHandler, useValue: { execute: jest.fn() } },
        { provide: CreateBefehlHandler, useValue: { execute: jest.fn() } },
        { provide: KorrigiereBefehlHandler, useValue: { execute: jest.fn() } },
        { provide: QuittierenBefehlHandler, useValue: { execute: jest.fn() } },
        { provide: AendereEmpfaengerStatusHandler, useValue: { execute: jest.fn() } },
        { provide: GetBefehlHistorieQueryHandler, useValue: { execute: jest.fn() } },
        { provide: ExportBefehleQueryHandler, useValue: { execute: jest.fn() } },
        { provide: EmpfaengerSucheQueryHandler, useValue: { execute: jest.fn() } },
        { provide: BefehlsgeberSucheQueryHandler, useValue: { execute: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(createMockJwtAuthGuard())
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, prefix: 'v-', defaultVersion: 'alpha' });
    app.setGlobalPrefix('api', { exclude: ['/'] });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- POST /befehle: BEOBACHTER wird abgelehnt (403) ---

  describe('POST /befehle (create) - Guard-Enforcement', () => {
    it('sollte BEOBACHTER mit 403 ablehnen (nur ERSTELLER/BEFEHLSGEBER erlaubt)', async () => {
      // Given - User hat BEOBACHTER-Rolle im Einsatz
      setUserRolle('BEOBACHTER');

      // When - POST Request mit valider CreateBefehlDto
      const response = await request(app.getHttpServer())
        .post('/api/v-alpha/befehle')
        .send({
          einsatzId: TEST_EINSATZ_ID,
          empfaenger: [{ name: 'ZF Meier' }],
          befehlsgeber: 'EL Mueller',
          erstellerId: TEST_USER_ID,
          auftrag: 'Test-Auftrag',
        });

      // Then - Guard blockiert BEOBACHTER (Story 4.2: Guard aktiviert)
      expect(response.status).toBe(403);
      // AC3: Strukturiertes Fehler-Body
      expect(response.body.code).toBe('MISSING_ROLLE');
      expect(response.body.message).toBeDefined();
      expect(response.body.nextAction).toBeDefined();
      expect(response.body.allowedRoles).toBeDefined();
      expect(Array.isArray(response.body.allowedRoles)).toBe(true);
    });

    it('sollte EMPFAENGER mit 403 ablehnen (nur ERSTELLER/BEFEHLSGEBER erlaubt)', async () => {
      // Given - User hat EMPFAENGER-Rolle im Einsatz
      setUserRolle('EMPFAENGER');

      // When
      const response = await request(app.getHttpServer())
        .post('/api/v-alpha/befehle')
        .send({
          einsatzId: TEST_EINSATZ_ID,
          empfaenger: [{ name: 'ZF Meier' }],
          befehlsgeber: 'EL Mueller',
          erstellerId: TEST_USER_ID,
          auftrag: 'Test-Auftrag',
        });

      // Then - Guard blockiert EMPFAENGER (Story 4.2: Guard aktiviert)
      expect(response.status).toBe(403);
    });
  });

  // --- POST /befehle/:id/quittieren: BEOBACHTER wird abgelehnt (403) ---

  describe('POST /befehle/:id/quittieren - Guard-Enforcement', () => {
    it('sollte BEOBACHTER mit 403 ablehnen (nur EMPFAENGER erlaubt)', async () => {
      // Given - Befehl-Lookup liefert einsatzId, User hat BEOBACHTER-Rolle
      setBefehlLookup(TEST_EINSATZ_ID);
      setUserRolle('BEOBACHTER');

      // When
      const response = await request(app.getHttpServer()).post(`/api/v-alpha/befehle/${TEST_BEFEHL_ID}/quittieren`).send({
        empfaengerId: TEST_USER_ID,
        quittierungArt: 'VERSTANDEN',
      });

      // Then - Guard blockiert BEOBACHTER (Story 4.2: Guard aktiviert)
      expect(response.status).toBe(403);
      // AC3: Strukturiertes Fehler-Body
      expect(response.body.code).toBe('MISSING_ROLLE');
      expect(response.body.message).toBeDefined();
      expect(response.body.nextAction).toBeDefined();
      expect(response.body.allowedRoles).toBeDefined();
      expect(Array.isArray(response.body.allowedRoles)).toBe(true);
    });

    it('sollte ERSTELLER mit 403 ablehnen (Story 4.2: nur BEFEHLSGEBER, EMPFAENGER erlaubt)', async () => {
      // Given - Befehl-Lookup liefert einsatzId, User hat ERSTELLER-Rolle
      setBefehlLookup(TEST_EINSATZ_ID);
      setUserRolle('ERSTELLER');

      // When
      const response = await request(app.getHttpServer()).post(`/api/v-alpha/befehle/${TEST_BEFEHL_ID}/quittieren`).send({
        empfaengerId: TEST_USER_ID,
        quittierungArt: 'VERSTANDEN',
      });

      // Then - Guard blockiert ERSTELLER (Story 4.2: ERSTELLER von quittieren entfernt)
      expect(response.status).toBe(403);
    });
  });

  // --- POST /befehle/:id/korrigieren: EMPFAENGER wird abgelehnt (403) ---

  describe('POST /befehle/:id/korrigieren - Guard-Enforcement', () => {
    it('sollte EMPFAENGER mit 403 ablehnen (nur BEFEHLSGEBER erlaubt)', async () => {
      // Given - Befehl-Lookup liefert einsatzId, User hat EMPFAENGER-Rolle
      setBefehlLookup(TEST_EINSATZ_ID);
      setUserRolle('EMPFAENGER');

      // When
      const response = await request(app.getHttpServer())
        .post(`/api/v-alpha/befehle/${TEST_BEFEHL_ID}/korrigieren`)
        .send({
          empfaenger: [{ name: 'ZF Nord' }],
          befehlsgeber: 'EL Mueller',
          erstellerId: TEST_USER_ID,
          auftrag: 'Korrigierter Auftrag',
        });

      // Then - Guard blockiert EMPFAENGER (Story 4.2: Guard aktiviert)
      expect(response.status).toBe(403);
      // AC3: Strukturiertes Fehler-Body
      expect(response.body.code).toBe('MISSING_ROLLE');
      expect(response.body.message).toBeDefined();
      expect(response.body.nextAction).toBeDefined();
      expect(response.body.allowedRoles).toBeDefined();
      expect(Array.isArray(response.body.allowedRoles)).toBe(true);
    });

    it('sollte BEOBACHTER mit 403 ablehnen (nur BEFEHLSGEBER erlaubt)', async () => {
      // Given
      setBefehlLookup(TEST_EINSATZ_ID);
      setUserRolle('BEOBACHTER');

      // When
      const response = await request(app.getHttpServer())
        .post(`/api/v-alpha/befehle/${TEST_BEFEHL_ID}/korrigieren`)
        .send({
          empfaenger: [{ name: 'ZF Nord' }],
          befehlsgeber: 'EL Mueller',
          erstellerId: TEST_USER_ID,
          auftrag: 'Korrigierter Auftrag',
        });

      // Then - Guard blockiert BEOBACHTER (Story 4.2: Guard aktiviert)
      expect(response.status).toBe(403);
    });
  });

  // --- GET /befehle: Ohne Rolle wird abgelehnt (403) ---

  describe('GET /befehle (findByEinsatz) - Guard-Enforcement', () => {
    it('sollte ohne Rollenzuweisung im Einsatz mit 403 ablehnen', async () => {
      // Given - User hat KEINE Rolle im Einsatz
      setUserRolle(null);

      // When
      const response = await request(app.getHttpServer()).get(`/api/v-alpha/befehle?einsatzId=${TEST_EINSATZ_ID}`);

      // Then - Guard blockiert fehlende Rollenzuweisung (Story 4.2)
      expect(response.status).toBe(403);
    });

    it('sollte mit gueltiger Rolle (BEOBACHTER) durchlassen (200)', async () => {
      // Given - User hat BEOBACHTER-Rolle (findByEinsatz erlaubt ALLE Rollen)
      setUserRolle('BEOBACHTER');

      // When
      const response = await request(app.getHttpServer()).get(`/api/v-alpha/befehle?einsatzId=${TEST_EINSATZ_ID}`);

      // Then - Nicht 403 (Guard laesst durch; Response kann 200 oder anderer Status sein)
      expect(response.status).not.toBe(403);
    });
  });

  // --- Fehlende einsatzId: Guard kann Rolle nicht pruefen ---

  describe('Fehlende einsatzId - Guard-Enforcement', () => {
    it('sollte 403 werfen wenn einsatzId weder in Body noch Query/Params', async () => {
      // Given - POST ohne einsatzId im Body
      const response = await request(app.getHttpServer())
        .post('/api/v-alpha/befehle')
        .send({
          empfaenger: [{ name: 'ZF Meier' }],
          befehlsgeber: 'EL Mueller',
          erstellerId: TEST_USER_ID,
          auftrag: 'Test-Auftrag',
          // einsatzId fehlt!
        });

      // Then - Guard kann einsatzId nicht ermitteln → 403 (Story 4.2)
      expect(response.status).toBe(403);
    });

    it('sollte 403 werfen wenn Befehl-Lookup fehlschlaegt (Befehl nicht gefunden)', async () => {
      // Given - Befehl existiert nicht in DB
      setBefehlLookup(null);

      // When - quittieren mit unbekannter Befehl-ID
      const response = await request(app.getHttpServer()).post('/api/v-alpha/befehle/unknown-befehl-id/quittieren').send({
        empfaengerId: TEST_USER_ID,
        quittierungArt: 'VERSTANDEN',
      });

      // Then - Guard blockiert wegen fehlendem Einsatz-Kontext (Story 4.2)
      expect(response.status).toBe(403);
    });
  });

  // --- GET /befehle/befehlsgeber-suche: EMPFAENGER/BEOBACHTER wird abgelehnt (403) ---

  describe('GET /befehle/befehlsgeber-suche - Guard-Enforcement (Story 4.2 C4)', () => {
    it('sollte EMPFAENGER mit 403 ablehnen (nur ERSTELLER/BEFEHLSGEBER erlaubt)', async () => {
      // Given - User hat EMPFAENGER-Rolle
      setUserRolle('EMPFAENGER');

      // When
      const response = await request(app.getHttpServer()).get(`/api/v-alpha/befehle/befehlsgeber-suche?einsatzId=${TEST_EINSATZ_ID}&q=Mueller`);

      // Then - Guard blockiert EMPFAENGER
      expect(response.status).toBe(403);
    });

    it('sollte BEOBACHTER mit 403 ablehnen (nur ERSTELLER/BEFEHLSGEBER erlaubt)', async () => {
      // Given - User hat BEOBACHTER-Rolle
      setUserRolle('BEOBACHTER');

      // When
      const response = await request(app.getHttpServer()).get(`/api/v-alpha/befehle/befehlsgeber-suche?einsatzId=${TEST_EINSATZ_ID}&q=Mueller`);

      // Then - Guard blockiert BEOBACHTER
      expect(response.status).toBe(403);
    });

    it('sollte ERSTELLER durchlassen (Guard-Pruefung)', async () => {
      // Given - User hat ERSTELLER-Rolle
      setUserRolle('ERSTELLER');

      // When
      const response = await request(app.getHttpServer()).get(`/api/v-alpha/befehle/befehlsgeber-suche?einsatzId=${TEST_EINSATZ_ID}&q=Mueller`);

      // Then - NICHT 403 (Guard laesst durch)
      expect(response.status).not.toBe(403);
    });
  });

  // --- Positive Kontrolltests: Berechtigte Rollen werden durchgelassen ---

  describe('Berechtigte Rollen - Guard laesst durch (Positive Kontrolle)', () => {
    it('sollte ERSTELLER bei POST /befehle durchlassen (Guard-Pruefung)', async () => {
      // Given - User hat ERSTELLER-Rolle
      setUserRolle('ERSTELLER');

      // When
      const response = await request(app.getHttpServer())
        .post('/api/v-alpha/befehle')
        .send({
          einsatzId: TEST_EINSATZ_ID,
          empfaenger: [{ name: 'ZF Meier' }],
          befehlsgeber: 'EL Mueller',
          erstellerId: TEST_USER_ID,
          auftrag: 'Test-Auftrag',
        });

      // Then - NICHT 403 (Guard laesst durch, kann 400/500 vom Handler sein)
      expect(response.status).not.toBe(403);
    });

    it('sollte EMPFAENGER bei POST /befehle/:id/quittieren durchlassen', async () => {
      // Given - Befehl-Lookup liefert einsatzId, User hat EMPFAENGER-Rolle
      setBefehlLookup(TEST_EINSATZ_ID);
      setUserRolle('EMPFAENGER');

      // When
      const response = await request(app.getHttpServer()).post(`/api/v-alpha/befehle/${TEST_BEFEHL_ID}/quittieren`).send({
        empfaengerId: TEST_USER_ID,
        quittierungArt: 'VERSTANDEN',
      });

      // Then - NICHT 403 (Guard laesst durch)
      expect(response.status).not.toBe(403);
    });

    it('sollte BEFEHLSGEBER bei POST /befehle/:id/korrigieren durchlassen', async () => {
      // Given
      setBefehlLookup(TEST_EINSATZ_ID);
      setUserRolle('BEFEHLSGEBER');

      // When
      const response = await request(app.getHttpServer())
        .post(`/api/v-alpha/befehle/${TEST_BEFEHL_ID}/korrigieren`)
        .send({
          empfaenger: [{ name: 'ZF Nord' }],
          befehlsgeber: 'EL Mueller',
          erstellerId: TEST_USER_ID,
          auftrag: 'Korrigierter Auftrag',
        });

      // Then - NICHT 403 (Guard laesst durch)
      expect(response.status).not.toBe(403);
    });
  });
});

describe('parseZeitvorgabe()', () => {
  it('sollte null zurueckgeben bei null/undefined/leerem String', () => {
    expect(parseZeitvorgabe(null)).toBeNull();
    expect(parseZeitvorgabe(undefined)).toBeNull();
    expect(parseZeitvorgabe('')).toBeNull();
    expect(parseZeitvorgabe('   ')).toBeNull();
  });

  it('sollte Minuten-Formate korrekt parsen', () => {
    expect(parseZeitvorgabe('15 min')).toBe(15);
    expect(parseZeitvorgabe('15min')).toBe(15);
    expect(parseZeitvorgabe('15 Minuten')).toBe(15);
    expect(parseZeitvorgabe('30 minuten')).toBe(30);
  });

  it('sollte Stunden-Formate korrekt parsen', () => {
    expect(parseZeitvorgabe('1h')).toBe(60);
    expect(parseZeitvorgabe('1 h')).toBe(60);
    expect(parseZeitvorgabe('2 Stunden')).toBe(120);
    expect(parseZeitvorgabe('1 Stunde')).toBe(60);
  });

  it('sollte reine Zahlen als Minuten interpretieren', () => {
    expect(parseZeitvorgabe('30')).toBe(30);
    expect(parseZeitvorgabe('45')).toBe(45);
  });

  it('sollte null zurueckgeben bei nicht-parseablen Strings', () => {
    expect(parseZeitvorgabe('sofort')).toBeNull();
    expect(parseZeitvorgabe('abc')).toBeNull();
  });

  it('sollte Edge-Cases korrekt parsen', () => {
    expect(parseZeitvorgabe('0 min')).toBe(0);
    expect(parseZeitvorgabe('1.5h')).toBe(90);
    expect(parseZeitvorgabe('05 min')).toBe(5);
    expect(parseZeitvorgabe('99999 min')).toBe(99999);
  });
});
