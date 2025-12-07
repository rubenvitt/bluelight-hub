/**
 * E2E Test Module Setup fuer ETB Infrastructure.
 *
 * Diese Datei stellt die vollständige E2E Test-Infrastruktur bereit:
 * - Database Setup/Cleanup Utilities mit Trigger-Management
 * - SpyEventPublisher fuer Event Verification
 * - Test User/Einsatz Creation Helpers
 * - ID-Generator Funktionen (CUID2 Format via @paralleldrive/cuid2)
 * - Transaction-sichere Cleanup-Logik
 *
 * **ID-FORMAT-KONVENTIONEN:**
 * - **CUID2** (alle Entity IDs: EtbId, EinsatzId, EintragId, UserId): Format von @paralleldrive/cuid2
 *
 * **TEST STRATEGY:**
 * - Real PostgreSQL Database (NICHT mocked)
 * - Direct Handler Invocation (oder full HTTP wenn Controller existiert)
 * - Given-When-Then BDD Style
 * - Cleanup mit Triggers disabled (SET session_replication_role = replica)
 */

import { PrismaClient } from '@prisma/client';
import type { DomainEvent } from '@domain/common/domain-event';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';
import { PrismaEtbRepository } from '../repositories/prisma-etb.repository';
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
 * Lifecycle Hooks (OnModuleInit, OnModuleDestroy) um mit PrismaEtbRepository
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
// SPY EVENT PUBLISHER (RE-EXPORT)
// ============================================

/**
 * SpyEventPublisher: Implementiert IEventPublisher und trackt alle publizierten Events.
 *
 * Gleiche Implementierung wie in integration/test-setup.ts, aber hier fuer E2E Tests.
 * Ermoeglicht Event-Verification ohne echte EventEmitter-Infrastruktur.
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
 * Verwendet fuer: EtbId, EinsatzId, EintragId, UserId - ALLE Entity IDs!
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

// ============================================
// E2E TEST MODULE PATTERN
// ============================================

/**
 * E2E Test Module Context Interface.
 *
 * Definiert die Struktur des Test-Kontexts der von createEtbE2eModule() zurueckgegeben wird.
 */
export interface EtbE2eTestContext {
  /** PrismaClient fuer direkte DB-Zugriffe in Tests */
  prisma: TestPrismaService;

  /** ETB Repository (real Prisma Implementation) */
  repository: PrismaEtbRepository;

  /** Event Publisher (Spy fuer Event Verification) */
  eventPublisher: SpyEventPublisher;

  /** Test User ID (erstellt in beforeAll) - Nanoid Format */
  testUserId: string;

  /** Test Einsatz ID (erstellt in beforeAll) - CUID Format */
  testEinsatzId: string;

  /** Unique Test Run ID fuer Isolation (Timestamp) */
  testRunId: string;
}

/**
 * Factory fuer ETB E2E Test Module.
 *
 * Erstellt vollstaendigen Test-Kontext mit:
 * - PrismaClient fuer DB-Zugriffe
 * - Test User (Nanoid ID)
 * - Test Einsatz (CUID ID)
 * - PrismaEtbRepository
 * - SpyEventPublisher
 *
 * Fuehrt automatisch Cleanup von alten Test-Daten aus (aelter als 1 Stunde).
 *
 * @returns E2E Test Context mit Repository, Prisma, Helpers
 *
 * @example
 * ```typescript
 * describe('ETB CQRS API - E2E Tests', () => {
 *   let ctx: EtbE2eTestContext;
 *
 *   beforeAll(async () => {
 *     ctx = await createEtbE2eModule();
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
 *   it('should create ETB', async () => {
 *     // ... test
 *   });
 * });
 * ```
 */
