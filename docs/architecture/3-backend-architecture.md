# 3. Backend Architecture

## Module Structure (ACTUAL)

Das Backend besteht aus **7 funktionalen Modulen** (nicht die 8+ in arc42 beschriebenen):

```
packages/backend/src/
├── auth/                    # Authentifizierung (Unified Auth)
├── einsatz/                 # Einsatzmanagement
├── etb/                     # Einsatztagebuch
├── user-management/         # Benutzerverwaltung
├── modules/
│   └── lagekarte/          # Lagekarten-Management
├── health/                  # Health Checks
├── config/                  # Konfiguration
├── common/                  # Shared utilities
├── prisma/                  # Prisma client
├── cli/                     # CLI-Tools
├── utils/                   # Helper functions
└── websocket/              # WebSocket (leer, nicht implementiert)
```

**Fehlende Module aus arc42:**
- ❌ Ressource Module (Personal, Fahrzeuge, Material)
- ❌ Dashboard Module (nur Frontend)
- ❌ Digitalfunk Integration
- ❌ Kommunikation Module

## API Design

### Versioning Strategy

- **VERSION_NEUTRAL:** `/api/{endpoint}` für Auth, Health, Root
- **Alpha Version:** `/api/alpha/{resource}` für Domain-Endpunkte

### Authentication Pattern

**3-Token Cookie-basiertes JWT System:**

1. **Access Token:** Short-lived, für API-Zugriff
2. **Refresh Token:** Long-lived, für Token-Erneuerung
3. **Admin Token:** Für administrative Operationen

**Cookie Settings:**
- `httpOnly: true` (XSS-Schutz)
- `secure: true` (nur HTTPS in Production)
- `sameSite: 'strict'` (CSRF-Schutz)

**Guards:**
- `@UseGuards(JwtAuthGuard)` - Standard-Auth
- `@UseGuards(AdminJwtAuthGuard)` - Admin-Auth
- `@UseGuards(JwtRefreshGuard)` - Refresh-Auth

### Rate Limiting

**Throttle Guards auf kritischen Endpunkten:**
- `/api/auth/unified`: 5 Requests / Minute
- Controller-Level: Konfigurierbar via `@Throttle()`
- Service-Level: Zusätzliche Limits

### Response Format

**Automatic Response Wrapping via Interceptor:**

```typescript
// Original Service Response
{ id: '123', name: 'Test' }

// Wrapped API Response
{
  data: { id: '123', name: 'Test' },
  statusCode: 200,
  timestamp: '2025-01-11T...'
}
```

## API Endpoints (54 Total)

### Authentication (VERSION_NEUTRAL)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/unified` | Unified login & auto-register | No |
| POST | `/api/auth/logout` | Logout (clear cookies) | Yes |
| POST | `/api/auth/refresh` | Refresh access token | Refresh |
| GET | `/api/auth/validate` | Validate current token | Yes |

### User Management (/api/alpha/users)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/users` | List all users | Admin |
| GET | `/api/alpha/users/:id` | Get user by ID | Admin |
| POST | `/api/alpha/users` | Create user | Admin |
| PATCH | `/api/alpha/users/:id` | Update user | Admin |
| DELETE | `/api/alpha/users/:id` | Soft-delete user | Admin |
| POST | `/api/alpha/users/:id/lock` | Lock user | Admin |
| POST | `/api/alpha/users/:id/unlock` | Unlock user | Admin |

### Einsatz Management (/api/alpha/einsaetze)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/einsaetze` | List all missions | Yes |
| GET | `/api/alpha/einsaetze/:id` | Get mission by ID | Yes |
| POST | `/api/alpha/einsaetze` | Create mission (minimal) | Yes |
| PATCH | `/api/alpha/einsaetze/:id` | Update mission | Yes |
| DELETE | `/api/alpha/einsaetze/:id` | Archive mission (no delete) | Yes |
| POST | `/api/alpha/einsaetze/:id/archive` | Explicit archive | Yes |

### Einsatztagebuch (/api/alpha/einsatztagebuch)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/einsatztagebuch` | List all ETBs | Yes |
| GET | `/api/alpha/einsatztagebuch/:id` | Get ETB by ID | Yes |
| POST | `/api/alpha/einsatztagebuch` | Create ETB | Yes |
| PATCH | `/api/alpha/einsatztagebuch/:id` | Update ETB | Yes |
| POST | `/api/alpha/einsatztagebuch/:id/lock` | Lock ETB | Yes |

