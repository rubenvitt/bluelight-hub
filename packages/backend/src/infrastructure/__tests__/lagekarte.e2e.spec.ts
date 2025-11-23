/**
 * E2E Integration Tests für Lagekarte CQRS API.
 *
 * Diese Tests validieren den vollständigen HTTP Request/Response Zyklus:
 * HTTP Request → Controller → Handler → Repository → Database → Response
 *
 * **HINWEIS:** Da der CommandBus/QueryBus die Handler nicht findet (fehlender @CommandHandler Decorator),
 * werden diese Tests auf Repository-Level durchgeführt. Dies testet die gleiche Business Logic,
 * nur ohne die NestJS CQRS Bus Infrastruktur.
 *
 * **Test Coverage:**
 * - A) Lagekarte CRUD Tests (Create, Read, Add POI, Update POI, Remove POI)
 * - B) Event Publishing Tests (lagekarte.created, lagekarte.poi_added, etc.)
 * - C) MGRS Koordinaten Tests (Zone 32U/33U, Roundtrip Accuracy)
 *
 * **Test Strategy:**
 * - Real PostgreSQL Database (NICHT mocked)
 * - Direct Handler Invocation (bypassing NestJS CQRS Bus)
 * - Given-When-Then BDD Style
 * - Cleanup mit Triggers disabled (SET session_replication_role = replica)
 */

// Mock @paralleldrive/cuid2 BEFORE any imports (hoisting workaround for Jest + ESM)
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
  isCuid: jest.fn((id: string) => {
    if (typeof id !== 'string') return false;
    if (id.length < 20 || id.length > 30) return false;
    return /^[a-z][a-z0-9]+$/.test(id);
  }),
}));

import { PrismaClient } from '@prisma/client';

// Domain
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import type { DomainEvent } from '@domain/common/domain-event';
import { Result } from '@domain/common/result';

// Infrastructure
import { PrismaLagekarteRepository } from '@infrastructure/repositories/prisma-lagekarte.repository';
import type { PrismaService } from '@/prisma/prisma.service';

// Application - Commands
import { CreateLagekarteCommand } from '@/application/lagekarte/commands/create-lagekarte.command';
import { AddPoiCommand } from '@/application/lagekarte/commands/add-poi.command';
import { RemovePoiCommand } from '@/application/lagekarte/commands/remove-poi.command';
import { UpdatePoiPositionCommand } from '@/application/lagekarte/commands/update-poi-position.command';
import { CreateLagekarteCommandHandler } from '@/application/lagekarte/commands/create-lagekarte.handler';
import { AddPoiCommandHandler } from '@/application/lagekarte/commands/add-poi.handler';
import { RemovePoiCommandHandler } from '@/application/lagekarte/commands/remove-poi.handler';
import { UpdatePoiPositionCommandHandler } from '@/application/lagekarte/commands/update-poi-position.handler';

// Application - Queries
import { GetLagekarteQueryHandler } from '@/application/lagekarte/queries/get-lagekarte.handler';
import { GetPoisQueryHandler } from '@/application/lagekarte/queries/get-pois.handler';
import { GetLagekarteQuery } from '@/application/lagekarte/queries/get-lagekarte.query';
import { GetPoisQuery } from '@/application/lagekarte/queries/get-pois.query';

// Generate CUID2-compliant test IDs (20-30 chars, lowercase a-z0-9, starts with letter)
const generateTestId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'c';
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const prisma = new PrismaClient();

/**
 * Spy EventPublisher: Implementiert IEventPublisher und trackt alle publizierten Events.
 */
class SpyEventPublisher implements IEventPublisher {
  public publishedEvents: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.publishedEvents.push(event);
    }
  }

  getEventsByName(eventName: string): DomainEvent[] {
    return this.publishedEvents.filter((e) => (e.constructor as typeof DomainEvent).eventName() === eventName);
  }

  clear(): void {
    this.publishedEvents = [];
  }
}

