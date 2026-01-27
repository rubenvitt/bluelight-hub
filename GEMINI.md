# GEMINI.md - Bluelight Hub

**Sprache:** Deutsch mit mir, englischer Code, deutsche JSDoc/Kommentare

## Projekt-Überblick

Bluelight Hub ist eine **Web + Tauri Desktop App** für Blaulicht-Organisationen (Katastrophenschutz).

| Package | Stack | Beschreibung |
|---------|-------|--------------|
| `frontend/` | React 19 + Vite + Tauri | Desktop App mit Feature-based Architektur |
| `backend/` | NestJS + Prisma + PostgreSQL | Hexagonale Architektur (Domain → Application → Infrastructure → Modules) |
| `shared/client/` | Generiert | API Client - **NIEMALS manuell ändern!** |

## MCP Server (NUTZE SIE!)

- **Serena** - Symbolische Code-Navigation, Refactoring, Semantic Search
- **Context7** - Aktuelle Library-Dokumentation abrufen
- **Claude-in-Chrome** - Frontend testen (Login: rubeen / MyPass123*)

## Kritische Regeln

### API Workflow (IMMER so!)

```
Backend-Endpoint → pnpm run generate-api → TanStack Query Hook → Komponente
```

**NIEMALS** manuelle `fetch()` Calls oder API-Helper!

### Tech Stack (NUR diese!)

| Bereich | Erlaubt | Verboten |
|---------|---------|----------|
| UI | Tailwind CSS + Headless UI | CSS-in-JS, andere Frameworks |
| Forms | @tanstack/react-form + Zod | HTML Forms, Formik |
| State | @tanstack/react-query (Server), @tanstack/react-store (Client) | Redux |
| Linting | Biome | ESLint, Prettier |

### Backend DI Import (AC1)

```typescript
// ✅ Injectable Classes mit "import"
import { MyService } from './my.service';

// ❌ NIEMALS "import type" für Injectable Classes (bricht NestJS DI!)
import type { MyService } from './my.service';
```

Pre-commit Hook prüft automatisch. Check: `pnpm --filter @bluelight-hub/backend check:di:imports`

### Controller Response Decorators (AC7)

```typescript
// ✅ IMMER Custom Decorators für korrekte OpenAPI-Generierung
@ApiWrappedResponse(EinsatzDto, { description: '...' })
@ApiWrappedCreatedResponse(EinsatzDto, { description: '...' })

// ❌ NIEMALS Standard Swagger Decorators
@ApiOkResponse({ type: EinsatzDto })  // Bricht API-Client Generation!
```

## Wichtige Commands

```bash
# Development
pnpm -r dev                          # Alles starten
pnpm --filter @bluelight-hub/frontend dev:vite  # Nur Web (ohne Tauri)
pnpm run generate-api                # API Client generieren

# Database (IMMER mit Name, sonst interaktiv!)
pnpm --filter @bluelight-hub/backend prisma:migrate --name add_feature_xyz

# Tests
pnpm --filter @bluelight-hub/backend test

# Code Quality
pnpm lint                            # Biome
pnpm --filter @bluelight-hub/backend check:arch  # Circular Dependencies
```

## Ports

- Frontend: `localhost:3090`
- Backend API + Swagger UI: `localhost:3091/api`

## Commit Format

```
<emoji>(<context>): <title>

- <description point 1>
- <description point 2> 
- ...
```

✨ Feature | 🐛 Fix | ♻️ Refactor | 📝 Docs | 🧪 Test | 💥 Breaking
**NIEMALS** `--no-verify`!

## Architektur-Layers (Backend)

```
modules/        → HTTP Controller (NestJS-spezifisch)
    ↓
infrastructure/ → DB, Events, Adapters
    ↓
application/    → Use Cases, Commands, Queries (nur @Injectable erlaubt)
    ↓
domain/         → Business Rules (Framework-agnostic, Result Pattern)
```

Abhängigkeiten fließen **IMMER nach innen**.

## Pattern-Referenz

Diese Patterns im Code nachschauen (nicht auswendig lernen):

- **Feature-Struktur:** `frontend/src/features/einsatz/`
- **TransactionalCommandHandler:** `backend/src/application/common/handlers/`
- **Result Pattern:** `backend/src/domain/common/result.ts`
- **API Wrapper Decorator:** `backend/src/modules/common/decorators/api-wrapped-response.decorator.ts`
- **DI Tokens:** `backend/src/infrastructure/di-tokens.ts`
- **Event Registry:** `backend/src/infrastructure/outbox/event-deserializer.ts` - Neue Events MÜSSEN hier registriert werden!

## Dokumentation

Bei Architektur-Änderungen: `/docs/architecture/` (arc42) und `/docs/adr/` aktualisieren!

## Dokumente

Dokumente in Deutsch verfassen.
