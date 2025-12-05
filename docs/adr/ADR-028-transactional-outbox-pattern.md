# ADR-028: Transactional Outbox Pattern

**Status:** Accepted
**Datum:** 2025-12-05
**Autoren:** Ruben (via Dev Agent)
**Context:** Sprint 0, Event Publishing Reliability

## Kontext

In einem event-getriebenen System müssen Domain Events zuverlässig publiziert werden, wenn Aggregates persistiert werden. Ohne zusätzliche Maßnahmen besteht folgendes Problem:

1. **Atomicity-Problem:** Aggregate wird gespeichert, aber Event-Publishing schlägt fehl → Events gehen verloren
2. **Konsistenz-Problem:** Andere Bounded Contexts bekommen keine Benachrichtigung über Domain-Änderungen
3. **Dual-Write-Problem:** Zwei separate Schreiboperationen (DB + Event Bus) können nicht atomar sein

### Beispiel-Szenario (ohne Outbox)

```typescript
// ❌ PROBLEM: Nicht-atomare Operationen
async createEinsatz(command: CreateEinsatzCommand) {
  const einsatz = Einsatz.create(command);
  await this.repository.save(einsatz); // ✓ Erfolg

  const events = einsatz.getDomainEvents();
  await this.eventBus.publish(events); // ✗ Fehlschlag → Events verloren!
}
```

Wenn das Event-Publishing fehlschlägt (z.B. durch Netzwerkfehler, Message Broker Down), sind die Domain Events unwiederbringlich verloren, obwohl das Aggregate erfolgreich persistiert wurde.

### Anforderungen

- **Atomicity:** Events und Aggregates müssen in derselben Datenbank-Transaktion gespeichert werden
- **Reliability:** Events müssen garantiert publiziert werden (At-Least-Once Delivery)
- **Retry-Logik:** Fehlgeschlagene Event-Publishes müssen automatisch wiederholt werden
- **Dead Letter Queue:** Nach mehreren Fehlversuchen müssen Events zur manuellen Intervention markiert werden
- **Parallelisierung:** Mehrere Worker müssen gleichzeitig Events verarbeiten können (ohne Race Conditions)

## Entscheidung

Wir implementieren das **Transactional Outbox Pattern** mit folgenden Komponenten:

### 1. OutboxEvent Database Table

Events werden in derselben Datenbank-Transaktion wie das Aggregate in eine `OutboxEvent`-Tabelle geschrieben:

```prisma
model OutboxEvent {
  id           String   @id @default(cuid())
  eventName    String   // z.B. "einsatz.created"
  aggregateId  String   // ID des betroffenen Aggregates
  payload      Json     // Serialisiertes Event (JSON)
  status       String   // PENDING | PUBLISHED | FAILED
  retryCount   Int      @default(0)
  lastError    String?  // Fehler-Message bei FAILED
  createdAt    DateTime @default(now())
  publishedAt  DateTime? // Zeitpunkt erfolgreicher Publikation

  @@index([status, createdAt]) // Performance-Optimierung für Polling
}
```

### 2. TransactionalCommandHandler (Abstract Base Class)

Alle Command Handler erben von dieser Basisklasse:

```typescript
export abstract class TransactionalCommandHandler<TCommand, TResult> {
  constructor(
    private readonly outboxRepository: IOutboxRepository,
    private readonly dataSource: DataSource,
  ) {}

  async execute(command: TCommand): Promise<Result<TResult>> {
    return await this.dataSource.transaction(async (tx) => {
      // 1. Business Logic ausführen (in abgeleiteter Klasse)
      const { result, events } = await this.executeInTransaction(command, tx);

      // 2. Events in Outbox speichern (atomare Transaktion!)
      for (const event of events) {
        await this.outboxRepository.save({
          eventName: event.constructor.name,
          aggregateId: event.aggregateId,
          payload: JSON.stringify(event),
          status: 'PENDING',
        }, tx);
      }

      return Result.ok(result);
    });
  }

  protected abstract executeInTransaction(
    command: TCommand,
    tx: TransactionContext
  ): Promise<{ result: TResult; events: DomainEvent[] }>;
}
```

