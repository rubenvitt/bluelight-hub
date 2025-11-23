/**
 * E2E Test Module Setup fuer ETB Infrastructure.
 *
 * Diese Datei stellt die Grundstruktur fuer E2E Tests bereit:
 * - NestJS Test Module Pattern
 * - Database Setup/Cleanup Utilities
 * - SpyEventPublisher fuer Event Verification
 * - Test User/Einsatz Creation Helpers
 *
 * **HINWEIS:** Dies ist ein PLACEHOLDER/TEMPLATE.
 * Die vollstaendige Implementierung erfolgt nach:
 * - Epic 3: ETB Application Layer (Handlers)
 * - Epic 4: ETB Infrastructure Layer (PrismaEtbRepository)
 *
 * **Test Strategy:**
 * - Real PostgreSQL Database (NICHT mocked)
 * - Direct Handler Invocation (oder full HTTP wenn Controller existiert)
 * - Given-When-Then BDD Style
 * - Cleanup mit Triggers disabled (SET session_replication_role = replica)
 */

import type { DomainEvent } from '@domain/common/domain-event';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';

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
 * Generiert eine Test-ID im nanoid-Format.
 *
 * Nutzt crypto.randomUUID() als Basis fuer Jest-Kompatibilitaet.
 *
 * @returns 21-Zeichen ID (nanoid-kompatibel)
 */
export function generateTestId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

// ============================================
// NESTJS TEST MODULE PATTERN
// ============================================

/**
 * E2E Test Module Context Interface.
 *
 * Definiert die Struktur des Test-Kontexts der von createEtbE2eModule() zurueckgegeben wird.
 */
export interface EtbE2eTestContext {
  /** NestJS Testing Module - wird nach Epic 4 typisiert */
  // module: TestingModule;

  /** PrismaClient fuer direkte DB-Zugriffe in Tests */
  // prisma: PrismaClient;

  /** ETB Repository (real Prisma Implementation) */
  // repository: PrismaEtbRepository;

  /** Event Publisher (Spy oder real) */
  eventPublisher: SpyEventPublisher;

  /** Test User ID (erstellt in beforeAll) */
  testUserId: string;

  /** Test Einsatz ID (erstellt in beforeAll) */
  testEinsatzId: string;

  /** Unique Test Run ID fuer Isolation */
  testRunId: string;
}

/**
 * Factory fuer ETB E2E Test Module.
 *
 * **PLACEHOLDER:** Vollstaendige Implementierung nach Epic 4.
 *
 * @returns E2E Test Context mit Module, Repository, Helpers
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
 *     ctx.eventPublisher.clear();
 *     await cleanupTestData(ctx);
 *   });
 *
 *   afterAll(async () => {
 *     await teardownE2eModule(ctx);
 *   });
 *
 *   // ... tests
 * });
 * ```
 */
export async function createEtbE2eModule(): Promise<EtbE2eTestContext> {
  // PLACEHOLDER: Implementierung nach Epic 4
  //
  // const prisma = new PrismaClient();
  //
  // // Cleanup from previous failed test runs
  // await prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
  // try {
  //   await prisma.$executeRawUnsafe(`DELETE FROM etb_eintraege WHERE "createdAt" >= NOW() - INTERVAL '1 hour'`);
  //   await prisma.$executeRawUnsafe(`DELETE FROM etb WHERE "createdAt" >= NOW() - INTERVAL '1 hour'`);
  //   await prisma.$executeRawUnsafe(`DELETE FROM einsaetze WHERE "createdAt" >= NOW() - INTERVAL '1 hour'`);
  //   await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE username LIKE 'test-etb-e2e-%'`);
  // } finally {
  //   await prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
  // }
  //
  // const testRunId = Date.now().toString();
  // const testUserId = generateTestId();
  //
  // // Create test user
  // await prisma.$queryRaw`
  //   INSERT INTO "User" (id, username, "passwordHash", role, "isActive", "createdAt", "updatedAt")
  //   VALUES (
  //     ${testUserId},
  //     ${`test-etb-e2e-user-${testRunId}`},
  //     'dummy-hash',
  //     'USER',
  //     true,
  //     NOW(),
  //     NOW()
  //   )
  // `;
  //
  // // Create test Einsatz
  // const testEinsatzId = generateTestId();
  // await prisma.einsatz.create({
  //   data: {
  //     id: testEinsatzId,
  //     alarmstichwort: `TEST - ETB E2E ${testRunId}`,
  //     einsatzort: 'Test-Einsatzort fuer ETB E2E Tests',
  //     status: 'ANGELEGT',
  //     createdBy: testUserId,
  //     updatedBy: testUserId,
  //   },
  // });
  //
  // // Initialize Repository
  // const repository = new PrismaEtbRepository(prisma);
  //
  // // Create Event Publisher
  // const eventPublisher = new SpyEventPublisher();
  //
  // return {
  //   prisma,
  //   repository,
  //   eventPublisher,
  //   testUserId,
  //   testEinsatzId,
  //   testRunId,
  // };

  throw new Error('createEtbE2eModule() is a placeholder. ' + 'Implement after Epic 4 when PrismaEtbRepository is available.');
}

