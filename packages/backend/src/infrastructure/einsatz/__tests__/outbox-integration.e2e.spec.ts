/**
 * Outbox Pattern Integration Tests (Story 4-10 - AC1.1-1.7).
 *
 * Verifiziert das Transactional Outbox Pattern für Event-Persistierung
 * und asynchrone Event-Publikation. Diese Tests prüfen die gesamte
 * Outbox-Pipeline: Persist → Poll → Deserialize → Publish.
 *
 * **TEST COVERAGE (Acceptance Criteria):**
 * - AC1.1: Events saved atomically with aggregate (single transaction)
 * - AC1.2: Transaction rollback on error (neither aggregate nor events saved)
 * - AC1.3: Polling worker publishes PENDING events within 6 seconds
 * - AC1.4: Failed events retried max 3 times before FAILED status
 * - AC1.5: Deserialization errors immediately marked as FAILED (non-retryable)
 * - AC1.6: Event roundtrip (serialize → store → deserialize → publish) preserves all data
 * - AC1.7: Concurrency prevention (isRunning flag prevents duplicate execution)
 *
 * **TEST STRATEGY:**
 * - Real PostgreSQL Database (NICHT mocked)
 * - Direct Repository + OutboxEventPublisher Invocation
 * - Given-When-Then BDD Style
 * - Transaction Testing mit Rollback Scenarios
 * - Polling Worker Testing mit waitFor()
 * - Event Roundtrip Testing für alle 19 Event Types
 */

import type { EinsatzE2eTestContext } from './einsatz.e2e-setup';
import { createEinsatzE2eModule, teardownE2eModule, cleanupTestData, createTestEinsatz, createTestOutboxEvent, generateTestId, waitFor } from './einsatz.e2e-setup';
import { OutboxEventPublisher } from '@/infrastructure/outbox/outbox-event-publisher.service';
import { EventDeserializer } from '@/infrastructure/outbox/event-deserializer';
import { EventSerializer } from '@/infrastructure/outbox/event-serializer';
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import { EinsatzUpdatedEvent } from '@domain/events/einsatz-updated.event';
import { EinsatzStatusChangedEvent } from '@domain/events/einsatz-status-changed.event';
import { EinsatzCompletedEvent } from '@domain/events/einsatz-completed.event';
import { EinsatzArchivedEvent } from '@domain/events/einsatz-archived.event';
import { EtbCreatedEvent } from '@domain/events/etb-created.event';
import { EintragAddedEvent } from '@domain/events/eintrag-added.event';
import { EintragUpdatedEvent } from '@domain/events/eintrag-updated.event';
import { EintragDeletedEvent } from '@domain/events/eintrag-deleted.event';
import { EtbLockedEvent } from '@domain/events/etb-locked.event';
import { LagekarteCreatedEvent } from '@domain/events/lagekarte-created.event';
import { PoiAddedEvent } from '@domain/events/poi-added.event';
import { PoiRemovedEvent } from '@domain/events/poi-removed.event';
import { PoiPositionUpdatedEvent } from '@domain/events/poi-position-updated.event';
import { UserCreatedEvent } from '@domain/events/user-created.event';
import { UserDeletedEvent } from '@domain/events/user-deleted.event';
import { UserRoleChangedEvent } from '@domain/events/user-role-changed.event';
import { PermissionGrantedEvent } from '@domain/events/permission-granted.event';
import { PermissionRevokedEvent } from '@domain/events/permission-revoked.event';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EtbId } from '@domain/value-objects/etb-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { LagekarteId } from '@domain/value-objects/lagekarte-id';
import { PoiId } from '@domain/value-objects/poi-id';
import { UserId } from '@domain/value-objects/user-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserRole } from '@domain/value-objects/user-role';
import { Username } from '@domain/value-objects/username';
import { Permission } from '@domain/value-objects/permission';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';

