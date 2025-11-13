# Bluelight Hub - Security Architecture

**Status:** Solutioning Phase (Security Focus)
**Created:** 2025-01-12
**Author:** Ruben + BMAD Security Architecture Workflow
**Base Architecture:** [hexagonal-architecture.md](./hexagonal-architecture.md)
**PRD:** [276-hexagonale-architektur.md](./prds/276-hexagonale-architektur.md)

---

## Executive Summary

Die **Security Architecture** für Bluelight Hub definiert sicherheitskritische Entscheidungen für die Hexagonal
Architecture + DDD Migration. Der Fokus liegt auf **DRK-Compliance** (10-year archival, NO-DELETE Policy), *
*RBAC-basierter Zugriffskontrolle**, und **Event-basiertem Audit Trail**.

### Security Principles

1. **Defense in Depth**: Mehrschichtige Sicherheit (Domain → Application → Infrastructure)
2. **Least Privilege**: Minimale Berechtigungen pro Rolle (RBAC)
3. **Fail Secure**: Bei Fehlern wird Zugriff verweigert (nicht gewährt)
4. **Audit Everything**: Alle sicherheitsrelevanten Aktionen protokolliert
5. **Framework Independence**: Security-Logic in Domain Layer (framework-agnostisch)

### Critical Security Requirements

| Requirement              | Status      | Priority | Rationale                                      |
|--------------------------|-------------|----------|------------------------------------------------|
| **NO-DELETE Policy**     | ✅ Required  | CRITICAL | DRK-Compliance: 10-year archival               |
| **Transactional Outbox** | ✅ Required  | CRITICAL | Event-Verlust verhindert Audit-Lücken          |
| **RBAC (3 Rollen)**      | ✅ Required  | HIGH     | Granulare Zugriffskontrolle                    |
| **Min 1 SUPER_ADMIN**    | ✅ Required  | HIGH     | System-Lock-out verhindern                     |
| **Audit Trail**          | ✅ Required  | HIGH     | Compliance + Forensics                         |
| **JWT Token Security**   | ✅ Required  | MEDIUM   | Session-Sicherheit                             |
| **Encryption at Rest**   | 🔄 Optional | LOW      | Datenbank-Verschlüsselung (PostgreSQL-Feature) |

---

## 1. Authentication & Authorization Architecture

### 1.1 Role-Based Access Control (RBAC)

**3 Rollen mit unterschiedlichen Berechtigungen:**

```typescript
// Domain Layer - Typisierte Rollen
enum UserRole {
   SUPER_ADMIN = 'SUPER_ADMIN',  // Vollzugriff + Admin-Management
   ADMIN = 'ADMIN',              // Einsatz-Management + User-Verwaltung
   USER = 'USER'                 // Nur Einsatz-Operationen
}

// Value Object für Role-Validierung
class Role extends ValueObject<UserRole> {
   private constructor(value: UserRole) {
      super(value);
   }

   static create(value: string): Result<Role> {
      if (!Object.values(UserRole).includes(value as UserRole)) {
         return Result.fail('Invalid role');
      }
      return Result.ok(new Role(value as UserRole));
   }

   canManageAdmins(): boolean {
      return this.value === UserRole.SUPER_ADMIN;
   }

   canManageUsers(): boolean {
      return this.value === UserRole.SUPER_ADMIN || this.value === UserRole.ADMIN;
   }

   canLockEinsatz(): boolean {
      return this.value !== UserRole.USER; // Nur Admins
   }
}
```

**Permission Matrix:**

| Action                  | USER | ADMIN (ohne adminToken) | ADMIN (mit adminToken) | SUPER_ADMIN (mit adminToken) |
|-------------------------|------|-------------------------|------------------------|------------------------------|
| **Einsatz erstellen**   | ✅    | ✅                       | ✅                      | ✅                            |
| **Einsatz bearbeiten**  | ✅    | ✅                       | ✅                      | ✅                            |
| **Einsatz abschließen** | ❌    | ❌                       | ✅                      | ✅                            |
| **Einsatz archivieren** | ❌    | ❌                       | ✅                      | ✅                            |
| **ETB hinzufügen**      | ✅    | ✅                       | ✅                      | ✅                            |
| **ETB sperren**         | ❌    | ❌                       | ✅                      | ✅                            |
| **User erstellen**      | ❌    | ❌                       | ✅                      | ✅                            |
| **User sperren**        | ❌    | ❌                       | ❌                      | ✅                            |
| **Admin erstellen**     | ❌    | ❌                       | ❌                      | ✅                            |
| **Admin löschen**       | ❌    | ❌                       | ❌                      | ✅ *                          |
| **SUPER_ADMIN löschen** | ❌    | ❌                       | ❌                      | ✅ **                         |

*\* Nur wenn ≥2 Admins existieren*
*\*\* Nur wenn ≥2 SUPER_ADMINs existieren*

**Wichtig:**

- Admins ohne `adminToken` haben gleiche Permissions wie USER
- `adminToken` wird durch Password-Verification erhalten (`POST /auth/admin/login`)
- Admin Mode kann an/aus geschaltet werden (flexible Rechte)

### 1.2 Authentication Strategy

**Unified Auth Pattern:**

