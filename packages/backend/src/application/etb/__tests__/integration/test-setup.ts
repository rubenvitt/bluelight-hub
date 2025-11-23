import type { DomainEvent } from '@domain/common/domain-event';
import type { IEventPublisher } from '@domain/services/ports/i-event-publisher.port';

/**
 * Integration Test Setup fuer ETB Application Layer.
 *
 * Diese Datei stellt gemeinsame Test-Utilities bereit:
 * - SpyEventPublisher: Fuer Event Verification in Tests
 * - NestJS Test Module Pattern (Template)
 * - Database Trigger-Disable Pattern
 *
 * **Verwendung:**
 * - Import in Integration Tests
 * - SpyEventPublisher fuer Event Assertions
 * - Test Module Pattern fuer NestJS-basierte Tests
 */

// ============================================
// SPY EVENT PUBLISHER
// ============================================

/**
 * SpyEventPublisher: Implementiert IEventPublisher und trackt alle publizierten Events.
 *
 * Diese Spy-Implementierung ermoeglicht Event-Verification in Tests:
 * - Alle publizierten Events werden in einem Array gespeichert
 * - Events koennen nach Name gefiltert werden
 * - Nuetzlich fuer Integration Tests ohne echte Event-Infrastruktur
 *
 * @example
 * ```typescript
 * const eventPublisher = new SpyEventPublisher();
 * const handler = new CreateEtbHandler(repo, eventPublisher);
 *
 * await handler.execute(command);
 *
 * expect(eventPublisher.publishedEvents).toHaveLength(1);
 * expect(eventPublisher.getEventsByName('etb.created')).toHaveLength(1);
 * ```
 */
export class SpyEventPublisher implements IEventPublisher {
  /**
   * Array aller publizierten Events (in chronologischer Reihenfolge).
   */
  public publishedEvents: DomainEvent[] = [];

  /**
   * Publiziert ein einzelnes Event (speichert es im Array).
   *
   * @param event - Das zu publizierende Domain Event
   */
  async publish(event: DomainEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  /**
   * Publiziert mehrere Events (speichert sie im Array).
   *
   * Events werden sequentiell hinzugefuegt (FIFO-Reihenfolge).
   *
   * @param events - Array von Domain Events
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      this.publishedEvents.push(event);
    }
  }

  /**
   * Filtert Events nach Event-Name.
   *
   * Nutzt die statische eventName() Methode der DomainEvent-Klasse
   * zur Identifikation des Event-Typs.
   *
   * @param eventName - Name des Events (z.B. 'etb.created', 'etb.eintrag_added')
   * @returns Array der gefundenen Events
   */
  getEventsByName(eventName: string): DomainEvent[] {
    return this.publishedEvents.filter((e) => (e.constructor as typeof DomainEvent).eventName() === eventName);
  }

  /**
   * Filtert Events nach Event-Typ (Klassen-basiert).
   *
   * Nuetzlich wenn der konkrete Event-Typ bekannt ist.
   *
   * @param eventType - Event-Klasse (z.B. EintragAddedEvent)
   * @returns Array der gefundenen Events (typisiert)
   */
  // biome-ignore lint/suspicious/noExplicitAny: Generic constructor type requires any[] for arbitrary argument lists
  getEventsByType<T extends DomainEvent>(eventType: new (...args: any[]) => T): T[] {
    return this.publishedEvents.filter((e) => e instanceof eventType) as T[];
  }

  /**
   * Loescht alle gespeicherten Events.
   *
   * Wird in beforeEach/afterEach verwendet um Test-Isolation zu gewaehrleisten.
   */
  clear(): void {
    this.publishedEvents = [];
  }

  /**
   * Gibt die Anzahl der publizierten Events zurueck.
   */
  get count(): number {
    return this.publishedEvents.length;
  }
}

// ============================================
// DATABASE TRIGGER DISABLE PATTERN
// ============================================

/**
 * SQL-Statement zum Deaktivieren von Database Triggers.
 *
 * PostgreSQL session_replication_role = 'replica' deaktiviert:
 * - Trigger (BEFORE/AFTER)
 * - Foreign Key Constraints
 * - Rules
 *
 * **Verwendung:**
 * Vor DELETE-Statements in Tests ausfuehren, danach zuruecksetzen.
 *
 * @example
 * ```typescript
 * await prisma.$executeRawUnsafe(DISABLE_TRIGGERS_SQL);
 * try {
 *   await prisma.$executeRawUnsafe('DELETE FROM etb_eintraege WHERE ...');
 *   await prisma.$executeRawUnsafe('DELETE FROM etb WHERE ...');
 * } finally {
 *   await prisma.$executeRawUnsafe(ENABLE_TRIGGERS_SQL);
 * }
 * ```
 */
export const DISABLE_TRIGGERS_SQL = 'SET session_replication_role = replica;';

/**
 * SQL-Statement zum Reaktivieren von Database Triggers.
 *
 * Setzt session_replication_role zurueck auf DEFAULT (origin).
 * IMMER in finally-Block ausfuehren!
 */
export const ENABLE_TRIGGERS_SQL = 'SET session_replication_role = DEFAULT;';

// ============================================
// NESTJS TEST MODULE PATTERN (TEMPLATE)
// ============================================

/**
 * NestJS Test Module Factory fuer ETB Integration Tests.
 *
 * Diese Factory erstellt ein konfiguriertes Test Module mit:
 * - ETB Application Module
 * - Mocked/In-Memory Repositories
 * - SpyEventPublisher
 *
 * **HINWEIS:** Dies ist ein Template/Placeholder. Die vollstaendige
 * Implementierung erfolgt wenn ETB Command/Query Handlers implementiert sind.
 *
 * @example
 * ```typescript
 * // In Integration Test (Epic 3 Story 3)
 * describe('CreateEtbHandler - Integration', () => {
 *   let module: TestingModule;
 *   let handler: CreateEtbHandler;
 *   let repository: InMemoryEtbRepository;
 *   let eventPublisher: SpyEventPublisher;
 *
 *   beforeAll(async () => {
 *     const testContext = await createEtbTestModule();
 *     module = testContext.module;
 *     handler = testContext.handler;
 *     repository = testContext.repository;
 *     eventPublisher = testContext.eventPublisher;
 *   });
 *
 *   afterEach(() => {
 *     repository.clear();
 *     eventPublisher.clear();
 *   });
 *
 *   // ... tests
 * });
 * ```
 */
export interface EtbTestModuleContext {
  /** NestJS Testing Module */
  // module: TestingModule; // Uncomment when @nestjs/testing is available

