# Bluelight-Hub Architecture Documentation

> **Source:** Generated from actual codebase analysis (exhaustive scan)
> **Date:** 2025-01-11
> **Status:** Current and accurate
> **Method:** BMM Document-Project Workflow v1.2.0

---

## 1. Executive Summary

### System Purpose

Bluelight-Hub ist eine **Desktop-basierte Einsatzunterstützungsanwendung** für das Deutsche Rote Kreuz (DRK), die folgende Kernfunktionen bietet:

- **Einsatzmanagement:** Verwaltung von Einsätzen mit flexibler Datenerfassung (minimale Pflichtvorgaben)
- **Einsatztagebuch (ETB):** Versionierte Dokumentation mit 10-Jahre-Archivierung und Compliance
- **Lagekarte:** Geografische Visualisierung mit POI-Management und MGRS-Koordinaten
- **Benutzerverwaltung:** Rollenbasiertes System (User, Admin, Super-Admin) mit Audit-Trail

### System Scope

**Enthalten:**
- ✅ Desktop-App (Tauri) mit Web-Frontend
- ✅ Lokaler/Remote Backend-Server (NestJS)
- ✅ Cookie-basierte JWT-Authentifizierung
- ✅ REST API für alle Operationen
- ✅ PostgreSQL Datenbank mit Prisma ORM
- ✅ Offline-Maps (Leaflet Tiles)
- ✅ Optimistic UI Updates (TanStack Query)

**Nicht enthalten:**
- ❌ Externe Systemintegration (TETRA, Digitalfunk, FMS)
- ❌ Echtzeit-Kommunikation (WebSocket)
- ❌ Offline-Sync / Cloud-Synchronisation
- ❌ Autonomer Modus (vollständig offline)
- ❌ Mobile Apps (iOS/Android)
- ❌ Ressourcen-Management (Personal, Fahrzeuge, Material)

### Key Characteristics

- **Project Type:** Monorepo (Backend + Frontend + Shared)
- **Domain:** Emergency Response Management (DRK)
- **Deployment:** Desktop application (Tauri) with local/remote backend
- **Users:** Admin, Koordinator, Mitglied roles (NOT implemented, only USER/ADMIN/SUPER_ADMIN)
- **Architecture Style:** Clean Architecture (CQRS, DDD, Hexagonal) with Transactional Outbox Pattern
- **Data Strategy:** CRUD with Audit Trail, Soft-Delete, No-Delete Policy (Einsätze)

---

## 2. Architecture Overview

### High-Level Architecture

```
┌────────────────────────────────────────────────────┐
│         Tauri Desktop App (Cross-Platform)         │
│  ┌──────────────────────────────────────────────┐  │
│  │   React 19 Frontend                          │  │
│  │   ┌────────────────────────────────────────┐ │  │
│  │   │ Atomic Design Components               │ │  │
│  │   │ - Atoms (24)   - Organisms (52)        │ │  │
│  │   │ - Molecules (46) - Templates (4)       │ │  │
│  │   │ - Pages (6)                            │ │  │
│  │   └────────────────────────────────────────┘ │  │
│  │   ┌────────────────────────────────────────┐ │  │
│  │   │ State Management                       │ │  │
│  │   │ - TanStack Query (Server State)        │ │  │
│  │   │ - TanStack Store (UI State)            │ │  │
│  │   │ - TanStack Form (Forms + Zod)          │ │  │
│  │   └────────────────────────────────────────┘ │  │
│  │   ┌────────────────────────────────────────┐ │  │
│  │   │ Styling & UI                           │ │  │
│  │   │ - Tailwind CSS 4.1.17                  │ │  │
│  │   │ - Headless UI 2.2.9                    │ │  │
│  │   │ - Phosphor Icons                       │ │  │
│  │   └────────────────────────────────────────┘ │  │
│  └───────────────────┬──────────────────────────┘  │
│                      │ HTTP REST                   │
│                      │ (Generated Client)          │
└──────────────────────┼─────────────────────────────┘
                       │
                       │ Cookie-based JWT
                       │ (Access + Refresh + Admin)
                       │
         ┌─────────────▼──────────────┐
         │  NestJS 11 Backend         │
         │  ┌──────────────────────┐  │
         │  │ Controllers (10)     │  │
         │  │ - Auth (Unified)     │  │
         │  │ - Einsatz (CRUD)     │  │
         │  │ - ETB (Versioned)    │  │
         │  │ - Lagekarte (GeoJSON)│  │
         │  │ - User Management    │  │
         │  │ - Health Checks      │  │
         │  └─────────┬────────────┘  │
         │            │                │
         │  ┌─────────▼────────────┐  │
         │  │ Services (Business)  │  │
         │  │ - Validation         │  │
         │  │ - Transformations    │  │
         │  │ - Event Emitters     │  │
         │  └─────────┬────────────┘  │
         │            │                │
         │  ┌─────────▼────────────┐  │
         │  │ Repositories (Data)  │  │
         │  │ - Prisma ORM         │  │
         │  │ - Query Building     │  │
         │  │ - Transactions       │  │
         │  └─────────┬────────────┘  │
         └────────────┼────────────────┘
                      │
         ┌────────────▼────────────┐
         │  PostgreSQL 17          │
         │  - 9 Models             │
         │  - 5 Enums              │
         │  - Audit Trail          │
         │  - Soft-Delete          │
         └─────────────────────────┘
```

### Technology Stack (ACTUAL)

#### Backend

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Framework** | NestJS | 11.1.8 | Modular server framework |
| **Language** | TypeScript | 5.9.3 | Type-safe development |
| **Runtime** | Node.js | 24.10.0+ | JavaScript runtime |
| **Database** | PostgreSQL | 17 | Relational database |
| **ORM** | Prisma | 6.19.0 | Type-safe database client |
| **API Docs** | Swagger/OpenAPI | 11.2.1 | Auto-generated API docs |
| **Authentication** | Passport JWT | 11.0.5 | JWT strategy |
| **Validation** | class-validator | 0.14.2 | DTO validation |
| **Security** | Helmet + Throttler | 8.1.0 + 6.4.0 | Security headers + rate limiting |
| **Caching** | cache-manager | 7.2.4 | In-memory caching |
| **Events** | EventEmitter | 3.0.1 | Domain events (not Event Sourcing) |

#### Frontend

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Framework** | React | 19.2.0 | UI library |
| **Language** | TypeScript | 5.9.3 | Type-safe development |
| **Build Tool** | Vite + SWC | 7.2.2 + 4.2.1 | Fast build and HMR |
| **Desktop** | Tauri | 2.8.5 | Cross-platform desktop app |
| **Routing** | TanStack Router | 1.135.0 | Type-safe routing with file-based |
| **Server State** | TanStack Query | 5.90.7 | Data fetching + caching |
| **UI State** | TanStack Store | 0.8.0 | Global state management |
| **Forms** | TanStack Form | 1.23.8 | Type-safe forms |
| **Validation** | Zod | 4.1.12 | Schema validation |
| **Styling** | Tailwind CSS | 4.1.17 | Utility-first CSS |
| **Components** | Headless UI | 2.2.9 | Accessible primitives |
| **Maps** | Leaflet | 1.9.4 | Mapping library |
| **Map Drawing** | Geoman | 2.18.3 | Drawing tools |
| **Icons** | Phosphor Icons | - | Icon library |
| **Notifications** | Sonner | 2.0.7 | Toast notifications |
| **Command** | cmdk | 1.1.1 | Command palette |

