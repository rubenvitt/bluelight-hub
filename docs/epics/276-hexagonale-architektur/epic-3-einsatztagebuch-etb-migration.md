# Epic 3: Einsatztagebuch (ETB) Migration

**Goal:** Migrate ETB to Hexagonal Architecture with revision-safe versioning and event-driven auto-creation.

**Business Value:**
- Audit-trail compliance (DRK 10-year retention)
- Automatic ETB creation when Einsatz created (via events)
- Immutable history (versioning with snapshots)
- Sequence numbers prevent manipulation

**Technical Scope:**
- Commands/Handlers: CreateEtb, AddEintrag, UpdateEintrag, DeleteEintrag, LockEtb
- Queries/Handlers: GetEtb, GetEtbHistory, GetEintraege
- Event Handlers: EinsatzCreated → Auto-Create ETB
- Infrastructure: PrismaEtbRepository with versioning
- Mappers: Domain ↔ Prisma (ETB, Entries, Snapshots)
- Controller Refactoring
- Frontend: API client, ETB component updates

**Success Criteria:**
- [ ] ETB completely migrated to new architecture
- [ ] Versioning works (snapshots before each mutation)
- [ ] Sequence numbers immutable
- [ ] Event-driven auto-creation functional
- [ ] Frontend functional with new API

**Estimated Effort:** 30-40h (26-34h Backend, 4-6h Frontend)

---

## Story 3.1: ETB Application Layer - Commands (Part 1: Create & Add)

**As a** Backend Developer,
**I want** Command handlers for ETB creation and entry addition,
**So that** ETB lifecycle is managed through the new architecture.

**Acceptance Criteria:**

**Given** Domain Layer exists (Epic 1)
**When** I implement ETB command handlers
**Then** the following exist in `application/etb/commands/`:

**1. CreateEtbCommand & Handler**

Command:
```typescript
class CreateEtbCommand {
  constructor(public readonly einsatzId: string) {}
}
```

Handler:
- Creates EinsatztagebuchAggregate for Einsatz
- Validates EinsatzId exists (via IEinsatzRepository)
- Saves via IEtbRepository
- Publishes EtbCreatedEvent
- Returns Result<EtbId>

**2. AddEintragCommand & Handler**

Command:
```typescript
class AddEintragCommand {
  constructor(
    public readonly etbId: string,
    public readonly text: string,
    public readonly userId: string
  ) {}
}
```

Handler:
- Loads EinsatztagebuchAggregate by ID
- Calls `aggregate.addEintrag(text, userId)`
- **Versioning:** Aggregate creates snapshot before mutation
- **Sequence Number:** Aggregate auto-increments sequence (1, 2, 3, ...)
- Saves aggregate (includes new snapshot in history)
- Publishes EintragAddedEvent
- Returns Result<EtbEintrag>

Business Rules enforced:
- ETB must NOT be locked (status !== LOCKED)
- Text must not be empty
- UserId must exist

**And** Unit-Tests validate:
- CreateEtb for valid EinsatzId succeeds
- AddEintrag increments sequence number
- AddEintrag fails if ETB locked
- Versioning: Snapshot created before add
- Event emission (EintragAddedEvent contains sequence number)

**Prerequisites:**
- Epic 1 (Domain Layer)
- Story 1.4 (ETB Aggregate)

**Technical Notes:**
- Snapshot created in Aggregate (before mutation)
- Repository persists snapshot in `etb_history` table
- Sequence numbers are domain invariants (never gaps, never duplicates)
- Result<T> pattern for all handlers

---

## Story 3.2: ETB Application Layer - Commands (Part 2: Update, Delete, Lock)

**As a** Backend Developer,
**I want** Command handlers for ETB entry modification and locking,
**So that** ETB mutations are revision-safe and comply with DRK audit requirements.

**Acceptance Criteria:**

**Given** Story 3.1 complete
**When** I implement remaining ETB command handlers
**Then** the following exist:

**1. UpdateEintragCommand & Handler**

Command:
```typescript
class UpdateEintragCommand {
  constructor(
    public readonly etbId: string,
    public readonly eintragId: string,
    public readonly newText: string,
    public readonly userId: string
  ) {}
}
```

Handler:
- Loads aggregate
- **Versioning:** Aggregate creates snapshot (old text preserved in history)
- Calls `aggregate.updateEintrag(eintragId, newText, userId)`
- Saves aggregate (snapshot + updated entry)
- Publishes EintragUpdatedEvent (with oldText + newText)
- Returns Result<void>

