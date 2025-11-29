/**
 * E2E Test Module Setup fuer Einsatz Infrastructure.
 *
 * Diese Datei stellt die vollständige E2E Test-Infrastruktur bereit:
 * - Database Setup/Cleanup Utilities mit Trigger-Management
 * - SpyEventPublisher fuer Event Verification
 * - Test User Creation Helpers (3 Rollen: USER, ADMIN, SUPER_ADMIN)
 * - Test Einsatz/Outbox Creation Helpers
 * - ID-Generator Funktionen (CUID2 Format via @paralleldrive/cuid2)
 * - Transaction-sichere Cleanup-Logik
 *
 * **ID-FORMAT-KONVENTIONEN:**
 * - **CUID2** (alle Entity IDs: EinsatzId, UserId, OutboxEventId): Format von @paralleldrive/cuid2
 *
 * **TEST STRATEGY:**
 * - Real PostgreSQL Database (NICHT mocked)
 * - Direct Handler Invocation (CQRS Commands/Queries)
 * - Given-When-Then BDD Style
 * - Cleanup mit Triggers disabled (SET session_replication_role = replica)
 * - RBAC Testing mit 3 User-Rollen (USER, ADMIN, SUPER_ADMIN)
 */

import { PrismaClient, UserRole, EinsatzStatus as PrismaEinsatzStatus } from '@prisma/client';
import type { DomainEvent } from '@domain/common/domain-event';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { PrismaEinsatzRepository } from '../repositories/prisma-einsatz.repository';
import { PrismaOutboxRepository } from '@/infrastructure/outbox/prisma-outbox.repository';
import { EventSerializer } from '@/infrastructure/outbox/event-serializer';
import { createId } from '@paralleldrive/cuid2';

// ============================================
// TEST PRISMA SERVICE
// ============================================

/**
 * Test-kompatible PrismaService fuer E2E Tests.
 *
 * Diese Klasse erweitert PrismaClient und implementiert die NestJS
 * Lifecycle Hooks (OnModuleInit, OnModuleDestroy) um mit PrismaEinsatzRepository
 * kompatibel zu sein, der einen PrismaService erwartet.
 */