export async function createEtbE2eModule(): Promise<EtbE2eTestContext> {
  // 1. PrismaClient erstellen (TestPrismaService fuer Repository-Kompatibilitaet)
  const prisma = new TestPrismaService();

  // 2. Cleanup von vorherigen Test-Runs (älter als 1 Stunde)
  await prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
  try {
    // Reihenfolge wichtig (FK Constraints!):
    // Snapshots -> Eintraege -> Einsatztagebuecher -> Einsaetze -> User
    await safeDeleteOld(prisma, 'etb_snapshots', '"snapshotAt"');
    await safeDeleteOld(prisma, 'etb_eintraege', '"createdAt"');
    await safeDeleteOld(prisma, 'einsatztagebuecher', '"createdAt"');
    await safeDeleteOld(prisma, 'einsaetze', '"createdAt"');
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test-etb-e2e-%'`);
  } finally {
    await prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
  }

  // 3. Test User erstellen (CUID2 Format!)
  const testRunId = Date.now().toString();
  const testUserId = generateTestId();
  await prisma.$executeRaw`
    INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
    VALUES (
      ${testUserId},
      ${`test-etb-e2e-user-${testRunId}`},
      'dummy-hash',
      'USER'::"UserRole",
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (username) DO NOTHING
  `;

  // 4. Test Einsatz erstellen (CUID2 Format!)
  const testEinsatzId = generateTestId();
  await prisma.$executeRaw`
    INSERT INTO einsaetze (id, alarmstichwort, einsatzort, status, "createdBy", "updatedBy", "createdAt", "updatedAt")
    VALUES (
      ${testEinsatzId},
      ${`TEST - ETB E2E ${testRunId}`},
      'Test-Einsatzort fuer ETB E2E Tests',
      'ANGELEGT'::"EinsatzStatus",
      ${testUserId},
      ${testUserId},
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `;

  // 5. Repository und EventPublisher mit Outbox Support (Story 4-4)
  const eventSerializer = new EventSerializer();
  const outboxRepository = new PrismaOutboxRepository(prisma, eventSerializer);
  const repository = new PrismaEtbRepository(prisma, outboxRepository);
  const eventPublisher = new SpyEventPublisher();

  return {
    prisma,
    repository,
    eventPublisher,
    testUserId,
    testEinsatzId,
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
export async function teardownE2eModule(ctx: EtbE2eTestContext): Promise<void> {
  await ctx.prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
  try {
    // Reihenfolge (FK-Reverse Order!):
    // Snapshots -> Eintraege -> Einsatztagebuecher -> Outbox Events -> Einsaetze -> User
    await ctx.prisma.$executeRaw`DELETE FROM etb_snapshots WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "einsatzId" = ${ctx.testEinsatzId})`;
    await ctx.prisma.$executeRaw`DELETE FROM etb_eintraege WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "einsatzId" = ${ctx.testEinsatzId})`;
    await ctx.prisma.$executeRaw`DELETE FROM einsatztagebuecher WHERE "einsatzId" = ${ctx.testEinsatzId}`;
    await ctx.prisma.$executeRaw`DELETE FROM outbox_events WHERE "aggregateId" = ${ctx.testEinsatzId}`;
    await ctx.prisma.$executeRaw`DELETE FROM einsaetze WHERE id = ${ctx.testEinsatzId}`;
    await ctx.prisma.$executeRaw`DELETE FROM "User" WHERE id = ${ctx.testUserId}`;
  } finally {
    await ctx.prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
    await ctx.prisma.$disconnect();
  }
}

/**
 * Cleanup fuer einzelnen Test (afterEach).
 *
 * Loescht ETB-Daten aber behaelt User/Einsatz.
 * Cleard auch den Event Publisher Spy.
 *
 * @param ctx - E2E Test Context
 */
export async function cleanupTestData(ctx: EtbE2eTestContext): Promise<void> {
  ctx.eventPublisher.clear();

  await ctx.prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
  try {
    // Reihenfolge (FK Order!): Snapshots -> Eintraege -> Einsatztagebuecher -> Outbox Events
    await ctx.prisma.$executeRaw`DELETE FROM etb_snapshots WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "einsatzId" = ${ctx.testEinsatzId})`;
    await ctx.prisma.$executeRaw`DELETE FROM etb_eintraege WHERE "etbId" IN (SELECT id FROM einsatztagebuecher WHERE "einsatzId" = ${ctx.testEinsatzId})`;
    await ctx.prisma.$executeRaw`DELETE FROM einsatztagebuecher WHERE "einsatzId" = ${ctx.testEinsatzId}`;
    await ctx.prisma.$executeRaw`DELETE FROM outbox_events WHERE "aggregateId" = ${ctx.testEinsatzId}`;
  } finally {
    await ctx.prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
  }
}

// ============================================
// TEST HELPERS
// ============================================

/**
 * Helper: Erstellt einen neuen Test-Einsatz.
 *
 * Nuetzlich wenn ein Test einen separaten Einsatz benoetigt.
 * Verwendet den testUserId aus dem Context fuer createdBy/updatedBy.
 *
 * @param ctx - E2E Test Context
 * @returns ID des erstellten Einsatzes (CUID2 Format)
 *
 * @example
 * ```typescript
 * it('should work with separate Einsatz', async () => {
 *   const separateEinsatzId = await createTestEinsatz(ctx);
 *   // ... test logic
 * });
 * ```
 */
export async function createTestEinsatz(ctx: EtbE2eTestContext): Promise<string> {
  const einsatzId = generateTestId();
  await ctx.prisma.$executeRaw`
    INSERT INTO einsaetze (id, alarmstichwort, einsatzort, status, "createdBy", "updatedBy", "createdAt", "updatedAt")
    VALUES (
      ${einsatzId},
      ${`TEST - ETB E2E ${ctx.testRunId}-${Date.now()}`},
      'Test-Einsatzort',
      'ANGELEGT'::"EinsatzStatus",
      ${ctx.testUserId},
      ${ctx.testUserId},
      NOW(),
      NOW()
    )
  `;
  return einsatzId;
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
 *     const events = ctx.eventPublisher.getEventsByName('etb.created');
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

// ============================================
// E2E TEST TEMPLATE DOCUMENTATION
// ============================================

/**
 * Template fuer ETB E2E Tests.
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
 *
 * @example
 * ```typescript
 * describe('ETB CQRS API - E2E Tests', () => {
 *   let ctx: EtbE2eTestContext;
 *
 *   beforeAll(async () => {
 *     ctx = await createEtbE2eModule();
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
 *   describe('Create ETB', () => {
 *     it('should create ETB successfully', async () => {
 *       // Given
 *       const command = CreateEtbCommand.create(ctx.testEinsatzId).value!;
 *
 *       // When
 *       const result = await createHandler.execute(command);
 *
 *       // Then
 *       expect(result.isSuccess).toBe(true);
 *       const etb = await ctx.repository.findById(result.value!);
 *       expect(etb).not.toBeNull();
 *       expect(etb!.status.value).toBe('DRAFT');
 *     });
 *
 *     it('should emit etb.created event', async () => {
 *       // Given
 *       const command = CreateEtbCommand.create(ctx.testEinsatzId).value!;
 *
 *       // When
 *       await createHandler.execute(command);
 *
 *       // Then
 *       await waitFor(async () => {
 *         const events = ctx.eventPublisher.getEventsByName('etb.created');
 *         expect(events).toHaveLength(1);
 *       });
 *     });
 *   });
 *
 *   describe('Add Eintrag', () => {
 *     it('should add eintrag to existing ETB', async () => {
 *       // Given: Create ETB first
 *       const createCmd = CreateEtbCommand.create(ctx.testEinsatzId).value!;
 *       const createResult = await createHandler.execute(createCmd);
 *       const etbId = createResult.value!.value;
 *       ctx.eventPublisher.clear();
 *
 *       // When
 *       const addCmd = AddEintragCommand.create(etbId, 'Test Eintrag', ctx.testUserId).value!;
 *       const result = await addEintragHandler.execute(addCmd);
 *
 *       // Then
 *       expect(result.isSuccess).toBe(true);
 *       const etb = await ctx.repository.findById(EtbId.create(etbId).value!);
 *       expect(etb!.eintraege).toHaveLength(1);
 *       expect(etb!.eintraege[0].text).toBe('Test Eintrag');
 *     });
 *   });
 *
 *   describe('Lock ETB', () => {
 *     it('should lock ETB and prevent further modifications', async () => {
 *       // Given: Create ETB with entries
 *       const createCmd = CreateEtbCommand.create(ctx.testEinsatzId).value!;
 *       const createResult = await createHandler.execute(createCmd);
 *       const etbId = createResult.value!.value;
 *
 *       // When: Lock
 *       const lockCmd = LockEtbCommand.create(etbId, ctx.testUserId).value!;
 *       const lockResult = await lockHandler.execute(lockCmd);
 *
 *       // Then
 *       expect(lockResult.isSuccess).toBe(true);
 *       const etb = await ctx.repository.findById(EtbId.create(etbId).value!);
 *       expect(etb!.isLocked()).toBe(true);
 *
 *       // Verify: Further modifications fail
 *       const addCmd = AddEintragCommand.create(etbId, 'Should fail', ctx.testUserId).value!;
 *       const addResult = await addEintragHandler.execute(addCmd);
 *       expect(addResult.isFailure).toBe(true);
 *     });
 *   });
 * });
 * ```
 */
export const E2E_TEST_TEMPLATE_DOCUMENTATION = 'See JSDoc above for E2E test template';