Business Rules:
- ETB must NOT be locked
- Eintrag must exist
- Old text preserved in snapshot (audit-trail)

**2. DeleteEintragCommand & Handler**

Command:
```typescript
class DeleteEintragCommand {
  constructor(
    public readonly etbId: string,
    public readonly eintragId: string,
    public readonly userId: string
  ) {}
}
```

Handler:
- Loads aggregate
- **Soft-Delete:** Aggregate marks entry as deleted (`isDeleted = true`)
- **History:** Deleted entry remains in history (compliance)
- Saves aggregate
- Publishes EintragDeletedEvent
- Returns Result<void>

Business Rules:
- NO hard delete (soft-delete only)
- ETB must NOT be locked
- Deleted entries remain queryable in history

**3. LockEtbCommand & Handler**

Command:
```typescript
class LockEtbCommand {
  constructor(
    public readonly etbId: string,
    public readonly userId: string
  ) {}
}
```

Handler:
- Loads aggregate
- Calls `aggregate.lock(userId)`
- **Immutability:** Status → LOCKED (irreversible)
- Saves aggregate
- Publishes EtbLockedEvent
- Returns Result<void>

Business Rules:
- Lock is IRREVERSIBLE (compliance requirement)
- After lock, ALL mutations fail
- Only ADMIN or SUPER_ADMIN can lock (authorization check in Application Layer)

**And** Unit-Tests validate:
- UpdateEintrag creates snapshot before mutation
- DeleteEintrag soft-deletes (isDeleted flag)
- LockEtb prevents further mutations
- Locked ETB rejects all commands (Update/Delete/Add)
- Events contain correct old/new values

**Prerequisites:**
- Story 3.1 (Create & Add)

**Technical Notes:**
- Snapshots include ALL entries (current state before mutation)
- Soft-delete: `isDeleted` flag in Eintrag entity
- Lock authorization checked in Handler (before calling aggregate)
- Result<T> errors include reason (e.g., "ETB is locked")

---

## Story 3.3: ETB Application Layer - Queries

**As a** Backend Developer,
**I want** Query handlers for ETB read operations,
**So that** ETB data can be retrieved efficiently.

**Acceptance Criteria:**

**Given** Domain Layer exists
**When** I implement ETB query handlers
**Then** the following exist in `application/etb/queries/`:

**1. GetEtbQuery & Handler**

Query:
```typescript
class GetEtbQuery {
  constructor(
    public readonly einsatzId: string,
    public readonly includeDeleted: boolean = false
  ) {}
}
```

Handler:
- Queries IEtbRepository.findByEinsatzId()
- Filters out deleted entries if `includeDeleted = false`
- Maps to EtbDto
- Returns Result<EtbDto | null>

DTO:
```typescript
class EtbDto {
  id: string;
  einsatzId: string;
  status: 'DRAFT' | 'ACTIVE' | 'LOCKED';
  eintraege: EintragDto[];
  version: {
    versionNumber: number;
    timestamp: Date;
  };
  createdAt: Date;
}

class EintragDto {
  id: string;
  sequenceNumber: number;
  text: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  isDeleted: boolean;
}
```

**2. GetEtbHistoryQuery & Handler**

Query:
```typescript
class GetEtbHistoryQuery {
  constructor(public readonly etbId: string) {}
}
```

Handler:
- Queries IEtbRepository.getHistory(etbId)
- Returns all snapshots (previous versions)
- Maps to EtbSnapshotDto[]

DTO:
```typescript
class EtbSnapshotDto {
  version: number;
  snapshotAt: Date;
  eintraege: EintragDto[]; // State at this version
}
```

**3. GetEintraegeQuery & Handler**

Query:
```typescript
class GetEintraegeQuery {
  constructor(
    public readonly etbId: string,
    public readonly includeDeleted: boolean = false
  ) {}
}
```

Handler:
- Loads aggregate
- Returns filtered eintraege (exclude deleted if `includeDeleted = false`)
- Sorted by sequence number (ascending)
- Returns Result<EintragDto[]>

**And** Unit-Tests validate:
- GetEtb returns ETB with entries
- GetEtb excludes deleted entries by default
- GetEtbHistory returns all snapshots
- GetEintraege sorted by sequence number
- Null handling (ETB not found)

**Prerequisites:**
- Epic 1 (Domain Layer)

