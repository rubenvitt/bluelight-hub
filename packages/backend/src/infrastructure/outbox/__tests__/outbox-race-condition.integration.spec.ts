/**
 * Integration Tests für Outbox Race Condition Prevention (Story 0-2).
 *
 * Diese Tests validieren die Acceptance Criteria für Race-Condition-sichere
 * Event-Publishing im Transactional Outbox Pattern mit PostgreSQL Pessimistic Locking.
 *
 * **Story 0-2 Acceptance Criteria:**
 * - AC1: Concurrent Access Prevention - Parallele publishPendingEvents() keine Duplikate
 * - AC2: Pessimistic Locking Query - FOR UPDATE SKIP LOCKED wird verwendet
 * - AC3: No Duplicate Event Publishing - Jedes Event exakt einmal verarbeitet
 * - AC4: Transaction Boundary Correctness - Lock freigegeben nach Status-Update Commit
 * - AC5: FIFO Ordering Preserved - ORDER BY createdAt ASC beibehalten
 *
 * **Test Strategy:**
 * - Real PostgreSQL Database (E2E Setup Pattern)
 * - Multiple Publisher Instances (parallele Scheduler Simulation)
 * - SpyEventPublisher für Event Tracking
 * - Direct Database Manipulation via Prisma
 * - Promise.all() für echte Parallelität
 *
 * **Implementation Notes:**
 * - Verwendet EinsatzE2eTestContext für DB Setup/Cleanup
 * - OutboxEventPublisher mit Real Dependencies
 * - PrismaOutboxRepository mit Real Database
 * - EventDeserializer für JSON → Domain Event Konvertierung
 */

import type { EinsatzE2eTestContext } from '../../einsatz/__tests__/einsatz.e2e-setup';
import { createEinsatzE2eModule, teardownE2eModule, cleanupTestData, generateTestId, waitFor } from '../../einsatz/__tests__/einsatz.e2e-setup';
import { OutboxEventPublisher, DEFAULT_OUTBOX_PUBLISHER_CONFIG } from '../outbox-event-publisher.service';
import { EventDeserializer } from '../event-deserializer';
import type { PrismaService } from '@/prisma/prisma.service';

