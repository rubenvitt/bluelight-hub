# Epic 4: Einsatz Lifecycle & Authentication

**Goal:** Migrate core Einsatz domain and authentication to Hexagonal Architecture with Transactional Outbox Pattern.

**Business Value:**
- Core business logic (Einsatz CRUD, status transitions, archival) on clean architecture
- RBAC enforced at domain level
- Event loss prevention via Transactional Outbox (DRK compliance)
- Unified authentication for passwordless (USER) and password-based (ADMIN/SUPER_ADMIN)

**Technical Scope:**
- Commands/Handlers: 10-15 Use Cases (Create, Complete, Archive, UpdateStatus, etc.)
- Transactional Outbox Pattern: Atomic event persistence + async publishing
- Domain Services Integration: EinsatzNamingService, CompletenessService, ArchivalPolicy
- Infrastructure: PrismaEinsatzRepository, PrismaUserRepository, JwtTokenServiceAdapter
- Mappers: Domain ↔ Prisma
- Controller Refactoring: Einsatz + Auth
- Frontend: Complete migration to new API

**Success Criteria:**
- [ ] Einsatz completely migrated to new architecture
- [ ] NO-DELETE policy enforced (canBeDeleted() always false)
- [ ] Transactional Outbox prevents event loss
- [ ] RBAC works (Min 1 SUPER_ADMIN constraint)
- [ ] Frontend functional with new API
- [ ] Event publishing guaranteed (atomicity with DB writes)

**Estimated Effort:** 36-50h (30-40h Backend, 6-10h Frontend)

---

## Story 4.1: Einsatz Application Layer - Commands (Part 1: CRUD)

**As a** Backend Developer,
**I want** Command handlers for Einsatz CRUD operations,
**So that** Einsatz management uses the new architecture.

**Acceptance Criteria:**

**Given** Domain Layer exists (Epic 1)
**When** I implement Einsatz command handlers
**Then** the following exist in `application/einsatz/commands/`:

**1. CreateEinsatzCommand & Handler**

Command:
```typescript
class CreateEinsatzCommand {
  constructor(
    public readonly alarmstichwort: string,
    public readonly createdBy: string,
    public readonly einsatzort?: Address,
    public readonly bemerkung?: string
  ) {}
}
```

Handler:
- Generates Einsatz number via EinsatzNamingService (e.g., "E2024-001")
- Creates EinsatzAggregate
- Saves via IEinsatzRepository
- Publishes EinsatzCreatedEvent (triggers ETB auto-creation)
- Returns Result<EinsatzId>

Business Rules:
- Alarmstichwort required
- Nummer auto-generated (year + sequence)
- Initial status = ANGELEGT

**2. UpdateEinsatzCommand & Handler**

Command:
```typescript
class UpdateEinsatzCommand {
  constructor(
    public readonly einsatzId: string,
    public readonly alarmstichwort?: string,
    public readonly einsatzort?: Address,
    public readonly bemerkung?: string
  ) {}
}
```

Handler:
- Loads aggregate
- Updates fields (only if provided)
- Saves aggregate
- Publishes EinsatzUpdatedEvent
- Returns Result<void>

**3. DeleteEinsatzCommand & Handler**

Command:
```typescript
class DeleteEinsatzCommand {
  constructor(public readonly einsatzId: string) {}
}
```

Handler:
- Loads aggregate
- Checks `aggregate.canBeDeleted()` → **ALWAYS false** (NO-DELETE Policy)
- Returns Result.fail("Einsätze cannot be deleted, use Archive instead")
- NO physical delete

Business Rules:
- **NO-DELETE Policy:** Einsätze NEVER physically deleted (DRK compliance)
- Soft-delete forbidden (use Archive instead)

**And** Unit-Tests validate:
- CreateEinsatz generates nummer correctly
- UpdateEinsatz updates only provided fields
- DeleteEinsatz ALWAYS fails (NO-DELETE policy)
- Event emission (EinsatzCreatedEvent contains nummer + alarmstichwort)

**Prerequisites:**
- Epic 1 (Domain Layer)
- Story 1.7 (EinsatzNamingService)

**Technical Notes:**
- Nummer sequence stored in database (counter table or query max)
- EinsatzNamingService does NOT fetch sequence (Application Layer does)
- Result<T> pattern for all handlers
- NO-DELETE policy enforced in Domain (canBeDeleted() method)

---

## Story 4.2: Einsatz Application Layer - Commands (Part 2: Status Transitions)

**As a** Backend Developer,
**I want** Command handlers for Einsatz status transitions and archival,
**So that** Einsatz lifecycle is managed with business rule enforcement.

**Acceptance Criteria:**

**Given** Story 4.1 complete
**When** I implement status transition handlers
**Then** the following exist:

**1. CompleteEinsatzCommand & Handler**

Command:
```typescript
class CompleteEinsatzCommand {
  constructor(
    public readonly einsatzId: string,
    public readonly completedBy: string
  ) {}
}
```

Handler:
- Loads aggregate
- Validates completeness via EinsatzCompletenessService
- Calls `aggregate.complete(completedBy)`
- Saves aggregate
- Publishes EinsatzCompletedEvent
- Returns Result<void>

Business Rules:
- Einsatz must have all required fields (alarmstichwort, einsatzort)
- Status must be IN_BEARBEITUNG (not ANGELEGT)
- Sets `abgeschlossenAt` timestamp

**2. ArchiveEinsatzCommand & Handler**

Command:
```typescript
class ArchiveEinsatzCommand {
  constructor(
    public readonly einsatzId: string,
    public readonly archivedBy: string
  ) {}
}
```

