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

- Swagger: `http://localhost:3090/api` (JSON: `/api-json`)
- Der TypeScript-Fetch-Client wird aus `packages/shared` generiert. Nach API-Änderungen:
    1) Backend starten
    2) `pnpm --filter @bluelight-hub/shared generate-api`

## Datenbank

- Prisma Schema: `packages/backend/prisma/schema.prisma`
- Migrationen per Prisma-Skripte (siehe oben)

## Policies & Architektur

- No-Delete-Policy für „Einsatz“ (Archivierung statt Löschen)
- Computed Fields & Optimistic UI sind im Code und in den ADRs dokumentiert
- Coding Standards, Source-Tree, Tech-Stack: siehe `docs/architecture/`

## Testing

- Unit-Tests via Jest
- E2E (Supertest/Jest); Coverage für Backend aktiv

## Troubleshooting

- Fehlende ENV-Variablen: `.env.example` als Vorlage verwenden
- Datenbankfehler: Verbindung prüfen, Prisma `generate/migrate` ausführen