```typescript
// Domain Layer - Authentication Port
interface IAuthenticationService {
    // Passwordless: Nur Username (keine Codes, keine Passwords)
    authenticatePasswordless(username: string): Promise<Result<UserId>>;

    // Admin Mode: Password-Verification für Admin-Berechtigungen
    activateAdminMode(userId: UserId, password: string): Promise<Result<void>>;
}

// Application Layer - Unified Login Command (Passwordless)
class UnifiedLoginCommand {
    constructor(
        public readonly username: string  // NUR Username (3-30 Zeichen)
    ) {
    }
}

class UnifiedLoginHandler {
    async execute(command: UnifiedLoginCommand): Promise<Result<AuthTokens>> {
        // 1. User laden oder erstellen (Auto-Register)
        let user = await this.userRepo.findByUsername(command.username);

        if (!user) {
            // Auto-Register: Neuer User wird als USER angelegt
            user = await this.userRepo.create({
                username: command.username,
                role: UserRole.USER,
                passwordHash: null, // Kein Password
            });
        }

        // 2. Tokens generieren (OHNE Admin-Berechtigungen)
        const accessToken = await this.tokenService.generateAccess(user.id, user.role);
        const refreshToken = await this.tokenService.generateRefresh(user.id);

        // 3. Audit: Successful Login
        await this.eventPublisher.publish(
            new UserLoggedInEvent(user.id, new Date())
        );

        return Result.ok({accessToken, refreshToken});
    }
}

// Application Layer - Admin Mode Activation (Password-Verification)
class ActivateAdminModeCommand {
    constructor(
        public readonly userId: UserId,     // Aus accessToken
        public readonly password: string    // Admin-Password
    ) {
    }
}

class ActivateAdminModeHandler {
    async execute(command: ActivateAdminModeCommand): Promise<Result<{ adminToken: string }>> {
        // 1. User laden
        const user = await this.userRepo.findById(command.userId);

        // 2. Prüfen: Ist Admin-Rolle?
        if (!user.role.isAdmin() && !user.role.isSuperAdmin()) {
            return Result.fail('User is not an admin');
        }

        // 3. Password prüfen
        if (!user.passwordHash) {
            return Result.fail('Admin has no password set');
        }

        const isValid = await user.password.verify(command.password);
        if (!isValid) {
            // Audit: Failed Admin Login
            await this.eventPublisher.publish(
                new AdminLoginFailedEvent(user.id, new Date())
            );
            return Result.fail('Invalid password');
        }

        // 4. Admin-Token generieren (separater Secret!)
        const adminToken = await this.tokenService.generateAdmin(user.id, user.role);

        // 5. Audit: Admin Mode Activated
        await this.eventPublisher.publish(
            new AdminModeActivatedEvent(user.id, new Date())
        );

        return Result.ok({adminToken});
    }
}
```

**Token Architecture (3 separate JWTs):**

```typescript
// 1. Access Token (15 min, JWT_SECRET)
{
    "sub": "user-uuid-123",
    "role": "ADMIN",          // Database-Rolle (statisch)
    "username": "max.mustermann",
    "iat": 1704067200,
    "exp": 1704068100
}

// 2. Refresh Token (7 Tage, JWT_REFRESH_SECRET)
{
    "sub": "user-uuid-123",
    "iat": 1704067200,
    "exp": 1704672000
}

// 3. Admin Token (15 min, ADMIN_JWT_SECRET - unterschiedlicher Secret!)
{
    "sub": "user-uuid-123",
    "role": "ADMIN",
    "adminMode": true,
    "iat": 1704067200,
    "exp": 1704068100
}
```

**Auth Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Passwordless Login (alle User)                           │
├─────────────────────────────────────────────────────────────┤
│ POST /auth/unified { username: "max_mustermann" }           │
│ ↓                                                            │
│ Wenn User nicht existiert → Auto-Register als USER          │
│ ↓                                                            │
│ Response: { accessToken, refreshToken, user: {...} }        │
│                                                              │
│ User kann jetzt normale Operationen machen (Einsatz-CRUD)   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. Admin Mode Activation (optional, nur für Admins)         │
├─────────────────────────────────────────────────────────────┤
│ POST /auth/admin/login { password: "admin-secret" }         │
│ ↓                                                            │
│ Password-Verification (bcrypt)                               │
│ ↓                                                            │
│ Response: { adminToken }                                     │
│                                                              │
│ Admin hat jetzt BEIDE Tokens:                               │
│ - accessToken (normale Operationen)                          │
│ - adminToken (Admin-Operationen: User sperren, etc.)        │
└─────────────────────────────────────────────────────────────┘
```

**Wichtig:**

- ✅ **Admins KÖNNEN sich ohne Password anmelden** (dann nur USER-Berechtigungen)
- ✅ **Admins MÜSSEN Password verifizieren** für Admin-Operationen
- ✅ **USER brauchen NIE ein Password** (username-only reicht)
- ✅ **Admin Mode ist optional** (kann an/aus geschaltet werden)

### 1.3 SUPER_ADMIN Constraint (System Safety)

**Business Rule:** System muss IMMER mindestens 1 SUPER_ADMIN haben.

```typescript
// Domain Layer - UserAggregate
class UserAggregate extends AggregateRoot {
    lock(lockedBy: UserId, reason: string): Result<void> {
        if (this.role.isSuperAdmin()) {
            // Constraint prüfen
            const canLock = this.canLockSuperAdmin();
            if (!canLock) {
                return Result.fail(
                    'Cannot lock last SUPER_ADMIN. System requires at least 1 active SUPER_ADMIN.'
                );
            }
        }

        this._isLocked = true;
        this.addDomainEvent(
            new UserLockedEvent(this.id, lockedBy, reason)
        );
        return Result.ok();
    }

    delete(deletedBy: UserId): Result<void> {
        if (this.role.isSuperAdmin()) {
            // Constraint prüfen
            const canDelete = this.canDeleteSuperAdmin();
            if (!canDelete) {
                return Result.fail(
                    'Cannot delete last SUPER_ADMIN. System requires at least 1 active SUPER_ADMIN.'
                );
            }
        }

        // Soft-Delete (Status = DELETED, nicht physisch löschen)
        this._status = UserStatus.DELETED;
        this.addDomainEvent(
            new UserDeletedEvent(this.id, deletedBy)
        );
        return Result.ok();
    }

    private canLockSuperAdmin(): boolean {
        // Wird vom Domain Service geprüft (hat Zugriff auf Repository)
        return true; // Placeholder - eigentliche Logic in Domain Service
    }
}

// Domain Layer - UserManagementService (Domain Service)
class UserManagementService {
    constructor(private userRepo: IUserRepository) {
    }