#### Shared

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **API Client** | openapi-typescript | - | Generated from OpenAPI spec |
| **Types** | TypeScript | 5.9.3 | Shared types |

### Architecture Style

**Backend:** **Clean Architecture & CQRS**
(Domain-Driven Design with Hexagonal approach)

```
Controller Layer (Ports/Adapters)
    ↓
Application Layer (Commands/Queries)
    ↓
Domain Layer (Aggregates, Policies, Value Objects)
    ↓
Infrastructure Layer (Repositories, External Services)
    ↓
Prisma ORM & PostgreSQL
```

**Transactional Outbox Pattern:**
Ensures atomicity between data persistence and domain events.
1. Application: Executes Command
2. Domain: Returns Result + Events
3. Infrastructure: Saves Aggregate + Events (in same TX)
4. Worker: Polls Outbox -> Publishes to EventBus

**Frontend:** **Component-based with Atomic Design**

```
Pages (Routes)
    ↓
Templates (Layouts)
    ↓
Organisms (Complex sections)
    ↓
Molecules (Combined components)
    ↓
Atoms (Base components)
```

**State Management:** **Hybrid Approach**

- **Server State:** TanStack Query (primary)
- **UI State:** TanStack Store (EinsatzStore only)
- **Form State:** TanStack Form + Zod
- **Context:** ColorMode, Confirm dialogs

---

## 3. Backend Architecture

### Module Structure (ACTUAL)

Das Backend folgt einer **vertikalen Slicing-Architektur** nach DDD-Prinzipien:

```
packages/backend/src/
├── application/             # Application Layer (Commands, Queries, Use Cases)
│   ├── einsatz/            # Einsatz Features
│   ├── etb/                # ETB Features
│   └── ...
├── domain/                  # Domain Layer (Enterprise Rules)
│   ├── model/              # Aggregates & Entities
│   ├── ports/              # Repository Interfaces
│   └── policies/           # Domain Policies (z.B. ArchivalPolicy)
├── infrastructure/          # Infrastructure Layer (Implementation)
│   ├── database/           # Prisma & Repositories
│   ├── http/               # Controllers & Filters
│   └── outbox/             # Transactional Outbox Implementation
└── modules/                 # NestJS Wiring (Dependency Injection)
```

**Features:**
- ✅ **Application Layer:** Trennung von Commands (Write) und Queries (Read)
- ✅ **Domain Layer:** Unabhängig von Frameworks, reine Business-Logik
- ✅ **Infrastructure:** Kapselt externe Abhängigkeiten (DB, Auth, etc.)
- ✅ **DI-Wiring:** Explizite Module zur Zusammenführung der Layer

### API Design

#### Versioning Strategy

- **VERSION_NEUTRAL:** `/api/{endpoint}` für Auth, Health, Root
- **Alpha Version:** `/api/alpha/{resource}` für Domain-Endpunkte

#### Authentication Pattern

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

#### Rate Limiting

**Throttle Guards auf kritischen Endpunkten:**
- `/api/auth/unified`: 5 Requests / Minute
- Controller-Level: Konfigurierbar via `@Throttle()`
- Service-Level: Zusätzliche Limits

#### Response Format

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

### API Endpoints (54 Total)

#### Authentication (VERSION_NEUTRAL)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/unified` | Unified login & auto-register | No |
| POST | `/api/auth/logout` | Logout (clear cookies) | Yes |
| POST | `/api/auth/refresh` | Refresh access token | Refresh |
| GET | `/api/auth/validate` | Validate current token | Yes |

#### User Management (/api/alpha/users)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/users` | List all users | Admin |
| GET | `/api/alpha/users/:id` | Get user by ID | Admin |
| POST | `/api/alpha/users` | Create user | Admin |
| PATCH | `/api/alpha/users/:id` | Update user | Admin |
| DELETE | `/api/alpha/users/:id` | Soft-delete user | Admin |
| POST | `/api/alpha/users/:id/lock` | Lock user | Admin |
| POST | `/api/alpha/users/:id/unlock` | Unlock user | Admin |

#### Einsatz Management (/api/alpha/einsaetze)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/einsaetze` | List all missions | Yes |
| GET | `/api/alpha/einsaetze/:id` | Get mission by ID | Yes |
| POST | `/api/alpha/einsaetze` | Create mission (minimal) | Yes |
| PATCH | `/api/alpha/einsaetze/:id` | Update mission | Yes |
| DELETE | `/api/alpha/einsaetze/:id` | Archive mission (no delete) | Yes |
| POST | `/api/alpha/einsaetze/:id/archive` | Explicit archive | Yes |

#### Einsatztagebuch (/api/alpha/einsatztagebuch)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/einsatztagebuch` | List all ETBs | Yes |
| GET | `/api/alpha/einsatztagebuch/:id` | Get ETB by ID | Yes |
| POST | `/api/alpha/einsatztagebuch` | Create ETB | Yes |
| PATCH | `/api/alpha/einsatztagebuch/:id` | Update ETB | Yes |
| POST | `/api/alpha/einsatztagebuch/:id/lock` | Lock ETB | Yes |

#### ETB Einträge (/api/alpha/etb-eintraege)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/etb-eintraege` | List entries | Yes |
| GET | `/api/alpha/etb-eintraege/:id` | Get entry by ID | Yes |
| POST | `/api/alpha/etb-eintraege` | Create entry | Yes |
| PATCH | `/api/alpha/etb-eintraege/:id` | Update entry (creates version) | Yes |
| DELETE | `/api/alpha/etb-eintraege/:id` | Soft-delete entry | Yes |
| GET | `/api/alpha/etb-eintraege/:id/historie` | Get version history | Yes |

#### ETB Textbausteine (/api/alpha/textbausteine)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/textbausteine` | List templates | Yes |
| GET | `/api/alpha/textbausteine/:id` | Get template by ID | Yes |
| POST | `/api/alpha/textbausteine` | Create template | Yes |
| PATCH | `/api/alpha/textbausteine/:id` | Update template | Yes |
| DELETE | `/api/alpha/textbausteine/:id` | Soft-delete template | Yes |

#### Lagekarte (/api/alpha/lagekarten)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/lagekarten` | List all maps | Yes |
| GET | `/api/alpha/lagekarten/:id` | Get map by ID | Yes |
| POST | `/api/alpha/lagekarten` | Create map | Yes |
| PATCH | `/api/alpha/lagekarten/:id` | Update map | Yes |
| DELETE | `/api/alpha/lagekarten/:id` | Delete map | Yes |

#### Lagekarte POIs (/api/alpha/lagekarten/:id/pois)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/lagekarten/:id/pois` | List POIs | Yes |
| POST | `/api/alpha/lagekarten/:id/pois` | Create POI | Yes |
| PATCH | `/api/alpha/lagekarten/:id/pois/:poiId` | Update POI | Yes |
| DELETE | `/api/alpha/lagekarten/:id/pois/:poiId` | Delete POI | Yes |

#### Geocoding (/api/alpha/geocoding)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/alpha/geocoding/search` | Search by address | Yes |
| GET | `/api/alpha/geocoding/reverse` | Reverse geocode | Yes |

#### Health Checks (VERSION_NEUTRAL)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Overall health | No |
| GET | `/api/health/liveness` | Liveness probe | No |
| GET | `/api/health/readiness` | Readiness probe | No |

#### Root Meta (VERSION_NEUTRAL)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | API metadata | No |

### Data Layer

#### ORM & Database

