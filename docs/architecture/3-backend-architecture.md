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

---