class TestPrismaService extends PrismaClient {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

// ============================================
// SPY EVENT PUBLISHER
// ============================================

/**
 * SpyEventPublisher: Implementiert IEventPublisher und trackt alle publizierten Events.
 *
 * Gleiche Implementierung wie in integration/test-setup.ts und etb.e2e-setup.ts,
 * aber hier fuer Einsatz E2E Tests. Ermoeglicht Event-Verification ohne echte
 * EventEmitter-Infrastruktur.
 */
export class SpyEventPublisher implements IEventPublisher {
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

// ============================================
// ID GENERATION UTILITIES
// ============================================

/**
 * Generiert eine Test-ID im CUID2-Format.
 *
 * Verwendet @paralleldrive/cuid2 - das echte Format das auch
 * im Domain Layer zur Validierung verwendet wird (isCuid()).
 * Verwendet fuer: EinsatzId, UserId, OutboxEventId - ALLE Entity IDs!
 *
 * @returns CUID2-kompatible ID
 *
 * @example
 * ```typescript
 * const einsatzId = generateTestId(); // "clocq1tpv0000..."
 * const userId = generateTestId();     // Gleiches Format!
 * ```
 */
export function generateTestId(): string {
  return createId();
}

// ============================================
// DATABASE UTILITIES
// ============================================

/**
 * SQL zum Deaktivieren von Database Triggers.
 *
 * Notwendig fuer sichere Test-Daten Loeschung (FK Constraints umgehen).
 */
export const DISABLE_TRIGGERS_SQL = 'SET session_replication_role = replica;';

/**
 * SQL zum Reaktivieren von Database Triggers.
 *
 * IMMER in finally-Block ausfuehren!
 */
export const ENABLE_TRIGGERS_SQL = 'SET session_replication_role = DEFAULT;';

/**
 * Helper: Loescht alte Test-Daten aus einer Tabelle (aelter als 1 Stunde).
 *
 * Diese Funktion wird verwendet um Daten von vorherigen fehlgeschlagenen
 * Test-Runs aufzuraeumen. Sie ist idempotent und behandelt nicht-existente
 * Tabellen gracefully.
 *
 * @param prisma - PrismaClient Instanz
 * @param table - Tabellenname (inkl. Quotes wenn reserved word)
 * @param timestampCol - Spaltenname fuer Timestamp-Vergleich (inkl. Quotes)
 */
async function safeDeleteOld(prisma: TestPrismaService, table: string, timestampCol: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE ${timestampCol} < NOW() - INTERVAL '1 hour'`);
  } catch (error: unknown) {
    // Table might not exist - ignore error
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('does not exist') && !msg.includes('42P01')) {
      throw error;
    }
  }
}

/**
 * Helper: Fuehrt SQL DELETE aus, ignoriert aber Fehler wenn Tabelle nicht existiert.
 *
 * Nuetzlich fuer Cleanup-Operationen bei optionalen/zukuenftigen Tabellen.
 *
 * @param prisma - PrismaClient Instanz
 * @param sql - SQL DELETE Statement
 * @param params - SQL Parameter (optional)
 */
async function safeDelete(prisma: TestPrismaService, sql: string, params?: unknown[]): Promise<void> {
  try {
    if (params) {
      await prisma.$executeRawUnsafe(sql, ...params);
    } else {
      await prisma.$executeRawUnsafe(sql);
    }
  } catch (error: unknown) {
    // Table might not exist - ignore error
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('does not exist') && !msg.includes('42P01')) {
      throw error;
    }
  }
}

// ============================================
// E2E TEST MODULE PATTERN
// ============================================

/**
 * E2E Test Module Context Interface.
 *
 * Definiert die Struktur des Test-Kontexts der von createEinsatzE2eModule() zurueckgegeben wird.
 */
export interface EinsatzE2eTestContext {
  /** PrismaClient fuer direkte DB-Zugriffe in Tests */
  prisma: TestPrismaService;

  /** Einsatz Repository (real Prisma Implementation) */
  repository: PrismaEinsatzRepository;

  /** Outbox Repository (fuer Outbox Integration Tests) */
  outboxRepository: PrismaOutboxRepository;

  /** Event Publisher (Spy fuer Event Verification) */
  eventPublisher: SpyEventPublisher;

  /** Test User IDs (3 Rollen fuer RBAC Testing) */
  testUserIds: {
    /** User mit USER Rolle */
    user: string;
    /** User mit ADMIN Rolle */
    admin: string;
    /** User mit SUPER_ADMIN Rolle */
    superAdmin: string;
  };

  /** Unique Test Run ID fuer Isolation (Timestamp) */
  testRunId: string;
}

/**
 * Factory fuer Einsatz E2E Test Module.
 *
 * Erstellt vollstaendigen Test-Kontext mit:
 * - PrismaClient fuer DB-Zugriffe
 * - 3 Test Users (USER, ADMIN, SUPER_ADMIN Rollen) - CUID2 IDs
 * - PrismaEinsatzRepository
 * - PrismaOutboxRepository (fuer Outbox Integration Tests)
 * - SpyEventPublisher
 *
 * Fuehrt automatisch Cleanup von alten Test-Daten aus (aelter als 1 Stunde).
 * Cleanup-Reihenfolge beachtet FK Constraints:
 * - Lagekarten (POIs, Aktualisierungen, Versionen, Snapshots, Eintraege)
 * - ETB (Snapshots, Eintraege, Einsatztagebuecher)
 * - Outbox Events
 * - Einsaetze
 * - Test Users
 *
 * @returns E2E Test Context mit Repository, Prisma, Helpers
 *
 * @example
 * ```typescript
 * describe('Einsatz CQRS API - E2E Tests', () => {
 *   let ctx: EinsatzE2eTestContext;
 *
 *   beforeAll(async () => {
 *     ctx = await createEinsatzE2eModule();
 *   });
 *
 *   afterEach(async () => {
 *     await cleanupTestData(ctx);
 *   });
 *
 *   afterAll(async () => {
 *     await teardownE2eModule(ctx);
 *   });
 *
 *   it('should create Einsatz', async () => {
 *     // ... test
 *   });
 * });
 * ```
 */
export async function createEinsatzE2eModule(): Promise<EinsatzE2eTestContext> {
  // 1. PrismaClient erstellen (TestPrismaService fuer Repository-Kompatibilitaet)
  const prisma = new TestPrismaService();

  // 2. Cleanup von vorherigen Test-Runs (älter als 1 Stunde)
  await prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
  try {
    // Reihenfolge wichtig (FK Constraints beachten!):
    // Lagekarten Dependencies (POIs, etc.) -> ETB Dependencies -> Outbox -> Einsaetze -> Users

    // Lagekarten Dependencies (deepest FK first)
    await safeDeleteOld(prisma, 'lagekarten_pois', '"createdAt"');
    await safeDeleteOld(prisma, 'lagekarten_aktualisierungen', '"createdAt"');
    await safeDeleteOld(prisma, 'lagekarten_versionen', '"versionTimestamp"');
    await safeDeleteOld(prisma, 'lagekarten_snapshots', '"snapshotAt"');
    await safeDeleteOld(prisma, 'lagekarten_eintraege', '"createdAt"');
    await safeDeleteOld(prisma, 'lagekarten', '"createdAt"');

    // ETB Dependencies
    await safeDeleteOld(prisma, 'etb_snapshots', '"snapshotAt"');
    await safeDeleteOld(prisma, 'etb_eintraege', '"createdAt"');
    await safeDeleteOld(prisma, 'einsatztagebuecher', '"createdAt"');

    // Outbox Events (for outbox integration tests)
    await safeDeleteOld(prisma, 'outbox_events', '"createdAt"');

    // Einsaetze
    await safeDeleteOld(prisma, 'einsaetze', '"createdAt"');

    // Test Users
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test-einsatz-e2e-%'`);
  } finally {
    await prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
  }