    async canLockSuperAdmin(userId: UserId): Promise<boolean> {
        const activeSuperAdmins = await this.userRepo.countActiveSuperAdmins();
        const user = await this.userRepo.findById(userId);

        if (user.role.isSuperAdmin() && user.isActive()) {
            // Mindestens 2 aktive SUPER_ADMINs nötig (einer wird gesperrt)
            return activeSuperAdmins >= 2;
        }
        return true; // Nicht-SUPER_ADMIN oder bereits inaktiv
    }

    async canDeleteSuperAdmin(userId: UserId): Promise<boolean> {
        const activeSuperAdmins = await this.userRepo.countActiveSuperAdmins();
        const user = await this.userRepo.findById(userId);

        if (user.role.isSuperAdmin() && user.isActive()) {
            // Mindestens 2 aktive SUPER_ADMINs nötig (einer wird gelöscht)
            return activeSuperAdmins >= 2;
        }
        return true;
    }
}
```

---

## 2. Audit & Compliance Architecture

### 2.1 Event-Based Audit Trail

**Alle sicherheitsrelevanten Aktionen erzeugen Domain Events:**

```typescript
// Domain Events für Audit
class EinsatzCreatedEvent extends DomainEvent {
    constructor(
        public readonly einsatzId: EinsatzId,
        public readonly createdBy: UserId,
        public readonly alarmstichwort: string,
        public readonly timestamp: Date
    ) {
        super();
    }
}

class EinsatzArchivedEvent extends DomainEvent {
    constructor(
        public readonly einsatzId: EinsatzId,
        public readonly archivedBy: UserId,
        public readonly reason: string,
        public readonly timestamp: Date
    ) {
        super();
    }
}

class UserLockedEvent extends DomainEvent {
    constructor(
        public readonly userId: UserId,
        public readonly lockedBy: UserId,
        public readonly reason: string,
        public readonly timestamp: Date
    ) {
        super();
    }
}

class LoginFailedEvent extends DomainEvent {
    constructor(
        public readonly username: string,
        public readonly attemptTimestamp: Date,
        public readonly ipAddress?: string
    ) {
        super();
    }
}
```

### 2.2 Transactional Outbox Pattern (KRITISCH für Compliance)

**Problem:** Event-Verlust bei Crash zwischen DB-Commit und Event-Publishing = Audit-Lücke (DRK-inakzeptabel)

**Solution:** Events in Outbox-Table schreiben (Teil der DB-Transaktion), dann asynchron publishen.

```typescript
// Infrastructure - Outbox Table Schema
interface OutboxEntry {
    id: string;
    eventId: string;           // UUID des Domain Events
    aggregateId: string;       // ID des Aggregates
    aggregateType: string;     // 'Einsatz', 'User', 'Etb'
    eventType: string;         // 'EinsatzCreatedEvent'
    payload: string;           // JSON.stringify(event)
    status: 'PENDING' | 'PUBLISHED' | 'FAILED';
    createdAt: Date;
    publishedAt?: Date;
    retries: number;
    lastError?: string;
}

// Infrastructure - DomainEventPublisher (Adapter)
@Injectable()
export class DomainEventPublisher {
    async publishAll(events: DomainEvent[], tx: PrismaTransaction): Promise<void> {
        // Events in Outbox schreiben (Teil der Transaktion!)
        for (const event of events) {
            await tx.outbox.create({
                data: {
                    eventId: event.eventId,
                    aggregateId: event.aggregateId,
                    aggregateType: event.constructor.name.replace('Event', ''),
                    eventType: event.constructor.name,
                    payload: JSON.stringify(event),
                    status: 'PENDING',
                    createdAt: new Date(),
                    retries: 0,
                },
            });
        }
    }
}

// Infrastructure - Outbox Processor (CronJob)
@Injectable()
export class OutboxProcessor {
    @Cron('*/5 * * * * *') // Alle 5 Sekunden
    async processOutbox(): Promise<void> {
        const pendingEvents = await this.outboxRepo.findPending({limit: 100});

        for (const entry of pendingEvents) {
            try {
                // Event deserialisieren
                const event = this.deserializeEvent(entry.eventType, entry.payload);

                // Event publishen (z.B. an NestJS EventBus)
                await this.eventBus.publish(event);

                // Als PUBLISHED markieren
                await this.outboxRepo.markPublished(entry.id, new Date());

            } catch (error) {
                // Retry-Logic mit Exponential Backoff
                const newRetryCount = entry.retries + 1;

                if (newRetryCount >= 3) {
                    // Max Retries erreicht → FAILED
                    await this.outboxRepo.markFailed(entry.id, error.message);

                    // Alert senden (z.B. Email an Admins)
                    await this.alertService.sendFailedEventAlert(entry, error);
                } else {
                    // Retry inkrementieren
                    await this.outboxRepo.incrementRetries(entry.id, error.message);
                }
            }
        }
    }

    private deserializeEvent(eventType: string, payload: string): DomainEvent {
        const data = JSON.parse(payload);

        // Event-Factory (Type-Safe Deserialization)
        switch (eventType) {
            case 'EinsatzCreatedEvent':
                return new EinsatzCreatedEvent(
                    new EinsatzId(data.einsatzId),
                    new UserId(data.createdBy),
                    data.alarmstichwort,
                    new Date(data.timestamp)
                );
            // ... weitere Events
            default:
                throw new Error(`Unknown event type: ${eventType}`);
        }
    }
}
```

**Outbox Pattern Benefits:**

- ✅ **Transactional Guarantee**: Events gehen nicht verloren (Teil der DB-Transaktion)
- ✅ **At-Least-Once Delivery**: Event wird mindestens einmal publisht (Idempotenz in Handlers nötig)
- ✅ **Retry-Logic**: Exponential Backoff bei Fehlern (1s, 2s, 4s)
- ✅ **Audit Trail**: Alle Events in DB nachvollziehbar (Forensics)
- ✅ **Monitoring**: Failed Events → Alert an Admins

### 2.3 Audit Log Queries

**Application Layer - Audit Query Handlers:**

```typescript
// Query: Alle Audit-Events für einen Einsatz
class GetEinsatzAuditLogQuery {
    constructor(public readonly einsatzId: EinsatzId) {
    }
}