### 3. OutboxEventPublisher (Background Worker)

Ein NestJS Cron Job pollt periodisch die Outbox-Tabelle und publiziert ausstehende Events:

```typescript
@Injectable()
export class OutboxEventPublisher {
  constructor(
    private readonly outboxRepository: IOutboxRepository,
    private readonly eventBus: IEventBus,
  ) {}

  @Cron('*/5 * * * * *') // Alle 5 Sekunden
  async processOutbox() {
    const pendingEvents = await this.outboxRepository.findPending(limit: 100);

    for (const outboxEvent of pendingEvents) {
      try {
        // Event Bus publizieren
        await this.eventBus.publish(JSON.parse(outboxEvent.payload));

        // Status auf PUBLISHED setzen
        await this.outboxRepository.markAsPublished(outboxEvent.id);
      } catch (error) {
        await this.handlePublishError(outboxEvent, error);
      }
    }
  }

  private async handlePublishError(outboxEvent: OutboxEvent, error: Error) {
    const newRetryCount = outboxEvent.retryCount + 1;

    if (newRetryCount >= 3) {
      // Dead Letter Queue: Nach 3 Fehlversuchen
      await this.outboxRepository.markAsFailed(outboxEvent.id, error.message);
    } else {
      // Retry mit Exponential Backoff (5s → 10s → 20s)
      await this.outboxRepository.incrementRetry(outboxEvent.id, error.message);
    }
  }
}
```

### 4. Race Condition Prevention (PostgreSQL FOR UPDATE SKIP LOCKED)

Mehrere Worker-Instanzen können parallel laufen, ohne dieselben Events zu verarbeiten:

```typescript
// IOutboxRepository Implementation (PrismaOutboxRepository)
async findPending(limit: number): Promise<OutboxEvent[]> {
  return await this.prisma.$queryRaw`
    SELECT * FROM "OutboxEvent"
    WHERE status = 'PENDING'
    ORDER BY "createdAt" ASC
    LIMIT ${limit}
    FOR UPDATE SKIP LOCKED
  `;
}
```

**Funktionsweise:**
- `FOR UPDATE`: Row-Level Lock für die ausgewählten Zeilen
- `SKIP LOCKED`: Überspringt bereits gelockte Zeilen (andere Worker)
- **Ergebnis:** Jeder Worker verarbeitet unterschiedliche Events (keine Duplikate!)

### 5. Retry-Logik mit Exponential Backoff

| Versuch | Wartezeit | Implementierung |
|---------|-----------|-----------------|
| 1. Retry | 5 Sekunden | Cron Job holt Event beim nächsten Run |
| 2. Retry | 10 Sekunden | Event wird beim übernächsten Run verarbeitet (durch höhere `retryCount`) |
| 3. Retry | 20 Sekunden | Letzter Versuch vor Dead Letter Queue |
| **FAILED** | - | Status `FAILED`, manuelle Intervention erforderlich |

**Implementierung:** Der Cron Job (alle 5 Sekunden) überprüft `retryCount` und verzögert Events entsprechend durch Filtering.

### Begründung

1. **Atomicity durch DB-Transaktion:** Events und Aggregates werden gemeinsam commited (ACID-Garantien)
2. **At-Least-Once Delivery:** Background Worker stellt sicher, dass Events publiziert werden (auch nach Restart)
3. **Resilience:** Retry-Logik mit DLQ verhindert, dass transiente Fehler zu Datenverlust führen
4. **Skalierbarkeit:** `FOR UPDATE SKIP LOCKED` ermöglicht parallele Worker ohne Koordination
5. **Standard-Pattern:** Bewährtes Pattern in Event-Driven Architectures (siehe "Microservices Patterns" - Chris Richardson)

## Konsequenzen