**Technical Notes:**
- CQRS: Queries can bypass Aggregate (direct Prisma for performance)
- For now: Load Aggregate, then map to DTO (simplicity)
- History stored in separate table (`etb_history`)
- Deleted entries visible if `includeDeleted = true` (audit use-case)

---

## Story 3.4: ETB Infrastructure - Prisma Repository with Versioning

**As a** Backend Developer,
**I want** a Prisma adapter with versioning support,
**So that** ETB snapshots are persisted for audit-trail compliance.

**Acceptance Criteria:**

**Given** Domain Layer with IEtbRepository interface
**When** I implement the Prisma adapter
**Then** a `PrismaEtbRepository` class exists in `infrastructure/persistence/prisma/adapters/`:

**Implementation:**
```typescript
class PrismaEtbRepository implements IEtbRepository {
  constructor(private prisma: PrismaClient) {}

  async save(aggregate: EinsatztagebuchAggregate): Promise<void> {
    const data = PrismaEtbMapper.toPersistence(aggregate);

    await this.prisma.$transaction(async (tx) => {
      // 1. Upsert ETB
      await tx.einsatztagebuch.upsert({
        where: { id: data.id },
        update: {
          status: data.status,
          version: data.version.versionNumber,
          versionTimestamp: data.version.timestamp,
          nextSequenceNumber: data.nextSequenceNumber
        },
        create: {
          id: data.id,
          einsatzId: data.einsatzId,
          status: data.status,
          version: data.version.versionNumber,
          versionTimestamp: data.version.timestamp,
          nextSequenceNumber: data.nextSequenceNumber,
          createdAt: data.createdAt
        }
      });

      // 2. Upsert Einträge (clear + re-create)
      await tx.etbEintrag.deleteMany({ where: { etbId: data.id } });
      await tx.etbEintrag.createMany({ data: data.eintraege });

      // 3. Save new snapshot to history (if version changed)
      if (data.snapshot) {
        await tx.etbSnapshot.create({
          data: {
            etbId: data.id,
            versionNumber: data.snapshot.versionNumber,
            snapshotAt: data.snapshot.snapshotAt,
            eintraege: JSON.stringify(data.snapshot.eintraege) // Serialize
          }
        });
      }
    });
  }

  async findById(id: EtbId): Promise<EinsatztagebuchAggregate | null> {
    const prismaEtb = await this.prisma.einsatztagebuch.findUnique({
      where: { id: id.value },
      include: { eintraege: true }
    });

    return prismaEtb ? PrismaEtbMapper.toDomain(prismaEtb) : null;
  }

  async findByEinsatzId(einsatzId: EinsatzId): Promise<EinsatztagebuchAggregate | null> {
    const prismaEtb = await this.prisma.einsatztagebuch.findUnique({
      where: { einsatzId: einsatzId.value },
      include: { eintraege: true }
    });

    return prismaEtb ? PrismaEtbMapper.toDomain(prismaEtb) : null;
  }

  async getHistory(id: EtbId): Promise<EtbSnapshot[]> {
    const snapshots = await this.prisma.etbSnapshot.findMany({
      where: { etbId: id.value },
      orderBy: { versionNumber: 'asc' }
    });

    return snapshots.map(s => ({
      version: new EtbVersion(s.versionNumber, s.snapshotAt),
      eintraege: JSON.parse(s.eintraege), // Deserialize
      snapshotAt: s.snapshotAt
    }));
  }
}
```

**And** Integration-Tests validate:
- Save creates new ETB with entries
- Save creates snapshot in `etb_snapshot` table
- Version number incremented correctly
- FindByEinsatzId returns ETB with entries
- GetHistory returns all snapshots in order
- Transaction rollback on error (atomic save)

**And** Schema Migration:
```prisma
model Einsatztagebuch {
  id                  String   @id
  einsatzId           String   @unique
  status              String
  version             Int
  versionTimestamp    DateTime
  nextSequenceNumber  Int
  createdAt           DateTime
  eintraege           EtbEintrag[]
  snapshots           EtbSnapshot[]
}

model EtbEintrag {
  id              String   @id
  etbId           String
  sequenceNumber  Int
  text            String
  createdBy       String
  createdAt       DateTime
  updatedAt       DateTime?
  isDeleted       Boolean  @default(false)
  etb             Einsatztagebuch @relation(fields: [etbId], references: [id])
}

model EtbSnapshot {
  id              String   @id @default(uuid())
  etbId           String
  versionNumber   Int
  snapshotAt      DateTime
  eintraege       String   // JSON serialized
  etb             Einsatztagebuch @relation(fields: [etbId], references: [id])
}
```