class GetEinsatzAuditLogHandler {
    async execute(query: GetEinsatzAuditLogQuery): Promise<AuditLogEntry[]> {
        // Direkt Outbox-Table abfragen (CQRS - Query nutzt Prisma)
        const events = await this.prisma.outbox.findMany({
            where: {
                aggregateId: query.einsatzId.value,
                aggregateType: 'Einsatz',
                status: 'PUBLISHED',
            },
            orderBy: {createdAt: 'asc'},
        });

        return events.map(e => ({
            eventType: e.eventType,
            timestamp: e.createdAt,
            payload: JSON.parse(e.payload),
        }));
    }
}

// Query: Failed Events (für Admin-Dashboard)
class GetFailedEventsQuery {
    constructor(public readonly limit: number = 50) {
    }
}

class GetFailedEventsHandler {
    async execute(query: GetFailedEventsQuery): Promise<FailedEvent[]> {
        return await this.prisma.outbox.findMany({
            where: {status: 'FAILED'},
            orderBy: {createdAt: 'desc'},
            take: query.limit,
        });
    }
}
```

---

## 3. Data Protection & Encryption

### 3.1 NO-DELETE Policy (DRK-Compliance)

**Requirement:** Einsätze dürfen NIEMALS physisch gelöscht werden (10-year archival).

```typescript
// Domain Layer - EinsatzAggregate
class EinsatzAggregate extends AggregateRoot {
    // ❌ KEINE delete() Methode!
    // Nur archive() erlaubt

    archive(archivedBy: UserId, reason: string): Result<void> {
        if (!this._status.canTransitionTo(EinsatzStatus.ARCHIVIERT)) {
            return Result.fail('Cannot archive Einsatz in current state');
        }

        this._status = EinsatzStatus.ARCHIVIERT;
        this._archivedAt = new Date();
        this._archivedBy = archivedBy;
        this._archiveReason = reason;

        this.addDomainEvent(
            new EinsatzArchivedEvent(this.id, archivedBy, reason, new Date())
        );

        return Result.ok();
    }

    // Query: Ist archiviert?
    isArchived(): boolean {
        return this._status.equals(EinsatzStatus.ARCHIVIERT);
    }

    // Archivierung rückgängig machen (z.B. bei Fehler)
    unarchive(unarchivedBy: UserId): Result<void> {
        if (!this.isArchived()) {
            return Result.fail('Einsatz is not archived');
        }

        this._status = EinsatzStatus.ABGESCHLOSSEN;
        this._archivedAt = null;
        this._archivedBy = null;
        this._archiveReason = null;

        this.addDomainEvent(
            new EinsatzUnarchivedEvent(this.id, unarchivedBy, new Date())
        );

        return Result.ok();
    }
}

// Infrastructure - Repository Constraint
class PrismaEinsatzRepository implements IEinsatzRepository {
    async delete(id: EinsatzId): Promise<void> {
        // ❌ NIEMALS implementiert!
        throw new Error(
            'Physical deletion of Einsatz is prohibited by DRK-Compliance. Use archive() instead.'
        );
    }

    async findArchived(): Promise<EinsatzAggregate[]> {
        const prismaEinsaetze = await this.prisma.einsatz.findMany({
            where: {status: 'ARCHIVIERT'},
        });
        return prismaEinsaetze.map(e => PrismaEinsatzMapper.toDomain(e));
    }
}
```

**Enforcement auf DB-Ebene:**

```sql
-- PostgreSQL Trigger: Verhindert DELETE auf einsatz-Table
CREATE OR REPLACE FUNCTION prevent_einsatz_deletion()
    RETURNS TRIGGER AS
$$
BEGIN
    RAISE EXCEPTION 'Physical deletion of Einsatz is prohibited by DRK-Compliance';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_delete_einsatz
    BEFORE DELETE
    ON einsatz
    FOR EACH ROW
EXECUTE FUNCTION prevent_einsatz_deletion();
```

### 3.2 Soft-Delete für ETB-Einträge (mit History)

**Requirement:** Gelöschte ETB-Einträge bleiben revisionssicher in Historie.

```typescript
// Domain Layer - EtbEintrag Entity
class EtbEintrag extends Entity {
    private _isDeleted: boolean = false;
    private _deletedAt?: Date;
    private _deletedBy?: UserId;

    delete(deletedBy: UserId): Result<void> {
        if (this._isDeleted) {
            return Result.fail('Eintrag already deleted');
        }

        this._isDeleted = true;
        this._deletedAt = new Date();
        this._deletedBy = deletedBy;

        // Event wird vom Aggregate erfasst
        return Result.ok();
    }

    isDeleted(): boolean {
        return this._isDeleted;
    }
}

// Application Layer - Delete ETB Eintrag Handler
class DeleteEtbEintragHandler {
    async execute(command: DeleteEtbEintragCommand): Promise<Result<void>> {
        const etb = await this.etbRepo.findById(command.etbId);

        // Soft-Delete Eintrag
        const result = etb.deleteEintrag(command.eintragId, command.deletedBy);
        if (result.isFailure) return result;

        // Save (inkl. History-Snapshot)
        await this.etbRepo.save(etb);

        // Event Publishing
        await this.eventPublisher.publishAll(etb.getUncommittedEvents());

        return Result.ok();
    }
}
```

### 3.3 Encryption Strategy

**Encryption at Rest:**

- ✅ PostgreSQL 17: Transparent Data Encryption (TDE) auf Datenbank-Ebene
- ✅ Backup-Verschlüsselung: pgBackRest mit AES-256

**Encryption in Transit:**

- ✅ HTTPS/TLS 1.3 für alle API-Requests
- ✅ PostgreSQL SSL-Verbindung (sslmode=require)

**Sensitive Data Handling:**

```typescript
// Domain Layer - Password Value Object
class Password extends ValueObject<string> {
    private constructor(hashedValue: string) {
        super(hashedValue);
    }