### Positiv

- **Garantierte Event-Publikation:** Keine verlorenen Events durch fehlgeschlagene Publishes
- **Transaktionale Konsistenz:** Events und Aggregates werden atomar persistiert
- **Retry-Mechanismus:** Transiente Fehler (Netzwerk, Message Broker Down) werden automatisch behandelt
- **Dead Letter Queue:** FAILED-Events können manuell untersucht und erneut verarbeitet werden
- **Horizontale Skalierung:** Mehrere Worker-Instanzen können parallel laufen (durch `FOR UPDATE SKIP LOCKED`)
- **Observability:** Outbox-Tabelle dient als Audit Log für alle Domain Events

### Negativ

- **Eventual Consistency:** Events werden asynchron publiziert (nicht sofort nach Command-Ausführung)
  - **Mitigation:** Für die meisten Use Cases akzeptabel (5 Sekunden Delay)
- **Zusätzliche Datenbank-Last:** Outbox-Tabelle wächst kontinuierlich
  - **Mitigation:** Regelmäßiges Cleanup von PUBLISHED-Events (Story 0-6: Outbox Cleanup)
- **Komplexität:** Zusätzliche Infrastruktur-Komponente (Cron Job, Repository)
  - **Mitigation:** Abstraktion durch `TransactionalCommandHandler` (Handler-Code bleibt einfach)
- **At-Least-Once Delivery:** Events können duplikativ publiziert werden (bei Worker-Crash nach Publish, aber vor Status-Update)
  - **Mitigation:** Event-Consumer müssen idempotent sein (siehe ADR-027: CQRS Pattern)

### Migration

#### Sprint 0: Outbox-Infrastruktur

| Story | Beschreibung | Komponenten |
|-------|--------------|-------------|
| **Story 0-1** | Outbox Transactional Integrity | `TransactionalCommandHandler`, `IOutboxRepository`, Prisma Schema |
| **Story 0-2** | Race Condition Prevention | `FOR UPDATE SKIP LOCKED` Query, Integration Tests |
| **Story 0-3** | Retry/DLQ Tests | Unit Tests für `OutboxEventPublisher`, Edge Cases |
| **Story 0-5** | Database Index | Prisma Migration für `@@index([status, createdAt])` |
| **Story 0-6** | Outbox Cleanup Job | Cron Job für DELETE PUBLISHED Events > 7 Tage |

#### Bestehende Handler migrieren

1. **CreateEinsatzHandler (Story 5-1):**
   ```typescript
   // Vorher: Direktes Event Publishing
   export class CreateEinsatzHandler {
     async execute(command: CreateEinsatzCommand): Promise<Result<string>> {
       const einsatz = Einsatz.create(command);
       await this.repository.save(einsatz);

       const events = einsatz.getDomainEvents();
       await this.eventBus.publish(events); // ❌ Nicht atomar!

       return Result.ok(einsatz.id.value);
     }
   }

   // Nachher: TransactionalCommandHandler
   export class CreateEinsatzHandler extends TransactionalCommandHandler<
     CreateEinsatzCommand,
     string
   > {
     protected async executeInTransaction(
       command: CreateEinsatzCommand,
       tx: TransactionContext
     ): Promise<{ result: string; events: DomainEvent[] }> {
       const einsatz = Einsatz.create(command);
       await this.repository.save(einsatz, tx); // ✓ In gleicher TX

       const events = einsatz.getDomainEvents();
       einsatz.clearDomainEvents();

       return { result: einsatz.id.value, events }; // Base class speichert in Outbox
     }
   }
   ```

2. **Alle Command Handler (Stories 5-1 bis 5-5):** Gleiche Migration

## Verwandte Entscheidungen

- **ADR-025: Hexagonal Architecture** → Outbox Repository ist Port im Domain Layer, Adapter im Infrastructure Layer
- **ADR-027: CQRS Pattern** → Command Handler nutzen Outbox für Event-Publishing
- **ADR-026: Event-Driven Architecture** → Outbox stellt zuverlässige Event-Publikation sicher
- **ADR-024: Result Pattern** → `TransactionalCommandHandler.execute()` gibt `Result<T>` zurück