**Prerequisites:**
- Story 3.1, 3.2 (Commands)
- Story 3.5 (Mapper)

**Technical Notes:**
- Use Prisma transactions for atomicity (ETB + Entries + Snapshot)
- Snapshots store full state (JSON serialized eintraege)
- Clear + re-create entries (simplicity over delta updates)
- Future optimization: Delta-based entry updates

---

## Story 3.5: ETB Infrastructure - Domain ↔ Prisma Mapper

**As a** Backend Developer,
**I want** a bidirectional mapper for ETB with versioning support,
**So that** ETB aggregates are correctly persisted and hydrated.

**Acceptance Criteria:**

**Given** EinsatztagebuchAggregate and Prisma schema exist
**When** I implement the mapper
**Then** a `PrismaEtbMapper` class exists in `infrastructure/persistence/prisma/mappers/`:

**Mapper Implementation:**
```typescript
class PrismaEtbMapper {
  static toDomain(
    prismaEtb: PrismaEinsatztagebuch & { eintraege: PrismaEtbEintrag[] }
  ): EinsatztagebuchAggregate {
    const eintraege = prismaEtb.eintraege.map(e =>
      new EtbEintrag({
        id: new EintragId(e.id),
        sequenceNumber: new EtbSequenceNumber(e.sequenceNumber),
        text: e.text,
        createdBy: new UserId(e.createdBy),
        createdAt: e.createdAt,
        updatedAt: e.updatedAt ?? undefined,
        isDeleted: e.isDeleted
      })
    );

    return new EinsatztagebuchAggregate({
      id: new EtbId(prismaEtb.id),
      einsatzId: new EinsatzId(prismaEtb.einsatzId),
      status: new EtbStatus(prismaEtb.status),
      eintraege: eintraege,
      version: new EtbVersion(prismaEtb.version, prismaEtb.versionTimestamp),
      nextSequenceNumber: prismaEtb.nextSequenceNumber,
      createdAt: prismaEtb.createdAt
      // Note: history loaded separately via getHistory()
    });
  }

  static toPersistence(aggregate: EinsatztagebuchAggregate): PrismaEtbPersistence {
    const eintraege = aggregate.eintraege.map(e => ({
      id: e.id.value,
      etbId: aggregate.id.value,
      sequenceNumber: e.sequenceNumber.value,
      text: e.text,
      createdBy: e.createdBy.value,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      isDeleted: e.isDeleted
    }));

    // Create snapshot if version changed (detected in Aggregate)
    const snapshot = aggregate.hasUncommittedSnapshot()
      ? {
          versionNumber: aggregate.version.versionNumber - 1, // Previous version
          snapshotAt: new Date(),
          eintraege: aggregate.getSnapshotData() // Serializable format
        }
      : null;

    return {
      id: aggregate.id.value,
      einsatzId: aggregate.einsatzId.value,
      status: aggregate.status.value,
      version: {
        versionNumber: aggregate.version.versionNumber,
        timestamp: aggregate.version.timestamp
      },
      nextSequenceNumber: aggregate.nextSequenceNumber,
      eintraege: eintraege,
      snapshot: snapshot,
      createdAt: aggregate.createdAt
    };
  }
}
```

**And** Unit-Tests validate:
- Bidirectional conversion (Domain → Prisma → Domain = equal)
- Sequence numbers preserved
- Version mapping correct
- Snapshot creation detection
- Soft-delete flag preserved
- No data loss in round-trip

**Prerequisites:**
- Epic 1 (Domain Layer)
- Story 3.4 (Repository)

**Technical Notes:**
- Mapper detects if snapshot needs creation (version changed)
- Snapshot data serialized to JSON in Repository
- History NOT loaded in toDomain (separate query for performance)
- EtbSequenceNumber immutable (value never changes)

---

## Story 3.6: ETB Event Handler - Auto-Create ETB on EinsatzCreated

**As a** Backend Developer,
**I want** an event handler that auto-creates ETB when Einsatz is created,
**So that** every Einsatz automatically has an ETB without manual creation.

**Acceptance Criteria:**

**Given** EinsatzCreatedEvent is published (Epic 4)
**When** I implement the event handler
**Then** an `EtbAutoCreationHandler` exists in `application/etb/event-handlers/`:

**Implementation:**
```typescript
@Injectable()
class EtbAutoCreationHandler {
  constructor(
    private commandBus: CommandBus,
    private logger: Logger
  ) {}

  @OnEvent(EinsatzCreatedEvent)
  async handle(event: EinsatzCreatedEvent): Promise<void> {
    this.logger.log(`Auto-creating ETB for Einsatz ${event.einsatzId.value}`);

    const command = new CreateEtbCommand(event.einsatzId.value);
    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      this.logger.error(`Failed to auto-create ETB: ${result.error}`);
      throw new Error(`ETB auto-creation failed: ${result.error}`);
    }

    this.logger.log(`ETB created successfully: ${result.value.value}`);
  }
}
```

**And** Integration-Tests validate:
- When Einsatz created, ETB auto-created
- ETB has einsatzId = Einsatz.id
- ETB status = DRAFT (initial)
- ETB has 0 entries (empty)
- Event handler runs asynchronously (non-blocking)
- Error logging if ETB creation fails

**And** Error handling:
- If ETB creation fails, error logged (NOT silent failure)
- Einsatz creation still succeeds (ETB creation is secondary)
- Future: Retry logic (3 attempts)

**Prerequisites:**
- Story 3.1 (CreateEtbCommand)
- Epic 4 (EinsatzCreatedEvent)

**Technical Notes:**
- Event handler is asynchronous (non-blocking)
- Uses CommandBus for consistency (same path as manual creation)
- Error logging essential (visibility for debugging)
- Future: Replace with Transactional Outbox (Epic 4) for guaranteed delivery

---

## Story 3.7: ETB Controller Refactoring

**As a** Backend Developer,
**I want** EtbController refactored to use CommandBus/QueryBus,
**So that** the controller is a thin adapter.

**Acceptance Criteria:**

**Given** Command/Query handlers exist
**When** I refactor EtbController
**Then** the controller uses CQRS:

**Example Endpoints:**
```typescript
@Controller('etb')
@ApiTags('etb')
class EtbController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus
  ) {}

  @Post(':etbId/eintrag')
  @ApiOperation({ summary: 'ETB Eintrag hinzufügen' })
  async addEintrag(
    @Param('etbId') etbId: string,
    @Body() dto: AddEintragDto,
    @CurrentUser() user: UserDto
  ): Promise<EintragDto> {
    const command = new AddEintragCommand(etbId, dto.text, user.id);
    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }

    return result.value;
  }

  @Put(':etbId/eintrag/:eintragId')
  @ApiOperation({ summary: 'ETB Eintrag aktualisieren' })
  async updateEintrag(
    @Param('etbId') etbId: string,
    @Param('eintragId') eintragId: string,
    @Body() dto: UpdateEintragDto,
    @CurrentUser() user: UserDto
  ): Promise<void> {
    const command = new UpdateEintragCommand(etbId, eintragId, dto.text, user.id);
    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }
  }

  @Post(':etbId/lock')
  @ApiOperation({ summary: 'ETB sperren (irreversibel)' })
  @UseGuards(RoleGuard) // Only ADMIN/SUPER_ADMIN
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async lock(
    @Param('etbId') etbId: string,
    @CurrentUser() user: UserDto
  ): Promise<void> {
    const command = new LockEtbCommand(etbId, user.id);
    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw new BadRequestException(result.error);
    }
  }

  @Get('einsatz/:einsatzId')
  @ApiOperation({ summary: 'ETB für Einsatz abrufen' })
  async getByEinsatzId(
    @Param('einsatzId') einsatzId: string,
    @Query('includeDeleted') includeDeleted: boolean = false
  ): Promise<EtbDto | null> {
    const query = new GetEtbQuery(einsatzId, includeDeleted);
    const result = await this.queryBus.execute(query);

    if (result.isFailure) {
      throw new NotFoundException(result.error);
    }

    return result.value;
  }

  @Get(':etbId/history')
  @ApiOperation({ summary: 'ETB Versionsverlauf abrufen' })
  async getHistory(@Param('etbId') etbId: string): Promise<EtbSnapshotDto[]> {
    const query = new GetEtbHistoryQuery(etbId);
    const result = await this.queryBus.execute(query);

    return result.value;
  }
}
```

**And** Integration-Tests validate:
- POST /etb/:id/eintrag adds entry
- PUT /etb/:id/eintrag/:entryId updates entry
- DELETE /etb/:id/eintrag/:entryId soft-deletes entry
- POST /etb/:id/lock locks ETB (ADMIN only)
- GET /etb/einsatz/:id returns ETB
- GET /etb/:id/history returns snapshots

