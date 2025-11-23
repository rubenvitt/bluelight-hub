// biome-ignore-all lint/suspicious/noExplicitAny: Integration tests access dynamic event properties
/**
 * Integration Tests fuer Lagekarte Event Publishing.
 *
 * Diese Tests verifizieren den vollstaendigen Event-Flow:
 * Command Handler → Repository → Event Publisher → Event-Emission
 *
 * **Test-Strategie:**
 * - Direktes Handler-Instanziieren (kein NestJS Test Module)
 * - In-Memory Repository fuer Lagekarte
 * - Mock EinsatzRepository (exists check)
 * - Mock EventPublisher mit Spy auf publish/publishAll
 *
 * **Warum Integration statt Unit:**
 * - Unit Tests (Handler-Specs) testen nur Mock-EventPublisher-Aufrufe
 * - Integration Tests verifizieren tatsaechlichen Event-Flow mit echten Aggregates
 * - Stellt sicher, dass Events mit korrekten Daten emittiert werden
 *
 * Epic 2 Story 2.7 | Task 8
 */

import { CreateLagekarteCommandHandler } from '../../create-lagekarte.handler';
import { AddPoiCommandHandler } from '../../add-poi.handler';
import { RemovePoiCommandHandler } from '../../remove-poi.handler';
import { UpdatePoiPositionCommandHandler } from '../../update-poi-position.handler';
import { CreateLagekarteCommand } from '../../create-lagekarte.command';
import { AddPoiCommand } from '../../add-poi.command';
import { RemovePoiCommand } from '../../remove-poi.command';
import { UpdatePoiPositionCommand } from '../../update-poi-position.command';
import { InMemoryLagekarteRepository } from '../../../queries/__tests__/integration/in-memory-lagekarte.repository';
import { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { UserId } from '@domain/value-objects/user-id';
import { Poi } from '@domain/entities/poi.entity';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { Result } from '@domain/common/result';
import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import type { DomainEvent } from '@domain/common/domain-event';

// Mock cuid2 for deterministic test IDs
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

/**
 * Helper function: Generates valid CUID2-format test ID.
 * CUID2 format: 20-30 chars, lowercase a-z0-9, starts with lowercase letter.
 */
function createValidTestId(suffix = ''): string {
  const base = 'clw3h8x9y0000qwertyui';
  const safeSuffix = suffix
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .padEnd(5, '0')
    .slice(0, 5);
  return base + safeSuffix;
}

/**
 * Hilfsfunktion: Erstellt ein LagekarteAggregate mit POIs fuer Tests.
 *
 * Warum diese Hilfsfunktion: Erstellt echte Domain-Objekte fuer
 * Integration Tests, cleared Domain Events nach Erstellung.
 */
function createTestAggregate(einsatzIdString: string, withPoi = false): LagekarteAggregate {
  const einsatzIdResult = EinsatzId.create(einsatzIdString);
  const userIdResult = UserId.create();

  if (einsatzIdResult.isFailure || userIdResult.isFailure) {
    throw new Error('Failed to create test IDs');
  }

  let initialPoi: Poi | undefined;
  if (withPoi) {
    const mgrsResult = MgrsCoordinate.fromLatLng(52.52, 13.4, 5);
    const categoryResult = PoiCategory.create('EINSATZSTELLE');
    if (mgrsResult.isSuccess && categoryResult.isSuccess && mgrsResult.value && categoryResult.value) {
      initialPoi = Poi.create('Test POI', mgrsResult.value, categoryResult.value, userIdResult.value!);
    }
  }

  const aggregateResult = LagekarteAggregate.create(einsatzIdResult.value!, userIdResult.value!, initialPoi);

  if (aggregateResult.isFailure || !aggregateResult.value) {
    throw new Error(`Failed to create test aggregate: ${aggregateResult.error}`);
  }

  // Clear domain events from creation (we want fresh slate for tests)
  aggregateResult.value.clearDomainEvents();
  return aggregateResult.value;
}

/**
 * SpyEventPublisher: Implementiert IEventPublisher und trackt alle publizierten Events.
 *
 * Warum: Ermoeglicht Verifizierung der Event-Emission ohne echten EventEmitter2.
 * Speichert Events in Arrays fuer einfache Assertions.
 */
class SpyEventPublisher implements IEventPublisher {
  public publishedEvents: DomainEvent[] = [];
  public publishCalls: DomainEvent[][] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    this.publishCalls.push([...events]);
    for (const event of events) {
      this.publishedEvents.push(event);
    }
  }

  /**
   * Gibt alle Events mit einem bestimmten eventName zurueck.
   */
  getEventsByName(eventName: string): DomainEvent[] {
    return this.publishedEvents.filter((e) => (e.constructor as typeof DomainEvent).eventName() === eventName);
  }

  clear(): void {
    this.publishedEvents = [];
    this.publishCalls = [];
  }
}