Handler:
- Loads aggregate
- Validates via EinsatzArchivalPolicy (must be ABGESCHLOSSEN + 10 years old)
- Calls `aggregate.archive(archivedBy)`
- Saves aggregate
- Publishes EinsatzArchivedEvent
- Returns Result<void>

Business Rules:
- Status must be ABGESCHLOSSEN
- Must be ≥10 years old (DRK compliance)
- After archival, Einsatz is immutable

**3. UpdateEinsatzStatusCommand & Handler**

Command:
```typescript
class UpdateEinsatzStatusCommand {
  constructor(
    public readonly einsatzId: string,
    public readonly newStatus: string
  ) {}
}
```

Handler:
- Loads aggregate
- Calls `aggregate.updateStatus(newStatus)`
- Validates transition (via EinsatzStatus.canTransitionTo())
- Saves aggregate
- Publishes EinsatzStatusChangedEvent
- Returns Result<void>

Business Rules:
- Valid transitions: ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT
- Backward transitions forbidden

**And** Unit-Tests validate:
- CompleteEinsatz validates completeness
- CompleteEinsatz fails if status != IN_BEARBEITUNG
- ArchiveEinsatz validates 10-year policy
- UpdateStatus rejects invalid transitions
- Event emission (status change events)

**Prerequisites:**
- Story 4.1 (CRUD Commands)
- Story 1.7 (Domain Services)

**Technical Notes:**
- EinsatzCompletenessService checks required fields
- EinsatzArchivalPolicy calculates archival eligibility
- Status transitions enforced in Domain (State Machine in EinsatzStatus VO)

---

## Story 4.3: Einsatz Application Layer - Queries

**As a** Backend Developer,
**I want** Query handlers for Einsatz read operations,
**So that** Einsatz data can be retrieved efficiently.

**Acceptance Criteria:**

**Given** Domain Layer exists
**When** I implement Einsatz query handlers
**Then** the following exist in `application/einsatz/queries/`:

**1. GetActiveEinsaetzeQuery & Handler**

Query:
```typescript
class GetActiveEinsaetzeQuery {
  constructor() {}
}
```

Handler:
- Queries IEinsatzRepository.findActive() (status != ARCHIVIERT)
- Sorts by createdAt descending (newest first)
- Maps to EinsatzDto[]
- Returns Result<EinsatzDto[]>

DTO:
```typescript
class EinsatzDto {
  id: string;
  nummer: string;
  alarmstichwort: string;
  status: 'ANGELEGT' | 'IN_BEARBEITUNG' | 'ABGESCHLOSSEN' | 'ARCHIVIERT';
  einsatzort?: AddressDto;
  bemerkung?: string;
  createdBy: string;
  createdAt: Date;
  abgeschlossenAt?: Date;
}
```

**2. GetEinsatzByIdQuery & Handler**

Query:
```typescript
class GetEinsatzByIdQuery {
  constructor(public readonly einsatzId: string) {}
}
```

Handler:
- Queries IEinsatzRepository.findById()
- Maps to EinsatzDto
- Returns Result<EinsatzDto | null>

**3. GetEinsatzByNummerQuery & Handler**

Query:
```typescript
class GetEinsatzByNummerQuery {
  constructor(public readonly nummer: string) {}
}
```

Handler:
- Queries IEinsatzRepository.findByNummer()
- Maps to EinsatzDto
- Returns Result<EinsatzDto | null>

**And** Unit-Tests validate:
- GetActiveEinsaetze excludes ARCHIVIERT
- GetActiveEinsaetze sorted correctly
- GetEinsatzById returns correct DTO
- Null handling (Einsatz not found)

**Prerequisites:**
- Epic 1 (Domain Layer)

**Technical Notes:**
- CQRS: Queries can bypass Aggregate (direct Prisma)
- For now: Load Aggregate, then map to DTO (simplicity)
- Future: Read Models for optimized queries

---

## Story 4.3b: Combined Cross-Aggregate Queries 🆕 (Efficiency Optimization)

**As a** Backend Developer,
**I want** combined query handlers that fetch related data in single requests,
**So that** frontend reduces API calls from 3 to 1 (improved efficiency and UX).

**Acceptance Criteria:**

**Given** Separate queries for Einsatz, ETB, and Lagekarte exist (Story 4.3, Epic 2, Epic 3)
**When** I implement combined queries
**Then** the following exist in `application/einsatz/queries/`:

**1. GetEinsatzDetailsQuery & Handler (Einsatz + ETB + Lagekarte)**

Query:
```typescript
class GetEinsatzDetailsQuery {
  constructor(public readonly einsatzId: string) {}
}
```

Handler:
```typescript
@QueryHandler(GetEinsatzDetailsQuery)
class GetEinsatzDetailsHandler {
  async execute(query: GetEinsatzDetailsQuery): Promise<Result<EinsatzDetailsDto>> {
    // Use Prisma `include` for eager loading (N+1 query prevention)
    const prismaEinsatz = await this.prisma.einsatz.findUnique({
      where: { id: query.einsatzId },
      include: {
        etb: {
          include: {
            eintraege: {
              where: { isDeleted: false },
              orderBy: { sequenceNumber: 'asc' }
            }
          }
        },
        lagekarte: {
          include: {
            pois: true
          }
        }
      }
    });

    if (!prismaEinsatz) {
      return Result.fail('Einsatz not found');
    }

    // Map to combined DTO
    const dto: EinsatzDetailsDto = {
      einsatz: PrismaEinsatzMapper.toDto(prismaEinsatz),
      etb: prismaEinsatz.etb ? PrismaEtbMapper.toDto(prismaEinsatz.etb) : null,
      lagekarte: prismaEinsatz.lagekarte ? PrismaLagekarteMapper.toDto(prismaEinsatz.lagekarte) : null
    };

    return Result.ok(dto);
  }
}
```