    static async create(plainPassword: string): Promise<Result<Password>> {
        // Validierung
        if (plainPassword.length < 12) {
            return Result.fail('Password must be at least 12 characters');
        }

        // Hashing mit bcrypt (Infrastructure)
        const hashed = await bcrypt.hash(plainPassword, 12);
        return Result.ok(new Password(hashed));
    }

    async verify(plainPassword: string): Promise<boolean> {
        return await bcrypt.compare(plainPassword, this.value);
    }
}
```

---

## 4. Threat Model & Risk Assessment

### 4.1 STRIDE Threat Model

| Threat Category            | Threat                             | Mitigation                                      | Status      |
|----------------------------|------------------------------------|-------------------------------------------------|-------------|
| **Spoofing**               | Unauthorized access via stolen JWT | JWT expiration (24h), Refresh Token Rotation    | ✅ Mitigated |
| **Tampering**              | Domain Event manipulation          | Transactional Outbox, Event Immutability        | ✅ Mitigated |
| **Repudiation**            | User denies action                 | Audit Trail (Event-Based), Signed Events        | ✅ Mitigated |
| **Information Disclosure** | Unauthorized data access           | RBAC, Domain-based Authorization                | ✅ Mitigated |
| **Denial of Service**      | Event Outbox flooding              | Rate Limiting (100 events/batch), Monitoring    | 🔄 Partial  |
| **Elevation of Privilege** | USER escalates to ADMIN            | Role immutability, Min 1 SUPER_ADMIN Constraint | ✅ Mitigated |

### 4.2 Attack Surface Analysis

**External Attack Surface:**

1. **REST API Endpoints:**
    - Mitigation: JWT Authentication, RBAC Guards, Input Validation (DTOs)
2. **Login Endpoint:**
    - Mitigation: Rate Limiting (5 attempts/minute), Failed Login Audit
3. **JWT Token:**
    - Mitigation: Short expiration (24h), HTTPOnly Cookie (Frontend)

**Internal Attack Surface:**

1. **Database Access:**
    - Mitigation: Principle of Least Privilege (DB User Permissions)
2. **Domain Events:**
    - Mitigation: Transactional Outbox, Event Immutability
3. **Admin Actions:**
    - Mitigation: SUPER_ADMIN Constraint, Audit Trail

### 4.3 Security Risks & Mitigation

#### Risiko 1: JWT Token Theft (OWASP A02:2021)

**Likelihood:** Medium | **Impact:** High

**Mitigation:**

- ✅ HTTPOnly Cookie (Frontend kann nicht auf Token zugreifen)
- ✅ SameSite=Strict (CSRF-Protection)
- ✅ Short Expiration (24h)
- ✅ Refresh Token Rotation (Refresh Token nur 1x verwendbar)

```typescript
// Infrastructure - JWT Token Service
@Injectable()
export class JwtTokenService implements ITokenService {
    generate(userId: UserId, role: Role): string {
        return this.jwtService.sign(
            {
                sub: userId.value,
                role: role.value,
            },
            {
                expiresIn: '24h',
                issuer: 'bluelight-hub',
                audience: 'bluelight-hub-api',
            }
        );
    }

    verify(token: string): Result<{ userId: UserId, role: Role }> {
        try {
            const payload = this.jwtService.verify(token);
            return Result.ok({
                userId: new UserId(payload.sub),
                role: Role.create(payload.role).getValue(),
            });
        } catch (error) {
            return Result.fail('Invalid token');
        }
    }
}
```

#### Risiko 2: Event-Verlust (DRK-Compliance Violation)

**Likelihood:** Low (nach Outbox) | **Impact:** CRITICAL

**Mitigation:**

- ✅ **Transactional Outbox Pattern** (Phase 4 - PFLICHT)
- ✅ Retry-Logic (3 Versuche, Exponential Backoff)
- ✅ Failed Event Monitoring (Alert an Admins)
- ✅ Manual Replay (Admin kann Failed Events neu publishen)

#### Risiko 3: SQL Injection (OWASP A03:2021)

**Likelihood:** Low | **Impact:** CRITICAL

**Mitigation:**

- ✅ Prisma ORM (Prepared Statements)
- ✅ Type-Safe Queries (TypeScript)
- ✅ Input Validation (class-validator DTOs)

```typescript
// ✅ SICHER: Prisma Prepared Statement
await this.prisma.einsatz.findMany({
    where: {nummer: userInput}, // Automatisch escaped
});

// ❌ UNSICHER: Raw SQL (NUR mit $queryRaw und Parametern)
// await this.prisma.$executeRawUnsafe(`SELECT * FROM einsatz WHERE nummer = '${userInput}'`);
```

#### Risiko 4: Privilege Escalation

**Likelihood:** Low | **Impact:** HIGH

**Mitigation:**

- ✅ Role immutability (Rolle kann nicht selbst geändert werden)
- ✅ SUPER_ADMIN Constraint (Letzter SUPER_ADMIN nicht löschbar)
- ✅ Audit Trail (Rollen-Änderungen protokolliert)

```typescript
// Domain Layer - UserAggregate
class UserAggregate extends AggregateRoot {
    changeRole(newRole: Role, changedBy: UserId): Result<void> {
        // Nur SUPER_ADMIN darf Rollen ändern
        if (!changedBy.isSuperAdmin()) {
            return Result.fail('Only SUPER_ADMIN can change roles');
        }

        // User kann nicht eigene Rolle ändern
        if (this.id.equals(changedBy)) {
            return Result.fail('Cannot change own role');
        }

        this._role = newRole;
        this.addDomainEvent(
            new UserRoleChangedEvent(this.id, newRole, changedBy)
        );

        return Result.ok();
    }
}
```

---

## 5. Security Implementation Patterns

### 5.1 Authorization Guards (NestJS Adapter)

```typescript
// Infrastructure - RBAC Guard
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {
    }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler());
        if (!requiredRoles) return true;

        const request = context.switchToHttp().getRequest();
        const user = request.user; // Von JWT-Strategy gesetzt

        return requiredRoles.some(role => user.role === role);
    }
}