### ETB Einträge (/api/alpha/etb-eintraege)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/etb-eintraege` | List entries | Yes |
| GET | `/api/alpha/etb-eintraege/:id` | Get entry by ID | Yes |
| POST | `/api/alpha/etb-eintraege` | Create entry | Yes |
| PATCH | `/api/alpha/etb-eintraege/:id` | Update entry (creates version) | Yes |
| DELETE | `/api/alpha/etb-eintraege/:id` | Soft-delete entry | Yes |
| GET | `/api/alpha/etb-eintraege/:id/historie` | Get version history | Yes |

### ETB Textbausteine (/api/alpha/textbausteine)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/textbausteine` | List templates | Yes |
| GET | `/api/alpha/textbausteine/:id` | Get template by ID | Yes |
| POST | `/api/alpha/textbausteine` | Create template | Yes |
| PATCH | `/api/alpha/textbausteine/:id` | Update template | Yes |
| DELETE | `/api/alpha/textbausteine/:id` | Soft-delete template | Yes |

### Lagekarte (/api/alpha/lagekarten)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/lagekarten` | List all maps | Yes |
| GET | `/api/alpha/lagekarten/:id` | Get map by ID | Yes |
| POST | `/api/alpha/lagekarten` | Create map | Yes |
| PATCH | `/api/alpha/lagekarten/:id` | Update map | Yes |
| DELETE | `/api/alpha/lagekarten/:id` | Delete map | Yes |

### Lagekarte POIs (/api/alpha/lagekarten/:id/pois)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/lagekarten/:id/pois` | List POIs | Yes |
| POST | `/api/alpha/lagekarten/:id/pois` | Create POI | Yes |
| PATCH | `/api/alpha/lagekarten/:id/pois/:poiId` | Update POI | Yes |
| DELETE | `/api/alpha/lagekarten/:id/pois/:poiId` | Delete POI | Yes |

### Geocoding (/api/alpha/geocoding)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/geocoding/search` | Search by address | Yes |
| GET | `/api/alpha/geocoding/reverse` | Reverse geocode | Yes |

### Health Checks (VERSION_NEUTRAL)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Overall health | No |
| GET | `/api/health/liveness` | Liveness probe | No |
| GET | `/api/health/readiness` | Readiness probe | No |

### Root Meta (VERSION_NEUTRAL)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | API metadata | No |

## Data Layer

### ORM & Database

- **ORM:** Prisma 6.19.0
- **Database:** PostgreSQL 17
- **Migration Strategy:** Prisma Migrate with SQL migrations
- **ID Generation:** `cuid()` (primary)

### Data Models (9 Models)

1. **User** - Benutzerverwaltung mit Soft-Delete und Lock
2. **Einsatz** - Einsätze mit No-Delete Policy
3. **Einsatztagebuch** - 1:1 Beziehung zu Einsatz
4. **EtbEintrag** - Versionierte Einträge
5. **EtbEintragHistorie** - Vollständige Versionshistorie
6. **EtbTextbaustein** - Wiederverwendbare Textbausteine
7. **EtbArchiv** - 10-Jahre-Archivierung mit SHA-256
8. **Lagekarte** - 1:1 Beziehung zu Einsatz
9. **LagekartePoi** - Geografische POIs

### Key Patterns

**No-Delete Policy (Einsätze):**
- Einsätze werden NIEMALS physisch gelöscht
- Stattdessen: Archivierung mit `archivedAt`, `archivedBy`
- Status-Transition: `ANGELEGT` → `IN_BEARBEITUNG` → `ABGESCHLOSSEN` → `ARCHIVIERT`

**Soft-Delete (Users, ETB Entries):**
- `isDeleted: boolean`, `deletedAt: DateTime`, `deletedBy: String`
- Queries filtern automatisch gelöschte Einträge

**Full Audit Logging:**
- **Created:** `createdAt`, `createdBy` (auf allen Entitäten)
- **Updated:** `updatedAt`, `updatedBy` (auf allen Entitäten)
- **Deleted:** `deletedAt`, `deletedBy` (Soft-Delete)
- **Archived:** `archivedAt`, `archivedBy` (Einsätze)
- **Locked:** `lockedAt`, `lockedBy` (ETB)