describe('Lagekarte Event Publishing - Integration', () => {
  let lagekarteRepository: InMemoryLagekarteRepository;
  let mockEinsatzRepository: jest.Mocked<IEinsatzRepository>;
  let eventPublisher: SpyEventPublisher;
  let createHandler: CreateLagekarteCommandHandler;
  let addPoiHandler: AddPoiCommandHandler;
  let removePoiHandler: RemovePoiCommandHandler;
  let updatePoiPositionHandler: UpdatePoiPositionCommandHandler;

  beforeEach(() => {
    // Reset all mocks and spies
    jest.clearAllMocks();

    // Create In-Memory Repository
    lagekarteRepository = new InMemoryLagekarteRepository();

    // Create Mock EinsatzRepository
    mockEinsatzRepository = {
      exists: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      findActive: jest.fn(),
      findByNummer: jest.fn(),
    } as any;

    // Create Spy EventPublisher
    eventPublisher = new SpyEventPublisher();

    // Instantiate Handlers with real repositories and spy publisher
    createHandler = new CreateLagekarteCommandHandler(mockEinsatzRepository, lagekarteRepository, eventPublisher);
    addPoiHandler = new AddPoiCommandHandler(lagekarteRepository, eventPublisher);
    removePoiHandler = new RemovePoiCommandHandler(lagekarteRepository, eventPublisher);
    updatePoiPositionHandler = new UpdatePoiPositionCommandHandler(lagekarteRepository, eventPublisher);
  });

  afterEach(() => {
    lagekarteRepository.clear();
    eventPublisher.clear();
  });

  describe('CreateLagekarte Events', () => {
    it('should emit lagekarte.created event when Lagekarte is created without initialPoi', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const commandResult = CreateLagekarteCommand.create(einsatzId);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // Mock: Einsatz exists
      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      // When
      const result = await createHandler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(eventPublisher.publishedEvents).toHaveLength(1);

      const event = eventPublisher.publishedEvents[0];
      expect((event.constructor as any).eventName()).toBe('lagekarte.created');
      expect((event as any).hasInitialPoi).toBe(false);
      expect((event as any).einsatzId.value).toBe(einsatzId);
    });

    it('should emit lagekarte.created AND lagekarte.poi_added when created with initialPoi', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const initialPoi = {
        name: 'Einsatzstelle',
        coordinate: { lat: 52.52, lng: 13.4 },
        category: 'EINSATZSTELLE',
      };
      const commandResult = CreateLagekarteCommand.create(einsatzId, initialPoi);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // Mock: Einsatz exists
      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      // When
      const result = await createHandler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(eventPublisher.publishedEvents).toHaveLength(2);

      // Verify lagekarte.created event
      const createdEvent = eventPublisher.publishedEvents[0];
      expect((createdEvent.constructor as any).eventName()).toBe('lagekarte.created');
      expect((createdEvent as any).hasInitialPoi).toBe(true);

      // Verify lagekarte.poi_added event
      const poiAddedEvent = eventPublisher.publishedEvents[1];
      expect((poiAddedEvent.constructor as any).eventName()).toBe('lagekarte.poi_added');
      expect((poiAddedEvent as any).name).toBe('Einsatzstelle');
      expect((poiAddedEvent as any).category.value).toBe('EINSATZSTELLE');
    });

    it('should NOT emit events when Einsatz does not exist', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const commandResult = CreateLagekarteCommand.create(einsatzId);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // Mock: Einsatz does NOT exist
      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(false));

      // When
      const result = await createHandler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Einsatz not found');
      expect(eventPublisher.publishedEvents).toHaveLength(0);
    });

    it('should NOT emit events when Lagekarte already exists', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const existingAggregate = createTestAggregate(einsatzId);
      await lagekarteRepository.save(existingAggregate);

      const commandResult = CreateLagekarteCommand.create(einsatzId);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // Mock: Einsatz exists
      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      // When
      const result = await createHandler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Lagekarte for this Einsatz already exists');
      expect(eventPublisher.publishedEvents).toHaveLength(0);
    });

    it('should verify event contains correct einsatzId and lagekarteId', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const commandResult = CreateLagekarteCommand.create(einsatzId);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      // When
      const result = await createHandler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      const createdEvent = eventPublisher.publishedEvents[0];
      expect((createdEvent as any).einsatzId.value).toBe(einsatzId);
      expect((createdEvent as any).lagekarteId.value).toBe(result.value!.value);
    });
  });

  describe('AddPoi Events', () => {
    it('should emit lagekarte.poi_added event when POI is added', async () => {
      // Given: Existing Lagekarte in repository
      const einsatzId = createValidTestId('einsatz');
      const aggregate = createTestAggregate(einsatzId);
      await lagekarteRepository.save(aggregate);
      const lagekarteId = aggregate.id.value;

      const commandResult = AddPoiCommand.create(lagekarteId, 'Bereitstellungsraum', { lat: 52.52, lng: 13.4 }, 'BEREITSTELLUNGSRAUM');
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await addPoiHandler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(eventPublisher.publishedEvents).toHaveLength(1);

      const event = eventPublisher.publishedEvents[0];
      expect((event.constructor as any).eventName()).toBe('lagekarte.poi_added');
      expect((event as any).name).toBe('Bereitstellungsraum');
      expect((event as any).category.value).toBe('BEREITSTELLUNGSRAUM');
    });

    it('should emit lagekarte.poi_added with MGRS coordinate (converted from Lat/Lng)', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const aggregate = createTestAggregate(einsatzId);
      await lagekarteRepository.save(aggregate);
      const lagekarteId = aggregate.id.value;

      // Berlin coordinates
      const commandResult = AddPoiCommand.create(lagekarteId, 'Berlin POI', { lat: 52.52, lng: 13.4 }, 'EINSATZSTELLE');
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await addPoiHandler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      const event = eventPublisher.publishedEvents[0] as any;
      expect(event.coordinate).toBeDefined();
      // Berlin is in MGRS zone 33U
      expect(event.coordinate.toString()).toContain('33UUU');
    });

    it('should emit lagekarte.poi_added with beschreibung when provided', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const aggregate = createTestAggregate(einsatzId);
      await lagekarteRepository.save(aggregate);
      const lagekarteId = aggregate.id.value;

      const commandResult = AddPoiCommand.create(lagekarteId, 'Gefahrenstelle', { lat: 52.52, lng: 13.4 }, 'GEFAHRENSTELLE', 'Achtung: Ueberflutete Strasse');
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await addPoiHandler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      // Verify POI was added with beschreibung
      const savedAggregate = await lagekarteRepository.findById(aggregate.id);
      expect(savedAggregate).not.toBeNull();
      expect(savedAggregate!.pois).toHaveLength(1);
      expect(savedAggregate!.pois[0].beschreibung).toBe('Achtung: Ueberflutete Strasse');
    });

    it('should NOT emit events when Lagekarte not found', async () => {
      // Given: Non-existent Lagekarte
      const lagekarteId = createValidTestId('lagekarte');
      const commandResult = AddPoiCommand.create(lagekarteId, 'Test POI', { lat: 52.52, lng: 13.4 }, 'EINSATZSTELLE');
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await addPoiHandler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Lagekarte not found');
      expect(eventPublisher.publishedEvents).toHaveLength(0);
    });

    it('should NOT emit events when POI name already exists', async () => {
      // Given: Lagekarte with existing POI
      const einsatzId = createValidTestId('einsatz');
      const aggregate = createTestAggregate(einsatzId, true); // withPoi = true -> "Test POI"
      await lagekarteRepository.save(aggregate);
      const lagekarteId = aggregate.id.value;
      const existingPoiName = aggregate.pois[0].name;

      const commandResult = AddPoiCommand.create(lagekarteId, existingPoiName, { lat: 53.0, lng: 14.0 }, 'BEREITSTELLUNGSRAUM');
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await addPoiHandler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already exists');
      expect(eventPublisher.publishedEvents).toHaveLength(0);
    });
  });

  describe('RemovePoi Events', () => {
    it('should emit lagekarte.poi_removed event when POI is removed', async () => {
      // Given: Lagekarte with existing POI
      const einsatzId = createValidTestId('einsatz');
      const aggregate = createTestAggregate(einsatzId, true);
      await lagekarteRepository.save(aggregate);
      const lagekarteId = aggregate.id.value;
      const poiId = aggregate.pois[0].id.value;

      const commandResult = RemovePoiCommand.create(lagekarteId, poiId);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await removePoiHandler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(eventPublisher.publishedEvents).toHaveLength(1);

      const event = eventPublisher.publishedEvents[0];
      expect((event.constructor as any).eventName()).toBe('lagekarte.poi_removed');
      expect((event as any).poiId.value).toBe(poiId);
      expect((event as any).lagekarteId.value).toBe(lagekarteId);
    });

    it('should NOT emit events when Lagekarte not found', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const poiId = createValidTestId('poi');

      const commandResult = RemovePoiCommand.create(lagekarteId, poiId);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await removePoiHandler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Lagekarte not found');
      expect(eventPublisher.publishedEvents).toHaveLength(0);
    });

    it('should NOT emit events when POI not found', async () => {
      // Given: Lagekarte WITHOUT the specified POI
      const einsatzId = createValidTestId('einsatz');
      const aggregate = createTestAggregate(einsatzId, false); // no POIs
      await lagekarteRepository.save(aggregate);
      const lagekarteId = aggregate.id.value;
      const nonExistentPoiId = createValidTestId('poi');

      const commandResult = RemovePoiCommand.create(lagekarteId, nonExistentPoiId);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await removePoiHandler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
      expect(eventPublisher.publishedEvents).toHaveLength(0);
    });
  });

  describe('UpdatePoiPosition Events', () => {
    it('should emit lagekarte.poi_position_updated event when position is updated', async () => {
      // Given: Lagekarte with existing POI (at Berlin)
      const einsatzId = createValidTestId('einsatz');
      const aggregate = createTestAggregate(einsatzId, true);
      await lagekarteRepository.save(aggregate);
      const lagekarteId = aggregate.id.value;
      const poiId = aggregate.pois[0].id.value;

      // New position: Hamburg
      const commandResult = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: 53.55, lng: 10.0 });
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await updatePoiPositionHandler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(eventPublisher.publishedEvents).toHaveLength(1);

      const event = eventPublisher.publishedEvents[0];
      expect((event.constructor as any).eventName()).toBe('lagekarte.poi_position_updated');
      expect((event as any).poiId.value).toBe(poiId);
    });

    it('should emit event with old and new coordinates (Event-Carried State Transfer)', async () => {
      // Given: Lagekarte with existing POI (at Berlin - 33UUU zone)
      const einsatzId = createValidTestId('einsatz');
      const aggregate = createTestAggregate(einsatzId, true);
      const oldCoordinate = aggregate.pois[0].coordinate.toString();
      await lagekarteRepository.save(aggregate);
      const lagekarteId = aggregate.id.value;
      const poiId = aggregate.pois[0].id.value;

      // New position: Hamburg (32U zone)
      const commandResult = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: 53.55, lng: 10.0 });
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await updatePoiPositionHandler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);

      const event = eventPublisher.publishedEvents[0] as any;
      // Old coordinate should be Berlin (33UUU)
      expect(event.oldCoordinate.toString()).toBe(oldCoordinate);
      expect(event.oldCoordinate.toString()).toContain('33UUU');

      // New coordinate should be Hamburg (32U)
      expect(event.newCoordinate.toString()).toContain('32U');
    });

    it('should NOT emit events when Lagekarte not found', async () => {
      // Given
      const lagekarteId = createValidTestId('lagekarte');
      const poiId = createValidTestId('poi');

      const commandResult = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: 53.0, lng: 10.0 });
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await updatePoiPositionHandler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Lagekarte not found');
      expect(eventPublisher.publishedEvents).toHaveLength(0);
    });

    it('should NOT emit events when POI not found', async () => {
      // Given: Lagekarte WITHOUT the specified POI
      const einsatzId = createValidTestId('einsatz');
      const aggregate = createTestAggregate(einsatzId, false);
      await lagekarteRepository.save(aggregate);
      const lagekarteId = aggregate.id.value;
      const nonExistentPoiId = createValidTestId('poi');

      const commandResult = UpdatePoiPositionCommand.create(lagekarteId, nonExistentPoiId, { lat: 53.0, lng: 10.0 });
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await updatePoiPositionHandler.execute(command);

      // Then
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
      expect(eventPublisher.publishedEvents).toHaveLength(0);
    });

    it('should support MGRS input coordinate directly', async () => {
      // Given: Lagekarte with existing POI
      const einsatzId = createValidTestId('einsatz');
      const aggregate = createTestAggregate(einsatzId, true);
      await lagekarteRepository.save(aggregate);
      const lagekarteId = aggregate.id.value;
      const poiId = aggregate.pois[0].id.value;

      // New position as MGRS string (Hamburg area)
      const commandResult = UpdatePoiPositionCommand.create(lagekarteId, poiId, { mgrs: '32UNE8934004990' });
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      // When
      const result = await updatePoiPositionHandler.execute(command);

      // Then
      expect(result.isSuccess).toBe(true);
      expect(eventPublisher.publishedEvents).toHaveLength(1);

      const event = eventPublisher.publishedEvents[0] as any;
      expect(event.newCoordinate.toString()).toBe('32UNE8934004990');
    });
  });

  describe('Transactional Consistency', () => {
    it('should only publish events after aggregate is saved (verify save happens)', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const commandResult = CreateLagekarteCommand.create(einsatzId);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      // Verify repository is empty before
      expect(lagekarteRepository.count()).toBe(0);

      // When
      const result = await createHandler.execute(command);

      // Then: Both aggregate saved AND events published
      expect(result.isSuccess).toBe(true);
      expect(lagekarteRepository.count()).toBe(1);
      expect(eventPublisher.publishedEvents).toHaveLength(1);
    });

    it('should publish events via publishAll in single call', async () => {
      // Given: Create with initialPoi (should emit 2 events)
      const einsatzId = createValidTestId('einsatz');
      const initialPoi = {
        name: 'Einsatzstelle',
        coordinate: { lat: 52.52, lng: 13.4 },
        category: 'EINSATZSTELLE',
      };
      const commandResult = CreateLagekarteCommand.create(einsatzId, initialPoi);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      // When
      await createHandler.execute(command);

      // Then: Both events should be in single publishAll call
      expect(eventPublisher.publishCalls).toHaveLength(1);
      expect(eventPublisher.publishCalls[0]).toHaveLength(2);
    });
  });

  describe('Event Content Verification', () => {
    it('should include createdBy/updatedBy UserId in all events', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const commandResult = CreateLagekarteCommand.create(einsatzId);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      // When
      await createHandler.execute(command);

      // Then
      const event = eventPublisher.publishedEvents[0] as any;
      expect(event.createdBy).toBeDefined();
      expect(event.createdBy.value).toBeDefined();
      expect(typeof event.createdBy.value).toBe('string');
    });

    it('should include eventId and occurredAt timestamp in all events', async () => {
      // Given
      const einsatzId = createValidTestId('einsatz');
      const commandResult = CreateLagekarteCommand.create(einsatzId);
      expect(commandResult.isSuccess).toBe(true);
      const command = commandResult.value!;

      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      // When
      await createHandler.execute(command);

      // Then
      const event = eventPublisher.publishedEvents[0] as any;
      expect(event.eventId).toBeDefined();
      expect(event.occurredAt).toBeInstanceOf(Date);
    });
  });

  describe('Full E2E Event Flow', () => {
    it('should handle complete POI lifecycle: create → add → update → remove', async () => {
      // Step 1: Create Lagekarte
      const einsatzId = createValidTestId('einsatz');
      const createCmd = CreateLagekarteCommand.create(einsatzId).value!;
      mockEinsatzRepository.exists.mockResolvedValue(Result.ok(true));

      const createResult = await createHandler.execute(createCmd);
      expect(createResult.isSuccess).toBe(true);
      const lagekarteId = createResult.value!.value;
      expect(eventPublisher.getEventsByName('lagekarte.created')).toHaveLength(1);

      // Step 2: Add POI
      const addCmd = AddPoiCommand.create(lagekarteId, 'Einsatzstelle', { lat: 52.52, lng: 13.4 }, 'EINSATZSTELLE').value!;
      const addResult = await addPoiHandler.execute(addCmd);
      expect(addResult.isSuccess).toBe(true);
      const poiId = addResult.value!.value;
      expect(eventPublisher.getEventsByName('lagekarte.poi_added')).toHaveLength(1);

      // Step 3: Update POI Position
      const updateCmd = UpdatePoiPositionCommand.create(lagekarteId, poiId, { lat: 53.55, lng: 10.0 }).value!;
      const updateResult = await updatePoiPositionHandler.execute(updateCmd);
      expect(updateResult.isSuccess).toBe(true);
      expect(eventPublisher.getEventsByName('lagekarte.poi_position_updated')).toHaveLength(1);

      // Step 4: Remove POI
      const removeCmd = RemovePoiCommand.create(lagekarteId, poiId).value!;
      const removeResult = await removePoiHandler.execute(removeCmd);
      expect(removeResult.isSuccess).toBe(true);
      expect(eventPublisher.getEventsByName('lagekarte.poi_removed')).toHaveLength(1);

      // Verify total events
      expect(eventPublisher.publishedEvents).toHaveLength(4);
    });
  });
});