  // 3. Test Users erstellen (3 Rollen fuer RBAC Testing - CUID2 Format!)
  const testRunId = Date.now().toString();

  const userId = generateTestId();
  const adminId = generateTestId();
  const superAdminId = generateTestId();

  // User mit USER Rolle
  await prisma.$executeRaw`
    INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
    VALUES (
      ${userId},
      ${`test-einsatz-e2e-user-${testRunId}`},
      'dummy-hash',
      'USER'::"UserRole",
      true,
      NOW(),
      NOW()
    )
  `;

  // User mit ADMIN Rolle
  await prisma.$executeRaw`
    INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
    VALUES (
      ${adminId},
      ${`test-einsatz-e2e-admin-${testRunId}`},
      'dummy-hash',
      'ADMIN'::"UserRole",
      true,
      NOW(),
      NOW()
    )
  `;

  // User mit SUPER_ADMIN Rolle
  await prisma.$executeRaw`
    INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
    VALUES (
      ${superAdminId},
      ${`test-einsatz-e2e-superadmin-${testRunId}`},
      'dummy-hash',
      'SUPER_ADMIN'::"UserRole",
      true,
      NOW(),
      NOW()
    )
  `;

  // 4. Repository und EventPublisher mit Outbox Support
  const eventSerializer = new EventSerializer();
  const outboxRepository = new PrismaOutboxRepository(prisma, eventSerializer);
  const repository = new PrismaEinsatzRepository(prisma, outboxRepository);
  const eventPublisher = new SpyEventPublisher();

  return {
    prisma,
    repository,
    outboxRepository,
    eventPublisher,
    testUserIds: {
      user: userId,
      admin: adminId,
      superAdmin: superAdminId,
    },
    testRunId,
  };
}

/**
 * Teardown fuer E2E Test Module.
 *
 * Loescht alle Test-Daten und schliesst DB-Verbindung.
 * Verwendet Trigger-Deaktivierung fuer sichere Loeschung.
 *
 * @param ctx - E2E Test Context
 */