- **ORM:** Prisma 6.19.0
- **Database:** PostgreSQL 17
- **Migration Strategy:** Prisma Migrate with SQL migrations
- **ID Generation:** `cuid()` (primary), `cuid()` (User IDs)

#### Data Models (9 Models)

1. **User** - Benutzerverwaltung mit Soft-Delete und Lock
2. **Einsatz** - Einsätze mit No-Delete Policy
3. **Einsatztagebuch** - 1:1 Beziehung zu Einsatz
4. **EtbEintrag** - Versionierte Einträge
5. **EtbEintragHistorie** - Vollständige Versionshistorie
6. **EtbTextbaustein** - Wiederverwendbare Textbausteine
7. **EtbArchiv** - 10-Jahre-Archivierung mit SHA-256
8. **Lagekarte** - 1:1 Beziehung zu Einsatz
9. **LagekartePoi** - Geografische POIs

#### Key Patterns

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

### Security Architecture

#### Authentication Flow

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

#### Token Refresh Flow

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

#### Role-Based Access Control (RBAC)

**3 Rollen (Implementiert):**

| Role | Permissions | Guards |
|------|-------------|--------|
| **USER** | Basic access, CRUD Einsätze/ETB/Lagekarte | `@UseGuards(JwtAuthGuard)` |
| **ADMIN** | User management, System config | `@UseGuards(AdminJwtAuthGuard)` |
| **SUPER_ADMIN** | Full system access | `@UseGuards(AdminJwtAuthGuard)` |

**Permission Guards:**
- `JwtAuthGuard` - Validiert Access Token
- `AdminJwtAuthGuard` - Validiert Admin Token
- `JwtRefreshGuard` - Validiert Refresh Token

#### Security Features

- **JWT Tokens:** Secure, stateless authentication
- **HTTP-Only Cookies:** XSS-Schutz
- **SameSite Cookies:** CSRF-Schutz
- **Helmet Middleware:** Security headers
- **Rate Limiting:** Throttle Guards auf kritischen Endpunkten
- **Audit Logging:** Vollständige Nachvollziehbarkeit aller Änderungen
- **Soft-Delete:** Daten werden nicht physisch gelöscht
- **Password Hashing:** Bcrypt (nur für Admin-User)

---

## 4. Frontend Architecture

### Component Architecture (Atomic Design)

**Feature-Sliced Atomic Design** (Modular Architecture)

```
src/
├── features/             # Domain Features (e.g. einsatz, etb)
│   ├── einsatz/
│   │   ├── api/          # React Query Hooks (Queries & Mutations)
│   │   ├── stores/       # TanStack Stores (UI State)
│   │   └── ui/           # Feature-specific Components (Atomic)
│   │       ├── atoms/
│   │       ├── molecules/
│   │       └── organisms/
│   └── ...
├── shared/               # Shared logic & UI
│   ├── ui/               # Global Design System
│   │   ├── atoms/        # Base components (Button, Input)
│   │   ├── molecules/    # Combined components
│   │   └── organisms/    # Complex widgets
│   └── hooks/            # Shared logic
├── routes/               # TanStack Router (File-based)
└── services/             # Infrastructure Services
```

### Feature Breakdown

| Feature | Components | Complexity | Status |
|---------|-----------|-----------|--------|
| **ETB** | 25 (8 Molecules + 17 Organisms) | ★★★★★ Very High | ✅ Fully implemented |
| **Lagekarte** | 20 (4 Molecules + 16 Organisms) | ★★★★★ Very High | ✅ Fully implemented |
| **Einsatz** | 18 (13 Molecules + 5 Organisms) | ★★★★☆ High | ✅ Fully implemented |
| **Shared** | 14 (Molecules) | ★★★☆☆ Medium | ✅ Fully implemented |
| **Admin** | 5 (1 Molecule + 4 Organisms) | ★★★☆☆ Medium | ✅ Fully implemented |
| **Command Palette** | 6 (Organisms) | ★★★☆☆ Medium | ✅ Fully implemented |
| **Dashboard** | 4 (2 Molecules + 2 Organisms) | ★★☆☆☆ Low | ✅ Fully implemented |
| **Auth** | 3 (1 Molecule + 2 Organisms) | ★★☆☆☆ Low | ✅ Fully implemented |
| **Forms** | 3 (Molecules) | ★★★☆☆ Medium | ✅ Fully implemented |

### State Management

**Hybrid Approach** (NOT pure Redux/Zustand):

#### 1. Server State (PRIMARY) - TanStack Query

**Purpose:** Data fetching, caching, synchronization

**Pattern:**
```typescript
// Query Keys (Hierarchical)
const QUERY_KEYS = {
  einsaetze: ['einsaetze'],
  einsatz: (id: string) => ['einsaetze', id],
  etb: {
    all: ['etb'],
    byId: (id: string) => ['etb', id],
    entries: (etbId: string) => ['etb', etbId, 'entries']
  }
};

// Usage
const useEinsaetze = () => {
  return useQuery({
    queryKey: QUERY_KEYS.einsaetze,
    queryFn: () => api.einsatz().getEinsaetze(),
    staleTime: 5 * 60 * 1000, // 5min
    gcTime: 10 * 60 * 1000    // 10min
  });
};
```

**Features:**
- Automatic background refetch
- Optimistic updates (ADR-020)
- Automatic retry on failure
- Cache invalidation
- Request deduplication
- Pagination support

#### 2. UI State - TanStack Store

**Purpose:** Global UI state (NOT server state)

**Implementation:**
```typescript
// Only ONE store: EinsatzStore
export const einsatzStore = new Store<EinsatzStoreState>({
  selectedEinsatzId: null,
  filterOptions: {},
  sortOrder: 'desc'
});
```

**Usage Pattern:**
```typescript
const useEinsatzStore = () => {
  const selectedId = einsatzStore.useSelector(
    (state) => state.selectedEinsatzId
  );

  const setSelectedId = (id: string) => {
    einsatzStore.setState((state) => ({
      ...state,
      selectedEinsatzId: id
    }));
  };

  return { selectedId, setSelectedId };
};
```

**Scope:**
- ✅ UI-only state (filters, selections, modals)
- ❌ NO server data (use TanStack Query)
- ❌ NO form state (use TanStack Form)

#### 3. Form State - TanStack Form + Zod

**Purpose:** Type-safe forms with validation

**Pattern:**
```typescript
const form = useForm({
  defaultValues: {
    username: '',
    password: ''
  },
  validators: {
    onChange: loginSchema
  },
  onSubmit: async ({ value }) => {
    await api.auth().unified(value);
  }
});
```

**Features:**
- Zod schema validation
- Field-level validation
- Submit handling
- Error messages
- Touched/dirty tracking

#### 4. Context - React Context

**Purpose:** App-wide settings

**Contexts:**
- `ColorModeContext` - Dark/Light mode
- `ConfirmDialogContext` - Global confirmation dialogs

### Routing (TanStack Router)

**File-based routing with type-safety:**

```
src/routes/
├── __root.tsx            # Root layout
├── index.tsx             # / (Dashboard)
├── login.tsx             # /login
├── einsaetze/
│   ├── index.tsx         # /einsaetze
│   └── $id.tsx           # /einsaetze/:id
├── etb/
│   ├── index.tsx         # /etb
│   └── $id.tsx           # /etb/:id
├── lagekarte/
│   └── $id.tsx           # /lagekarte/:id
└── admin/
    └── users.tsx         # /admin/users
```

**Features:**
- Type-safe navigation
- Auto-generated route tree
- Nested layouts
- Route guards (auth check)
- Suspense boundaries
- Code-splitting per route

### API Integration

