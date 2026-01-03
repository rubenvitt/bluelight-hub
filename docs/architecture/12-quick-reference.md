# 12. Quick Reference

## Development Commands

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

## Important Paths

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

## Key URLs

```
Backend:       http://localhost:3091
Swagger UI:    http://localhost:3091/api
Frontend:      http://localhost:3090
Prisma Studio: http://localhost:3093

Health:        http://localhost:3091/api/health
OpenAPI JSON:  http://localhost:3091/api-json
```

## Architecture Patterns Cheat Sheet

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

## Database Patterns

### Upsert Pattern (Race Condition Prevention)

**Wann verwenden:** Bei parallelen Requests auf UNIQUE Constraints (z.B. mehrere User weisen gleichzeitig dieselbe Rolle zu).

**Problem:** Race Conditions können zu `DuplicateKeyError` führen, wenn zwei Requests gleichzeitig `create()` aufrufen.

**Lösung:** Prisma `upsert()` mit named UNIQUE constraint garantiert last-write-wins Semantik.

```typescript
// Prisma Schema (UNIQUE Constraint definieren)
model EinsatzRollenbesetzung {
  id                 String @id @default(cuid())
  einsatzId          String
  rollenDefinitionId String
  personId           String

  // UNIQUE constraint verhindert doppelte Besetzung
  @@unique([einsatzId, rollenDefinitionId], name: "unique_rolle_per_einsatz")
}

// Handler (Upsert statt create)
const besetzung = await prisma.einsatzRollenbesetzung.upsert({
  where: {
    unique_rolle_per_einsatz: {  // Named constraint aus Schema
      einsatzId: command.einsatzId,
      rollenDefinitionId: command.rollenDefinitionId,
    },
  },
  create: {
    einsatzId: command.einsatzId,
    rollenDefinitionId: command.rollenDefinitionId,
    personId: command.personId,
    createdBy: command.userId,
  },
  update: {
    personId: command.personId,
    updatedBy: command.userId,
    updatedAt: new Date(),
  },
});
```

**Garantien:**
- **Idempotenz:** Gleicher Request 2x → gleiches Ergebnis
- **Last-Write-Wins:** Letzter Request überschreibt (kein Error)
- **Atomarität:** Mit `TransactionalCommandHandler` für Outbox-Events

**Verweis:** ADR-023 (vollständige Dokumentation), Story 0-2 (Tests), Story 5.0/5.1 (Implementierung)

## Authentication & Authorization

### 3-Token-System (ADR-007b)

| Token | Cookie-Name | TTL | Verwendung | Endpoint | Cookie-Flags |
|-------|------------|-----|------------|----------|--------------|
| **accessToken** | `accessToken` | 15 min | Normale Authentifizierung | Alle `/api/*` (außer public) | `HttpOnly: true`<br>`Secure: true`<br>`SameSite: Strict` |
| **refreshToken** | `refreshToken` | 7 Tage | Token-Erneuerung | `POST /api/auth/refresh` | `HttpOnly: true`<br>`Secure: true`<br>`SameSite: Strict` |
| **adminToken** | `adminToken` | 15 min | Admin-Berechtigung | Admin-Endpunkte (zusätzlich!) | `HttpOnly: true`<br>`Secure: true`<br>`SameSite: Strict` |

**Cookie-Flags Erklärung:**
- `HttpOnly: true` - JavaScript kann nicht auf Cookie zugreifen (verhindert XSS-Angriffe)
- `Secure: true` - Cookie wird nur über HTTPS übertragen
- `SameSite: Strict` - CSRF-Schutz (Cookie nur bei Same-Site-Requests)

**Wichtig:** Admin-Endpunkte benötigen BEIDE Tokens (accessToken + adminToken)

### Guards & Roles

| Guard | Benötigte Tokens | User-Rolle | Verwendung |
|-------|------------------|------------|------------|
| `JwtAuthGuard` | `accessToken` | USER, ADMIN, SUPER_ADMIN | Normale authentifizierte Endpunkte |
| `AdminJwtAuthGuard` | `accessToken` + `adminToken` | ADMIN, SUPER_ADMIN | Admin-Operationen |

### Auth Endpoints

```typescript
// Login (erhält accessToken + refreshToken)
POST /api/auth/unified
{ username: string, password?: string }
→ Returns: { user, accessToken, refreshToken, isNewUser }

// Admin-Login (erhält zusätzlich adminToken)
POST /api/auth/admin-login
{ username: string, password: string }
→ Returns: { user, accessToken, refreshToken, adminToken }

// Token Refresh
POST /api/auth/refresh
(Cookie: refreshToken)
→ Returns: { accessToken }

// Logout
POST /api/auth/logout
→ Clears all cookies
```

### Beispiel: Backend Guard-Verwendung

```typescript
// Normale authentifizierte Route (nur accessToken)
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@Request() req) {
  return req.user; // User aus accessToken
}

// Admin-Route (accessToken + adminToken)
@UseGuards(AdminJwtAuthGuard)
@Post('admin/delete-user/:id')
deleteUser(@Param('id') id: string, @Request() req) {
  // Beide Tokens validiert:
  // 1. accessToken → user authentifiziert
  // 2. adminToken → user hat Admin-Rechte
  return this.userService.delete(id);
}
```

---

**End of Architecture Documentation**

**Last Updated:** 2025-01-11
**Version:** 1.0.0
**Status:** ✅ Current and accurate
**Source:** Actual codebase implementation
**Method:** BMM Document-Project Workflow v1.2.0

---

**Note:** This documentation replaces the partially outdated arc42 documentation. For ADR details, see `docs/architecture/adr/`. For arc42 comparison, see `docs/.bmm-arc42-reality-check.md`.
