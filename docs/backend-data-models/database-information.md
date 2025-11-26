# Database Information

- **Typ:** PostgreSQL
- **ORM:** Prisma (prisma-client-js)
- **ID-Generierung:**
  - Primär: `cuid()` für die meisten Entitäten
- **Migration-Strategie:** Prisma Migrate mit SQL-Migrations in `prisma/migrations/`
- **Schema-Location:** `/packages/backend/prisma/schema.prisma`