#### Generated OpenAPI Client

**Workflow:**
1. Backend: NestJS controllers with `@ApiOperation()`, `@ApiResponse()` decorators
2. Generate: `pnpm run generate-api` (in root)
3. Output: `packages/shared/client/apis/` (auto-generated TypeScript)
4. Frontend: Import and wrap in TanStack Query hooks

**Example:**
```typescript
// Generated client (DO NOT EDIT)
export class EinsatzApi {
  async getEinsaetze(): Promise<Einsatz[]> {
    return this.request('/api/alpha/einsaetze');
  }
}

// Frontend wrapper
export const useEinsaetze = () => {
  return useQuery({
    queryKey: QUERY_KEYS.einsaetze,
    queryFn: () => api.einsatz().getEinsaetze()
  });
};
```

#### BackendApi Singleton

**Pattern:**
```typescript
// Singleton wrapper with error handling
export const api = {
  auth: () => new AuthApi(httpClient),
  einsatz: () => new EinsatzApi(httpClient),
  etb: () => new EtbApi(httpClient),
  lagekarte: () => new LagekarteApi(httpClient),
  users: () => new UsersApi(httpClient)
};
```

**Features:**
- Automatic token refresh on 401
- Cookie-based auth (no manual headers)
- Error handling with toast notifications
- Request/response interceptors

### Design System

#### Tailwind CSS Configuration

**Theme:**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {...},
        secondary: {...},
        danger: {...}
      }
    }
  }
};
```

**Usage:**
```tsx
<button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md">
  Click me
</button>
```

#### Headless UI Components

**Accessible primitives:**
- `Dialog` - Modals
- `Menu` - Dropdowns
- `Listbox` - Custom selects
- `Disclosure` - Accordions
- `Tab` - Tabs
- `Transition` - Animations

**Pattern:**
```tsx
import { Dialog } from '@headlessui/react';

<Dialog open={isOpen} onClose={close}>
  <Dialog.Panel className="...">
    <Dialog.Title>Title</Dialog.Title>
    {/* Content */}
  </Dialog.Panel>
</Dialog>
```

#### Icon System

**Phosphor Icons via react-icons:**
```tsx
import { PiUser, PiMapPin } from 'react-icons/pi';

<PiUser className="w-5 h-5" />
```

---

## 5. Integration Architecture

### Backend ↔ Frontend Communication

**REST API via Generated TypeScript Client:**

```
┌─────────────────────────────────────────┐
│ Frontend                                │
│ ┌─────────────────────────────────────┐ │
│ │ useEinsaetze() Hook                 │ │
│ │   ↓                                 │ │
│ │ TanStack Query                      │ │
│ │   ↓                                 │ │
│ │ api.einsatz().getEinsaetze()        │ │
│ │   ↓                                 │ │
│ │ Generated EinsatzApi Client         │ │
│ └─────────────────┬───────────────────┘ │
└───────────────────┼─────────────────────┘
                    │
                    │ HTTP GET /api/alpha/einsaetze
                    │ Cookie: accessToken=...
                    │
┌───────────────────▼─────────────────────┐
│ Backend                                 │
│ ┌─────────────────────────────────────┐ │
│ │ @Get() findAll()                    │ │
│ │   ↓                                 │ │
│ │ @UseGuards(JwtAuthGuard)            │ │
│ │   ↓                                 │ │
│ │ EinsatzController                   │ │
│ │   ↓                                 │ │
│ │ EinsatzService                      │ │
│ │   ↓                                 │ │
│ │ EinsatzRepository                   │ │
│ │   ↓                                 │ │
│ │ Prisma Client                       │ │
│ └─────────────────┬───────────────────┘ │
└───────────────────┼─────────────────────┘
                    │
                    │ SQL Query
                    │
┌───────────────────▼─────────────────────┐
│ PostgreSQL                              │
└─────────────────────────────────────────┘
```

### API Generation Workflow

**Step-by-Step:**

1. **Backend: Define API with OpenAPI decorators**
   ```typescript
   @ApiOperation({ summary: 'Get all missions' })
   @ApiResponse({ status: 200, type: [EinsatzDto] })
   @Get()
   async findAll(): Promise<Einsatz[]> {
     return this.einsatzService.findAll();
   }
   ```

2. **Generate OpenAPI Spec**
   ```bash
   # Automatic on backend start
   # Output: packages/backend/openapi.json
   ```

3. **Generate TypeScript Client**
   ```bash
   pnpm run generate-api
   # Uses: openapi-typescript-codegen
   # Output: packages/shared/client/apis/
   ```

4. **Frontend: Import Generated Client**
   ```typescript
   import { api } from '@/api/backend-api';

   const useEinsaetze = () => {
     return useQuery({
       queryKey: ['einsaetze'],
       queryFn: () => api.einsatz().getEinsaetze()
     });
   };
   ```

**Benefits:**
- ✅ Type-safety across frontend/backend
- ✅ Auto-completion in IDE
- ✅ Compile-time errors for API mismatches
- ✅ Single source of truth (Backend OpenAPI)
- ✅ No manual API client maintenance

### Data Flow (Optimistic Updates)

**Pattern (ADR-020):**

```
User Action (e.g., Create Einsatz)
  ↓
1. Frontend: Optimistic Update (TanStack Query)
   - Update local cache immediately
   - Show pending indicator
  ↓
2. Backend: API Request
   - POST /api/alpha/einsaetze
  ↓
3a. Success:
   - Replace optimistic data with server data
   - Remove pending indicator
   - Show success toast

3b. Failure:
   - Rollback optimistic update
   - Restore previous data
   - Show error toast
  ↓
4. Refetch (onSettled)
   - Ensure data consistency