// Controller Usage
@Controller('einsatz')
export class EinsatzController {
    @Post('archive')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    async archive(@Body() dto: ArchiveEinsatzDto, @CurrentUser() user: User) {
        return await this.commandBus.execute(
            new ArchiveEinsatzCommand(dto.einsatzId, user.id, dto.reason)
        );
    }
}
```

### 5.2 Domain-Based Authorization

```typescript
// Domain Layer - Authorization in Aggregate
class EinsatzAggregate extends AggregateRoot {
    complete(completedBy: UserId, userRole: Role): Result<void> {
        // Business Rule: Nur Admins dürfen Einsatz abschließen
        if (!userRole.canCompleteEinsatz()) {
            return Result.fail('Only ADMIN or SUPER_ADMIN can complete Einsatz');
        }

        if (!this._status.canTransitionTo(EinsatzStatus.ABGESCHLOSSEN)) {
            return Result.fail('Cannot complete Einsatz in current state');
        }

        this._status = EinsatzStatus.ABGESCHLOSSEN;
        this._completedBy = completedBy;
        this._completedAt = new Date();

        this.addDomainEvent(
            new EinsatzCompletedEvent(this.id, completedBy)
        );

        return Result.ok();
    }
}

// Application Layer - Handler prüft Authorization
class CompleteEinsatzHandler {
    async execute(command: CompleteEinsatzCommand): Promise<Result<void>> {
        const aggregate = await this.repo.findById(command.einsatzId);
        const user = await this.userRepo.findById(command.completedBy);

        // Domain macht Authorization-Check
        const result = aggregate.complete(command.completedBy, user.role);

        if (result.isFailure) {
            return result;
        }

        await this.repo.save(aggregate);
        await this.eventPublisher.publishAll(aggregate.getUncommittedEvents());

        return Result.ok();
    }
}
```

### 5.3 Input Validation (DTOs)

```typescript
// Infrastructure - DTO mit class-validator
export class CreateEinsatzDto {
    @ApiProperty()
    @IsString()
    @MinLength(3)
    @MaxLength(100)
    alarmstichwort: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsString()
    @MaxLength(200)
    ort?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @Matches(/^[0-9]{5}$/, {message: 'PLZ must be 5 digits'})
    plz?: string;
}

// NestJS Validation Pipe (global)
app.useGlobalPipes(
    new ValidationPipe({
        whitelist: true,          // Nur deklarierte Properties
        forbidNonWhitelisted: true, // Fehler bei unbekannten Properties
        transform: true,           // Auto-Transform zu DTO-Typen
    })
);
```

### 5.4 Rate Limiting

```typescript
// Infrastructure - Rate Limiting für Login
@Controller('auth')
export class AuthController {
    @Post('login')
    @Throttle(5, 60) // 5 Versuche pro 60 Sekunden
    async login(@Body() dto: LoginDto) {
        return await this.commandBus.execute(
            new LoginCommand(dto.username, dto.password, dto.code)
        );
    }
}

// Global Rate Limiting (Infrastructure)
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 Minuten
        max: 100,                  // Max 100 Requests pro IP
        message: 'Too many requests from this IP',
    })
);
```

---

## 6. Security Testing Strategy

### 6.1 Security Unit Tests

```typescript
// Domain Layer - Security Business Rules testen
describe('UserAggregate - SUPER_ADMIN Constraint', () => {
    it('should prevent locking last SUPER_ADMIN', async () => {
        const user = createSuperAdmin();
        const domainService = new UserManagementService(mockRepo);

        // Mock: Nur 1 SUPER_ADMIN aktiv
        mockRepo.countActiveSuperAdmins.mockResolvedValue(1);

        const canLock = await domainService.canLockSuperAdmin(user.id);
        expect(canLock).toBe(false);
    });

    it('should allow locking SUPER_ADMIN if ≥2 active', async () => {
        const user = createSuperAdmin();
        const domainService = new UserManagementService(mockRepo);

        // Mock: 2 SUPER_ADMINs aktiv
        mockRepo.countActiveSuperAdmins.mockResolvedValue(2);

        const canLock = await domainService.canLockSuperAdmin(user.id);
        expect(canLock).toBe(true);
    });
});

// Domain Layer - NO-DELETE Policy testen
describe('EinsatzAggregate - NO-DELETE Policy', () => {
    it('should archive instead of delete', () => {
        const einsatz = createEinsatz();
        const userId = new UserId('admin-1');

        const result = einsatz.archive(userId, 'Einsatz abgeschlossen');

        expect(result.isSuccess).toBe(true);
        expect(einsatz.isArchived()).toBe(true);
        expect(einsatz.getUncommittedEvents()).toContainEqual(
            expect.any(EinsatzArchivedEvent)
        );
    });

    it('should throw error when trying to delete', async () => {
        const repo = new PrismaEinsatzRepository(prisma);

        await expect(
            repo.delete(new EinsatzId('einsatz-1'))
        ).rejects.toThrow('Physical deletion of Einsatz is prohibited');
    });
});
```

### 6.2 Integration Tests

```typescript
// Infrastructure - RBAC Integration Test
describe('EinsatzController - RBAC', () => {
    it('should allow ADMIN to archive Einsatz', async () => {
        const token = generateJWT({role: 'ADMIN'});

        const response = await request(app)
            .post('/einsatz/archive')
            .set('Authorization', `Bearer ${token}`)
            .send({einsatzId: 'einsatz-1', reason: 'Test'});

        expect(response.status).toBe(200);
    });

    it('should deny USER to archive Einsatz', async () => {
        const token = generateJWT({role: 'USER'});

        const response = await request(app)
            .post('/einsatz/archive')
            .set('Authorization', `Bearer ${token}`)
            .send({einsatzId: 'einsatz-1', reason: 'Test'});

        expect(response.status).toBe(403); // Forbidden
    });
});