**Prerequisites:**
- Stories 3.1-3.5

**Technical Notes:**
- RoleGuard for lock endpoint (ADMIN/SUPER_ADMIN only)
- includeDeleted query param for audit use-case
- OpenAPI decorators for API client generation

---

## Story 3.8: Frontend - ETB Component Updates

**As a** Frontend Developer,
**I want** ETB components updated to use the new API,
**So that** the Frontend displays ETB data correctly.

**Acceptance Criteria:**

**Given** Backend API changed
**When** I update Frontend
**Then** the following completed:

**1. API Client Regeneration (1h)**
```bash
pnpm run generate-api
```

**2. TanStack Query Hooks (2-3h)**

Create `src/hooks/etb/useEtb.ts`:
```typescript
const useEtb = (einsatzId: string, includeDeleted = false) => {
  return useQuery({
    queryKey: ['etb', einsatzId, includeDeleted],
    queryFn: () => api.etb.getByEinsatzId(einsatzId, includeDeleted)
  });
};

const useAddEintrag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ etbId, text }: AddEintragDto) =>
      api.etb.addEintrag(etbId, { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['etb'] });
    }
  });
};
```

**3. Component Updates (1-2h)**

Update components:
- `EtbViewer.tsx` - Display entries with sequence numbers
- `EintragForm.tsx` - Add/edit entry form
- `EtbHistoryModal.tsx` - Show versioning history
- `EtbLockButton.tsx` - Lock ETB (ADMIN only)

**And** Manual Testing:
- ETB auto-created when Einsatz created
- Entries can be added/edited/deleted
- Sequence numbers displayed
- Lock button disabled after locking
- History modal shows snapshots

**Prerequisites:**
- Story 3.7 (Backend API)

**Technical Notes:**
- Sequence numbers displayed in UI (e.g., "#1", "#2")
- Lock confirmation modal (irreversible action)
- Deleted entries styled differently (strikethrough)

---

## Story 3.9: ETB Migration - Integration Tests

**As a** Backend Developer,
**I want** comprehensive integration tests for ETB migration,
**So that** versioning and event-driven auto-creation are validated.

**Acceptance Criteria:**

**Given** ETB migration complete
**When** I implement integration tests
**Then** the following tests exist:

**Tests:**
```typescript
describe('ETB Migration - E2E', () => {
  it('should auto-create ETB when Einsatz created', async () => {
    const einsatz = await createEinsatz({ alarmstichwort: 'Test' });

    // Wait for async event handler
    await waitFor(() =>
      expect(api.etb.getByEinsatzId(einsatz.id)).resolves.toBeDefined()
    );

    const etb = await api.etb.getByEinsatzId(einsatz.id);
    expect(etb.status).toBe('DRAFT');
    expect(etb.eintraege).toHaveLength(0);
  });

  it('should create snapshot before entry update', async () => {
    const etb = await createEtbWithEntry('Initial text');

    await api.etb.updateEintrag(etb.id, etb.eintraege[0].id, { text: 'Updated' });

    const history = await api.etb.getHistory(etb.id);
    expect(history).toHaveLength(1); // One snapshot
    expect(history[0].eintraege[0].text).toBe('Initial text');
  });

  it('should prevent mutations after lock', async () => {
    const etb = await createEtb();

    await api.etb.lock(etb.id);

    await expect(
      api.etb.addEintrag(etb.id, { text: 'Fail' })
    ).rejects.toThrow('ETB is locked');
  });

  it('should soft-delete entries', async () => {
    const etb = await createEtbWithEntry('Delete me');

    await api.etb.deleteEintrag(etb.id, etb.eintraege[0].id);

    const updated = await api.etb.getByEinsatzId(etb.einsatzId, false);
    expect(updated.eintraege).toHaveLength(0); // Excluded

    const withDeleted = await api.etb.getByEinsatzId(etb.einsatzId, true);
    expect(withDeleted.eintraege).toHaveLength(1); // Included
    expect(withDeleted.eintraege[0].isDeleted).toBe(true);
  });
});
```

**And** Performance Tests:
- Snapshot creation doesn't slow down mutations (< +10ms overhead)
- History retrieval for 100 snapshots < 200ms

**Prerequisites:**
- All Stories 3.1-3.8 complete

**Technical Notes:**
- Integration tests use real database
- Async event handler tested with `waitFor` pattern
- Rollback plan same as Epic 2

---