```

**Implementation:**
```typescript
const useCreateEinsatz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => api.einsatz().create(data),

    onMutate: async (newEinsatz) => {
      await queryClient.cancelQueries(['einsaetze']);
      const previous = queryClient.getQueryData(['einsaetze']);

      queryClient.setQueryData(['einsaetze'], (old) => [
        ...old,
        { ...newEinsatz, id: `temp-${Date.now()}` }
      ]);

      return { previous };
    },

    onError: (err, vars, context) => {
      queryClient.setQueryData(['einsaetze'], context.previous);
      toast.error('Fehler beim Erstellen');
    },

    onSuccess: (data) => {
      queryClient.setQueryData(['einsaetze'], (old) =>
        old.map(e => e.id.startsWith('temp-') ? data : e)
      );
      toast.success('Einsatz erstellt');
    },

    onSettled: () => {
      queryClient.invalidateQueries(['einsaetze']);
    }
  });
};
```

### Error Handling

**Frontend:**
- TanStack Query error handling
- Toast notifications (Sonner)
- Automatic retry on 401 (token refresh)
- Global error boundary

**Backend:**
- NestJS exception filters
- Custom HTTP exceptions
- Validation pipes (class-validator)
- Global error interceptor

---

## 6. Domain Model

### Core Entities (9 Models)

#### 1. User

**Purpose:** Zentrale Benutzerverwaltung

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `username` (String, unique) - Username
- `passwordHash` (String, optional) - Nur für Admin-User
- `role` (UserRole) - USER, ADMIN, SUPER_ADMIN
- `isActive` (Boolean) - Account aktiv/inaktiv
- `isDeleted` (Boolean) - Soft-Delete
- `isLocked` (Boolean) - Manueller Lock

**Relationships:**
- `createdEinsaetze` - Einsätze erstellt
- `updatedEinsaetze` - Einsätze aktualisiert
- `archivedEinsaetze` - Einsätze archiviert
- `createdEtbs` - ETBs erstellt
- `createdEtbEintraege` - ETB-Einträge erstellt

**Business Rules:**
- Soft-Delete statt physischer Löschung
- Manueller Lock getrennt von Auto-Lock
- Password-Hash nur für Admin-User (Standard-User haben keins)

#### 2. Einsatz

**Purpose:** Einsatzverwaltung

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `alarmstichwort` (String, optional) - Kann leer sein (ADR-018)
- `alarmierungszeit` (DateTime, optional) - Kann leer sein
- `status` (EinsatzStatus) - ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
- `archivedAt` (DateTime, optional) - Archivierungszeitpunkt
- `archivedBy` (String, optional) - User ID des Archivierers

**Relationships:**
- `createdBy` - User (Creator)
- `updatedBy` - User (Updater)
- `archivedBy` - User (Archiver)
- `einsatztagebuch` - 1:1 Einsatztagebuch
- `lagekarte` - 1:1 Lagekarte

**Business Rules:**
- **No-Delete Policy (ADR-017):** Einsätze werden NIEMALS gelöscht, nur archiviert
- **Minimale Erstellung (ADR-018):** Keine Pflichtfelder außer ID
- **Computed Fields (ADR-019):** `name`, `completeness` werden berechnet

#### 3. Einsatztagebuch

**Purpose:** 1:1 Beziehung zu Einsatz, Container für ETB-Einträge

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `einsatzId` (String, unique) - Foreign Key zu Einsatz
- `status` (EtbStatus) - DRAFT, ACTIVE, LOCKED
- `lockedAt` (DateTime, optional) - Lock-Zeitpunkt
- `lockedBy` (String, optional) - User ID des Lockers

**Relationships:**
- `einsatz` - 1:1 Einsatz
- `eintraege` - 1:N EtbEintrag
- `createdBy` - User (Creator)
- `updatedBy` - User (Updater)
- `lockedBy` - User (Locker)

**Business Rules:**
- Status-Transition: DRAFT → ACTIVE → LOCKED
- Nach LOCKED: Keine Änderungen mehr möglich
- Automatische Archivierung nach 10 Jahren (EtbArchiv)

#### 4. EtbEintrag

**Purpose:** Einzelner Einsatztagebuch-Eintrag mit Versionierung

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `laufendeNummer` (Int) - Fortlaufende Nummer innerhalb ETB
- `timestampErstellung` (DateTime) - Erstellungszeitpunkt
- `timestampEreignis` (DateTime) - Ereigniszeitpunkt
- `kategorie` (EtbKategorie) - LAGE, MASSNAHME, KOMMUNIKATION
- `beschreibung` (String) - Freitext
- `isDeleted` (Boolean) - Soft-Delete

**Relationships:**
- `einsatztagebuch` - N:1 Einsatztagebuch
- `historie` - 1:N EtbEintragHistorie
- `createdBy` - User (Creator)
- `updatedBy` - User (Updater)
- `deletedBy` - User (Deleter)

**Business Rules:**
- Versionierung bei jeder Änderung
- Soft-Delete mit Zeitstempel
- Laufende Nummer für einfache Referenzierung

#### 5. EtbEintragHistorie

**Purpose:** Vollständige Versionshistorie eines ETB-Eintrags

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `eintragId` (String) - Foreign Key zu EtbEintrag
- `versionNumber` (Int) - Versionsnummer
- `modifiedAt` (DateTime) - Änderungszeitpunkt
- `changes` (JSON) - Diff der Änderungen

**Relationships:**
- `eintrag` - N:1 EtbEintrag
- `modifiedBy` - User (Modifier)

**Business Rules:**
- Unveränderbar nach Erstellung
- Vollständige Nachvollziehbarkeit
- JSON-Diff für effizienten Speicher

#### 6. EtbTextbaustein

**Purpose:** Wiederverwendbare Textbausteine für ETB-Einträge

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `titel` (String) - Titel des Bausteins
- `inhalt` (String) - Textinhalt
- `kategorie` (EtbKategorie) - Zugeordnete Kategorie
- `isDeleted` (Boolean) - Soft-Delete

**Relationships:**
- `createdBy` - User (Creator)
- `updatedBy` - User (Updater)

**Business Rules:**
- Global verfügbar (nicht Einsatz-spezifisch)
- Soft-Delete für Audit-Trail

#### 7. EtbArchiv

**Purpose:** 10-Jahre-Archivierung von ETBs mit Checksummen

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `einsatztagebuchId` (String, unique) - Foreign Key zu Einsatztagebuch
- `archivData` (JSON) - Vollständiger ETB-Snapshot
- `checksum` (String) - SHA-256 Checksum
- `archivedAt` (DateTime) - Archivierungszeitpunkt

**Relationships:**
- `einsatztagebuch` - 1:1 Einsatztagebuch
- `archivedBy` - User (Archiver)

**Business Rules:**
- Unveränderbar nach Erstellung
- SHA-256 Checksum für Integrität
- Automatische Erstellung bei ETB-Lock oder 10 Jahren

#### 8. Lagekarte

**Purpose:** Geografische Visualisierung eines Einsatzes

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `einsatzId` (String, unique) - Foreign Key zu Einsatz
- `centerLat` (Float, optional) - Zentrum Latitude
- `centerLng` (Float, optional) - Zentrum Longitude
- `centerMgrs` (String, optional) - MGRS-Koordinate (primary)
- `zoom` (Int, default: 13) - Zoom-Level
- `geoJson` (JSON) - GeoJSON Features

**Relationships:**
- `einsatz` - 1:1 Einsatz
- `pois` - 1:N LagekartePoi

**Business Rules:**
- MGRS-Koordinaten als Primär (mit Lat/Lng Fallback)
- GeoJSON für Zeichnungen (Polygone, Linien, etc.)
- Offline-fähig (Leaflet Tiles)

#### 9. LagekartePoi

**Purpose:** Point of Interest auf Lagekarte

**Key Fields:**
- `id` (String, cuid) - Primary Key
- `lagekarteId` (String) - Foreign Key zu Lagekarte
- `typ` (PoiType) - EINSATZSTELLE, SAMMELPLATZ, GEFAHRENBEREICH
- `name` (String) - POI-Name
- `latitude` (Float) - Lat-Koordinate
- `longitude` (Float) - Lng-Koordinate
- `mgrsKoordinate` (String, optional) - MGRS-Koordinate

**Relationships:**
- `lagekarte` - N:1 Lagekarte

**Business Rules:**
- Lat/Lng als Primär (mit MGRS optional)
- Icon basierend auf `typ`
- Clustering bei vielen POIs

### Entity Relationships (ER Diagram)

```
User
  │
  ├── 1:N ──► Einsatz (as Creator/Updater/Archiver)
  │           │
  │           ├── 1:1 ──► Einsatztagebuch
  │           │           │
  │           │           └── 1:N ──► EtbEintrag
  │           │                       │
  │           │                       └── 1:N ──► EtbEintragHistorie
  │           │
  │           └── 1:1 ──► Lagekarte
  │                       │
  │                       └── 1:N ──► LagekartePoi
  │
  ├── 1:N ──► Einsatztagebuch (as Creator/Updater/Locker)
  │
  ├── 1:N ──► EtbEintrag (as Creator/Updater/Deleter)
  │
  ├── 1:N ──► EtbEintragHistorie (as Modifier)
  │
  ├── 1:N ──► EtbTextbaustein (as Creator/Updater)
  │
  └── 1:N ──► EtbArchiv (as Archiver)
