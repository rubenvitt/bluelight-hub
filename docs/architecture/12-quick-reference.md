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
Backend:       http://localhost:3090
Swagger UI:    http://localhost:3090/api
Frontend:      http://localhost:3091
Prisma Studio: http://localhost:3093

Health:        http://localhost:3090/api/health
OpenAPI JSON:  http://localhost:3090/api-json
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

---

**End of Architecture Documentation**

**Last Updated:** 2025-01-11
**Version:** 1.0.0
**Status:** ✅ Current and accurate
**Source:** Actual codebase implementation
**Method:** BMM Document-Project Workflow v1.2.0

---

**Note:** This documentation replaces the partially outdated arc42 documentation. For ADR details, see `docs/architecture/adr/`. For arc42 comparison, see `docs/.bmm-arc42-reality-check.md`.