export async function teardownE2eModule(ctx: EinsatzE2eTestContext): Promise<void> {
  await ctx.prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
  try {
    // Reihenfolge (FK-Reverse Order!):
    // Lagekarten -> ETB -> Outbox -> Einsaetze -> Users

    // Cleanup all test data created during tests (delete by test user IDs)
    const allUserIds = [ctx.testUserIds.user, ctx.testUserIds.admin, ctx.testUserIds.superAdmin];

    // Lagekarten Dependencies (safe delete - tables may not exist yet)
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_pois WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(
      ctx.prisma,
      `DELETE FROM lagekarten_aktualisierungen WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`,
      [allUserIds],
    );
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_versionen WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_snapshots WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_eintraege WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1))`, [allUserIds]);

    // ETB Dependencies
    await safeDelete(ctx.prisma, `DELETE FROM etb_snapshots WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(ctx.prisma, `DELETE FROM etb_eintraege WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(ctx.prisma, `DELETE FROM einsatztagebuecher WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1))`, [allUserIds]);

    // Outbox Events
    await safeDelete(ctx.prisma, `DELETE FROM outbox_events WHERE "aggregateId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1))`, [allUserIds]);

    // Einsaetze
    await safeDelete(ctx.prisma, `DELETE FROM einsaetze WHERE "createdBy" = ANY($1)`, [allUserIds]);

    // Test Users
    await safeDelete(ctx.prisma, `DELETE FROM "User" WHERE id = ANY($1)`, [allUserIds]);
  } finally {
    await ctx.prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
    await ctx.prisma.$disconnect();
  }
}

/**
 * Cleanup fuer einzelnen Test (afterEach).
 *
 * Loescht Einsatz-Daten aber behaelt Test-Users.
 * Cleared auch den Event Publisher Spy.
 *
 * @param ctx - E2E Test Context
 */
export async function cleanupTestData(ctx: EinsatzE2eTestContext): Promise<void> {
  ctx.eventPublisher.clear();

  await ctx.prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
  try {
    const allUserIds = [ctx.testUserIds.user, ctx.testUserIds.admin, ctx.testUserIds.superAdmin];

    // Reihenfolge (FK Order!): Lagekarten -> ETB -> Outbox -> Einsaetze
    // (Users bleiben erhalten!)

    // Lagekarten Dependencies (safe delete - tables may not exist yet)
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_pois WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(
      ctx.prisma,
      `DELETE FROM lagekarten_aktualisierungen WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`,
      [allUserIds],
    );
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_versionen WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_snapshots WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_eintraege WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1))`, [allUserIds]);

    // ETB Dependencies
    await safeDelete(ctx.prisma, `DELETE FROM etb_snapshots WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(ctx.prisma, `DELETE FROM etb_eintraege WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1)))`, [
      allUserIds,
    ]);
    await safeDelete(ctx.prisma, `DELETE FROM einsatztagebuecher WHERE "einsatzId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1))`, [allUserIds]);

    // Outbox Events
    await safeDelete(ctx.prisma, `DELETE FROM outbox_events WHERE "aggregateId" IN (SELECT id FROM einsaetze WHERE "createdBy" = ANY($1))`, [allUserIds]);

    // Einsaetze
    await safeDelete(ctx.prisma, `DELETE FROM einsaetze WHERE "createdBy" = ANY($1)`, [allUserIds]);
  } finally {
    await ctx.prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
  }
}

// ============================================
// TEST HELPERS
// ============================================

/**
 * Optionen fuer Test-Einsatz Erstellung.
 */
export interface CreateTestEinsatzOptions {
  /** Einsatz Status (default: ANGELEGT) */
  status?: 'ANGELEGT' | 'IN_BEARBEITUNG' | 'ABGESCHLOSSEN' | 'ARCHIVIERT';
  /** User ID der den Einsatz erstellt (default: ctx.testUserIds.user) */
  createdBy?: string;
  /** Alarmstichwort (default: generiert) */
  alarmstichwort?: string;
  /** archivedAt Timestamp (nur fuer ARCHIVIERT, default: NOW) */
  archivedAt?: Date;
}

/**
 * Helper: Erstellt einen neuen Test-Einsatz.
 *
 * Nuetzlich wenn ein Test einen separaten Einsatz benoetigt.
 * Verwendet standardmaessig den testUserIds.user aus dem Context fuer createdBy/updatedBy.
 *
 * @param ctx - E2E Test Context
 * @param options - Optionale Einsatz-Konfiguration
 * @returns ID des erstellten Einsatzes (CUID2 Format)
 *
 * @example
 * ```typescript
 * it('should work with separate Einsatz', async () => {
 *   const separateEinsatzId = await createTestEinsatz(ctx, {
 *     status: 'IN_BEARBEITUNG',
 *     createdBy: ctx.testUserIds.admin,
 *   });
 *   // ... test logic
 * });
 * ```
 */