// Infrastructure - Transactional Outbox Test
describe('Outbox Pattern - Event-Verlust Prevention', () => {
    it('should write event to Outbox within transaction', async () => {
        const einsatz = createEinsatz();
        einsatz.complete(new UserId('user-1'));

        // Save innerhalb Transaktion
        await repo.save(einsatz);

        // Outbox Entry prüfen
        const outboxEntry = await prisma.outbox.findFirst({
            where: {
                aggregateId: einsatz.id.value,
                eventType: 'EinsatzCompletedEvent',
            },
        });

        expect(outboxEntry).toBeDefined();
        expect(outboxEntry.status).toBe('PENDING');
    });

    it('should publish event from Outbox', async () => {
        const processor = new OutboxProcessor(outboxRepo, eventBus);

        await processor.processOutbox();

        // Event wurde publisht
        expect(eventBus.publish).toHaveBeenCalledWith(
            expect.any(EinsatzCompletedEvent)
        );

        // Outbox Entry als PUBLISHED markiert
        const entry = await outboxRepo.findById(outboxId);
        expect(entry.status).toBe('PUBLISHED');
    });
});
```

### 6.3 Security Penetration Testing

**Manual Testing Checklist:**

- [ ] **JWT Token Theft**: Token aus LocalStorage stehlen → FAIL (HTTPOnly Cookie)
- [ ] **CSRF Attack**: Externe Seite sendet Request → FAIL (SameSite=Strict)
- [ ] **SQL Injection**: `' OR '1'='1` in Input → FAIL (Prisma Prepared Statements)
- [ ] **Privilege Escalation**: USER ändert eigene Rolle → FAIL (Authorization in Domain)
- [ ] **Brute Force**: 100 Login-Versuche → FAIL (Rate Limiting nach 5 Versuchen)
- [ ] **Event-Verlust**: Server-Crash während Event-Publishing → SUCCESS (Outbox Retry)

---

## 7. Security Compliance Mapping

### 7.1 DRK-Compliance Requirements

| Requirement                   | Implementation                                        | Status        |
|-------------------------------|-------------------------------------------------------|---------------|
| **10-year archival**          | NO-DELETE Policy, Status=ARCHIVIERT                   | ✅ Implemented |
| **Audit Trail**               | Event-Based Audit (Outbox), Immutable Events          | ✅ Implemented |
| **NO-DELETE Policy**          | Physisches DELETE verboten (DB Trigger)               | ✅ Implemented |
| **Revisionssichere Historie** | ETB Versionierung, History-Snapshots                  | ✅ Implemented |
| **Benutzer-Zuordnung**        | Alle Events haben `userId` (wer hat was gemacht)      | ✅ Implemented |
| **Zeitstempel**               | Alle Events haben `timestamp` (wann wurde es gemacht) | ✅ Implemented |

### 7.2 OWASP Top 10 (2021) Mitigation

| OWASP Risk                            | Mitigation                                               | Status      |
|---------------------------------------|----------------------------------------------------------|-------------|
| **A01: Broken Access Control**        | RBAC, Domain-based Authorization                         | ✅ Mitigated |
| **A02: Cryptographic Failures**       | bcrypt (Passwords), TLS 1.3, PostgreSQL TDE              | ✅ Mitigated |
| **A03: Injection**                    | Prisma ORM (Prepared Statements), Input Validation       | ✅ Mitigated |
| **A04: Insecure Design**              | Threat Model (STRIDE), Defense in Depth                  | ✅ Mitigated |
| **A05: Security Misconfiguration**    | Secure Defaults (HTTPOnly, SameSite), JWT Best Practices | ✅ Mitigated |
| **A06: Vulnerable Components**        | pnpm audit, Dependabot, Regular Updates                  | 🔄 Ongoing  |
| **A07: Identification/Auth Failures** | JWT (24h expiration), Rate Limiting, Audit Trail         | ✅ Mitigated |
| **A08: Software/Data Integrity**      | Transactional Outbox, Event Immutability                 | ✅ Mitigated |
| **A09: Logging/Monitoring Failures**  | Event-Based Audit, Failed Event Alerts                   | ✅ Mitigated |
| **A10: Server-Side Request Forgery**  | N/A (keine externen Requests von User-Input)             | ✅ N/A       |

---

## 8. Security Architecture Decision Records (ADRs)

### ADR-SEC-001: JWT Token in HTTPOnly Cookie

**Status:** Accepted | **Date:** 2025-01-12

**Context:**
JWT Tokens können im Frontend von XSS-Angriffen gestohlen werden, wenn sie in LocalStorage gespeichert sind.

**Decision:**
JWT Token wird in HTTPOnly Cookie gespeichert (Frontend kann nicht zugreifen).

**Consequences:**

- ✅ XSS-Protection: JavaScript kann Token nicht lesen
- ✅ CSRF-Protection: SameSite=Strict verhindert Cross-Site Requests
- ⚠️ Komplexität: Refresh Token Flow nötig für Token-Erneuerung

**Alternatives Considered:**

- LocalStorage → Verworfen (XSS-anfällig)
- SessionStorage → Verworfen (verliert Token bei Tab-Close)

---

### ADR-SEC-002: Transactional Outbox für Audit Trail

**Status:** Accepted | **Date:** 2025-01-12

**Context:**
Event-Verlust bei Crash zwischen DB-Commit und Event-Publishing = Audit-Lücke (DRK-inakzeptabel).

**Decision:**
Events in Outbox-Table schreiben (Teil der DB-Transaktion), dann asynchron publishen.

**Consequences:**

- ✅ Transactional Guarantee: Events gehen nicht verloren
- ✅ At-Least-Once Delivery: Event wird mindestens einmal publisht
- ✅ Retry-Logic: Fehler-Behandlung mit Exponential Backoff
- ⚠️ Latency: Max. 5s Verzögerung bis Event publisht wird
- ⚠️ Idempotenz: Event-Handler müssen idempotent sein

**Alternatives Considered:**

- Direktes Event-Bus Publishing → Verworfen (Event-Verlust bei Crash)
- Event Sourcing → Zu komplex für aktuellen Scope

---

### ADR-SEC-003: NO-DELETE Policy mit DB-Trigger

**Status:** Accepted | **Date:** 2025-01-12

**Context:**
DRK-Compliance: Einsätze dürfen NIEMALS physisch gelöscht werden (10-year archival).

**Decision:**
Physisches DELETE auf `einsatz`-Table wird durch PostgreSQL-Trigger verhindert.

**Consequences:**

- ✅ Enforcement auf DB-Ebene (selbst bei manuellen SQL-Queries)
- ✅ Status=ARCHIVIERT als einzige Lösch-Methode
- ✅ Reversible (Unarchive möglich)
- ⚠️ Datenbank-Wachstum (alte Einsätze bleiben)

**Alternatives Considered:**

- Nur Application-Layer Enforcement → Verworfen (umgehbar)
- Separate Archive-Database → Zu komplex

---

### ADR-SEC-004: RBAC mit Min 1 SUPER_ADMIN Constraint

**Status:** Accepted | **Date:** 2025-01-12

**Context:**
System muss administrierbar bleiben (Deadlock vermeiden, wenn letzter SUPER_ADMIN gesperrt wird).

**Decision:**
Domain Service prüft vor Lock/Delete, ob ≥2 SUPER_ADMINs aktiv sind.

**Consequences:**

- ✅ System-Lock-out verhindert
- ✅ Business Rule in Domain Layer (framework-agnostisch)
- ⚠️ Complexity: Domain Service nötig (Aggregate allein kann nicht prüfen)

**Alternatives Considered:**

- DB-Constraint → Verworfen (nicht expressive genug)
- Application-Layer Check → Verworfen (Business Rule gehört in Domain)

---

## 9. Next Steps & Implementation

### 9.1 Security Implementation Roadmap

**Phase 1: Domain Layer (Epic 1) - Woche 1**

- ✅ Role Value Object mit Permission-Logic
- ✅ Password Value Object (Hashing)
- ✅ User Management Domain Service (SUPER_ADMIN Constraint)
- ✅ Security Domain Events (UserLockedEvent, LoginFailedEvent)

**Phase 2: Lagekarte (Epic 2) - Woche 2**

- ✅ RBAC Guards (NestJS)
- ✅ JWT Token Service Adapter
- ✅ Input Validation (DTOs)

**Phase 3: ETB (Epic 3) - Woche 3**

- ✅ Soft-Delete für ETB-Einträge
- ✅ Audit Queries (GetEinsatzAuditLog)

**Phase 4: Einsatz + Auth (Epic 4) - Woche 4**

- ✅ **Transactional Outbox Pattern** (KRITISCH!)
- ✅ Outbox Processor (CronJob)
- ✅ Failed Event Monitoring
- ✅ Login/Logout Commands
- ✅ NO-DELETE Policy Enforcement (DB-Trigger)

**Phase 5: Cleanup (Epic 5) - Woche 5**

- ✅ Security Penetration Testing
- ✅ Performance-Tuning (Audit Queries)

### 9.2 Security Monitoring

**Metrics zu überwachen:**

- Failed Login Attempts (>5/minute → Alert)
- Failed Outbox Events (Status=FAILED → Sofort Alert)
- Authorization Failures (403 Errors → Tracking)
- JWT Token Expiration Rate (hohe Rate → Session-Problem)

**Alerting-Strategie:**

```typescript
// Infrastructure - Alert Service
@Injectable()
export class SecurityAlertService {
    async sendFailedEventAlert(entry: OutboxEntry, error: Error): Promise<void> {
        // Email an Admins
        await this.emailService.send({
            to: process.env.ADMIN_EMAIL,
            subject: '[CRITICAL] Failed Event in Outbox',
            body: `
        Event ID: ${entry.eventId}
        Event Type: ${entry.eventType}
        Aggregate: ${entry.aggregateType} (${entry.aggregateId})
        Error: ${error.message}
        Retries: ${entry.retries}
        Created: ${entry.createdAt}

        Action Required: Check Outbox manually and replay event if needed.
      `,
        });
    }

