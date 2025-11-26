# Backend Part (packages/backend/)

**Typ:** REST API Backend
**Framework:** NestJS 11 mit Prisma ORM
**Entry Point:** `src/main.ts`
**Port:** 3000 (dev), konfigurierbar via `PORT` env
**Database:** PostgreSQL via Prisma

## Backend-Struktur

```
packages/backend/
├── src/
│   ├── main.ts                         # 🚀 Application entry point (Bootstrap)
│   │   # - NestJS app initialization
│   │   # - Swagger/OpenAPI setup (KRITISCH für API-Generation!)
│   │   # - Global pipes, filters, interceptors
│   │   # - Versioned API (v-alpha, v-1)
│   │   # - CORS, helmet, rate limiting
│   │
│   ├── app.module.ts                   # Root module with global imports
│   │   # - ConfigModule (global config)
│   │   # - PrismaModule (database)
│   │   # - CacheModule (Redis-backed)
│   │   # - All feature modules
│   │
│   ├── modules/                        # 🏛️ Feature modules (Domain-driven)
│   │   └── lagekarte/                  # Situation Map Module
│   │       ├── controllers/
│   │       │   ├── lagekarte.controller.ts  # Map state CRUD
│   │       │   ├── poi.controller.ts        # POI (Point of Interest) CRUD
│   │       │   └── geocoding.controller.ts  # Address → Coordinates
│   │       ├── services/
│   │       │   ├── lagekarte.service.ts     # Map business logic
│   │       │   ├── poi.service.ts           # POI business logic
│   │       │   ├── geocoding.service.ts     # Nominatim API integration
│   │       │   └── mgrs-converter.service.ts # Military Grid Reference System
│   │       ├── repositories/
│   │       │   ├── lagekarte.repository.ts  # Lagekarte data access
│   │       │   └── poi.repository.ts        # POI data access
│   │       ├── dto/
│   │       │   ├── save-lagekarte-state.dto.ts # GeoJSON state
│   │       │   ├── create-poi.dto.ts        # POI creation (geocoding support)
│   │       │   ├── update-poi.dto.ts        # POI updates
│   │       │   └── poi-response.dto.ts      # POI API response
│   │       ├── validators/
│   │       │   └── coordinates-or-address.validator.ts # Custom Zod validator
│   │       └── lagekarte.module.ts          # Module definition
│   │
│   ├── auth/                           # 🔐 Authentication & Authorization Module
│   │   ├── auth.controller.ts          # Auth endpoints (14 endpoints)
│   │   │   # - POST /auth/login (user login)
│   │   │   # - POST /auth/admin/login (admin login)
│   │   │   # - POST /auth/admin/setup (initial admin setup)
│   │   │   # - POST /auth/refresh (token refresh)
│   │   │   # - GET /auth/check (auth status)
│   │   │   # - POST /auth/logout (logout)
│   │   │   # - GET /auth/users (public user list)
│   │   ├── auth.service.ts             # Core auth logic
│   │   │   # - JWT generation (access + refresh + admin tokens)
│   │   │   # - Password hashing (bcrypt)
│   │   │   # - Token validation and refresh
│   │   │   # - Admin initialization
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts       # Standard user authentication
│   │   │   ├── jwt-refresh.guard.ts    # Refresh token validation
│   │   │   └── admin-jwt-auth.guard.ts # Admin-only authentication
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts         # Passport JWT strategy (user)
│   │   │   ├── jwt-refresh.strategy.ts # Passport JWT refresh strategy
│   │   │   └── admin-jwt.strategy.ts   # Passport JWT strategy (admin)
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts # @CurrentUser() parameter decorator
│   │   ├── dto/                        # 17 DTOs für Auth-Endpoints
│   │   │   ├── auth-request.dto.ts     # Login credentials
│   │   │   ├── auth-response.dto.ts    # Login response with user + tokens
│   │   │   ├── admin-setup.dto.ts      # Initial admin setup
│   │   │   ├── refresh-response.dto.ts # Token refresh response
│   │   │   └── ... (weitere DTOs)
│   │   ├── mappers/                    # Domain → DTO Mapper
│   │   │   ├── auth-response.mapper.ts # User → AuthResponseDto
│   │   │   └── admin-auth.mapper.ts    # Admin → AdminLoginResponseDto
│   │   └── utils/
│   │       └── auth.utils.ts           # Password hashing, validation
│   │
│   ├── einsatz/                        # 🚨 Mission Management Module (Core Domain)
│   │   ├── einsatz.controller.ts       # Einsatz endpoints (12 endpoints)
│   │   │   # - GET /einsatz (list with filters + pagination)
│   │   │   # - POST /einsatz (create new mission)
│   │   │   # - GET /einsatz/:id (get single)
│   │   │   # - PATCH /einsatz/:id (update)
│   │   │   # - DELETE /einsatz/:id (soft-delete)
│   │   │   # - GET /einsatz/:id/navigation (prev/next/first/last)
│   │   │   # - GET /einsatz/status/counts (status statistics)
│   │   │   # - GET /einsatz/:id/completeness (data completeness check)
│   │   │   # - POST /einsatz/:id/archive (archive mission)
│   │   ├── einsatz.service.ts          # Business logic
│   │   │   # - Create with auto-generated name (animals + adjectives)
│   │   │   # - Status transitions with validation
│   │   │   # - Completeness calculation (0-100%)
│   │   │   # - Navigation (prev/next/first/last)
│   │   │   # - Archive with user tracking
│   │   ├── einsatz.repository.ts       # Data access layer
│   │   │   # - Prisma-based queries with relations
│   │   │   # - Soft-delete support
│   │   │   # - Complex filtering (status, date ranges, search)
│   │   ├── dto/                        # 10 DTOs
│   │   │   ├── create-einsatz.dto.ts   # Minimal creation (only date)
│   │   │   ├── update-einsatz.dto.ts   # Partial updates
│   │   │   ├── einsatz-response.dto.ts # Full response with relations
│   │   │   ├── completeness-response.dto.ts # Completeness metrics
│   │   │   ├── navigation-response.dto.ts # Prev/next IDs
│   │   │   └── ... (weitere DTOs)
│   │   ├── events/
│   │   │   └── einsatz-erstellt.event.ts # Domain event
│   │   ├── exceptions/
│   │   │   └── einsatz-not-found.exception.ts # Custom exception
│   │   └── utils/
│   │       ├── name-generator.util.ts  # Adjektiv + Tier (z.B. "Fleißiger Dachs")
│   │       ├── status-transitions.util.ts # Valid status transitions
│   │       └── completeness.util.ts    # Calculate field completeness
│   │
│   ├── etb/                            # 📝 Einsatztagebuch (Mission Log) Module
│   │   ├── etb.controller.ts           # ETB endpoints (9 endpoints)
│   │   │   # - POST /etb (create ETB for Einsatz)
│   │   │   # - GET /etb/:einsatzId (get ETB with entries)
│   │   │   # - POST /etb/:einsatzId/entry (add entry)
│   │   │   # - PATCH /etb/entry/:entryId (update entry)
│   │   │   # - DELETE /etb/entry/:entryId (soft-delete entry)
│   │   │   # - GET /etb/entry/:entryId/history (entry history)
│   │   │   # - GET /etb/textbausteine (templates)
│   │   │   # - POST /etb/textbausteine (create template)
│   │   ├── etb.service.ts              # Business logic
│   │   │   # - Versioning system (entry modifications tracked)
│   │   │   # - Soft-delete with deletedBy tracking
│   │   │   # - Textbausteine (text templates) management
│   │   │   # - History for every entry modification
│   │   ├── etb.repository.ts           # Data access layer
│   │   │   # - Prisma-based CRUD with relations
│   │   │   # - History retrieval with pagination
│   │   ├── dto/                        # 5 DTOs
│   │   │   ├── create-etb.dto.ts       # ETB creation
│   │   │   ├── create-etb-eintrag.dto.ts # Entry creation
│   │   │   ├── update-etb-eintrag.dto.ts # Entry update
│   │   │   ├── etb-response.dto.ts     # ETB with entries
│   │   │   └── etb-pagination.dto.ts   # Pagination params
│   │   └── etb.constants.ts            # Constants (categories, etc.)
│   │
│   ├── user-management/                # 👥 User Management Module
│   │   ├── user.controller.ts          # User profile endpoints (2 endpoints)
│   │   │   # - GET /users/profile (current user profile)
│   │   │   # - PATCH /users/profile (update profile)
│   │   ├── user-management.controller.ts # Admin user management (6 endpoints)
│   │   │   # - GET /user-management (list all users)
│   │   │   # - POST /user-management (create user)
│   │   │   # - PATCH /user-management/:id (update user)
│   │   │   # - POST /user-management/:id/lock (lock user)
│   │   │   # - POST /user-management/:id/unlock (unlock user)
│   │   │   # - DELETE /user-management/:id (soft-delete user)
│   │   ├── user-management.service.ts  # Admin operations
│   │   ├── user.repository.ts          # Data access layer
│   │   ├── dto/                        # 7 DTOs
│   │   │   ├── create-user.dto.ts      # User creation (admin only)
│   │   │   ├── update-user.dto.ts      # User updates
│   │   │   ├── lock-user.dto.ts        # Lock reason
│   │   │   └── ... (weitere DTOs)
│   │   └── mappers/
│   │       └── user-management.mapper.ts # User → UserDto
│   │
│   ├── health/                         # ⚕️ Health Check Module
│   │   ├── health.controller.ts        # Health endpoints (3 endpoints)
│   │   │   # - GET /health (liveness probe)
│   │   │   # - GET /health/readiness (readiness probe)
│   │   │   # - GET /health/detailed (detailed health + database)
│   │   ├── health.module.ts            # TerminusModule integration
│   │   └── prisma-health.indicator.ts  # Custom Prisma health indicator
│   │
│   ├── cli/                            # 🖥️ CLI Commands (NestJS Commander)
│   │   ├── cli.module.ts               # CLI module definition
│   │   └── commands/
│   │       └── admin-reset-password.command.ts # Admin password reset
│   │
│   ├── common/                         # 🔧 Shared utilities and infrastructure
│   │   ├── decorators/
│   │   │   ├── api-wrapped-response.decorator.ts # Swagger wrapper
│   │   │   ├── is-cuid.decorator.ts  # Zod Nanoid validator
│   │   │   ├── rate-limit.decorator.ts # Rate limiting decorator
│   │   │   └── skip-transform.decorator.ts # Skip response transformation
│   │   ├── guards/
│   │   │   └── rate-limit.guard.ts     # Rate limiting guard (Redis-backed)
│   │   ├── interceptors/
│   │   │   ├── transform.interceptor.ts # Response wrapper (data, meta, errors)
│   │   │   └── performance.interceptor.ts # Performance logging
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts # Global exception handler
│   │   ├── pipes/
│   │   │   └── parse-cuid.pipe.ts    # Nanoid validation pipe
│   │   ├── dto/
│   │   │   └── pagination.dto.ts       # Pagination params (page, limit)
│   │   ├── interfaces/
│   │   │   └── api-response.interface.ts # ApiResponse<T> interface
│   │   ├── services/
│   │   │   ├── app-config.service.ts   # Centralized config service
│   │   │   ├── cache-rate-limiter.service.ts # Redis rate limiter
│   │   │   └── cache-duplicate-detection.service.ts # Duplicate request detection
│   │   └── utils/
│   │       ├── circuit-breaker.util.ts # Circuit breaker pattern
│   │       ├── retry.util.ts           # Retry logic with exponential backoff
│   │       ├── performance-logger.util.ts # Performance metrics
│   │       └── prisma.util.ts          # Prisma helper utilities
│   │
│   ├── config/                         # ⚙️ Configuration modules
│   │   ├── config.module.ts            # ConfigModule setup
│   │   └── security.config.ts          # Security settings (JWT, CORS, etc.)
│   │
│   ├── prisma/                         # 🗄️ Prisma integration
│   │   ├── prisma.service.ts           # PrismaClient wrapper
│   │   └── prisma.module.ts            # Global Prisma module
│   │
│   ├── websocket/                      # 🔌 WebSocket support (future)
│   │   └── event/                      # WebSocket event types
│   │
│   ├── utils/                          # 🛠️ Global utilities
│   │   ├── date.util.ts                # Date formatting
│   │   └── url.util.ts                 # URL helpers
│   │
│   ├── app.controller.ts               # Root API endpoints
│   │   # - GET / (API info)
│   │   # - GET /meta (API metadata)
│   │
│   └── main-cli.ts                     # 🖥️ CLI entry point (NestJS Commander)
│
├── prisma/                             # 📊 Database Schema & Migrations
│   ├── schema.prisma                   # Prisma schema (9 models, 5 enums)
│   │   # Models:
│   │   # - User (authentication, roles, soft-delete, manual lock)
│   │   # - Einsatz (mission management, status, soft-delete)
│   │   # - Einsatztagebuch (mission log, versioning)
│   │   # - EtbEintrag (log entries, soft-delete)
│   │   # - EtbEintragHistorie (entry history/versioning)
│   │   # - EtbTextbaustein (text templates)
│   │   # - EtbArchiv (ETB archive)
│   │   # - Lagekarte (situation map state)
│   │   # - LagekartePoi (points of interest)
│   │   #
│   │   # Enums:
│   │   # - UserRole (SUPER_ADMIN, ADMIN, USER)
│   │   # - EinsatzStatus (ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT)
│   │   # - EtbKategorie (EINSATZLEITUNG, FUEHRUNGSSTAB, TECHNISCHE_LEITUNG, etc.)
│   │   # - PoiType (FIRE, WATER, VEHICLE, PERSON, BUILDING, etc.)
│   │   # - PoiPriority (LOW, NORMAL, HIGH, CRITICAL)
│   │
│   ├── migrations/                     # Database migrations (auto-generated)
│   └── seed.ts                         # Database seeding script
│
├── scripts/
│   └── find-missing-jsdoc.ts           # JSDoc coverage checker
│
├── test/                               # E2E Tests (removed as per project notes)
│
├── uploads/                            # File uploads storage
│   └── lagekarte/                      # Lagekarte screenshots
│
├── package.json                        # Backend dependencies
│   # Key dependencies:
│   # - @nestjs/core, @nestjs/common (NestJS framework)
│   # - @nestjs/swagger (OpenAPI generation)
│   # - @prisma/client, prisma (ORM)
│   # - passport, passport-jwt (authentication)
│   # - bcrypt (password hashing)
│   # - cuid (ID generation)
│   # - @nestjs/terminus (health checks)
│   # - @nestjs/cache-manager (caching)
│   # - nest-commander (CLI)
│
├── nest-cli.json                       # NestJS CLI configuration
├── tsconfig.json                       # TypeScript configuration
└── biome.json                          # Biome linter configuration
```

## Backend-Zusammenfassung

**Feature Modules:** 7 Hauptmodule (Auth, Einsatz, ETB, Lagekarte, User Management, Health, CLI)
**API Endpoints:** ~60 REST-Endpunkte (versioned via `/v-alpha/`, zukünftig `/v-1/`)
**Database Models:** 9 Prisma Models, 5 Enums
**Authentication:** JWT-based (3 token types: access, refresh, admin)
**Architecture Pattern:** Repository Pattern mit Service-Layer
**API Documentation:** Swagger/OpenAPI auto-generated (kritisch für Frontend!)

**Integration Points:**
- Exposes REST API at `http://localhost:3000/api`
- OpenAPI spec at `http://localhost:3000/api-docs`
- Consumed by Frontend via generated client in `packages/shared`

---