export async function createTestEinsatz(ctx: EinsatzE2eTestContext, options?: CreateTestEinsatzOptions): Promise<string> {
  const einsatzId = generateTestId();
  const createdBy = options?.createdBy ?? ctx.testUserIds.user;
  const status = options?.status ?? 'ANGELEGT';
  const alarmstichwort = options?.alarmstichwort ?? `TEST - Einsatz E2E ${ctx.testRunId}-${Date.now()}`;

  // Determine archivedAt timestamp (only for ARCHIVIERT status)
  let archivedAt: Date | null = null;
  let archivedBy: string | null = null;

  if (status === 'ARCHIVIERT') {
    archivedAt = options?.archivedAt ?? new Date();
    archivedBy = createdBy; // Same user who created it
  }

  await ctx.prisma.$executeRaw`
    INSERT INTO einsaetze (id, alarmstichwort, einsatzort, status, "createdBy", "updatedBy", "archivedAt", "archivedBy", "createdAt", "updatedAt")
    VALUES (
      ${einsatzId},
      ${alarmstichwort},
      'Test-Einsatzort',
      ${status}::"EinsatzStatus",
      ${createdBy},
      ${createdBy},
      ${archivedAt},
      ${archivedBy},
      NOW(),
      NOW()
    )
  `;
  return einsatzId;
}

/**
 * Helper: Erstellt einen neuen Test-User mit spezifischer Rolle.
 *
 * Nuetzlich wenn ein Test zusaetzliche User mit bestimmten Rollen benoetigt.
 *
 * @param ctx - E2E Test Context
 * @param role - User Rolle (USER, ADMIN, SUPER_ADMIN)
 * @param username - Optionaler Username (default: generiert)
 * @returns ID des erstellten Users (CUID2 Format)
 *
 * @example
 * ```typescript
 * it('should handle multiple users', async () => {
 *   const extraAdminId = await createTestUser(ctx, 'ADMIN');
 *   // ... test logic
 * });
 * ```
 */
export async function createTestUser(ctx: EinsatzE2eTestContext, role: 'USER' | 'ADMIN' | 'SUPER_ADMIN', username?: string): Promise<string> {
  const userId = generateTestId();
  const generatedUsername = username ?? `test-einsatz-e2e-${role.toLowerCase()}-${ctx.testRunId}-${Date.now()}`;

  await ctx.prisma.$executeRaw`
    INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
    VALUES (
      ${userId},
      ${generatedUsername},
      'dummy-hash',
      ${role}::"UserRole",
      true,
      NOW(),
      NOW()
    )
  `;
  return userId;
}

/**
 * Optionen fuer Test-Outbox-Event Erstellung.
 */
export interface CreateTestOutboxEventOptions {
  /** Event Name (default: 'test.event') */
  eventName?: string;
  /** Aggregate ID (default: generiert) */
  aggregateId?: string;
  /** Event Status (default: PENDING) */
  status?: 'PENDING' | 'PUBLISHED' | 'FAILED';
  /** Retry Count (default: 0) */
  retryCount?: number;
  /** Event Payload (default: {}) */
  payload?: Record<string, unknown>;
}

/**
 * Helper: Erstellt ein Test-Outbox-Event.
 *
 * Nuetzlich fuer Outbox Integration Tests.
 *
 * @param ctx - E2E Test Context
 * @param options - Optionale Event-Konfiguration
 * @returns ID des erstellten Outbox Events (CUID2 Format)
 *
 * @example
 * ```typescript
 * it('should publish pending outbox events', async () => {
 *   const eventId = await createTestOutboxEvent(ctx, {
 *     eventName: 'einsatz.created',
 *     status: 'PENDING',
 *   });
 *   // ... test logic
 * });
 * ```
 */
export async function createTestOutboxEvent(ctx: EinsatzE2eTestContext, options?: CreateTestOutboxEventOptions): Promise<string> {
  const eventId = generateTestId();
  const eventName = options?.eventName ?? 'test.event';
  const aggregateId = options?.aggregateId ?? generateTestId();
  const status = options?.status ?? 'PENDING';
  const retryCount = options?.retryCount ?? 0;
  const payload = options?.payload ?? {};

  await ctx.prisma.$executeRaw`
    INSERT INTO outbox_events (id, "eventName", "aggregateId", payload, status, "retryCount", "createdAt", "occurredAt", "eventVersion")
    VALUES (
      ${eventId},
      ${eventName},
      ${aggregateId},
      ${JSON.stringify(payload)}::jsonb,
      ${status}::"OutboxEventStatus",
      ${retryCount},
      NOW(),
      NOW(),
      1
    )
  `;
  return eventId;
}