**Version History (ETB Entries):**
- Jede Änderung erstellt einen neuen `EtbEintragHistorie`-Eintrag
- Historie enthält: `modifiedAt`, `modifiedBy`, `changes` (JSON)
- Vollständige Nachvollziehbarkeit aller Änderungen

**10-Year Archival (ETB):**
- `EtbArchiv` speichert vollständigen ETB-Snapshot
- SHA-256 Checksum für Integrität
- Compliance-konform für DRK-Anforderungen

## Security Architecture

### Authentication Flow

```
1. POST /api/auth/unified { username, password }
   ↓
2. Backend prüft Credentials (oder erstellt User bei Auto-Register)
   ↓
3. Generiere JWT Tokens:
   - Access Token (15min)
   - Refresh Token (7d)
   - Admin Token (falls Admin-Rolle)
   ↓
4. Setze HTTP-Only Cookies
   ↓
5. Return User-Objekt
```

### Token Refresh Flow

```
1. Access Token abgelaufen (401)
   ↓
2. Frontend: POST /api/auth/refresh (mit Refresh Token Cookie)
   ↓
3. Backend validiert Refresh Token
   ↓
4. Generiere neues Access Token
   ↓
5. Setze neues Access Token Cookie
   ↓
6. Retry original request
```

### Role-Based Access Control (RBAC)

**3 Rollen (NICHT die arc42-beschriebenen Admin/Koordinator/Mitglied):**

| Role | Permissions | Guards |
|------|-------------|--------|
| **USER** | Basic access, CRUD Einsätze/ETB/Lagekarte | `@UseGuards(JwtAuthGuard)` |
| **ADMIN** | User management, System config | `@UseGuards(AdminJwtAuthGuard)` |
| **SUPER_ADMIN** | Full system access | `@UseGuards(AdminJwtAuthGuard)` |

**Permission Guards:**
- `JwtAuthGuard` - Validiert Access Token
- `AdminJwtAuthGuard` - Validiert Admin Token
- `JwtRefreshGuard` - Validiert Refresh Token

### Security Features

- **JWT Tokens:** Secure, stateless authentication
- **HTTP-Only Cookies:** XSS-Schutz
- **SameSite Cookies:** CSRF-Schutz
- **Helmet Middleware:** Security headers
- **Rate Limiting:** Throttle Guards auf kritischen Endpunkten
- **Audit Logging:** Vollständige Nachvollziehbarkeit aller Änderungen
- **Soft-Delete:** Daten werden nicht physisch gelöscht
- **Password Hashing:** Bcrypt (nur für Admin-User)

## Testing Architecture

### E2E Test Infrastructure Pattern

Das Backend nutzt **End-to-End Integration Tests** gegen eine echte PostgreSQL Datenbank, um das vollständige Zusammenspiel aller Layer (Domain, Application, Infrastructure) zu validieren.

**Test-Strategie:**
- **Real Database:** PostgreSQL 17 (KEINE Mocks!)
- **Direct Handler Invocation:** CQRS Handlers direkt aufrufen
- **Given-When-Then BDD:** Strukturierter Test-Stil
- **RBAC Testing:** Alle 3 User-Rollen (USER, ADMIN, SUPER_ADMIN)
- **Outbox Pattern:** Event Publishing Verification
- **Performance Baselines:** Kritische Operationen monitoren

### Core Test Patterns

#### 1. EinsatzE2eTestContext Pattern

Zentrale Test-Context Factory für isolierte Test-Umgebungen:

```typescript
interface EinsatzE2eTestContext {
  prisma: TestPrismaService;
  repository: PrismaEinsatzRepository;
  outboxRepository: PrismaOutboxRepository;
  eventPublisher: SpyEventPublisher;
  testUserIds: {
    user: string;        // CUID2 für USER Rolle
    admin: string;       // CUID2 für ADMIN Rolle
    superAdmin: string;  // CUID2 für SUPER_ADMIN Rolle
  };
  testRunId: string;     // Unique Timestamp für Test Isolation
}

// Setup in beforeAll
const ctx = await createEinsatzE2eModule();
```

**Was passiert intern:**
1. PrismaClient für Test-DB erstellen
2. Alte Test-Daten aufräumen (> 1 Stunde)
3. Drei Test User anlegen (USER, ADMIN, SUPER_ADMIN)
4. Repository und SpyEventPublisher instanzieren
5. Outbox Repository initialisieren