DTO:
```typescript
class EinsatzDetailsDto {
  einsatz: EinsatzDto;
  etb: EtbDto | null; // null if no ETB created yet
  lagekarte: LagekarteDto | null; // null if no POIs added yet
}

class EtbDto {
  id: string;
  einsatzId: string;
  status: 'DRAFT' | 'ACTIVE' | 'LOCKED';
  version: number;
  eintraege: EtbEintragDto[];
}

class EtbEintragDto {
  id: string;
  sequenceNumber: number;
  text: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

class LagekarteDto {
  id: string;
  einsatzId: string;
  pois: PoiDto[];
}

class PoiDto {
  id: string;
  name: string;
  mgrsCoordinate: string; // Formatted MGRS (e.g., "32U MV 12345 67890")
  latLng: { lat: number; lng: number }; // Converted for map display
  category: 'EINSATZSTELLE' | 'BEREITSTELLUNGSRAUM' | 'GEFAHRENSTELLE' | 'WASSERENTNAHMESTELLE' | 'SONSTIGES';
  beschreibung?: string;
  createdAt: Date;
}
```

**2. GetActiveEinsaetzeWithCountsQuery & Handler (List with Counts)**

Query:
```typescript
class GetActiveEinsaetzeWithCountsQuery {
  constructor() {}
}
```

Handler:
```typescript
@QueryHandler(GetActiveEinsaetzeWithCountsQuery)
class GetActiveEinsaetzeWithCountsHandler {
  async execute(): Promise<Result<EinsatzListItemDto[]>> {
    const einsaetze = await this.prisma.einsatz.findMany({
      where: { status: { not: 'ARCHIVIERT' } },
      include: {
        _count: {
          select: {
            etb: { where: { eintraege: { some: { isDeleted: false } } } },
            lagekarte: { where: { pois: { some: {} } } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const dtos = einsaetze.map(e => ({
      id: e.id,
      nummer: e.nummer,
      alarmstichwort: e.alarmstichwort,
      status: e.status,
      einsatzort: e.einsatzort,
      createdAt: e.createdAt,
      etbEintraegeCount: e._count.etb,
      poisCount: e._count.lagekarte
    }));

    return Result.ok(dtos);
  }
}
```

DTO:
```typescript
class EinsatzListItemDto {
  id: string;
  nummer: string;
  alarmstichwort: string;
  status: 'ANGELEGT' | 'IN_BEARBEITUNG' | 'ABGESCHLOSSEN' | 'ARCHIVIERT';
  einsatzort?: { ort: string };
  createdAt: Date;
  etbEintraegeCount: number; // For UI badge (e.g., "12 Einträge")
  poisCount: number; // For UI badge (e.g., "3 POIs")
}
```

**3. Controller Integration**

Update `EinsatzController`:
```typescript
@Get(':id/details')
@ApiOperation({ summary: 'Get Einsatz with ETB and Lagekarte (combined)' })
@ApiOkResponse({ type: EinsatzDetailsDto })
async getEinsatzDetails(@Param('id') id: string): Promise<EinsatzDetailsDto> {
  const query = new GetEinsatzDetailsQuery(id);
  const result = await this.queryBus.execute(query);

  if (result.isFailure) {
    throw new NotFoundException(result.error);
  }

  return result.value;
}

@Get()
@ApiOperation({ summary: 'Get active Einsätze with counts' })
@ApiOkResponse({ type: [EinsatzListItemDto] })
async getActiveEinsaetzeWithCounts(): Promise<EinsatzListItemDto[]> {
  const query = new GetActiveEinsaetzeWithCountsQuery();
  const result = await this.queryBus.execute(query);
  return result.value;
}
```

**And** Unit-Tests validate:
- GetEinsatzDetails returns Einsatz + ETB + Lagekarte in single query
- GetEinsatzDetails handles missing ETB/Lagekarte (null values)
- GetActiveEinsaetzeWithCounts returns correct counts
- Prisma query uses `include` (not N+1 queries)

**And** Performance Validation:
- Single combined query ≈ same latency as single Einsatz query (<50ms overhead)
- No N+1 query problem (verified via Prisma query log)

**Prerequisites:**
- Story 4.3 (Einsatz Queries)
- Epic 2 (Lagekarte - Story 2.6 Queries)
- Epic 3 (ETB - Story 3.6 Queries)

**Technical Notes:**
- **CQRS Optimization:** Combined queries bypass Aggregates (direct Prisma for efficiency)
- **Prisma `include`:** Eager loads relations in single DB round-trip (joins under the hood)
- **Null Safety:** ETB/Lagekarte may not exist yet (lazy creation) → nullable DTOs
- **Frontend Benefit:** Reduces 3 API calls to 1 (faster page load, less network overhead)
- **Mapping:** Use existing mappers (EinsatzMapper, EtbMapper, LagekarteMapper) for consistency
- **Future Enhancement:** Consider GraphQL if combined query variations increase (optional)

**Effort Estimate:** 3-4h
- 1h: GetEinsatzDetailsQuery implementation
- 1h: GetActiveEinsaetzeWithCountsQuery implementation
- 30min: Controller updates + OpenAPI docs
- 1h: Unit tests + performance validation

**Priority:** 🟠 HIGH (Risk Reduction - improves frontend efficiency, prevents N+1 queries)

---