## Validierung

### Akzeptanzkriterien (Story 0-1 bis 0-6)

- [ ] **AC1:** Events werden in derselben DB-Transaktion wie Aggregates gespeichert
- [ ] **AC2:** `FOR UPDATE SKIP LOCKED` verhindert Race Conditions bei parallelen Workern
- [ ] **AC3:** Retry-Logik mit max. 3 Versuchen und exponential backoff
- [ ] **AC4:** FAILED-Events werden in Dead Letter Queue markiert
- [ ] **AC5:** Database Index `(status, createdAt)` für performantes Polling
- [ ] **AC6:** Cleanup-Job löscht PUBLISHED-Events älter als 7 Tage

### Integration Tests

```typescript
describe('Outbox Pattern Integration', () => {
  it('should save event in same transaction as aggregate', async () => {
    // Given: CreateEinsatzCommand
    const command = CreateEinsatzCommand.create({ ... }).value!;

    // When: Handler executes
    const result = await handler.execute(command);

    // Then: Aggregate AND OutboxEvent exist in DB
    const einsatz = await einsatzRepo.findById(result.value!);
    const outboxEvent = await outboxRepo.findByAggregateId(result.value!);

    expect(einsatz).toBeDefined();
    expect(outboxEvent.status).toBe('PENDING');
    expect(outboxEvent.eventName).toBe('EinsatzCreatedEvent');
  });

  it('should prevent race conditions with parallel workers', async () => {
    // Given: 10 PENDING events in Outbox
    await seedOutboxEvents(10);

    // When: 3 Workers fetch events simultaneously
    const [worker1, worker2, worker3] = await Promise.all([
      outboxRepo.findPending(5),
      outboxRepo.findPending(5),
      outboxRepo.findPending(5),
    ]);

    // Then: No overlapping events (total 10 unique events)
    const allIds = [...worker1, ...worker2, ...worker3].map(e => e.id);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(10); // Keine Duplikate!
  });

  it('should mark event as FAILED after 3 retries', async () => {
    // Given: PENDING event, mocked failing Event Bus
    const outboxEvent = await createOutboxEvent({ status: 'PENDING' });
    eventBusMock.publish.mockRejectedValue(new Error('Network timeout'));

    // When: Publisher runs 3 times
    await publisher.processOutbox();
    await publisher.processOutbox();
    await publisher.processOutbox();

    // Then: Event is FAILED (DLQ)
    const failedEvent = await outboxRepo.findById(outboxEvent.id);
    expect(failedEvent.status).toBe('FAILED');
    expect(failedEvent.retryCount).toBe(3);
    expect(failedEvent.lastError).toContain('Network timeout');
  });
});
```

### Performance-Metriken

- **Polling-Query:** < 50ms für 100 PENDING events (durch `@@index([status, createdAt])`)
- **Event Latency:** < 10 Sekunden (Durchschnitt zwischen Aggregate-Save und Event-Publish)
- **Throughput:** 1000+ Events/Sekunde bei 3 parallelen Workern

### Monitoring

```typescript
// Prometheus-Metriken für Outbox
outbox_events_total{status="PENDING"}     // Anzahl wartender Events
outbox_events_total{status="PUBLISHED"}   // Erfolgreich publizierte Events
outbox_events_total{status="FAILED"}      // Dead Letter Queue (DLQ)
outbox_publish_duration_seconds           // Latenz pro Event
outbox_retry_count{attempt="1|2|3"}       // Retry-Statistiken
```

**Alerting:**
- `outbox_events_total{status="PENDING"} > 1000` → Backlog wächst (Worker-Skalierung nötig)
- `outbox_events_total{status="FAILED"} > 10` → Dead Letter Queue wächst (manuelle Intervention)