#### 2. SpyEventPublisher Pattern

Mock-Implementation von `IEventPublisher` für Event-Verification ohne echtes Publishing:

```typescript
// Events publishen (automatisch durch Repository)
await ctx.repository.save(aggregate);

// Events abrufen und verifizieren
const events = ctx.eventPublisher.getEventsByName('einsatz.created');
expect(events).toHaveLength(1);
expect(events[0].payload.alarmstichwort).toBe('Brand');

// Events zwischen Tests clearen
ctx.eventPublisher.clear();
```

**Use Cases:**
- Domain Event Emission verifizieren
- Event Payload validieren
- Event Handler Integration testen
- Outbox Pattern Integration prüfen

#### 3. SQL Trigger Management Pattern

**Problem:** PostgreSQL Triggers blockieren physisches DELETE (DRK Compliance).
**Lösung:** `session_replication_role` für Test-Cleanup:

```typescript
// Trigger temporär deaktivieren
await ctx.prisma.$executeRawUnsafe('SET session_replication_role = replica;');

try {
  // DELETE-Operationen ausführen
  await ctx.prisma.$executeRawUnsafe('DELETE FROM einsaetze WHERE ...');
} finally {
  // IMMER re-enablen!
  await ctx.prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
}
```

**Wichtig:**
- In Produktion NIEMALS `session_replication_role` ändern!
- Pattern ist in `cleanupTestData()` und `teardownE2eModule()` automatisch implementiert
- Constants: `DISABLE_TRIGGERS_SQL`, `ENABLE_TRIGGERS_SQL`

#### 4. waitFor() Utility Pattern

Polling-basierte asynchrone Assertions für Event Handler:

```typescript
// Event Handler läuft asynchron
await createHandler.execute(command);

// Warten bis Event im Publisher erscheint
await waitFor(async () => {
  const events = ctx.eventPublisher.getEventsByName('einsatz.created');
  expect(events).toHaveLength(1);
}, 500, 50); // 500ms timeout, 50ms interval
```

**Use Cases:**
- Event Handler Verification
- Outbox Event Persistence warten
- Asynchrone Side-Effects prüfen

### Integration Test Patterns

#### Outbox Pattern Validation

Testen der atomaren Event-Persistierung und Retry-Logic:

```typescript
// AC1.1: Einsatz-Events werden in Outbox persistiert
const result = await createHandler.execute(command);
const outboxEvents = await ctx.outboxRepository.findPendingEvents(10);
expect(outboxEvents).toContainEqual(
  expect.objectContaining({
    eventName: 'einsatz.created',
    status: 'PENDING',
    aggregateId: result.value!,
  })
);

// AC1.4: Retry Mechanism
await ctx.outboxRepository.markAsFailed(eventId, 'Network Error');
const failedEvent = await ctx.outboxRepository.findById(eventId);
expect(failedEvent!.retryCount).toBe(1);
```

#### NO-DELETE Policy Testing

Validierung der Domain-Invariante gegen PostgreSQL Trigger:

```typescript
// AC2.1: DELETE-Operationen werden blockiert
await expect(
  ctx.prisma.einsatz.delete({ where: { id: einsatzId } })
).rejects.toThrow('DELETE operations are not allowed');

// AC2.2: Soft-Delete Flag wird verwendet
const command = ArchiveEinsatzCommand.create(einsatzId, userId).value!;
await archiveHandler.execute(command);

const archived = await ctx.repository.findById(einsatzId);
expect(archived!.archivedAt).toBeDefined();
expect(archived!.status.value).toBe('ARCHIVIERT');
```

#### RBAC Constraint Testing

Multi-User Authorization Tests:

```typescript
// AC3.1: USER kann nur eigene Einsätze ändern
const einsatzId = await createTestEinsatz(ctx, {
  createdBy: ctx.testUserIds.admin,
});

const userCommand = UpdateEinsatzCommand.create({
  id: einsatzId,
  einsatzort: 'Neue Adresse',
}, ctx.testUserIds.user).value!;

const result = await updateHandler.execute(userCommand);
expect(result.isFailure).toBe(true);
expect(result.error).toContain('Unauthorized');

// AC3.2: ADMIN kann alle Einsätze ändern
const adminCommand = UpdateEinsatzCommand.create({
  id: einsatzId,
  einsatzort: 'Neue Adresse',
}, ctx.testUserIds.admin).value!;

const adminResult = await updateHandler.execute(adminCommand);
expect(adminResult.isSuccess).toBe(true);
```