## Story 4.4: Transactional Outbox Pattern - Infrastructure

**As a** Backend Developer,
**I want** Transactional Outbox Pattern implemented,
**So that** domain events are guaranteed to be published (no event loss).

**Acceptance Criteria:**

**Given** Domain events are critical for ETB auto-creation and audit-trail
**When** I implement Transactional Outbox
**Then** the following exist:

**1. Outbox Table Schema**

Prisma Schema:
```prisma
model OutboxEvent {
  id           String   @id @default(uuid())
  aggregateId  String
  eventType    String   // Event class name (e.g., "EinsatzCreatedEvent")
  payload      String   // JSON serialized event
  status       String   // PENDING | PUBLISHED | FAILED
  createdAt    DateTime @default(now())
  publishedAt  DateTime?
  retryCount   Int      @default(0)
  error        String?  // Error message if status = FAILED
}
```

**2. OutboxEventRepository**

```typescript
class PrismaOutboxRepository {
  async save(events: DomainEvent[], tx: PrismaTransaction): Promise<void> {
    const outboxEvents = events.map(e => ({
      id: uuid(),
      aggregateId: e.aggregateId,
      eventType: e.constructor.name,
      payload: JSON.stringify(e),
      status: 'PENDING',
      createdAt: new Date(),
      retryCount: 0
    }));

    await tx.outboxEvent.createMany({ data: outboxEvents });
  }

  async findPendingEvents(limit = 100): Promise<OutboxEvent[]> {
    return this.prisma.outboxEvent.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit
    });
  }

  async markAsPublished(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: { status: 'PUBLISHED', publishedAt: new Date() }
    });
  }

  async markAsFailed(eventId: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'FAILED',
        error: error,
        retryCount: { increment: 1 }
      }
    });
  }
}
```

**3. Polling Worker (CronJob)**

```typescript
@Injectable()
class OutboxEventPublisher {
  constructor(
    private outboxRepo: PrismaOutboxRepository,
    private eventEmitter: EventEmitter2,
    private logger: Logger
  ) {}

  @Cron('*/5 * * * * *') // Every 5 seconds
  async publishPendingEvents(): Promise<void> {
    const events = await this.outboxRepo.findPendingEvents(100);

    for (const outboxEvent of events) {
      try {
        const event = this.deserializeEvent(outboxEvent);
        await this.eventEmitter.emitAsync(outboxEvent.eventType, event);
        await this.outboxRepo.markAsPublished(outboxEvent.id);
        this.logger.log(`Published event: ${outboxEvent.eventType}`);
      } catch (error) {
        this.logger.error(`Failed to publish event: ${error.message}`);
        await this.outboxRepo.markAsFailed(outboxEvent.id, error.message);

        // Retry logic: Max 3 attempts
        if (outboxEvent.retryCount >= 3) {
          this.logger.error(`Event ${outboxEvent.id} failed after 3 retries`);
          // Alert admin (future: send notification)
        }
      }
    }
  }

  private deserializeEvent(outboxEvent: OutboxEvent): DomainEvent {
    const payload = JSON.parse(outboxEvent.payload);
    const EventClass = this.getEventClass(outboxEvent.eventType);
    return Object.assign(new EventClass(), payload);
  }
}
```

**4. Repository Integration**

Update `PrismaEinsatzRepository.save()`:
```typescript
async save(aggregate: EinsatzAggregate): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    // 1. Save aggregate
    const data = PrismaEinsatzMapper.toPersistence(aggregate);
    await tx.einsatz.upsert({ ... });

    // 2. Save events to outbox (ATOMIC!)
    const events = aggregate.getUncommittedEvents();
    await this.outboxRepo.save(events, tx);

    aggregate.clearEvents();
  });
}
```

**And** Integration-Tests validate:
- Events saved to outbox atomically with aggregate
- Polling worker publishes pending events
- Failed events retried (max 3 times)
- Published events marked as PUBLISHED
- NO event loss on crash (events persisted)

**And** Monitoring:
- Log pending event count
- Alert if FAILED events > 10
- Dashboard: Event publishing rate

**5. Alert System for FAILED Events** 🆕 **CRITICAL for DRK Compliance**

**Purpose:** Notify administrators when outbox events fail permanently, preventing audit-trail gaps.

**Alert Service Interface:**
```typescript
interface IAlertService {
  sendCriticalAlert(subject: string, message: string, metadata?: Record<string, any>): Promise<void>;
}
```

**Implementation Options:**
- **E-Mail:** Use nodemailer to send alerts to SUPER_ADMIN users
- **Slack:** Webhook integration for real-time notifications
- **Dashboard:** In-app notification center (future enhancement)

**Alert Trigger Logic:**
Update `OutboxEventPublisher.publishPendingEvents()`:
```typescript
@Cron('*/5 * * * * *') // Every 5 seconds
async publishPendingEvents(): Promise<void> {
  const events = await this.outboxRepo.findPendingEvents(100);
  let failedCount = 0;

  for (const outboxEvent of events) {
    try {
      const event = this.deserializeEvent(outboxEvent);
      await this.eventEmitter.emitAsync(outboxEvent.eventType, event);
      await this.outboxRepo.markAsPublished(outboxEvent.id);
      this.logger.log(`Published event: ${outboxEvent.eventType}`);
    } catch (error) {
      this.logger.error(`Failed to publish event: ${error.message}`);
      await this.outboxRepo.markAsFailed(outboxEvent.id, error.message);
      failedCount++;

      // Retry logic: Max 3 attempts
      if (outboxEvent.retryCount >= 2) { // Will be 3 after increment
        this.logger.error(`Event ${outboxEvent.id} failed permanently after 3 retries`);

        // 🚨 CRITICAL: Send alert for permanent failure
        await this.alertService.sendCriticalAlert(
          'Outbox Event Failed Permanently',
          `Event ${outboxEvent.eventType} (ID: ${outboxEvent.id}) failed after 3 retries.`,
          {
            eventId: outboxEvent.id,
            eventType: outboxEvent.eventType,
            aggregateId: outboxEvent.aggregateId,
            error: error.message,
            createdAt: outboxEvent.createdAt
          }
        );
      }
    }
  }

  // 🚨 Alert if too many FAILED events (threshold: 10)
  if (failedCount > 10) {
    await this.alertService.sendCriticalAlert(
      'High Outbox Failure Rate',
      `${failedCount} events failed in this polling cycle. System may have issues.`,
      { failedCount, timestamp: new Date() }
    );
  }
}
```