/**
 * Helper: Wartet bis eine asynchrone Assertion erfolgreich ist.
 *
 * Nuetzlich fuer Event-Handler Tests die async sind und Zeit benoetigen.
 * Pollt die Assertion in Intervallen bis timeout erreicht ist.
 *
 * @param assertion - Async Funktion die eine Assertion ausfuehrt
 * @param timeout - Maximale Wartezeit in Millisekunden (default: 500ms)
 * @param interval - Poll-Intervall in Millisekunden (default: 50ms)
 *
 * @throws Der letzte Assertion-Error wenn Timeout erreicht wird
 *
 * @example
 * ```typescript
 * it('should emit event', async () => {
 *   await createHandler.execute(command);
 *
 *   await waitFor(async () => {
 *     const events = ctx.eventPublisher.getEventsByName('einsatz.created');
 *     expect(events).toHaveLength(1);
 *   });
 * });
 * ```
 */
export async function waitFor(assertion: () => Promise<void>, timeout = 500, interval = 50): Promise<void> {
  const start = Date.now();
  let lastError: Error | undefined;
  while (Date.now() - start < timeout) {
    try {
      await assertion();
      return;
    } catch (e) {
      lastError = e as Error;
      await new Promise((r) => setTimeout(r, interval));
    }
  }
  throw lastError ?? new Error('Timeout waiting for assertion');
}

/**
 * Helper: Cleanup fuer spezifischen Einsatz (inkl. Dependencies).
 *
 * Loescht einen Einsatz und alle abhaengigen Daten (Lagekarte, ETB, Outbox).
 * Nuetzlich fuer gezieltes Cleanup in Tests.
 *
 * @param ctx - E2E Test Context
 * @param einsatzId - ID des zu loeschenden Einsatzes
 *
 * @example
 * ```typescript
 * it('should clean up after test', async () => {
 *   const einsatzId = await createTestEinsatz(ctx);
 *   // ... test logic
 *   await cleanupEinsatzById(ctx, einsatzId);
 * });
 * ```
 */