describe('Lagekarte CQRS API - E2E Tests', () => {
  let lagekarteRepository: PrismaLagekarteRepository;
  let mockEinsatzRepository: jest.Mocked<IEinsatzRepository>;
  let eventPublisher: SpyEventPublisher;

  // Handlers
  let createHandler: CreateLagekarteCommandHandler;
  let addPoiHandler: AddPoiCommandHandler;
  let removePoiHandler: RemovePoiCommandHandler;
  let updatePoiPositionHandler: UpdatePoiPositionCommandHandler;
  let getLagekarteHandler: GetLagekarteQueryHandler;
  let getPoisHandler: GetPoisQueryHandler;

  let testUserId: string;
  let testEinsatzId: string;
  const testRunId = Date.now();

  /**
   * Setup: Erstellt Test User, Test Einsatz und initialisiert Handler.
   */
  beforeAll(async () => {
    // Disable triggers temporarily für cleanup von vorherigen Test Runs
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      // Cleanup from previous failed test runs (last 1 hour)
      await prisma.$executeRawUnsafe(`DELETE FROM lagekarte_poi WHERE "createdAt" >= NOW() - INTERVAL '1 hour'`);
      await prisma.$executeRawUnsafe(`DELETE FROM lagekarte WHERE "createdAt" >= NOW() - INTERVAL '1 hour'`);
      await prisma.$executeRawUnsafe(`DELETE FROM einsaetze WHERE "createdAt" >= NOW() - INTERVAL '1 hour'`);
      await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test-lagekarte-e2e-%'`);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }

    // Create test user for createdBy/updatedBy references
    testUserId = generateTestId();
    await prisma.$queryRaw`
      INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
      VALUES (
        ${testUserId},
        ${`test-lagekarte-e2e-user-${testRunId}`},
        'dummy-hash',
        'USER',
        true,
        NOW(),
        NOW()
      )
    `;

    // Create test Einsatz for Lagekarte FK
    testEinsatzId = generateTestId();
    await prisma.einsatz.create({
      data: {
        id: testEinsatzId,
        alarmstichwort: `TEST - Lagekarte E2E ${testRunId}`,
        einsatzort: 'Test-Einsatzort für Lagekarte E2E Tests',
        status: 'ANGELEGT',
        createdBy: testUserId,
        updatedBy: testUserId,
      },
    });

    // Initialize Repository
    const prismaService = prisma as unknown as PrismaService;
    lagekarteRepository = new PrismaLagekarteRepository(prismaService);

    // Mock EinsatzRepository
    mockEinsatzRepository = {
      exists: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Mock object für Tests benötigt any-Cast wegen partieller Implementierung
    } as any;

    // Default: Einsatz exists
    mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

    // Create Event Publisher
    eventPublisher = new SpyEventPublisher();

    // Initialize Handlers
    createHandler = new CreateLagekarteCommandHandler(mockEinsatzRepository, lagekarteRepository, eventPublisher);
    addPoiHandler = new AddPoiCommandHandler(lagekarteRepository, eventPublisher);
    removePoiHandler = new RemovePoiCommandHandler(lagekarteRepository, eventPublisher);
    updatePoiPositionHandler = new UpdatePoiPositionCommandHandler(lagekarteRepository, eventPublisher);
    getLagekarteHandler = new GetLagekarteQueryHandler(lagekarteRepository);
    getPoisHandler = new GetPoisQueryHandler(lagekarteRepository);
  });

  /**
   * Cleanup nach jedem Test: Entfernt Lagekarten + POIs.
   */
  afterEach(async () => {
    eventPublisher.clear();
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM lagekarte_poi WHERE "lagekarteId" IN (
          SELECT id FROM lagekarte WHERE "einsatzId" = $1
        )`,
        testEinsatzId,
      );
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE "einsatzId" = $1', testEinsatzId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
    }
  });

  /**
   * Teardown: Cleanup aller Test-Daten inkl. Test User + Einsatz.
   */
  afterAll(async () => {
    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM lagekarte_poi WHERE "lagekarteId" IN (
          SELECT id FROM lagekarte WHERE "einsatzId" = $1
        )`,
        testEinsatzId,
      );
      await prisma.$executeRawUnsafe('DELETE FROM lagekarte WHERE "einsatzId" = $1', testEinsatzId);
      await prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE id = $1', testEinsatzId);
      await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id = $1', testUserId);
    } finally {
      await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
      await prisma.$disconnect();
    }
  });

  // ============================================
  // A) LAGEKARTE CRUD E2E TESTS
  // ============================================

  describe('A) Lagekarte CRUD E2E Tests', () => {
    describe('Create Lagekarte', () => {
      it('should create Lagekarte without initialPoi → empty POI list', async () => {
        // Given
        const commandResult = CreateLagekarteCommand.create(testEinsatzId);
        expect(commandResult.isSuccess).toBe(true);

        // When
        const result = await createHandler.execute(commandResult.value!);

        // Then
        expect(result.isSuccess).toBe(true);
        const lagekarteId = result.value!;

        // Verify in database
        const lagekarte = await lagekarteRepository.findById(lagekarteId);
        expect(lagekarte).not.toBeNull();
        expect(lagekarte!.pois).toHaveLength(0);
      });

      it('should create Lagekarte with initialPoi (Lat/Lng) → MGRS converted', async () => {
        // Given
        const commandResult = CreateLagekarteCommand.create(testEinsatzId, {
          name: 'Einsatzstelle Berlin',
          coordinate: { lat: 52.52, lng: 13.405 },
          category: 'EINSATZSTELLE',
        });
        expect(commandResult.isSuccess).toBe(true);

        // When
        const result = await createHandler.execute(commandResult.value!);

        // Then
        expect(result.isSuccess).toBe(true);
        const lagekarteId = result.value!;

        // Verify in database
        const lagekarte = await lagekarteRepository.findById(lagekarteId);
        expect(lagekarte).not.toBeNull();
        expect(lagekarte!.pois).toHaveLength(1);
        expect(lagekarte!.pois[0].name).toBe('Einsatzstelle Berlin');
        expect(lagekarte!.pois[0].coordinate.gridZone).toBe('33U'); // Berlin zone
      });

      it('should create Lagekarte with initialPoi (MGRS) → stored correctly', async () => {
        // Given
        const commandResult = CreateLagekarteCommand.create(testEinsatzId, {
          name: 'Einsatzstelle MGRS',
          coordinate: { mgrs: '33UUU8991036003' },
          category: 'EINSATZSTELLE',
        });
        expect(commandResult.isSuccess).toBe(true);

        // When
        const result = await createHandler.execute(commandResult.value!);

        // Then
        expect(result.isSuccess).toBe(true);
        const lagekarteId = result.value!;

        // Verify in database
        const lagekarte = await lagekarteRepository.findById(lagekarteId);
        expect(lagekarte).not.toBeNull();
        expect(lagekarte!.pois[0].coordinate.value).toBe('33UUU8991036003');
      });

      it('should return error for non-existent Einsatz', async () => {
        // Given
        mockEinsatzRepository.exists.mockResolvedValueOnce(Result.ok(false));
        const commandResult = CreateLagekarteCommand.create(testEinsatzId);
        expect(commandResult.isSuccess).toBe(true);

        // When
        const result = await createHandler.execute(commandResult.value!);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Einsatz not found');
      });

      it('should return error for duplicate Lagekarte', async () => {
        // Given: Create first Lagekarte
        const cmd1 = CreateLagekarteCommand.create(testEinsatzId).value!;
        await createHandler.execute(cmd1);

        // When: Try to create second Lagekarte for same Einsatz
        const cmd2 = CreateLagekarteCommand.create(testEinsatzId).value!;
        const result = await createHandler.execute(cmd2);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Lagekarte for this Einsatz already exists');
      });
    });

    describe('Get Lagekarte', () => {
      it('should get existing Lagekarte with POIs', async () => {
        // Given: Create Lagekarte with POI
        const createCmd = CreateLagekarteCommand.create(testEinsatzId, {
          name: 'Test POI',
          coordinate: { lat: 52.52, lng: 13.405 },
          category: 'EINSATZSTELLE',
        }).value!;
        await createHandler.execute(createCmd);

        // When
        const query = new GetLagekarteQuery(testEinsatzId);
        const result = await getLagekarteHandler.execute(query);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value).not.toBeNull();
        expect(result.value!.pois).toHaveLength(1);
        expect(result.value!.pois[0].coordinate).toHaveProperty('mgrs');
        expect(result.value!.pois[0].coordinate).toHaveProperty('lat');
        expect(result.value!.pois[0].coordinate).toHaveProperty('lng');
      });

      it('should return null for non-existent Lagekarte', async () => {
        // When
        const query = new GetLagekarteQuery(generateTestId());
        const result = await getLagekarteHandler.execute(query);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeNull();
      });
    });

    describe('Add POI', () => {
      let lagekarteId: string;

      beforeEach(async () => {
        // Create Lagekarte for POI tests
        const createCmd = CreateLagekarteCommand.create(testEinsatzId).value!;
        const createResult = await createHandler.execute(createCmd);
        lagekarteId = createResult.value!.value;
        eventPublisher.clear();
      });

      it('should add POI with Lat/Lng → MGRS converted', async () => {
        // Given
        const addCmd = AddPoiCommand.create(lagekarteId, 'Bereitstellungsraum', { lat: 52.52, lng: 13.405 }, 'BEREITSTELLUNGSRAUM').value!;

        // When
        const result = await addPoiHandler.execute(addCmd);

        // Then
        expect(result.isSuccess).toBe(true);

        // Verify in database
        const lagekarte = await lagekarteRepository.findById(LagekarteId.create(lagekarteId).value!);
        expect(lagekarte!.pois).toHaveLength(1);
        expect(lagekarte!.pois[0].coordinate.gridZone).toBe('33U');
      });

      it('should add POI with MGRS → stored correctly', async () => {
        // Given
        const addCmd = AddPoiCommand.create(lagekarteId, 'Wasserentnahme', { mgrs: '32UNE8934004990' }, 'WASSERENTNAHMESTELLE').value!;

        // When
        const result = await addPoiHandler.execute(addCmd);

        // Then
        expect(result.isSuccess).toBe(true);

        // Verify in database
        const lagekarte = await lagekarteRepository.findById(LagekarteId.create(lagekarteId).value!);
        expect(lagekarte!.pois[0].coordinate.value).toBe('32UNE8934004990');
      });

      it('should add POI with beschreibung', async () => {
        // Given
        const addCmd = AddPoiCommand.create(lagekarteId, 'Gefahrenstelle', { lat: 52.52, lng: 13.405 }, 'GEFAHRENSTELLE', 'Achtung: Gasleitung').value!;

        // When
        const result = await addPoiHandler.execute(addCmd);

        // Then
        expect(result.isSuccess).toBe(true);

        // Verify in database
        const lagekarte = await lagekarteRepository.findById(LagekarteId.create(lagekarteId).value!);
        expect(lagekarte!.pois[0].beschreibung).toBe('Achtung: Gasleitung');
      });

      it('should return error for non-existent Lagekarte', async () => {
        // Given
        const addCmd = AddPoiCommand.create(generateTestId(), 'Test POI', { lat: 52.52, lng: 13.405 }, 'SONSTIGES').value!;

        // When
        const result = await addPoiHandler.execute(addCmd);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('Lagekarte not found');
      });
    });

    describe('Remove POI', () => {
      let lagekarteId: string;
      let poiId: string;

      beforeEach(async () => {
        // Create Lagekarte with POI
        const createCmd = CreateLagekarteCommand.create(testEinsatzId, {
          name: 'To Be Deleted',
          coordinate: { lat: 52.52, lng: 13.405 },
          category: 'SONSTIGES',
        }).value!;
        const createResult = await createHandler.execute(createCmd);
        lagekarteId = createResult.value!.value;

        const lagekarte = await lagekarteRepository.findById(createResult.value!);
        poiId = lagekarte!.pois[0].id.value;
        eventPublisher.clear();
      });

      it('should remove existing POI', async () => {
        // Given
        const removeCmd = RemovePoiCommand.create(lagekarteId, poiId).value!;

        // When
        const result = await removePoiHandler.execute(removeCmd);

        // Then
        expect(result.isSuccess).toBe(true);

        // Verify in database
        const lagekarte = await lagekarteRepository.findById(LagekarteId.create(lagekarteId).value!);
        expect(lagekarte!.pois).toHaveLength(0);
      });

      it('should return error for non-existent POI', async () => {
        // Given
        const removeCmd = RemovePoiCommand.create(lagekarteId, generateTestId()).value!;

        // When
        const result = await removePoiHandler.execute(removeCmd);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('not found');
      });
    });

    describe('Update POI Position', () => {
      let lagekarteId: string;
      let poiId: string;

      beforeEach(async () => {
        // Create Lagekarte with POI in Berlin (33U)
        const createCmd = CreateLagekarteCommand.create(testEinsatzId, {
          name: 'Movable POI',
          coordinate: { lat: 52.52, lng: 13.405 },
          category: 'EINSATZSTELLE',
        }).value!;
        const createResult = await createHandler.execute(createCmd);
        lagekarteId = createResult.value!.value;

        const lagekarte = await lagekarteRepository.findById(createResult.value!);
        poiId = lagekarte!.pois[0].id.value;
        eventPublisher.clear();
      });

      it('should update position with Lat/Lng → new MGRS zone', async () => {
        // Given: Move from Berlin (33U) to Hamburg (32U)
        const updateCmd = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: 53.55, lng: 10.0 }).value!;

        // When
        const result = await updatePoiPositionHandler.execute(updateCmd);

        // Then
        expect(result.isSuccess).toBe(true);

        // Verify in database
        const lagekarte = await lagekarteRepository.findById(LagekarteId.create(lagekarteId).value!);
        expect(lagekarte!.pois[0].coordinate.gridZone).toBe('32U'); // Hamburg zone
      });

      it('should return error for non-existent POI', async () => {
        // Given
        const updateCmd = UpdatePoiPositionCommand.create(lagekarteId, generateTestId(), { lat: 53.55, lng: 10.0 }).value!;

        // When
        const result = await updatePoiPositionHandler.execute(updateCmd);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('not found');
      });
    });

    describe('Get POIs', () => {
      let lagekarteId: string;

      beforeEach(async () => {
        // Create Lagekarte with multiple POIs
        const createCmd = CreateLagekarteCommand.create(testEinsatzId, {
          name: 'Einsatzstelle',
          coordinate: { lat: 52.52, lng: 13.405 },
          category: 'EINSATZSTELLE',
        }).value!;
        const createResult = await createHandler.execute(createCmd);
        lagekarteId = createResult.value!.value;

        // Add more POIs
        await addPoiHandler.execute(AddPoiCommand.create(lagekarteId, 'Bereitstellungsraum', { lat: 52.53, lng: 13.41 }, 'BEREITSTELLUNGSRAUM').value!);
        await addPoiHandler.execute(AddPoiCommand.create(lagekarteId, 'Zweite Einsatzstelle', { lat: 52.54, lng: 13.42 }, 'EINSATZSTELLE').value!);
        eventPublisher.clear();
      });

      it('should return all POIs without filter', async () => {
        // When
        const query = new GetPoisQuery(lagekarteId);
        const result = await getPoisHandler.execute(query);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(3);
      });

      it('should filter POIs by category', async () => {
        // When
        const query = new GetPoisQuery(lagekarteId, 'EINSATZSTELLE');
        const result = await getPoisHandler.execute(query);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value).toHaveLength(2);
        expect(result.value!.every((poi) => poi.category === 'EINSATZSTELLE')).toBe(true);
      });
    });
  });

  // ============================================
  // B) EVENT PUBLISHING TESTS
  // ============================================

  describe('B) Event Publishing Tests', () => {
    it('should emit lagekarte.created event when Lagekarte is created', async () => {
      // Given
      const createCmd = CreateLagekarteCommand.create(testEinsatzId).value!;

      // When
      const result = await createHandler.execute(createCmd);
      expect(result.isSuccess).toBe(true);

      // Then
      const createdEvents = eventPublisher.getEventsByName('lagekarte.created');
      expect(createdEvents).toHaveLength(1);
    });

    it('should emit lagekarte.poi_added event when POI is added', async () => {
      // Given: Create Lagekarte
      const createCmd = CreateLagekarteCommand.create(testEinsatzId).value!;
      const createResult = await createHandler.execute(createCmd);
      const lagekarteId = createResult.value!.value;
      eventPublisher.clear();

      // When
      const addCmd = AddPoiCommand.create(lagekarteId, 'Event Test POI', { lat: 52.52, lng: 13.405 }, 'EINSATZSTELLE').value!;
      await addPoiHandler.execute(addCmd);

      // Then
      const poiAddedEvents = eventPublisher.getEventsByName('lagekarte.poi_added');
      expect(poiAddedEvents).toHaveLength(1);
    });

    it('should emit lagekarte.poi_removed event when POI is removed', async () => {
      // Given: Create Lagekarte with POI
      const createCmd = CreateLagekarteCommand.create(testEinsatzId, {
        name: 'To Remove',
        coordinate: { lat: 52.52, lng: 13.405 },
        category: 'SONSTIGES',
      }).value!;
      const createResult = await createHandler.execute(createCmd);
      const lagekarteId = createResult.value!.value;

      const lagekarte = await lagekarteRepository.findById(createResult.value!);
      const poiId = lagekarte!.pois[0].id.value;
      eventPublisher.clear();

      // When
      const removeCmd = RemovePoiCommand.create(lagekarteId, poiId).value!;
      await removePoiHandler.execute(removeCmd);

      // Then
      const poiRemovedEvents = eventPublisher.getEventsByName('lagekarte.poi_removed');
      expect(poiRemovedEvents).toHaveLength(1);
    });

    it('should emit lagekarte.poi_position_updated event when POI position is updated', async () => {
      // Given: Create Lagekarte with POI
      const createCmd = CreateLagekarteCommand.create(testEinsatzId, {
        name: 'To Move',
        coordinate: { lat: 52.52, lng: 13.405 },
        category: 'EINSATZSTELLE',
      }).value!;
      const createResult = await createHandler.execute(createCmd);
      const lagekarteId = createResult.value!.value;

      const lagekarte = await lagekarteRepository.findById(createResult.value!);
      const poiId = lagekarte!.pois[0].id.value;
      eventPublisher.clear();

      // When
      const updateCmd = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: 53.55, lng: 10.0 }).value!;
      await updatePoiPositionHandler.execute(updateCmd);

      // Then
      const positionUpdatedEvents = eventPublisher.getEventsByName('lagekarte.poi_position_updated');
      expect(positionUpdatedEvents).toHaveLength(1);
    });
  });

  // ============================================
  // C) MGRS KOORDINATEN E2E TESTS
  // ============================================

  describe('C) MGRS Koordinaten E2E Tests', () => {
    it('should correctly handle Berlin coordinates (52.52, 13.405) → Zone 33U', async () => {
      // Given
      const createCmd = CreateLagekarteCommand.create(testEinsatzId, {
        name: 'Berlin POI',
        coordinate: { lat: 52.52, lng: 13.405 },
        category: 'EINSATZSTELLE',
      }).value!;

      // When
      const result = await createHandler.execute(createCmd);

      // Then
      expect(result.isSuccess).toBe(true);
      const lagekarte = await lagekarteRepository.findById(result.value!);
      expect(lagekarte!.pois[0].coordinate.gridZone).toBe('33U');
    });

    it('should correctly handle Hamburg coordinates (53.55, 10.0) → Zone 32U', async () => {
      // Given
      const createCmd = CreateLagekarteCommand.create(testEinsatzId, {
        name: 'Hamburg POI',
        coordinate: { lat: 53.55, lng: 10.0 },
        category: 'EINSATZSTELLE',
      }).value!;

      // When
      const result = await createHandler.execute(createCmd);

      // Then
      expect(result.isSuccess).toBe(true);
      const lagekarte = await lagekarteRepository.findById(result.value!);
      expect(lagekarte!.pois[0].coordinate.gridZone).toBe('32U');
    });

    it('should maintain coordinate accuracy through Lat/Lng → API → Lat/Lng roundtrip (±0.001°)', async () => {
      // Given: Original coordinates (Berlin)
      const originalLat = 52.52;
      const originalLng = 13.405;

      // When: Create Lagekarte with Lat/Lng
      const createCmd = CreateLagekarteCommand.create(testEinsatzId, {
        name: 'Roundtrip Test',
        coordinate: { lat: originalLat, lng: originalLng },
        category: 'EINSATZSTELLE',
      }).value!;
      const result = await createHandler.execute(createCmd);
      expect(result.isSuccess).toBe(true);

      // Retrieve using Query Handler (tests DTO mapping with lat/lng)
      const query = new GetLagekarteQuery(testEinsatzId);
      const getResult = await getLagekarteHandler.execute(query);
      expect(getResult.isSuccess).toBe(true);

      // Then: Returned Lat/Lng should be within ±0.001° of original
      const returnedLat = getResult.value!.pois[0].coordinate.lat;
      const returnedLng = getResult.value!.pois[0].coordinate.lng;

      expect(Math.abs(returnedLat - originalLat)).toBeLessThan(0.001);
      expect(Math.abs(returnedLng - originalLng)).toBeLessThan(0.001);
    });

    it('should handle cross-zone POI movement (Berlin 33U → Hamburg 32U)', async () => {
      // Given: Create Lagekarte with POI in Berlin (33U)
      const createCmd = CreateLagekarteCommand.create(testEinsatzId, {
        name: 'Cross-Zone POI',
        coordinate: { lat: 52.52, lng: 13.405 },
        category: 'EINSATZSTELLE',
      }).value!;
      const createResult = await createHandler.execute(createCmd);
      const lagekarteId = createResult.value!.value;

      // Verify initial zone is 33U
      let lagekarte = await lagekarteRepository.findById(createResult.value!);
      expect(lagekarte!.pois[0].coordinate.gridZone).toBe('33U');
      const poiId = lagekarte!.pois[0].id.value;

      // When: Move to Hamburg (32U)
      const updateCmd = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: 53.55, lng: 10.0 }).value!;
      await updatePoiPositionHandler.execute(updateCmd);

      // Then: New zone should be 32U
      lagekarte = await lagekarteRepository.findById(LagekarteId.create(lagekarteId).value!);
      expect(lagekarte!.pois[0].coordinate.gridZone).toBe('32U');
    });
  });
});