/**
 * Teardown fuer E2E Test Module.
 *
 * Loescht alle Test-Daten und schliesst DB-Verbindung.
 *
 * @param ctx - E2E Test Context
 */
export async function teardownE2eModule(_ctx: EtbE2eTestContext): Promise<void> {
  // PLACEHOLDER: Implementierung nach Epic 4
  //
  // await ctx.prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
  // try {
  //   await ctx.prisma.$executeRawUnsafe(
  //     `DELETE FROM etb_eintraege WHERE "lagekarteId" IN (
  //       SELECT id FROM etb WHERE "einsatzId" = $1
  //     )`,
  //     ctx.testEinsatzId,
  //   );
  //   await ctx.prisma.$executeRawUnsafe('DELETE FROM etb WHERE "einsatzId" = $1', ctx.testEinsatzId);
  //   await ctx.prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE id = $1', ctx.testEinsatzId);
  //   await ctx.prisma.$executeRawUnsafe('DELETE FROM "User" WHERE id = $1', ctx.testUserId);
  // } finally {
  //   await ctx.prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
  //   await ctx.prisma.$disconnect();
  // }

  throw new Error('teardownE2eModule() is a placeholder. ' + 'Implement after Epic 4.');
}

/**
 * Cleanup fuer einzelnen Test (afterEach).
 *
 * Loescht ETB-Daten aber behaelt User/Einsatz.
 *
 * @param ctx - E2E Test Context
 */
export async function cleanupTestData(_ctx: EtbE2eTestContext): Promise<void> {
  // PLACEHOLDER: Implementierung nach Epic 4
  //
  // ctx.eventPublisher.clear();
  // await ctx.prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
  // try {
  //   await ctx.prisma.$executeRawUnsafe(
  //     `DELETE FROM etb_eintraege WHERE "etbId" IN (
  //       SELECT id FROM etb WHERE "einsatzId" = $1
  //     )`,
  //     ctx.testEinsatzId,
  //   );
  //   await ctx.prisma.$executeRawUnsafe('DELETE FROM etb WHERE "einsatzId" = $1', ctx.testEinsatzId);
  // } finally {
  //   await ctx.prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
  // }
}

// ============================================
// TEST HELPERS
// ============================================

/**
 * Helper: Erstellt einen neuen Test-Einsatz.
 *
 * Nuetzlich wenn ein Test einen separaten Einsatz benoetigt.
 *
 * @param ctx - E2E Test Context
 * @returns ID des erstellten Einsatzes
 */
export async function createTestEinsatz(_ctx: EtbE2eTestContext): Promise<string> {
  // PLACEHOLDER: Implementierung nach Epic 4
  //
  // const einsatzId = generateTestId();
  // await ctx.prisma.einsatz.create({
  //   data: {
  //     id: einsatzId,
  //     alarmstichwort: `TEST - ETB E2E ${ctx.testRunId}-${Date.now()}`,
  //     einsatzort: 'Test-Einsatzort',
  //     status: 'ANGELEGT',
  //     createdBy: ctx.testUserId,
  //     updatedBy: ctx.testUserId,
  //   },
  // });
  // return einsatzId;

  throw new Error('createTestEinsatz() is a placeholder.');
}

// ============================================
// E2E TEST TEMPLATE
// ============================================

/**
 * Template fuer ETB E2E Tests.
 *
 * Dieses Template zeigt die erwartete Struktur von E2E Tests nach Epic 4.
 * Es dient als Referenz fuer Entwickler die neue E2E Tests schreiben.
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
 *       const events = ctx.eventPublisher.getEventsByName('etb.created');
 *       expect(events).toHaveLength(1);
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
