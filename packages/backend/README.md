# Bluelight Hub – Backend (NestJS + Prisma)

## Überblick

- NestJS 11 (REST, Swagger), Prisma ORM (PostgreSQL)
- Auth: JWT (Cookie-basiert), Guards/Decorators
- Cross-Cutting: Caching, Performance-Logging, Exception-Filter
- API-Doku: Swagger + Compodoc

## Schnellstart

- Voraussetzungen: pnpm, Node LTS, laufende Postgres (siehe `docker-compose.yml`)
- Installation im Monorepo: `pnpm install`
- DB migrieren: `pnpm --filter @bluelight-hub/backend prisma:migrate`
- Entwickeln: `pnpm --filter @bluelight-hub/backend dev` (oder Root: `pnpm dev`)
- Build: `pnpm --filter @bluelight-hub/backend build`

## Nützliche Skripte

- `dev`/`start:dev`: Watch-Mode
- `test`, `test:watch`, `test:cov`: Jest Unit-Tests
- Prisma: `prisma:migrate`, `prisma:deploy`, `prisma:seed`, `prisma:studio`
- Docs: `docs:build` (Compodoc), `docs:serve`

## Swagger & API-Client

- Swagger: `http://localhost:3091/api` (JSON: `/api-json`)
- Der TypeScript-Fetch-Client wird aus `packages/shared` generiert. Nach API-Änderungen:
    1) Backend starten
    2) `pnpm --filter @bluelight-hub/shared generate-api`

## Datenbank

- Prisma Schema: `packages/backend/prisma/schema.prisma`
- Migrationen per Prisma-Skripte (siehe oben)

## TypeScript Path Aliases

Das Backend nutzt TypeScript Path Aliases für saubere Imports gemäß Hexagonal Architecture (siehe ADR-022):

| Alias | Ziel | Layer | Verwendung |
|-------|------|-------|------------|
| `@domain/*` | `src/domain/*` | Domain Layer | Business Logic, Entities, Value Objects, Aggregates |
| `@application/*` | `src/application/*` | Application Layer | Use Cases, Commands, Queries |
| `@infrastructure/*` | `src/infrastructure/*` | Infrastructure Layer | Repositories, Adapters, External Services |

**Beispiel:**
```typescript
// ✅ RICHTIG: Mit Path Alias
import { Result } from '@domain/common/result';
import { GeoCoordinate } from '@domain/value-objects/geo-coordinate';

// ❌ FALSCH: Relative Imports
import { Result } from '../../../domain/common/result';
```

**Konfiguration:**
- TypeScript: `tsconfig.json` (Zeilen 29-34) - Compiler-Auflösung
- Jest: `jest.config.js` (Zeilen 12-16) - Test-Module-Auflösung

**Dependency Rules (ADR-022):**
```
Domain Layer (keine externen Dependencies)
    ↑ importiert von
Application Layer (Domain Layer only)
    ↑ importiert von
Infrastructure Layer (Domain + Application Layer)
```

**Validation:**
- Pre-commit Hook: `tsc --noEmit` prüft TypeScript-Kompilierung (~1.5s)
- Madge: `pnpm check:deps` erkennt zirkuläre Dependencies

## Pre-commit Hooks

Vor jedem Commit werden automatisch folgende Checks ausgeführt:

1. **TypeScript Smoke Test** (~1.5s)
   - Kommando: `pnpm --filter @bluelight-hub/backend exec tsc --noEmit`
   - Prüft: TypeScript-Kompilierung ohne Code-Generierung
   - Verhindert: Commits mit Type-Errors (z.B. fehlende Imports, Type-Mismatches)
   - Bei Fehler: Commit wird abgebrochen mit klarer Fehlermeldung

2. **Code Quality Checks** (Biome Linter)
   - Kommando: `pnpm lint-staged`
   - Prüft: Code-Style, Imports, Formatting
   - Auto-Fix: Viele Probleme werden automatisch korrigiert

**Hook-Konfiguration:** `.husky/pre-commit`

**Hinweise:**
- Hooks laufen automatisch - keine manuelle Aktion erforderlich
- Gesamtlaufzeit: ~2-3 Sekunden (akzeptabel für schnelles Feedback)
- **Niemals `--no-verify` verwenden** - würde wichtige Checks überspringen

## Policies & Architektur

- No-Delete-Policy für „Einsatz" (Archivierung statt Löschen)
- Computed Fields & Optimistic UI sind im Code und in den ADRs dokumentiert
- Coding Standards, Source-Tree, Tech-Stack: siehe `docs/architecture/`
- **ADR-022:** Domain Layer als Backend Subfolder (TypeScript Path Aliases)

## Testing

- Unit-Tests via Jest
- E2E (Supertest/Jest); Coverage für Backend aktiv

## Troubleshooting

- Fehlende ENV-Variablen: `.env.example` als Vorlage verwenden
- Datenbankfehler: Verbindung prüfen, Prisma `generate/migrate` ausführen