#### HTTP Integration Testing

Controller-Level Tests mit NestJS TestingModule:

```typescript
// AC5.1: REST Endpoints funktionieren
const response = await request(app.getHttpServer())
  .post('/api/alpha/einsaetze')
  .set('Cookie', authCookie)
  .send({ alarmstichwort: 'Brand' })
  .expect(201);

expect(response.body).toMatchObject({
  data: expect.objectContaining({
    id: expect.any(String),
    alarmstichwort: 'Brand',
  }),
  statusCode: 201,
});

// AC5.2: Authentication via JWT
await request(app.getHttpServer())
  .get('/api/alpha/einsaetze')
  .expect(401); // Ohne Cookie
```

### Performance Baseline Testing

Kritische Operationen mit festgelegten Thresholds:

| Operation | Baseline | Tolerance | Test Threshold | AC |
|-----------|----------|-----------|----------------|-----|
| List Active Einsätze | 50ms | ±10% | 55ms | AC4.1 |
| Get Einsatz Details | 80ms | ±10% | 88ms | AC4.2 |
| Create Einsatz | 150ms | ±10% | 165ms | AC4.3 |
| Combined Query Overhead | - | - | <50ms | AC4.4 |

**Test Pattern:**

```typescript
const start = performance.now();
await getActiveHandler.execute(query);
const duration = performance.now() - start;

expect(duration).toBeLessThan(55); // AC4.1
```

**Hinweis:** Baselines sind Guidelines, keine Hard Limits. CI/CD Pipeline kann langsamer sein.

### Test Lifecycle Hooks

**Setup Pattern (beforeAll):**
```typescript
let ctx: EinsatzE2eTestContext;

beforeAll(async () => {
  ctx = await createEinsatzE2eModule();
  // - DB-Verbindung erstellen
  // - Test-User anlegen
  // - Repositories instanzieren
});
```

**Cleanup Pattern (afterEach):**
```typescript
afterEach(async () => {
  await cleanupTestData(ctx);
  // - Einsatz-Daten löschen (Lagekarten, ETB, Outbox, Einsätze)
  // - Users behalten für weitere Tests
  // - EventPublisher Spy clearen
});
```

**Teardown Pattern (afterAll):**
```typescript
afterAll(async () => {
  await teardownE2eModule(ctx);
  // - ALLE Test-Daten löschen (inkl. Users)
  // - DB-Verbindung schließen
  // - Cleanup mit disabled Triggers
});
```

### Test Helper Functions

| Helper | Verwendung |
|--------|------------|
| `generateTestId()` | CUID2-Format IDs für alle Entity Types |
| `createTestEinsatz(ctx, options?)` | Test-Einsatz mit Custom-Properties erstellen |
| `createTestUser(ctx, role, username?)` | Zusätzlichen Test-User anlegen |
| `createTestOutboxEvent(ctx, options?)` | Test-Outbox-Event erstellen |
| `cleanupEinsatzById(ctx, einsatzId)` | Spezifischen Einsatz mit Dependencies löschen |
| `waitFor(assertion, timeout?, interval?)` | Asynchrone Assertions pollen |

### Test Coverage

**Implementierte Test-Suites:**

| Test File | Acceptance Criteria | Beschreibung |
|-----------|-------------------|--------------|
| `outbox-integration.e2e.spec.ts` | AC1.1-1.7 | Outbox Pattern & Event Publishing |
| `no-delete-policy.e2e.spec.ts` | AC2.1-2.5 | NO-DELETE Policy Enforcement |
| `rbac-constraints.e2e.spec.ts` | AC3.1-3.4 | RBAC Authorization Tests |
| `einsatz-performance.e2e.spec.ts` | AC4.1-4.4 | Performance Baselines |
| `einsatz-controller.e2e.spec.ts` | AC5.1, 5.3, 5.4 | HTTP REST Integration |
| `auth-controller.e2e.spec.ts` | AC5.2 | Authentication HTTP Integration |

**Weitere Details:** `/packages/backend/src/infrastructure/einsatz/__tests__/README.md`

---