```

### Enums (5)

1. **UserRole:** USER, ADMIN, SUPER_ADMIN
2. **EinsatzStatus:** ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT
3. **EtbStatus:** DRAFT, ACTIVE, LOCKED
4. **EtbKategorie:** LAGE, MASSNAHME, KOMMUNIKATION, SONSTIGES
5. **PoiType:** EINSATZSTELLE, SAMMELPLATZ, GEFAHRENBEREICH, BEREITSTELLUNGSRAUM, ABSPERRUNG

---

## 7. Cross-Cutting Concerns

### Logging & Monitoring

**NOT FULLY IMPLEMENTED** (minimal logging only)

**Current State:**
- Console logging in development
- Error logging via NestJS exception filters
- No structured logging (Winston/Pino)
- No centralized monitoring

**TODO:**
- Structured logging framework
- Log aggregation (e.g., ELK Stack)
- APM (Application Performance Monitoring)
- Metrics collection (Prometheus)

### Error Handling

**Frontend:**
```typescript
// TanStack Query Error Handling
const useEinsaetze = () => {
  return useQuery({
    queryKey: ['einsaetze'],
    queryFn: () => api.einsatz().getEinsaetze(),
    onError: (error) => {
      if (error.status === 401) {
        // Auto-redirect to login
        router.navigate('/login');
      } else {
        toast.error(error.message);
      }
    }
  });
};

// Global Error Boundary
<ErrorBoundary
  fallback={<ErrorPage />}
  onError={(error) => {
    console.error('Global error:', error);
  }}
>
  {children}
</ErrorBoundary>
```

**Backend:**
```typescript
// Global Exception Filter
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString()
    });
  }
}
```

### Testing Strategy

**Status:** **Tests temporarily disabled** (per project notes)

**Current State:**
- ❌ Unit tests: Skipped
- ❌ Integration tests: Skipped
- ❌ E2E tests: Removed
- ❌ Testing infrastructure: Exists but not actively used

**Planned Strategy:**
- Unit tests: Jest (Backend + Frontend)
- Integration tests: Supertest (Backend API)
- E2E tests: Playwright (Frontend flows)
- Component tests: Testing Library (Frontend)

### Build & Deployment

#### Development Workflow

```bash
# Install dependencies
pnpm install

# Start all services
pnpm -r dev
# → Backend: http://localhost:3000
# → Frontend: http://localhost:3001
# → Tauri: Desktop app with webview

# Generate API client
pnpm run generate-api

# Build all
pnpm -r build
```

#### Production Deployment

**Backend:**
- Docker image with NestJS app
- PostgreSQL 17 container
- Environment variables via .env
- Health checks: `/api/health`

**Frontend:**
- Vite build for production
- Tauri bundle for desktop
- Static assets with CDN (optional)

**Workflow:**
```bash
# Build backend
cd packages/backend
pnpm build
docker build -t bluelight-hub-backend .

# Build frontend
cd packages/frontend
pnpm build

# Build Tauri app
pnpm tauri build
```

---

## 8. Quality Attributes

### Actually Implemented

#### Security

- ✅ **JWT Authentication:** Cookie-based, 3-Token-System
- ✅ **RBAC:** Role-based access control (USER, ADMIN, SUPER_ADMIN)
- ✅ **Audit Logging:** createdBy, updatedBy, deletedBy, archivedBy on all entities
- ✅ **HTTP-Only Cookies:** XSS-Schutz
- ✅ **SameSite Cookies:** CSRF-Schutz
- ✅ **Helmet Middleware:** Security headers
- ✅ **Rate Limiting:** Throttle Guards auf kritischen Endpunkten
- ✅ **Password Hashing:** Bcrypt (für Admin-User)

#### Data Integrity

- ✅ **No-Delete Policy:** Einsätze werden nur archiviert, nie gelöscht (ADR-017)
- ✅ **Soft-Delete:** User, ETB-Einträge, Textbausteine
- ✅ **10-Year Archival:** ETB mit SHA-256 Checksums (EtbArchiv)
- ✅ **Version History:** Vollständige Nachvollziehbarkeit (EtbEintragHistorie)
- ✅ **Audit Trail:** createdAt, updatedAt, deletedAt, archivedAt
- ✅ **Checksummen:** SHA-256 für Archiv-Integrität

#### Reliability

- ✅ **Automatic Token Refresh:** Transparente Token-Erneuerung bei 401
- ✅ **Optimistic Updates:** Sofortiges Feedback mit Rollback (ADR-020)
- ✅ **Request Retry:** Automatic retry bei Netzwerkfehlern (TanStack Query)
- ✅ **Error Boundaries:** Globale Frontend-Error-Handling
- ✅ **Health Checks:** Liveness/Readiness Probes

#### Usability

- ✅ **Dark Mode:** ColorModeContext
- ✅ **Keyboard Shortcuts:** Command Palette (CMDK)
- ✅ **Offline Maps:** Leaflet Tiles mit Offline-Region-Download
- ✅ **Toast Notifications:** Sonner für Feedback
- ✅ **Optimistic UI:** Sofortiges Feedback ohne Wartezeit
- ✅ **Form Validation:** Zod-Schemas mit klaren Fehlermeldungen
- ✅ **Responsive Design:** Tailwind CSS Breakpoints

#### Maintainability

- ✅ **Modular Architecture:** NestJS Modules + Atomic Design
- ✅ **Generated API Client:** Kein manueller API-Code
- ✅ **TypeScript Everywhere:** Vollständige Type-Safety
- ✅ **OpenAPI Documentation:** Auto-generated Swagger UI
- ✅ **Consistent Code Style:** ESLint + Prettier
- ✅ **Monorepo:** Shared types, consistent tooling

### Not Implemented / Aspirational

#### Performance

- ⚠️ **Caching:** Nur TanStack Query Client-Cache (kein Redis/Backend-Cache)
- ❌ **CDN:** Kein CDN für statische Assets
- ❌ **Database Indexing:** Minimal (nur Prisma auto-indexes)
- ❌ **Query Optimization:** Keine expliziten N+1 Optimierungen

#### Scalability

- ❌ **Horizontal Scaling:** Nicht implementiert (Single-Instance)
- ❌ **Load Balancing:** Nicht konfiguriert
- ❌ **Database Replication:** Nicht eingerichtet
- ❌ **Message Queue:** Keine Async-Processing

#### Offline Capability

- ⚠️ **Offline Maps:** Nur Map-Tiles (keine Daten-Sync)
- ❌ **Service Worker:** Nicht implementiert
- ❌ **IndexedDB:** Keine lokale Datenbank
- ❌ **Sync Engine:** Keine Konfliktauflösung

#### Real-Time Communication

- ❌ **WebSocket:** Ordner existiert, aber leer
- ❌ **Server-Sent Events:** Nicht implementiert
- ❌ **Push Notifications:** Nicht implementiert

---

## 9. Architecture Decisions (ADRs)

### Implemented ADRs (✅)

#### ADR-005: Event Sourcing → CRUD + Audit Log

**Status:** ✅ Fully implemented

**Decision:** CRUD-basierter Ansatz mit Versionierung und Audit-Trail

**Implementation:**
- Soft-Delete only (keine physischen Löschungen)
- Versionierte Einträge (EtbEintragHistorie)
- Separater Audit-Table für alle Aktionen
- Status-Feld für ETB (DRAFT → ACTIVE → LOCKED)

**Rationale:**
- Konsistenz mit Prisma/PostgreSQL Stack
- Einfachere Implementierung
- Schnellere Time-to-Market
- Performance: Direkte Queries ohne Event-Replay

#### ADR-007: JWT-Authentifizierung

**Status:** ✅ Fully implemented

**Implementation:**
- Cookie-basierte JWT-Tokens (HTTP-Only, Secure, SameSite)
- 3-Token-System: Access (15min), Refresh (7d), Admin
- Passport JWT Strategy
- Automatic token refresh on 401

#### ADR-010: MFA Removal

**Status:** ✅ Implemented

**Decision:** Vollständige Entfernung von Multi-Factor Authentication

**Rationale:**
- Zu komplex für initialen Release
- Fokus auf Kernfeatures
- Kann später ergänzt werden

#### ADR-011: Admin Roles System

**Status:** ✅ Fully implemented

**Implementation:**
- 3 Rollen: USER, ADMIN, SUPER_ADMIN
- Role-based Guards (`JwtAuthGuard`, `AdminJwtAuthGuard`)
- Granular permissions per endpoint

#### ADR-013: Tailwind CSS + Headless UI Migration

**Status:** ✅ Fully implemented

**Decision:** Migration von Chakra UI zu Tailwind CSS + Headless UI

**Implementation:**
- Atomic Design mit Tailwind-Klassen
- Headless UI für accessible Komponenten
- Bundle-Size Reduktion um ~60%
- Performance-Verbesserung (kein CSS-in-JS Runtime)

**Rationale:**
- Bessere Performance (Zero-Runtime)
- Kleinere Bundle-Size
- Tailwind IntelliSense in IDE
- Headless UI für Accessibility

#### ADR-016: Unified Authentication

**Status:** ✅ Fully implemented

**Decision:** Ein einziger `/api/auth/unified` Endpunkt für Login & Auto-Register

**Implementation:**
```typescript
POST /api/auth/unified
{
  username: string,
  password?: string // optional
}