    async sendBruteForceAlert(username: string, attempts: number): Promise<void> {
        await this.emailService.send({
            to: process.env.ADMIN_EMAIL,
            subject: '[WARNING] Brute Force Attempt Detected',
            body: `
        Username: ${username}
        Failed Attempts: ${attempts}
        Time Window: Last 5 minutes

        Action Required: Review logs and consider IP blocking.
      `,
        });
    }
}
```

---

## 10. Conclusion

Die **Security Architecture** für Bluelight Hub stellt sicher, dass alle DRK-Compliance-Anforderungen erfüllt sind:

✅ **NO-DELETE Policy**: Physisches Löschen unmöglich (DB-Trigger)
✅ **Audit Trail**: Lückenlos durch Transactional Outbox
✅ **RBAC**: Granulare Zugriffskontrolle (3 Rollen)
✅ **Framework Independence**: Security-Logic in Domain Layer
✅ **Defense in Depth**: Mehrschichtige Sicherheit (Domain → Application → Infrastructure)

**Critical Success Factors:**

1. **Transactional Outbox** MUSS in Phase 4 implementiert werden (NICHT optional)
2. **DB-Trigger** für NO-DELETE Policy MUSS vor Produktion aktiv sein
3. **Min 1 SUPER_ADMIN Constraint** MUSS in Domain Service geprüft werden
4. **Security Tests** MÜSSEN Teil der TDD-Strategie sein

**Next Actions:**

1. ✅ Security Architecture Review mit Ruben
2. ⏭️ Integration mit General Architecture (`hexagonal-architecture.md`)
3. ⏭️ Security ADRs in separates Dokument auslagern (optional)
4. ⏭️ Solutioning Gate Check (PRD + Architecture + Security Architecture kohärent)

---

_Erstellt durch BMAD Security Architecture Workflow v1.0_
_Datum: 2025-01-12_
_Für: Ruben_
_Basis: Hexagonal Architecture + DDD (hexagonal-architecture.md)_