**6. Hourly Summary CronJob** (Optional Enhancement)

```typescript
@Cron('0 * * * *') // Every hour
async sendHourlySummary(): Promise<void> {
  const stats = await this.outboxRepo.getStats();

  if (stats.failedCount > 0) {
    await this.alertService.sendCriticalAlert(
      'Hourly Outbox Summary',
      `Pending: ${stats.pendingCount}, Published: ${stats.publishedCount}, Failed: ${stats.failedCount}`,
      stats
    );
  }
}
```

**Acceptance Criteria (Extended):**
- ✅ Alert sent when event fails after 3 retries (permanent failure)
- ✅ Alert sent when failedCount > 10 in single polling cycle
- ✅ Alert includes event metadata (eventType, aggregateId, error message)
- ✅ Alerts delivered via E-Mail to all SUPER_ADMIN users
- ✅ Alert failures logged (but don't block event processing)
- ✅ Integration test: Simulate event failure → verify alert sent

**Alert Service Implementation (E-Mail via Nodemailer):**
```typescript
@Injectable()
class EmailAlertService implements IAlertService {
  constructor(
    private configService: ConfigService,
    private userRepository: IUserRepository
  ) {}

  async sendCriticalAlert(subject: string, message: string, metadata?: Record<string, any>): Promise<void> {
    try {
      // Get all SUPER_ADMIN users
      const admins = await this.userRepository.findByRole(UserRole.SUPER_ADMIN);
      const recipients = admins.map(u => u.email).filter(Boolean);

      if (recipients.length === 0) {
        this.logger.warn('No SUPER_ADMIN users with email found for alert');
        return;
      }

      const transporter = nodemailer.createTransport({
        host: this.configService.get('SMTP_HOST'),
        port: this.configService.get('SMTP_PORT'),
        auth: {
          user: this.configService.get('SMTP_USER'),
          pass: this.configService.get('SMTP_PASS')
        }
      });

      await transporter.sendMail({
        from: '"Bluelight Hub" <alerts@bluelight-hub.de>',
        to: recipients.join(', '),
        subject: `🚨 CRITICAL: ${subject}`,
        text: message,
        html: this.formatAlertHtml(subject, message, metadata)
      });

      this.logger.log(`Alert sent to ${recipients.length} admins: ${subject}`);
    } catch (error) {
      // IMPORTANT: Alert failures MUST NOT block event processing
      this.logger.error(`Failed to send alert: ${error.message}`);
    }
  }

  private formatAlertHtml(subject: string, message: string, metadata?: Record<string, any>): string {
    return `
      <h2>🚨 ${subject}</h2>
      <p>${message}</p>
      ${metadata ? `<pre>${JSON.stringify(metadata, null, 2)}</pre>` : ''}
      <hr>
      <p><small>Bluelight Hub Alert System | ${new Date().toISOString()}</small></p>
    `;
  }
}
```

**Integration Test for Alerting:**
```typescript
describe('Outbox Alerting', () => {
  it('should send alert when event fails after 3 retries', async () => {
    // Given: Event fails 3 times
    const event = await prisma.outboxEvent.create({
      data: {
        eventType: 'EinsatzCreatedEvent',
        aggregateId: 'test-123',
        payload: '{}',
        status: 'PENDING',
        retryCount: 2 // Will be 3 after next failure
      }
    });

    // Mock event emitter to throw error
    jest.spyOn(eventEmitter, 'emitAsync').mockRejectedValue(new Error('Test failure'));

    // Spy on alert service
    const alertSpy = jest.spyOn(alertService, 'sendCriticalAlert');

    // When: Polling worker runs
    await publisher.publishPendingEvents();

    // Then: Alert sent
    expect(alertSpy).toHaveBeenCalledWith(
      'Outbox Event Failed Permanently',
      expect.stringContaining('failed after 3 retries'),
      expect.objectContaining({ eventId: event.id })
    );
  });

  it('should send alert when failedCount > 10', async () => {
    // Given: 15 events all fail
    for (let i = 0; i < 15; i++) {
      await prisma.outboxEvent.create({
        data: { eventType: 'TestEvent', aggregateId: `test-${i}`, payload: '{}', status: 'PENDING' }
      });
    }

    jest.spyOn(eventEmitter, 'emitAsync').mockRejectedValue(new Error('Batch failure'));
    const alertSpy = jest.spyOn(alertService, 'sendCriticalAlert');

    // When: Polling worker runs
    await publisher.publishPendingEvents();

    // Then: High failure rate alert sent
    expect(alertSpy).toHaveBeenCalledWith(
      'High Outbox Failure Rate',
      expect.stringContaining('15 events failed'),
      expect.anything()
    );
  });
});
```

**Configuration (Environment Variables):**
```env
# SMTP Configuration for Alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@bluelight-hub.de
SMTP_PASS=<app-password>
```

**Prerequisites:**
- Story 4.1 (Commands)
- Epic 1 (Domain Events)
- Story 1.6 (User Aggregate - for SUPER_ADMIN lookup)

**Technical Notes:**
- **Alert Failures MUST NOT block event processing** (catch + log errors)
- Outbox pattern ensures atomicity (events + data in single transaction)
- Polling worker runs every 5 seconds (configurable)
- Retry logic: Max 3 attempts (fixed, not exponential backoff for simplicity)
- Alert threshold (10 failures) configurable via environment variable
- Hourly summary optional (can be added in future sprint if needed)
- Future: Replace polling with message broker (RabbitMQ, Kafka) and keep alert system

**Effort Estimate (Updated):** 6-7h
- 3h: Outbox Pattern (original)
- 2h: Alert Service (E-Mail integration)
- 1h: Integration Tests (alerting scenarios)
- 30min: Configuration + Documentation

**Priority:** 🔴 CRITICAL (Blocker for Epic 4 - DRK Audit Trail Compliance)

---

## Story 4.5: Einsatz Infrastructure - Prisma Repository Adapter

**As a** Backend Developer,
**I want** a Prisma adapter for EinsatzAggregate with Outbox integration,
**So that** Einsätze are persisted atomically with events.

**Acceptance Criteria:**

**Given** Domain Layer with IEinsatzRepository interface
**When** I implement the Prisma adapter
**Then** a `PrismaEinsatzRepository` class exists in `infrastructure/persistence/prisma/adapters/`:

**Implementation:**
```typescript
class PrismaEinsatzRepository implements IEinsatzRepository {
  constructor(
    private prisma: PrismaClient,
    private outboxRepo: PrismaOutboxRepository
  ) {}

  async save(aggregate: EinsatzAggregate): Promise<void> {
    const data = PrismaEinsatzMapper.toPersistence(aggregate);

    await this.prisma.$transaction(async (tx) => {
      await tx.einsatz.upsert({
        where: { id: data.id },
        update: {
          alarmstichwort: data.alarmstichwort,
          status: data.status,
          einsatzort: data.einsatzort,
          bemerkung: data.bemerkung,
          abgeschlossenAt: data.abgeschlossenAt
        },
        create: data
      });

      // CRITICAL: Save events to outbox (atomic)
      const events = aggregate.getUncommittedEvents();
      await this.outboxRepo.save(events, tx);

      aggregate.clearEvents();
    });
  }

  async findById(id: EinsatzId): Promise<EinsatzAggregate | null> {
    const prismaEinsatz = await this.prisma.einsatz.findUnique({
      where: { id: id.value }
    });

    return prismaEinsatz ? PrismaEinsatzMapper.toDomain(prismaEinsatz) : null;
  }

  async findActive(): Promise<EinsatzAggregate[]> {
    const einsaetze = await this.prisma.einsatz.findMany({
      where: { status: { not: 'ARCHIVIERT' } },
      orderBy: { createdAt: 'desc' }
    });

    return einsaetze.map(PrismaEinsatzMapper.toDomain);
  }

  async findByNummer(nummer: string): Promise<EinsatzAggregate | null> {
    const prismaEinsatz = await this.prisma.einsatz.findUnique({
      where: { nummer: nummer }
    });

    return prismaEinsatz ? PrismaEinsatzMapper.toDomain(prismaEinsatz) : null;
  }

  async exists(id: EinsatzId): Promise<boolean> {
    const count = await this.prisma.einsatz.count({
      where: { id: id.value }
    });
    return count > 0;
  }

  async getNextSequenceNumber(year: number): Promise<number> {
    const lastEinsatz = await this.prisma.einsatz.findFirst({
      where: { nummer: { startsWith: `E${year}-` } },
      orderBy: { nummer: 'desc' }
    });

    if (!lastEinsatz) return 1;

    const match = lastEinsatz.nummer.match(/E\d{4}-(\d{3})/);
    return match ? parseInt(match[1], 10) + 1 : 1;
  }
}
```

**And** Integration-Tests validate:
- Save creates new Einsatz
- Save updates existing Einsatz
- Events saved to outbox atomically
- Transaction rollback on error (no partial saves)
- FindActive excludes ARCHIVIERT
- GetNextSequenceNumber increments correctly

**Prerequisites:**
- Story 4.4 (Outbox Pattern)
- Story 4.6 (Mapper)

**Technical Notes:**
- Use Prisma transactions for atomicity
- Outbox events saved in same transaction (CRITICAL)
- Sequence number query separate (not in transaction)

---

## Story 4.6: Einsatz Infrastructure - Domain ↔ Prisma Mapper

**As a** Backend Developer,
**I want** a bidirectional mapper for EinsatzAggregate,
**So that** Einsätze are correctly persisted and hydrated.

**Acceptance Criteria:**

**Given** EinsatzAggregate and Prisma schema exist
**When** I implement the mapper
**Then** a `PrismaEinsatzMapper` class exists in `infrastructure/persistence/prisma/mappers/`:

**Mapper Implementation:**
```typescript
class PrismaEinsatzMapper {
  static toDomain(prismaEinsatz: PrismaEinsatz): EinsatzAggregate {
    return new EinsatzAggregate({
      id: new EinsatzId(prismaEinsatz.id),
      nummer: prismaEinsatz.nummer,
      alarmstichwort: prismaEinsatz.alarmstichwort,
      status: new EinsatzStatus(prismaEinsatz.status),
      einsatzort: prismaEinsatz.einsatzort
        ? new Address(JSON.parse(prismaEinsatz.einsatzort))
        : undefined,
      bemerkung: prismaEinsatz.bemerkung ?? undefined,
      createdBy: new UserId(prismaEinsatz.createdBy),
      createdAt: prismaEinsatz.createdAt,
      abgeschlossenAt: prismaEinsatz.abgeschlossenAt ?? undefined
    });
  }

  static toPersistence(aggregate: EinsatzAggregate): PrismaEinsatzCreateInput {
    return {
      id: aggregate.id.value,
      nummer: aggregate.nummer,
      alarmstichwort: aggregate.alarmstichwort,
      status: aggregate.status.value,
      einsatzort: aggregate.einsatzort
        ? JSON.stringify(aggregate.einsatzort)
        : null,
      bemerkung: aggregate.bemerkung,
      createdBy: aggregate.createdBy.value,
      createdAt: aggregate.createdAt,
      abgeschlossenAt: aggregate.abgeschlossenAt
    };
  }
}
```

**And** Unit-Tests validate:
- Bidirectional conversion (Domain → Prisma → Domain = equal)
- Address serialization (JSON)
- Status enum mapping
- Optional fields (einsatzort, bemerkung, abgeschlossenAt)
- No data loss in round-trip

**Prerequisites:**
- Epic 1 (Domain Layer)

**Technical Notes:**
- Address stored as JSON string in DB
- EinsatzStatus mapped to string enum
- Typed IDs converted to strings

---

## Story 4.7: Authentication - User Repository & JWT Adapter

**As a** Backend Developer,
**I want** User repository and JWT token service adapters,
**So that** authentication works with the new architecture.

**Acceptance Criteria:**

**Given** Domain Layer with IUserRepository and ITokenServicePort
**When** I implement adapters
**Then** the following exist:

**1. PrismaUserRepository**

```typescript
class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async save(aggregate: UserAggregate): Promise<void> {
    const data = PrismaUserMapper.toPersistence(aggregate);
    await this.prisma.user.upsert({
      where: { id: data.id },
      update: data,
      create: data
    });
    aggregate.clearEvents();
  }

  async findById(id: UserId): Promise<UserAggregate | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: id.value }
    });
    return user ? PrismaUserMapper.toDomain(user) : null;
  }

  async findByUsername(username: Username): Promise<UserAggregate | null> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.value.toLowerCase() }
    });
    return user ? PrismaUserMapper.toDomain(user) : null;
  }

  async existsByUsername(username: Username): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { username: username.value.toLowerCase() }
    });
    return count > 0;
  }

  async findByRole(role: UserRole): Promise<UserAggregate[]> {
    const users = await this.prisma.user.findMany({
      where: { role: role.value }
    });
    return users.map(PrismaUserMapper.toDomain);
  }

  async countSuperAdmins(): Promise<number> {
    return this.prisma.user.count({
      where: { role: 'SUPER_ADMIN', isLocked: false }
    });
  }
}
```

**2. JwtTokenServiceAdapter**

```typescript
class JwtTokenServiceAdapter implements ITokenServicePort {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService
  ) {}

  async generateToken(userId: UserId, role: UserRole): Promise<string> {
    const payload = {
      sub: userId.value,
      role: role.value,
      iat: Math.floor(Date.now() / 1000)
    };

    return this.jwtService.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: '24h'
    });
  }

  async validateToken(token: string): Promise<Result<{ userId: UserId; role: UserRole }>> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get('JWT_SECRET')
      });

      return Result.ok({
        userId: new UserId(payload.sub),
        role: new UserRole(payload.role)
      });
    } catch (error) {
      return Result.fail('Invalid or expired token');
    }
  }

  async revokeToken(token: string): Promise<void> {
    // Future: Implement token blacklist (Redis)
    // For now: No-op (tokens expire after 24h)
  }
}
```

**And** Integration-Tests validate:
- User CRUD works
- FindByUsername is case-insensitive
- CountSuperAdmins returns correct count
- JWT generation/validation works
- Token expiration after 24h

**Prerequisites:**
- Epic 1 (Domain Layer)

**Technical Notes:**
- Username stored lowercase in DB (case-insensitive)
- JWT secret from environment variable
- Future: Token blacklist for logout

---

## Story 4.8: Einsatz & Auth Controller Refactoring

**As a** Backend Developer,
**I want** Einsatz and Auth controllers refactored to CQRS,
**So that** controllers are thin adapters.

**Acceptance Criteria:**

**Given** Command/Query handlers exist
**When** I refactor controllers
**Then** the following exist:

**1. EinsatzController (CQRS)**

```typescript
@Controller('einsatz')
@ApiTags('einsatz')
class EinsatzController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus
  ) {}

  @Post()
  @ApiOperation({ summary: 'Einsatz erstellen' })
  async create(
    @Body() dto: CreateEinsatzDto,
    @CurrentUser() user: UserDto
  ): Promise<EinsatzDto> {
    const command = new CreateEinsatzCommand(
      dto.alarmstichwort,
      user.id,
      dto.einsatzort,
      dto.bemerkung
    );

    const result = await this.commandBus.execute(command);
    if (result.isFailure) throw new BadRequestException(result.error);

    const query = new GetEinsatzByIdQuery(result.value.value);
    return (await this.queryBus.execute(query)).value;
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Einsatz abschließen' })
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: UserDto
  ): Promise<void> {
    const command = new CompleteEinsatzCommand(id, user.id);
    const result = await this.commandBus.execute(command);
    if (result.isFailure) throw new BadRequestException(result.error);
  }

  @Get()
  @ApiOperation({ summary: 'Aktive Einsätze abrufen' })
  async getActive(): Promise<EinsatzDto[]> {
    const query = new GetActiveEinsaetzeQuery();
    const result = await this.queryBus.execute(query);
    return result.value;
  }
}
```

**2. AuthController (CQRS)**

```typescript
@Controller('auth')
@ApiTags('auth')
class AuthController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Login (Password für ADMIN/SUPER_ADMIN, Passwordless für USER)' })
  async login(@Body() dto: LoginDto): Promise<{ token: string }> {
    const command = new LoginCommand(dto.username, dto.password);
    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw new UnauthorizedException(result.error);
    }

    return { token: result.value };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout (Token ungültig machen)' })
  async logout(@Headers('authorization') authHeader: string): Promise<void> {
    const token = authHeader?.replace('Bearer ', '');
    const command = new LogoutCommand(token);
    await this.commandBus.execute(command);
  }
}
```

**And** Integration-Tests validate:
- POST /einsatz creates Einsatz
- POST /einsatz/:id/complete completes Einsatz
- GET /einsatz returns active Einsätze
- POST /auth/login returns JWT token
- POST /auth/logout invalidates token

**Prerequisites:**
- Stories 4.1-4.7

**Technical Notes:**
- @CurrentUser decorator extracts user from JWT
- RoleGuard for authorization
- OpenAPI decorators for API client

---

## Story 4.9: Frontend - Complete Migration to New API

**As a** Frontend Developer,
**I want** Frontend completely migrated to new Einsatz/Auth API,
**So that** Frontend uses the new Backend architecture.

**Acceptance Criteria:**

**Given** Backend API changed
**When** I update Frontend
**Then** the following completed:

**1. API Client Regeneration (1h)**
```bash
pnpm run generate-api
```

**2. TanStack Query Hooks (3-4h)**

Update all Einsatz hooks:
```typescript
const useEinsaetze = () => {
  return useQuery({
    queryKey: ['einsaetze'],
    queryFn: () => api.einsatz.getActive()
  });
};

const useCreateEinsatz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateEinsatzDto) => api.einsatz.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['einsaetze'] });
    }
  });
};

const useCompleteEinsatz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.einsatz.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['einsaetze'] });
    }
  });
};
```

**3. Component Updates (2-4h)**

Update components:
- `EinsatzList.tsx` - Display active Einsätze
- `CreateEinsatzForm.tsx` - Create Einsatz form
- `EinsatzDetails.tsx` - Show Einsatz details
- `CompleteEinsatzButton.tsx` - Complete Einsatz
- `LoginForm.tsx` - Auth login
- `UserProfile.tsx` - Display user role

**4. E2E Smoke Tests (1-2h)**

```typescript
describe('Einsatz CRUD Flow', () => {
  it('should create, complete, and archive Einsatz', async () => {
    // 1. Login
    await login('admin', 'password');

    // 2. Create Einsatz
    const einsatz = await createEinsatz({
      alarmstichwort: 'Brand',
      einsatzort: { ort: 'Berlin' }
    });
    expect(einsatz.status).toBe('ANGELEGT');

    // 3. Complete Einsatz
    await completeEinsatz(einsatz.id);
    expect(einsatz.status).toBe('ABGESCHLOSSEN');

    // 4. Verify ETB auto-created
    const etb = await getEtb(einsatz.id);
    expect(etb).toBeDefined();
  });
});
```

**And** Manual Testing:
- Einsatz can be created
- Status transitions work
- ETB auto-created
- Auth login/logout works

**Prerequisites:**
- Story 4.8 (Backend API)

**Technical Notes:**
- Use generated API client
- TanStack Query for caching
- E2E tests optional (manual QA acceptable)

---

## Story 4.10: Epic 4 Integration Tests & Performance Validation

**As a** Backend Developer,
**I want** comprehensive integration tests and performance validation,
**So that** Epic 4 migration is complete and safe.

**Acceptance Criteria:**

**Given** Epic 4 complete
**When** I implement tests
**Then** the following validated:

**Tests:**
```typescript
describe('Epic 4 - Einsatz + Auth Migration', () => {
  it('should publish events via Outbox (no loss)', async () => {
    const einsatz = await createEinsatz({ alarmstichwort: 'Test' });

    // Check outbox has event
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { aggregateId: einsatz.id }
    });
    expect(outboxEvents).toHaveLength(1);
    expect(outboxEvents[0].eventType).toBe('EinsatzCreatedEvent');

    // Wait for polling worker
    await sleep(6000);

    // Check event published
    const published = await prisma.outboxEvent.findFirst({
      where: { id: outboxEvents[0].id }
    });
    expect(published.status).toBe('PUBLISHED');
  });

  it('should enforce NO-DELETE policy', async () => {
    const einsatz = await createEinsatz();

    await expect(
      api.einsatz.delete(einsatz.id)
    ).rejects.toThrow('cannot be deleted');
  });

  it('should enforce Min 1 SUPER_ADMIN constraint', async () => {
    const lastAdmin = await getLastSuperAdmin();

    await expect(
      api.user.lock(lastAdmin.id)
    ).rejects.toThrow('Cannot lock last SUPER_ADMIN');
  });
});
```

**And** Performance Baseline:
- API response times ±10% from baseline
- Outbox polling latency <1s
- NO N+1 queries

**Prerequisites:**
- All Stories 4.1-4.9 complete

**Technical Notes:**
- Integration tests use real database
- Rollback plan same as Epic 2/3

---