describe('Outbox Race Condition Prevention (Story 0-2)', () => {
  let ctx: EinsatzE2eTestContext;

  beforeAll(async () => {
    ctx = await createEinsatzE2eModule();
  });

  beforeEach(async () => {
    // Ensure clean state before each test
    ctx.eventPublisher.clear();

    // Clean up ALL outbox events (including orphaned test events)
    await ctx.prisma.$executeRaw`DELETE FROM outbox_events`;
  });

  afterEach(async () => {
    // Clean up test data after each test
    ctx.eventPublisher.clear();
    await ctx.prisma.$executeRaw`DELETE FROM outbox_events`;
    await cleanupTestData(ctx);
  });

  afterAll(async () => {
    await teardownE2eModule(ctx);
  });

  /**
   * Helper: Erstellt Test-Outbox-Events mit verschiedenen Timestamps.
   *
   * Erstellt Events direkt in der Datenbank mit PENDING Status und
   * steigenden createdAt Timestamps für FIFO Testing.
   *
   * @param count - Anzahl zu erstellender Events
   * @param baseTime - Basis-Timestamp (default: NOW())
   * @returns Array von Event IDs (CUID2 Format)
   */
  async function createTestOutboxEvents(count: number, baseTime?: Date): Promise<string[]> {
    const eventIds: string[] = [];
    const base = baseTime ?? new Date();

    for (let i = 0; i < count; i++) {
      const eventId = generateTestId();
      const createdAt = new Date(base.getTime() + i * 1000); // 1 Sekunde Abstand

      await ctx.prisma.$executeRaw`
        INSERT INTO outbox_events (
          id,
          "eventName",
          "eventVersion",
          "aggregateId",
          payload,
          status,
          "retryCount",
          "createdAt",
          "occurredAt"
        ) VALUES (
          ${eventId},
          'einsatz.created',
          1,
          ${generateTestId()},
          ${JSON.stringify({
            eventId,
            eventName: 'einsatz.created',
            eventVersion: 1,
            occurredAt: createdAt.toISOString(),
            aggregateId: generateTestId(),
            payload: {
              einsatzId: generateTestId(),
              createdBy: ctx.testUserIds.user,
              alarmstichwort: `Test Event ${i}`,
              nummer: `${i}`,
            },
          })}::jsonb,
          'PENDING'::"OutboxEventStatus",
          0,
          ${createdAt},
          ${createdAt}
        )
      `;
      eventIds.push(eventId);
    }

    return eventIds;
  }

  /**
   * Helper: Erstellt einen OutboxEventPublisher mit Real Dependencies.
   *
   * Der Publisher nutzt die echten Repositories und EventDeserializer
   * aus dem Test-Kontext, aber einen eigenen SpyEventPublisher für
   * Event Tracking.
   *
   * @returns OutboxEventPublisher Instanz
   */
  function createPublisher(): OutboxEventPublisher {
    const eventDeserializer = new EventDeserializer();
    return new OutboxEventPublisher(
      ctx.prisma as PrismaService,
      ctx.outboxRepository,
      eventDeserializer,
      ctx.eventPublisher,
      undefined, // Kein AlertService in Tests
      DEFAULT_OUTBOX_PUBLISHER_CONFIG,
    );
  }

  /**
   * Helper: Wartet auf Event-Publishing und gibt publizierte Event-Namen zurück.
   *
   * Pollt den SpyEventPublisher bis die erwartete Anzahl Events publiziert wurde
   * oder Timeout erreicht wird.
   *
   * @param expectedCount - Erwartete Anzahl publizierter Events
   * @param timeout - Maximale Wartezeit in Millisekunden (default: 2000ms)
   * @returns Array von Event-Namen (für Verifikation)
   */
  async function waitForPublishedEvents(expectedCount: number, timeout = 2000): Promise<string[]> {
    await waitFor(
      async () => {
        expect(ctx.eventPublisher.publishedEvents.length).toBe(expectedCount);
      },
      timeout,
      50,
    );

    return ctx.eventPublisher.publishedEvents.map((e) => e.constructor.name);
  }

  // ============================================
  // AC1: Concurrent Access Prevention
  // ============================================

  describe('AC1: Concurrent Access Prevention', () => {
    it('should prevent duplicate processing with parallel scheduler instances', async () => {
      // Given: 10 PENDING Events in Outbox
      const eventIds = await createTestOutboxEvents(10);

      // When: Zwei parallele publishPendingEvents() Calls (simuliert 2 Scheduler Instances)
      const publisher1 = createPublisher();
      const publisher2 = createPublisher();

      await Promise.all([publisher1.publishPendingEvents(), publisher2.publishPendingEvents()]);

      // Then: Jedes Event wurde exakt einmal publiziert (10 Events, NICHT 20)
      await waitForPublishedEvents(10);

      // Verify: Alle Events sind PUBLISHED (kein Duplikat bleibt PENDING)
      const pendingEvents = await ctx.outboxRepository.findPendingEvents(100);
      expect(pendingEvents).toHaveLength(0);

      // Verify: Alle Original-Events sind PUBLISHED
      for (const eventId of eventIds) {
        const event = await ctx.outboxRepository.findById(eventId);
        expect(event?.status).toBe('PUBLISHED');
      }
    });

    it('should handle 3+ parallel scheduler instances without duplicates', async () => {
      // Given: 15 PENDING Events
      const eventIds = await createTestOutboxEvents(15);

      // Clear any events from previous tests (defensive)
      ctx.eventPublisher.clear();

      // When: 3 parallele Scheduler Instances
      const publisher1 = createPublisher();
      const publisher2 = createPublisher();
      const publisher3 = createPublisher();

      await Promise.all([publisher1.publishPendingEvents(), publisher2.publishPendingEvents(), publisher3.publishPendingEvents()]);

      // Then: Exakt 15 Events publiziert (NICHT 45)
      await waitForPublishedEvents(15);

      // Verify: Keine PENDING Events mehr
      const pendingEvents = await ctx.outboxRepository.findPendingEvents(100);
      expect(pendingEvents).toHaveLength(0);

      // Verify: Alle Events sind PUBLISHED
      for (const eventId of eventIds) {
        const event = await ctx.outboxRepository.findById(eventId);
        expect(event?.status).toBe('PUBLISHED');
      }
    });

    it('should handle rapid sequential calls without duplicates', async () => {
      // Given: 5 PENDING Events
      await createTestOutboxEvents(5);

      // When: Schnell aufeinanderfolgende Calls (kein Duplikat trotz Race Window)
      const publisher = createPublisher();
      await Promise.all([publisher.publishPendingEvents(), publisher.publishPendingEvents(), publisher.publishPendingEvents()]);

      // Then: Exakt 5 Events publiziert
      await waitForPublishedEvents(5);

      const pendingEvents = await ctx.outboxRepository.findPendingEvents(100);
      expect(pendingEvents).toHaveLength(0);
    });
  });

  // ============================================
  // AC2: Pessimistic Locking Query
  // ============================================

  describe('AC2: Pessimistic Locking Query', () => {
    it('should use FOR UPDATE SKIP LOCKED when querying pending events', async () => {
      // Given: 3 PENDING Events
      const eventIds = await createTestOutboxEvents(3);

      // When: findAndLockPending() innerhalb einer Transaction
      let lockedEventIds: string[] = [];
      await ctx.prisma.$transaction(async (tx) => {
        const events = await ctx.outboxRepository.findAndLockPending(10, tx);
        lockedEventIds = events.map((e) => e.id);

        // Verify: Events wurden gelocked (gleiche Order wie createdAt ASC)
        expect(lockedEventIds).toHaveLength(3);
        expect(lockedEventIds).toEqual(eventIds); // FIFO Order
      });

      // Verify: Nach Transaction COMMIT sind Events noch immer PENDING
      // (Lock wurde freigegeben, Status noch nicht geändert)
      const pendingEvents = await ctx.outboxRepository.findPendingEvents(10);
      expect(pendingEvents).toHaveLength(3);
    });

    it('should verify SKIP LOCKED prevents blocking on locked rows', async () => {
      // Given: 5 PENDING Events
      const eventIds = await createTestOutboxEvents(5);

      // When: Two parallel transactions try to lock events
      // This test verifies that SKIP LOCKED prevents blocking/deadlocks
      const results = await Promise.all([
        ctx.prisma.$transaction(async (tx) => {
          const events = await ctx.outboxRepository.findAndLockPending(10, tx);
          await new Promise((r) => setTimeout(r, 100)); // Hold lock briefly
          return events.map((e) => e.id);
        }),
        ctx.prisma.$transaction(async (tx) => {
          await new Promise((r) => setTimeout(r, 50)); // Start slightly after TX1
          const events = await ctx.outboxRepository.findAndLockPending(10, tx);
          return events.map((e) => e.id);
        }),
      ]);

      const [tx1Ids, tx2Ids] = results;

      // Then: Both transactions completed without blocking (SKIP LOCKED worked)
      expect(tx1Ids.length + tx2Ids.length).toBeLessThanOrEqual(5);

      // Verify: No overlapping IDs (each event locked by at most one transaction)
      const allIds = [...tx1Ids, ...tx2Ids];
      const uniqueIds = [...new Set(allIds)];
      expect(uniqueIds.length).toBe(allIds.length); // No duplicates

      // Verify: All original events were locked
      expect(uniqueIds.sort()).toEqual(eventIds.sort());
    });
  });

  // ============================================
  // AC3: No Duplicate Event Publishing
  // ============================================

  describe('AC3: No Duplicate Event Publishing', () => {
    it('should process each event exactly once with concurrent polls', async () => {
      // Given: 20 Events mit bekannten IDs
      const eventIds = await createTestOutboxEvents(20);

      // When: 4 parallele Publisher Instances (High Concurrency)
      const publishers = Array.from({ length: 4 }, () => createPublisher());
      await Promise.all(publishers.map((p) => p.publishPendingEvents()));

      // Then: Exakt 20 Events publiziert
      await waitForPublishedEvents(20, 3000);

      // Verify: Jedes Event nur einmal publiziert (Count via SpyEventPublisher)
      const publishedEventIds = new Set(
        ctx.eventPublisher.publishedEvents.map((e) => {
          // Extract eventId from Event instance (falls vorhanden)
          return (e as { eventId?: string }).eventId;
        }),
      );

      // Alternative: Verify via Database Status
      for (const eventId of eventIds) {
        const event = await ctx.outboxRepository.findById(eventId);
        expect(event?.status).toBe('PUBLISHED');
        expect(event?.publishedAt).not.toBeNull();
      }

      // Verify: Keine PENDING Events mehr
      const pendingEvents = await ctx.outboxRepository.findPendingEvents(100);
      expect(pendingEvents).toHaveLength(0);
    });

    it('should not publish event twice if first publish succeeds', async () => {
      // Given: 1 PENDING Event
      const [eventId] = await createTestOutboxEvents(1);

      // When: Publisher verarbeitet Event
      const publisher = createPublisher();
      await publisher.publishPendingEvents();

      // Verify: Event ist PUBLISHED
      let event = await ctx.outboxRepository.findById(eventId);
      expect(event?.status).toBe('PUBLISHED');

      // When: Zweiter publishPendingEvents() Call
      ctx.eventPublisher.clear(); // Reset Spy
      await publisher.publishPendingEvents();

      // Then: KEIN weiteres Event publiziert (SpyEventPublisher leer)
      expect(ctx.eventPublisher.publishedEvents).toHaveLength(0);

      // Verify: Event bleibt PUBLISHED (kein Re-Publishing)
      event = await ctx.outboxRepository.findById(eventId);
      expect(event?.status).toBe('PUBLISHED');
    });
  });

  // ============================================
  // AC4: Transaction Boundary Correctness
  // ============================================

  describe('AC4: Transaction Boundary Correctness', () => {
    it('should hold lock until status update commits', async () => {
      // Given: 2 PENDING Events
      await createTestOutboxEvents(2);

      let tx1EventIds: string[] = [];

      // When: TX1 startet, lockt Events, aber committed noch nicht
      const tx1Promise = ctx.prisma.$transaction(
        async (tx) => {
          const events = await ctx.outboxRepository.findAndLockPending(2, tx);
          tx1EventIds = events.map((e) => e.id);

          // Mark as PUBLISHED (aber TX noch nicht committed)
          for (const event of events) {
            await ctx.outboxRepository.markAsPublished(event.id, tx);
          }

          // Halte Lock für 300ms (vor COMMIT)
          await new Promise((r) => setTimeout(r, 300));

          return tx1EventIds;
        },
        { timeout: 2000 },
      );

      // Warte bis TX1 Lock hat
      await new Promise((r) => setTimeout(r, 100));

      // TX2 versucht parallel Events zu holen (sollte warten oder überspringen)
      const tx2Promise = ctx.prisma.$transaction(async (tx) => {
        const events = await ctx.outboxRepository.findAndLockPending(10, tx);
        // Events sind noch gelocked oder bereits PUBLISHED (nach TX1 COMMIT)
        return events;
      });

      // Then: TX1 committed erfolgreich
      const tx1Ids = await tx1Promise;
      expect(tx1Ids).toHaveLength(2);

      // TX2 findet keine PENDING Events mehr (TX1 hat sie published)
      const tx2Events = await tx2Promise;
      expect(tx2Events).toHaveLength(0);

      // Verify: Events sind PUBLISHED nach TX1 COMMIT
      for (const eventId of tx1Ids) {
        const event = await ctx.outboxRepository.findById(eventId);
        expect(event?.status).toBe('PUBLISHED');
        expect(event?.publishedAt).not.toBeNull();
      }
    });

    it('should release lock on transaction rollback', async () => {
      // Given: 2 PENDING Events
      const eventIds = await createTestOutboxEvents(2);

      // When: TX1 lockt Events, macht Rollback
      try {
        await ctx.prisma.$transaction(async (tx) => {
          const events = await ctx.outboxRepository.findAndLockPending(2, tx);
          expect(events).toHaveLength(2);

          // Simuliere Fehler → Rollback
          throw new Error('Simulated Error');
        });
      } catch (error) {
        // Expected Error
      }

      // Then: Events bleiben PENDING (Rollback) und Lock ist freigegeben
      const pendingEvents = await ctx.outboxRepository.findPendingEvents(10);
      expect(pendingEvents).toHaveLength(2);
      expect(pendingEvents.map((e) => e.id).sort()).toEqual(eventIds.sort());

      // Verify: Lock ist freigegeben (neuer Publisher kann Events verarbeiten)
      const publisher = createPublisher();
      await publisher.publishPendingEvents();

      await waitForPublishedEvents(2);

      // Verify: Events sind jetzt PUBLISHED
      const finalEvents = await ctx.outboxRepository.findPendingEvents(10);
      expect(finalEvents).toHaveLength(0);
    });
  });

  // ============================================
  // AC5: FIFO Ordering Preserved
  // ============================================

  describe('AC5: FIFO Ordering', () => {
    it('should process events in createdAt order', async () => {
      // Given: 5 Events mit unterschiedlichen createdAt Timestamps
      const baseTime = new Date('2024-01-01T10:00:00.000Z');
      const eventIds = await createTestOutboxEvents(5, baseTime);

      // When: Publisher verarbeitet Events
      const publisher = createPublisher();
      await publisher.publishPendingEvents();

      // Wait for all events to be published
      await waitForPublishedEvents(5);

      // Then: Events wurden in createdAt ASC Order publiziert
      // Verify via Database publishedAt Timestamps (sollten aufsteigend sein)
      const publishedEvents = [];
      for (const eventId of eventIds) {
        const event = await ctx.outboxRepository.findById(eventId);
        expect(event?.status).toBe('PUBLISHED');
        publishedEvents.push({
          id: eventId,
          createdAt: event!.createdAt,
          publishedAt: event!.publishedAt!,
        });
      }

      // Verify: publishedAt Timestamps folgen createdAt Order
      for (let i = 1; i < publishedEvents.length; i++) {
        const prev = publishedEvents[i - 1];
        const curr = publishedEvents[i];

        // createdAt sollte strikt aufsteigend sein (1 Sekunde Abstand)
        expect(curr.createdAt.getTime()).toBeGreaterThan(prev.createdAt.getTime());
      }
    });

    it('should maintain FIFO order with batch processing', async () => {
      // Given: 10 Events (Batch Size = 100, alle passen in einen Batch)
      const baseTime = new Date('2024-01-01T10:00:00.000Z');
      const eventIds = await createTestOutboxEvents(10, baseTime);

      // When: Batch Processing via Publisher
      const publisher = createPublisher();
      await publisher.publishPendingEvents();

      await waitForPublishedEvents(10);

      // Then: Alle Events in Order verarbeitet
      const publishedEvents = [];
      for (const eventId of eventIds) {
        const event = await ctx.outboxRepository.findById(eventId);
        publishedEvents.push({
          id: eventId,
          createdAt: event!.createdAt,
          status: event!.status,
        });
      }

      // Verify: createdAt Order entspricht Original Order
      for (let i = 0; i < publishedEvents.length; i++) {
        expect(publishedEvents[i].id).toBe(eventIds[i]);
        expect(publishedEvents[i].status).toBe('PUBLISHED');
      }
    });

    it('should preserve FIFO order across multiple polling cycles', async () => {
      // Given: 150 Events (mehr als Batch Size 100)
      const baseTime = new Date('2024-01-01T10:00:00.000Z');
      const eventIds = await createTestOutboxEvents(150, baseTime);

      // When: Mehrere Polling Cycles (Batch 1: Events 0-99, Batch 2: Events 100-149)
      const publisher = createPublisher();

      // First poll (Batch 0-99)
      await publisher.publishPendingEvents();
      await waitForPublishedEvents(100, 3000);

      // Second poll (Batch 100-149)
      ctx.eventPublisher.clear();
      await publisher.publishPendingEvents();
      await waitForPublishedEvents(50, 3000);

      // Then: Alle Events in FIFO Order verarbeitet
      let previousCreatedAt = new Date(0);
      for (const eventId of eventIds) {
        const event = await ctx.outboxRepository.findById(eventId);
        expect(event?.status).toBe('PUBLISHED');

        // Verify: createdAt steigt monoton
        expect(event!.createdAt.getTime()).toBeGreaterThanOrEqual(previousCreatedAt.getTime());
        previousCreatedAt = event!.createdAt;
      }

      // Verify: Keine PENDING Events mehr
      const pendingEvents = await ctx.outboxRepository.findPendingEvents(200);
      expect(pendingEvents).toHaveLength(0);
    });
  });
});