// Backend prüft:
if (userExists) {
  // Login-Flow
  validatePassword();
  return { user, token, isNewUser: false };
} else {
  // Auto-Register-Flow
  createUser();
  return { user, token, isNewUser: true };
}
```

**Rationale:**
- Bessere UX (keine Verwirrung Login vs. Register)
- Schnellerer Onboarding
- Weniger Code (ein Formular, ein Endpunkt)

#### ADR-017: No-Delete Policy für Einsätze

**Status:** ✅ Fully implemented

**Decision:** Einsätze werden NIEMALS physisch gelöscht

**Implementation:**
- `archivedAt`, `archivedBy` Felder
- Status-Transition: → ARCHIVIERT
- Prisma-Query-Filter für archivierte Einsätze
- Expliziter `/archive` Endpunkt

**Rationale:**
- Compliance (DRK-Anforderungen)
- Audit-Trail
- Datenintegrität
- Nachvollziehbarkeit

#### ADR-018: Minimale Einsatzerstellung

**Status:** ✅ Fully implemented

**Decision:** Einsätze können ohne Pflichtparameter erstellt werden

**Implementation:**
- Alle Felder optional (außer ID)
- Automatische Namengenerierung aus verfügbaren Feldern
- Inkrementelle Vervollständigung
- Completeness-Score (0-100%)

**Rationale:**
- Flexibilität im Einsatz
- Schnelle Anlage ohne Vorkenntnisse
- Nachträgliche Vervollständigung

#### ADR-019: Computed Fields für Einsatzdaten

**Status:** ✅ Fully implemented

**Decision:** `name` und `completeness` als Computed Fields

**Implementation:**
```typescript
// name: Automatisch generiert
name = alarmstichwort || `Einsatz ${id.slice(0,8)}` || 'Unbenannter Einsatz';