export async function cleanupEinsatzById(ctx: EinsatzE2eTestContext, einsatzId: string): Promise<void> {
  await ctx.prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
  try {
    // Reihenfolge (FK Order!): Lagekarten -> ETB -> Outbox -> Einsatz

    // Lagekarten Dependencies (safe delete - tables may not exist yet)
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_pois WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" = $1)`, [einsatzId]);
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_aktualisierungen WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" = $1)`, [einsatzId]);
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_versionen WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" = $1)`, [einsatzId]);
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_snapshots WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" = $1)`, [einsatzId]);
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten_eintraege WHERE "lagekarteId" IN (SELECT id FROM lagekarten WHERE "einsatzId" = $1)`, [einsatzId]);
    await safeDelete(ctx.prisma, `DELETE FROM lagekarten WHERE "einsatzId" = $1`, [einsatzId]);

    // ETB Dependencies
    await safeDelete(ctx.prisma, `DELETE FROM etb_snapshots WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "einsatzId" = $1)`, [einsatzId]);
    await safeDelete(ctx.prisma, `DELETE FROM etb_eintraege WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "einsatzId" = $1)`, [einsatzId]);
    await safeDelete(ctx.prisma, `DELETE FROM einsatztagebuecher WHERE "einsatzId" = $1`, [einsatzId]);

    // Outbox Events
    await safeDelete(ctx.prisma, `DELETE FROM outbox_events WHERE "aggregateId" = $1`, [einsatzId]);

    // Einsatz
    await safeDelete(ctx.prisma, `DELETE FROM einsaetze WHERE id = $1`, [einsatzId]);
  } finally {
    await ctx.prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
  }
}

// ============================================
// E2E TEST TEMPLATE DOCUMENTATION
// ============================================

/**
 * Template fuer Einsatz E2E Tests.
 *
 * Dieses Template zeigt die erwartete Struktur von E2E Tests.
 * Es dient als Referenz fuer Entwickler die neue E2E Tests schreiben.
 *
 * **BEST PRACTICES:**
 * - Given-When-Then BDD Style
 * - Event Publisher nach jedem Test clearen
 * - Test-Daten nach jedem Test aufräumen
 * - Alle DB-Ressourcen in afterAll schließen
 * - Async Event Handler mit waitFor() testen
 * - RBAC Testing mit verschiedenen User-Rollen (USER, ADMIN, SUPER_ADMIN)
 *
 * @example
 * ```typescript
 * describe('Einsatz CQRS API - E2E Tests', () => {
 *   let ctx: EinsatzE2eTestContext;
 *
 *   beforeAll(async () => {
 *     ctx = await createEinsatzE2eModule();
 *   });
 *
 *   afterEach(async () => {
 *     await cleanupTestData(ctx);
 *   });
 *
 *   afterAll(async () => {
 *     await teardownE2eModule(ctx);
 *   });
 *
 *   describe('Create Einsatz', () => {
 *     it('should create Einsatz successfully', async () => {
 *       // Given
 *       const command = CreateEinsatzCommand.create({
 *         alarmstichwort: 'Brand',
 *         einsatzort: 'Hauptstraße 1',
 *       }, ctx.testUserIds.user).value!;
 *
 *       // When
 *       const result = await createHandler.execute(command);
 *
 *       // Then
 *       expect(result.isSuccess).toBe(true);
 *       const einsatz = await ctx.repository.findById(result.value!);
 *       expect(einsatz).not.toBeNull();
 *       expect(einsatz!.status.value).toBe('ANGELEGT');
 *     });
 *
 *     it('should emit einsatz.created event', async () => {
 *       // Given
 *       const command = CreateEinsatzCommand.create({
 *         alarmstichwort: 'Brand',
 *       }, ctx.testUserIds.user).value!;
 *
 *       // When
 *       await createHandler.execute(command);
 *
 *       // Then
 *       await waitFor(async () => {
 *         const events = ctx.eventPublisher.getEventsByName('einsatz.created');
 *         expect(events).toHaveLength(1);
 *       });
 *     });
 *   });
 *
 *   describe('RBAC Authorization', () => {
 *     it('should allow ADMIN to archive Einsatz', async () => {
 *       // Given: Einsatz created by USER
 *       const einsatzId = await createTestEinsatz(ctx, {
 *         createdBy: ctx.testUserIds.user,
 *       });
 *
 *       // When: ADMIN archives
 *       const command = ArchiveEinsatzCommand.create(einsatzId, ctx.testUserIds.admin).value!;
 *       const result = await archiveHandler.execute(command);
 *
 *       // Then
 *       expect(result.isSuccess).toBe(true);
 *     });
 *
 *     it('should deny USER to archive other users Einsatz', async () => {
 *       // Given: Einsatz created by ADMIN
 *       const einsatzId = await createTestEinsatz(ctx, {
 *         createdBy: ctx.testUserIds.admin,
 *       });
 *
 *       // When: USER tries to archive
 *       const command = ArchiveEinsatzCommand.create(einsatzId, ctx.testUserIds.user).value!;
 *       const result = await archiveHandler.execute(command);
 *
 *       // Then
 *       expect(result.isFailure).toBe(true);
 *       expect(result.error).toContain('Unauthorized');
 *     });
 *   });
 *
 *   describe('Outbox Integration', () => {
 *     it('should store events in outbox', async () => {
 *       // Given
 *       const command = CreateEinsatzCommand.create({
 *         alarmstichwort: 'Brand',
 *       }, ctx.testUserIds.user).value!;
 *
 *       // When
 *       await createHandler.execute(command);
 *
 *       // Then
 *       const pendingEvents = await ctx.outboxRepository.findPendingEvents(10);
 *       expect(pendingEvents.length).toBeGreaterThan(0);
 *       expect(pendingEvents[0].eventName).toBe('einsatz.created');
 *     });
 *   });
 * });
 * ```
 */
export const E2E_TEST_TEMPLATE_DOCUMENTATION = 'See JSDoc above for E2E test template';