  /** In-Memory Repository fuer ETB - Placeholder fuer InMemoryEtbRepository */
  // biome-ignore lint/suspicious/noExplicitAny: Placeholder - wird mit InMemoryEtbRepository typisiert wenn verfuegbar
  repository: any;

  /** Spy Event Publisher fuer Event Verification */
  eventPublisher: SpyEventPublisher;

  /** Handler-Instanz (generic, wird je nach Test spezifiziert) */
  // biome-ignore lint/suspicious/noExplicitAny: Placeholder - Handler-Typ variiert je nach Test-Kontext
  handler: any;
}

/**
 * Factory fuer ETB Test Module.
 *
 * **PLACEHOLDER:** Vollstaendige Implementierung nach Epic 3 Story 3.
 * Aktuell nur Dokumentation der erwarteten Struktur.
 *
 * @returns Test Module Context mit Repository, EventPublisher, Handler
 */
export async function createEtbTestModule(): Promise<EtbTestModuleContext> {
  // PLACEHOLDER: Wird implementiert wenn NestJS Handlers existieren
  //
  // const module = await Test.createTestingModule({
  //   imports: [EtbApplicationModule],
  //   providers: [
  //     {
  //       provide: 'IEtbRepository',
  //       useClass: InMemoryEtbRepository,
  //     },
  //     {
  //       provide: 'IEventPublisher',
  //       useClass: SpyEventPublisher,
  //     },
  //   ],
  // }).compile();
  //
  // return {
  //   module,
  //   repository: module.get<InMemoryEtbRepository>('IEtbRepository'),
  //   eventPublisher: module.get<SpyEventPublisher>('IEventPublisher'),
  //   handler: module.get<CreateEtbHandler>(CreateEtbHandler),
  // };

  throw new Error('createEtbTestModule() is a placeholder. ' + 'Implement after Epic 3 Story 3 when ETB handlers are available.');
}

// ============================================
// TEST DATA CLEANUP UTILITIES
// ============================================

/**
 * Hilfsfunktion fuer Test-Daten Cleanup in beforeAll/afterAll.
 *
 * Loescht Test-Daten innerhalb eines Zeitfensters (z.B. letzte Stunde).
 * Verwendet Trigger-Disable Pattern fuer sichere FK-Loeschung.
 *
 * @example
 * ```typescript
 * // In afterAll():
 * await cleanupTestData(prisma, {
 *   tables: ['etb_eintraege', 'etb', 'einsaetze'],
 *   timeWindow: '1 hour',
 *   userFilter: "username LIKE 'test-etb-%'"
 * });
 * ```
 */
export interface CleanupOptions {
  /** Tabellen in Loesch-Reihenfolge (Child -> Parent) */
  tables: string[];
  /** Zeitfenster fuer Cleanup (PostgreSQL INTERVAL Syntax) */
  timeWindow: string;
  /** Optional: Zusaetzlicher User-Filter */
  userFilter?: string;
}

/**
 * Generiert Cleanup-SQL fuer Test-Daten.
 *
 * @param options - Cleanup-Konfiguration
 * @returns Array von SQL-Statements
 */
export function generateCleanupSql(options: CleanupOptions): string[] {
  const { tables, timeWindow } = options;

  const statements: string[] = [DISABLE_TRIGGERS_SQL];

  for (const table of tables) {
    statements.push(`DELETE FROM ${table} WHERE "createdAt" >= NOW() - INTERVAL '${timeWindow}'`);
  }

  statements.push(ENABLE_TRIGGERS_SQL);

  return statements;
}

// ============================================
// TEST ID GENERATION
// ============================================

/**
 * Generiert eine Test-ID im nanoid-Format.
 *
 * Nutzt crypto.randomUUID() als Basis fuer Jest-Kompatibilitaet
 * (nanoid hat Probleme mit Jest ESM Mocking).
 *
 * @returns 21-Zeichen ID (nanoid-kompatibel)
 */
export function generateTestId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
}

/**
 * Generiert einen eindeutigen Test-Run-Identifier.
 *
 * Nuetzlich fuer Test-Isolation wenn mehrere Test-Runs parallel laufen.
 *
 * @returns Timestamp-basierter Identifier
 */
export function generateTestRunId(): string {
  return Date.now().toString();
}