// completeness: Berechnet aus ausgefüllten Feldern
completeness = (filledFields / totalFields) * 100;
```

**Rationale:**
- User Experience (sinnvoller Name ohne Pflicht)
- Übersicht über Datenvollständigkeit
- Keine Duplikation in Datenbank

#### ADR-020: Optimistic UI Updates

**Status:** ✅ Fully implemented with TanStack Query

**Decision:** Sofortige UI-Aktualisierung mit Rollback bei Fehler

**Implementation:**
- TanStack Query `onMutate`, `onError`, `onSuccess`, `onSettled`
- Automatic rollback bei Server-Fehler
- Visuelle Indikatoren für Pending-Status
- Toast-Notifications für Feedback

**Rationale:**
- Beste UX (sofortiges Feedback)
- Gefühlte Performance verbessern
- User-Flow nicht unterbrechen
- Stresssituationen berücksichtigen

#### ADR-021: BMAD Documentation Integration

**Status:** ✅ This document

**Decision:** Nutzung von BMAD Method für Architektur-Dokumentation

**Rationale:**
- arc42 teilweise veraltet
- BMAD für brownfield-Analyse geeignet
- Single Source of Truth aus Code

### Partially Implemented ADRs (⚠️)

#### ADR-001: Verbindungskonzept

**Status:** ⚠️ Partially implemented

**Decision:** Verschiedene Konnektivitätsszenarien (lokal, vollständig, autonom)

**Reality:**
- ✅ HTTP REST API (lokal + remote)
- ❌ Keine Offline-Sync
- ❌ Kein autonomer Modus
- ⚠️ Nur Offline-Maps (Leaflet Tiles)

#### ADR-004: Tauri Desktop App

**Status:** ⚠️ Implemented, but limited

**Reality:**
- ✅ Tauri 2.8.5 Desktop App
- ✅ Cross-Platform (Windows, macOS, Linux)
- ❌ Keine nativen Features genutzt (z.B. Dateisystem)
- ❌ Keine Offline-Features

#### ADR-006: Docker Deployment

**Status:** ⚠️ Partially implemented

**Reality:**
- ✅ Dockerfile vorhanden
- ✅ docker-compose.yml für Development
- ❌ Production-Deployment nicht dokumentiert
- ❌ Kubernetes nicht evaluiert

#### ADR-009: Dashboard-Architektur

**Status:** ⚠️ Frontend-only

**Reality:**
- ✅ 4 Dashboard-Komponenten im Frontend
- ❌ Kein Backend-Dashboard-Modul
- ❌ Keine Echtzeit-Updates

#### ADR-015: ETB Filter Implementation

**Status:** ⚠️ Not fully verified

**Reality:**
- Implementierung nicht im Detail verifiziert
- Wahrscheinlich vorhanden (13 ETB-Molecules)

### Not Implemented ADRs (❌)

#### ADR-002: CRDTs für Datensynchronisation

**Status:** ❌ "In Prüfung", not implemented

**Reality:**
- Keine CRDT-Bibliotheken
- Keine Konfliktauflösung
- Nur Standard HTTP REST

#### ADR-003: Monolith vs. Microservice

**Status:** ❌ Monolith gewählt, aber keine klaren Service-Grenzen

**Reality:**
- Modularer Monolith (NestJS Modules)
- Keine Service-Grenzen definiert
- Keine Microservice-Architektur

#### ADR-008: Offene Entscheidungen

**Status:** ❌ Dokument mit TODOs, keine finalen Entscheidungen

#### ADR-012: API Versioning Strategy

**Status:** ⚠️ `alpha` implementiert, aber keine v1/v2-Strategie

**Reality:**
- `/api/alpha/{resource}` für Domain-Endpunkte
- Keine Backward-Compatibility-Strategie
- Kein Deprecation-Prozess

---

## 10. Future Considerations

### Current Limitations

**Technical Debt:**
- Tests disabled (no test coverage)
- Minimal logging (no structured logging)
- No monitoring/observability
- No caching strategy (nur TanStack Query)
- No database indexing optimization
- WebSocket-Ordner existiert, aber leer

**Feature Gaps:**
- Keine Offline-Sync (nur Offline-Maps)
- Keine Echtzeit-Kommunikation (WebSocket)
- Keine Ressourcen-Verwaltung (Personal, Fahrzeuge, Material)
- Keine Externe System-Integration (TETRA, Digitalfunk, FMS)
- Kein Dashboard-Backend-Modul

**Architecture Mismatches:**
- arc42 verspricht Hexagonal/CQRS/Event Sourcing → Reality: Standard 3-Layer
- arc42 verspricht Offline-Sync → Reality: Nur HTTP REST
- arc42 verspricht Ressourcen-Module → Reality: Nicht implementiert

### Potential Improvements

**Based on actual code, not aspirations:**

#### Short-Term (Next Sprint)

1. **Enable Tests:**
   - Jest Unit Tests (Backend + Frontend)
   - Testing Library Component Tests
   - Supertest Integration Tests

2. **Structured Logging:**
   - Winston/Pino für Backend
   - Log-Levels (DEBUG, INFO, WARN, ERROR)
   - Request-ID Tracking

3. **Database Optimization:**
   - Analyze slow queries (pg_stat_statements)
   - Add missing indexes (auf Basis von Query-Patterns)
   - Optimize N+1 queries (Prisma `include`)

4. **Frontend Performance:**
   - Code-splitting per route (bereits teilweise)
   - Bundle-Analysis (Vite Bundle Analyzer)
   - Image Optimization (lazy loading)

#### Mid-Term (Next Quarter)

1. **Monitoring & Observability:**
   - APM (Application Performance Monitoring)
   - Metrics collection (Prometheus)
   - Centralized logging (ELK Stack)
   - Error tracking (Sentry)

2. **WebSocket for Real-Time:**
   - Real-time notifications
   - Live updates (ohne Polling)
   - Collaborative editing (ETB)

3. **Offline-First:**
   - Service Worker
   - IndexedDB für lokale Datenbank
   - Sync-Engine mit Konfliktauflösung
   - Background-Sync API

4. **Caching Strategy:**
   - Redis für Backend-Cache
   - Query-Result-Caching
   - CDN für statische Assets

#### Long-Term (Next Year)

1. **Ressourcen-Verwaltung:**
   - Personal-Modul
   - Fahrzeug-Modul
   - Material-Modul
   - Templates & Vorlagen

2. **Externe System-Integration:**
   - TETRA Digitalfunk (falls Schnittstelle verfügbar)
   - FMS (Funkmeldesystem)
   - Alarmierungssysteme
   - GIS-Integration

3. **Scalability:**
   - Horizontal scaling (Load Balancer)
   - Database replication (Read-Replicas)
   - Message Queue (RabbitMQ/Redis)
   - Kubernetes Deployment

4. **Mobile Apps:**
   - React Native für iOS/Android
   - Shared Logic mit Web-Frontend
   - Native Features (Push, Offline)

---

## 11. Documentation Generation

**Source:** Exhaustive codebase scan (BMM Document-Project Workflow v1.2.0)

**Method:**
1. **Step 1-2:** Scan backend structure, API contracts
2. **Step 3:** Scan data models (Prisma schema)
3. **Step 4:** Scan frontend structure, components
4. **Step 5:** Scan state management patterns
5. **Step 6:** Analyze integration patterns
6. **Step 7:** Technology stack analysis
7. **Step 8:** Compare with arc42 documentation

**Validation:**
- ✅ Cross-referenced with actual implementation
- ✅ Verified against Prisma schema
- ✅ Checked OpenAPI documentation
- ✅ Reviewed ADRs vs. actual code
- ✅ Tested API endpoints (via Swagger UI)

**Status:** Current and accurate as of 2025-01-11

**Differences from arc42:**
- **Removed:** Hexagonal Architecture, CQRS, Event Sourcing, CRDTs, Externe Systeme
- **Updated:** Technologie-Stack, Module-Liste, API-Design, State-Management
- **Added:** TanStack Suite, Tailwind CSS, Lagekarte-Modul, Computed Fields

---

## 12. Quick Reference

### Development Commands

```bash
# Install
pnpm install

# Dev (all)
pnpm -r dev

# Dev (specific)
pnpm --filter @bluelight-hub/backend dev
pnpm --filter @bluelight-hub/frontend dev

# Generate API Client
pnpm run generate-api

# Build
pnpm -r build

# Tauri
pnpm tauri dev
pnpm tauri build

# Database
pnpm --filter @bluelight-hub/backend prisma migrate dev
pnpm --filter @bluelight-hub/backend prisma studio

# Lint
pnpm -r lint
pnpm -r lint:fix

# Format
pnpm -r format
```

### Important Paths

```
/packages/backend/
  src/
    auth/                     # Authentication
    einsatz/                  # Mission management
    etb/                      # ETB
    user-management/          # User management
    modules/lagekarte/        # Map module
    health/                   # Health checks
    common/                   # Shared utilities
    prisma/                   # Prisma client
  prisma/
    schema.prisma            # Database schema
    migrations/              # SQL migrations

/packages/frontend/
  src/
    components/
      atoms/                 # Base components (24)
      molecules/             # Combined (46)
      organisms/             # Complex (52)
      templates/             # Layouts (4)
      pages/                 # Routes (6)
    hooks/                   # Custom hooks
    stores/                  # TanStack Store
    routes/                  # TanStack Router
    api/                     # Backend API client
    utils/                   # Helpers

/packages/shared/
  client/apis/               # Generated API client (DO NOT EDIT)

/docs/
  architecture/              # arc42 docs (partially outdated)
  .bmm-*.md                 # BMM-generated docs (CURRENT)
```

### Key URLs

```
Backend:       http://localhost:3000
Swagger UI:    http://localhost:3000/api
Frontend:      http://localhost:3001
Prisma Studio: http://localhost:5555

Health:        http://localhost:3000/api/health
OpenAPI JSON:  http://localhost:3000/api-json
```

### Architecture Patterns Cheat Sheet

| What | Where | How |
|------|-------|-----|
| **API erstellen** | Backend | NestJS Controller + `@ApiOperation()` |
| **API nutzen** | Frontend | `pnpm run generate-api` → `api.{module}().{method}()` |
| **Daten fetchen** | Frontend | TanStack Query `useQuery()` |
| **State verwalten** | Frontend | TanStack Store (nur UI-State) |
| **Form erstellen** | Frontend | TanStack Form + Zod |
| **Component bauen** | Frontend | Atomic Design + Tailwind CSS |
| **Authentifizierung** | Backend | `@UseGuards(JwtAuthGuard)` |
| **Admin-Route** | Backend | `@UseGuards(AdminJwtAuthGuard)` |
| **Datenbank ändern** | Backend | Prisma Migrate: `prisma migrate dev` |
| **Neue Entität** | Backend | Prisma Schema → Migrate → Generate Client |

---

**End of Architecture Documentation**

**Last Updated:** 2025-01-11
**Version:** 1.0.0
**Status:** ✅ Current and accurate
**Source:** Actual codebase implementation
**Method:** BMM Document-Project Workflow v1.2.0

---

**Note:** This documentation replaces the partially outdated arc42 documentation. For ADR details, see `docs/architecture/adr/`. For arc42 comparison, see `docs/.bmm-arc42-reality-check.md`.