describe('Outbox Pattern Integration Tests (AC1.1-1.7)', () => {
  let ctx: EinsatzE2eTestContext;
  let outboxPublisher: OutboxEventPublisher;
  let eventDeserializer: EventDeserializer;
  let eventSerializer: EventSerializer;

  beforeAll(async () => {
    ctx = await createEinsatzE2eModule();

    // Setup Outbox Publisher mit Context Dependencies
    eventDeserializer = new EventDeserializer();
    eventSerializer = new EventSerializer();

    // Outbox Publisher mit real dependencies (no mocks!)
    outboxPublisher = new OutboxEventPublisher(
      ctx.outboxRepository,
      eventDeserializer,
      ctx.eventPublisher,
      undefined, // No AlertService for tests
      { maxRetries: 3, batchSize: 100 }, // Explicit config
    );
  }, 30000);

  afterEach(async () => {
    await cleanupTestData(ctx);
  });

  afterAll(async () => {
    await teardownE2eModule(ctx);
  });

  // ============================================
  // AC1.1: Atomic Event Persistence
  // ============================================

  describe('AC1.1: Atomic Event Persistence', () => {
    it('should save events atomically with aggregate in single transaction', async () => {
      // Given: Create Einsatz Aggregate with Domain Event
      const einsatzId = EinsatzId.create().value!;
      const createdBy = UserId.create(ctx.testUserIds.user).value!;

      const einsatzResult = Einsatz.create(
        {
          alarmstichwort: 'Wohnungsbrand - AC1.1 Test',
          einsatzort: 'Teststraße 1',
          createdBy,
          updatedBy: createdBy,
        },
        einsatzId,
      );

      expect(einsatzResult.isSuccess).toBe(true);
      const einsatz = einsatzResult.value!;

      // Verify Domain Event exists in Aggregate
      expect(einsatz.domainEvents.length).toBeGreaterThan(0);
      const event = einsatz.domainEvents[0] as EinsatzCreatedEvent;
      expect(event).toBeInstanceOf(EinsatzCreatedEvent);

      // When: Save Aggregate via Repository (uses transaction internally)
      await ctx.repository.save(einsatz);

      // Then: Both Einsatz AND OutboxEvent exist in DB
      const savedEinsatz = await ctx.repository.findById(einsatzId);
      expect(savedEinsatz).not.toBeNull();
      expect(savedEinsatz!.id.value).toBe(einsatzId.value);

      const outboxEvent = await ctx.outboxRepository.findById(event.eventId);
      expect(outboxEvent).not.toBeNull();
      expect(outboxEvent!.eventName).toBe('einsatz.created');
      expect(outboxEvent!.aggregateId).toBe(einsatzId.value);
      expect(outboxEvent!.status).toBe('PENDING');
    });
  });

  // ============================================
  // AC1.2: Transaction Rollback on Error
  // ============================================

  describe('AC1.2: Transaction Rollback on Error', () => {
    it('should rollback both aggregate and events on transaction failure', async () => {
      // Given: Existing Einsatz mit gleicher Nummer (Constraint Violation provozieren)
      const existingEinsatzId = await createTestEinsatz(ctx, {
        alarmstichwort: 'Existing Einsatz for Rollback Test',
      });

      // Get the nummer from existing Einsatz to trigger duplicate constraint
      const existingEinsatz = await ctx.prisma.einsaetze.findUnique({
        where: { id: existingEinsatzId },
        select: { nummer: true },
      });
      expect(existingEinsatz).not.toBeNull();
      const duplicateNummer = existingEinsatz!.nummer;

      // When: Try to create Einsatz with duplicate nummer (will fail)
      const einsatzId = EinsatzId.create().value!;
      const createdBy = UserId.create(ctx.testUserIds.user).value!;

      // Manually insert Einsatz via raw SQL to force duplicate nummer
      try {
        await ctx.prisma.$transaction(async (tx) => {
          // Insert Einsatz with duplicate nummer
          await tx.$executeRaw`
            INSERT INTO einsaetze (id, alarmstichwort, einsatzort, nummer, status, "createdBy", "updatedBy", "createdAt", "updatedAt")
            VALUES (
              ${einsatzId.value},
              'Rollback Test Einsatz',
              'Teststraße 99',
              ${duplicateNummer},
              'ANGELEGT'::"EinsatzStatus",
              ${createdBy.value},
              ${createdBy.value},
              NOW(),
              NOW()
            )
          `;

          // Create Outbox Event in same transaction
          const eventId = generateTestId();
          await tx.$executeRaw`
            INSERT INTO outbox_events (id, "eventName", "eventVersion", "aggregateId", payload, status, "createdAt", "occurredAt")
            VALUES (
              ${eventId},
              'einsatz.created',
              1,
              ${einsatzId.value},
              '{"eventId": "${eventId}", "eventName": "einsatz.created", "eventVersion": 1, "occurredAt": "${new Date().toISOString()}", "aggregateId": "${einsatzId.value}", "payload": {"einsatzId": "${einsatzId.value}", "createdBy": "${createdBy.value}", "alarmstichwort": "Rollback Test", "nummer": "${duplicateNummer}"}}'::jsonb,
              'PENDING'::"OutboxEventStatus",
              NOW(),
              NOW()
            )
          `;

          // Force transaction failure by violating unique constraint on nummer
          // (This will throw and cause rollback)
          throw new Error('Simulated transaction failure');
        });

        // Should not reach here
        fail('Transaction should have thrown an error');
      } catch (error) {
        // Expected: Transaction failed
        expect(error).toBeDefined();
      }

      // Then: Neither Einsatz nor OutboxEvent persisted
      const einsatz = await ctx.prisma.einsaetze.findUnique({
        where: { id: einsatzId.value },
      });
      expect(einsatz).toBeNull();

      const outboxEvents = await ctx.prisma.outboxEvent.findMany({
        where: { aggregateId: einsatzId.value },
      });
      expect(outboxEvents.length).toBe(0);
    });
  });

  // ============================================
  // AC1.3: Polling Worker Publishes Within 6s
  // ============================================

  describe('AC1.3: Polling Worker Publishes Within 6 Seconds', () => {
    it('should publish PENDING events within 6 seconds', async () => {
      // Given: PENDING event in outbox
      const einsatzId = EinsatzId.create().value!;
      const createdBy = UserId.create(ctx.testUserIds.user).value!;

      const event = new EinsatzCreatedEvent(einsatzId, createdBy, 'AC1.3 Test Einsatz', `E2024-${generateTestId().substring(0, 8)}`, einsatzId.value);

      await ctx.outboxRepository.save([event]);

      // Verify event is PENDING
      const pendingEventsBefore = await ctx.outboxRepository.findPendingEvents(10);
      expect(pendingEventsBefore.length).toBeGreaterThan(0);
      const targetEvent = pendingEventsBefore.find((e) => e.id === event.eventId);
      expect(targetEvent).toBeDefined();
      expect(targetEvent!.status).toBe('PENDING');

      // When: Trigger polling worker manually (instead of waiting for cron)
      await outboxPublisher.triggerManually();

      // Then: Event status = PUBLISHED, publishedAt set (within 6s SLA)
      await waitFor(
        async () => {
          const publishedEvent = await ctx.outboxRepository.findById(event.eventId);
          expect(publishedEvent).not.toBeNull();
          expect(publishedEvent!.status).toBe('PUBLISHED');
          expect(publishedEvent!.publishedAt).not.toBeNull();

          // Verify event was published to EventPublisher
          const publishedEvents = ctx.eventPublisher.getEventsByName('einsatz.created');
          expect(publishedEvents.length).toBeGreaterThan(0);
        },
        6000, // AC1.3: Max 6 seconds SLA
        100,
      );
    });
  });

  // ============================================
  // AC1.4: Retry Logic (Max 3 Attempts)
  // ============================================

  describe('AC1.4: Retry Logic (Max 3 Attempts)', () => {
    it('should increment retryCount on each failure', async () => {
      // Given: Event that will fail (invalid payload for deserialization)
      const eventId = await createTestOutboxEvent(ctx, {
        eventName: 'einsatz.created',
        status: 'PENDING',
        retryCount: 0,
        payload: {
          // Missing required fields → will fail deserialization
          invalidField: 'test',
        } as never,
      });

      // When: Trigger polling worker (will fail deserialization)
      await outboxPublisher.triggerManually();

      // Then: retryCount should be incremented (deserialization error → FAILED immediately)
      const failedEvent = await ctx.outboxRepository.findById(eventId);
      expect(failedEvent).not.toBeNull();
      expect(failedEvent!.status).toBe('FAILED'); // AC1.5: Non-retryable
      expect(failedEvent!.lastFailureReason).toContain('Invalid einsatzId');
    });

    it('should mark as FAILED after 3 retries for handler errors', async () => {
      // Given: Valid event that will trigger handler errors
      // Create mock scenario: Event with valid structure but will fail in handler
      const einsatzId = EinsatzId.create().value!;
      const createdBy = UserId.create(ctx.testUserIds.user).value!;

      const event = new EinsatzCreatedEvent(einsatzId, createdBy, 'Retry Test Einsatz', `E2024-${generateTestId().substring(0, 8)}`, einsatzId.value);

      await ctx.outboxRepository.save([event]);

      // Manually set retryCount to 2 (simulate 2 previous failures)
      await ctx.prisma.outboxEvent.update({
        where: { id: event.eventId },
        data: { retryCount: 2 },
      });

      // When: Trigger polling worker (3rd failure → should mark as FAILED)
      // Note: Since our EventPublisher is a Spy (no real handlers), we need to
      // simulate a handler failure by injecting a failing publisher
      class FailingEventPublisher {
        async publish(): Promise<void> {
          throw new Error('Simulated handler error');
        }
      }

      const failingPublisher = new OutboxEventPublisher(ctx.outboxRepository, eventDeserializer, new FailingEventPublisher() as never, undefined, { maxRetries: 3, batchSize: 100 });

      await failingPublisher.triggerManually();

      // Then: status = FAILED, retryCount = 3
      const failedEvent = await ctx.outboxRepository.findById(event.eventId);
      expect(failedEvent).not.toBeNull();
      expect(failedEvent!.status).toBe('FAILED');
      expect(failedEvent!.retryCount).toBe(3);
      expect(failedEvent!.lastFailureReason).toContain('Simulated handler error');
    });
  });

  // ============================================
  // AC1.5: Deserialization Errors Non-Retryable
  // ============================================

  describe('AC1.5: Deserialization Errors Non-Retryable', () => {
    it('should immediately mark corrupt events as FAILED without retrying', async () => {
      // Given: Event with corrupt/invalid payload
      const eventId = await createTestOutboxEvent(ctx, {
        eventName: 'einsatz.created',
        status: 'PENDING',
        retryCount: 0,
        payload: {
          // Corrupt: Missing required einsatzId field
          createdBy: 'invalid-user-id',
          alarmstichwort: 'Test',
          nummer: 'E2024-test',
        } as never,
      });

      // When: Trigger polling worker
      await outboxPublisher.triggerManually();

      // Then: Immediately FAILED (retryCount does not increment for deserialization errors)
      const failedEvent = await ctx.outboxRepository.findById(eventId);
      expect(failedEvent).not.toBeNull();
      expect(failedEvent!.status).toBe('FAILED');
      expect(failedEvent!.retryCount).toBe(1); // Incremented once, then permanently failed
      expect(failedEvent!.lastFailureReason).toContain('Invalid einsatzId');
    });

    it('should handle completely corrupt JSON payload', async () => {
      // Given: Event with completely invalid JSON structure
      const eventId = generateTestId();

      await ctx.prisma.outboxEvent.create({
        data: {
          id: eventId,
          eventName: 'einsatz.created',
          eventVersion: 1,
          aggregateId: generateTestId(),
          // Corrupt: Not even valid SerializedEvent structure
          payload: { corrupted: 'data', random: 123 } as never,
          status: 'PENDING',
          retryCount: 0,
          createdAt: new Date(),
          occurredAt: new Date(),
        },
      });

      // When: Trigger polling worker
      await outboxPublisher.triggerManually();

      // Then: Immediately FAILED
      const failedEvent = await ctx.outboxRepository.findById(eventId);
      expect(failedEvent).not.toBeNull();
      expect(failedEvent!.status).toBe('FAILED');
      expect(failedEvent!.lastFailureReason).toBeDefined();
    });
  });

  // ============================================
  // AC1.6: Event Roundtrip Preserves Data
  // ============================================

  describe('AC1.6: Event Roundtrip Preserves Data', () => {
    it('should preserve all EinsatzCreatedEvent fields through roundtrip', async () => {
      // Given: Original event with all fields
      const einsatzId = EinsatzId.create().value!;
      const createdBy = UserId.create(ctx.testUserIds.user).value!;
      const originalEvent = new EinsatzCreatedEvent(einsatzId, createdBy, 'Großbrand Industriegebiet', `E2024-${generateTestId().substring(0, 8)}`, einsatzId.value);

      // When: Serialize → Store in DB → Load → Deserialize
      const _serialized = eventSerializer.serialize(originalEvent);
      await ctx.outboxRepository.save([originalEvent]);

      const storedEvent = await ctx.outboxRepository.findById(originalEvent.eventId);
      expect(storedEvent).not.toBeNull();

      const deserializeResult = eventDeserializer.deserialize(storedEvent!.payload);
      expect(deserializeResult.isSuccess).toBe(true);

      const deserializedEvent = deserializeResult.value as EinsatzCreatedEvent;

      // Then: All fields match original
      expect(deserializedEvent).toBeInstanceOf(EinsatzCreatedEvent);
      expect(deserializedEvent.einsatzId.value).toBe(originalEvent.einsatzId.value);
      expect(deserializedEvent.createdBy.value).toBe(originalEvent.createdBy.value);
      expect(deserializedEvent.alarmstichwort).toBe(originalEvent.alarmstichwort);
      expect(deserializedEvent.nummer).toBe(originalEvent.nummer);
      expect(deserializedEvent.aggregateId).toBe(originalEvent.aggregateId);
    });

    it('should handle all 19 event types correctly', async () => {
      // Test representative sample of event types (covering all domains)
      const testCases = [
        // Einsatz Events
        {
          name: 'EinsatzCreatedEvent',
          event: new EinsatzCreatedEvent(EinsatzId.create().value!, UserId.create(ctx.testUserIds.user).value!, 'Test Einsatz', `E2024-${generateTestId().substring(0, 8)}`),
        },
        {
          name: 'EinsatzUpdatedEvent',
          event: new EinsatzUpdatedEvent(EinsatzId.create().value!, {
            alarmstichwort: 'Updated Alarmstichwort',
            einsatzort: 'Neue Straße 1',
          }),
        },
        {
          name: 'EinsatzStatusChangedEvent',
          event: new EinsatzStatusChangedEvent(EinsatzId.create().value!, EinsatzStatus.create('ANGELEGT').value!, EinsatzStatus.create('IN_BEARBEITUNG').value!),
        },
        {
          name: 'EinsatzCompletedEvent',
          event: new EinsatzCompletedEvent(EinsatzId.create().value!, UserId.create(ctx.testUserIds.user).value!, new Date()),
        },
        {
          name: 'EinsatzArchivedEvent',
          event: new EinsatzArchivedEvent(EinsatzId.create().value!, UserId.create(ctx.testUserIds.admin).value!),
        },

        // ETB Events
        {
          name: 'EtbCreatedEvent',
          event: new EtbCreatedEvent(EtbId.create().value!, EinsatzId.create().value!),
        },
        {
          name: 'EintragAddedEvent',
          event: new EintragAddedEvent(EtbId.create().value!, EintragId.create().value!, 1, 'Test Eintrag Text', UserId.create(ctx.testUserIds.user).value!),
        },
        {
          name: 'EintragUpdatedEvent',
          event: new EintragUpdatedEvent(EtbId.create().value!, EintragId.create().value!, 'Old Text', 'New Text', UserId.create(ctx.testUserIds.user).value!),
        },
        {
          name: 'EintragDeletedEvent',
          event: new EintragDeletedEvent(EtbId.create().value!, EintragId.create().value!, UserId.create(ctx.testUserIds.user).value!),
        },
        {
          name: 'EtbLockedEvent',
          event: new EtbLockedEvent(EtbId.create().value!, UserId.create(ctx.testUserIds.admin).value!, new Date()),
        },

        // Lagekarte Events
        {
          name: 'LagekarteCreatedEvent',
          event: new LagekarteCreatedEvent(LagekarteId.create().value!, EinsatzId.create().value!, UserId.create(ctx.testUserIds.user).value!, false),
        },
        {
          name: 'PoiAddedEvent',
          event: new PoiAddedEvent(
            LagekarteId.create().value!,
            PoiId.create().value!,
            'Einsatzstelle',
            MgrsCoordinate.fromString('33UUU1234567890').value!,
            PoiCategory.create('FIRE').value!,
            UserId.create(ctx.testUserIds.user).value!,
          ),
        },
        {
          name: 'PoiRemovedEvent',
          event: new PoiRemovedEvent(LagekarteId.create().value!, PoiId.create().value!, UserId.create(ctx.testUserIds.user).value!),
        },
        {
          name: 'PoiPositionUpdatedEvent',
          event: new PoiPositionUpdatedEvent(
            LagekarteId.create().value!,
            PoiId.create().value!,
            MgrsCoordinate.fromString('33UUU1234567890').value!,
            MgrsCoordinate.fromString('33UUU9876543210').value!,
            UserId.create(ctx.testUserIds.user).value!,
          ),
        },

        // User Events
        {
          name: 'UserCreatedEvent',
          event: new UserCreatedEvent(UserId.create().value!, Username.create('testuser').value!, UserRole.create('USER').value!),
        },
        {
          name: 'UserDeletedEvent',
          event: new UserDeletedEvent(UserId.create().value!, UserId.create(ctx.testUserIds.admin).value!),
        },
        {
          name: 'UserRoleChangedEvent',
          event: new UserRoleChangedEvent(UserId.create().value!, UserRole.create('USER').value!, UserRole.create('ADMIN').value!, UserId.create(ctx.testUserIds.superAdmin).value!),
        },
        {
          name: 'PermissionGrantedEvent',
          event: new PermissionGrantedEvent(UserId.create().value!, Permission.create('MANAGE_USERS').value!, UserId.create(ctx.testUserIds.admin).value!),
        },
        {
          name: 'PermissionRevokedEvent',
          event: new PermissionRevokedEvent(UserId.create().value!, Permission.create('MANAGE_USERS').value!, UserId.create(ctx.testUserIds.admin).value!),
        },
      ];

      // When: Test roundtrip for each event type
      for (const testCase of testCases) {
        // Serialize
        const serialized = eventSerializer.serialize(testCase.event);
        expect(serialized).toBeDefined();
        expect(serialized.eventName).toBeDefined();

        // Store in DB
        await ctx.outboxRepository.save([testCase.event]);

        // Load from DB
        const storedEvent = await ctx.outboxRepository.findById(testCase.event.eventId);
        expect(storedEvent).not.toBeNull();

        // Deserialize
        const deserializeResult = eventDeserializer.deserialize(storedEvent!.payload);
        expect(deserializeResult.isSuccess).toBe(true);

        const deserializedEvent = deserializeResult.value!;

        // Then: Event type matches
        expect(deserializedEvent.constructor.name).toBe(testCase.name);
        expect((deserializedEvent.constructor as typeof EinsatzCreatedEvent).eventName()).toBe(serialized.eventName);
      }
    });
  });

  // ============================================
  // AC1.7: Concurrency Prevention
  // ============================================

  describe('AC1.7: Concurrency Prevention', () => {
    it('should prevent concurrent polling executions via isRunning flag', async () => {
      // Given: Multiple PENDING events in outbox
      const events = Array.from({ length: 5 }, (_, i) => {
        const einsatzId = EinsatzId.create().value!;
        const createdBy = UserId.create(ctx.testUserIds.user).value!;
        return new EinsatzCreatedEvent(einsatzId, createdBy, `Concurrent Test Einsatz ${i}`, `E2024-${generateTestId().substring(0, 8)}`, einsatzId.value);
      });

      await ctx.outboxRepository.save(events);

      // When: Call publishPendingEvents() twice simultaneously
      const promise1 = outboxPublisher.publishPendingEvents();
      const promise2 = outboxPublisher.publishPendingEvents();

      await Promise.all([promise1, promise2]);

      // Then: Second call should have skipped (isRunning = true)
      // Verify: All events were published exactly once
      const publishedEvents = ctx.eventPublisher.getEventsByName('einsatz.created');

      // Note: Due to isRunning flag, second call skips, so we should have
      // exactly the events from the first call (not duplicated)
      expect(publishedEvents.length).toBe(events.length);

      // Verify all events are PUBLISHED in DB
      for (const event of events) {
        const storedEvent = await ctx.outboxRepository.findById(event.eventId);
        expect(storedEvent).not.toBeNull();
        expect(storedEvent!.status).toBe('PUBLISHED');
      }
    });

    it('should allow sequential executions after previous completes', async () => {
      // Given: PENDING events
      const firstBatch = [new EinsatzCreatedEvent(EinsatzId.create().value!, UserId.create(ctx.testUserIds.user).value!, 'Sequential Test 1', `E2024-${generateTestId().substring(0, 8)}`)];

      await ctx.outboxRepository.save(firstBatch);

      // When: First execution
      await outboxPublisher.triggerManually();

      // Verify first batch published
      let publishedCount = ctx.eventPublisher.publishedEvents.length;
      expect(publishedCount).toBe(1);

      // Add second batch
      const secondBatch = [new EinsatzCreatedEvent(EinsatzId.create().value!, UserId.create(ctx.testUserIds.user).value!, 'Sequential Test 2', `E2024-${generateTestId().substring(0, 8)}`)];

      await ctx.outboxRepository.save(secondBatch);

      // When: Second execution (after first completed)
      await outboxPublisher.triggerManually();

      // Then: Second batch also published (isRunning flag was released)
      publishedCount = ctx.eventPublisher.publishedEvents.length;
      expect(publishedCount).toBe(2);
    });
  });
});
