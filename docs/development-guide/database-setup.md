# Database Setup

## Option 1: Docker PostgreSQL (Recommended for Development)

**Start PostgreSQL container:**
```bash
docker-compose up -d postgres
```

**Verify database is running:**
```bash
docker ps | grep bluelight-hub-postgres
docker logs bluelight-hub-postgres
```

**Default credentials (from docker-compose.yml):**
- User: `bluelight`
- Password: `bluelight`
- Database: `bluelight-hub`
- Port: `3092` (Docker Host, mapped from container's 5432)

**Connection URL:**
```env
DATABASE_URL="postgresql://bluelight:bluelight@localhost:3092/bluelight-hub?schema=public"
```

## Option 2: Local PostgreSQL Installation

**Install PostgreSQL 17:**
```bash
# macOS (Homebrew)
brew install postgresql@17
brew services start postgresql@17

# Ubuntu/Debian
sudo apt-get install postgresql-17
sudo systemctl start postgresql

# Windows (PostgreSQL Installer)
# Download from: https://www.postgresql.org/download/windows/
```

**Create database and user:**
```sql
-- Connect as postgres user
psql -U postgres

-- Create user and database
CREATE USER bluelight WITH PASSWORD 'bluelight';
CREATE DATABASE bluelight_hub OWNER bluelight;
GRANT ALL PRIVILEGES ON DATABASE bluelight_hub TO bluelight;

-- Exit
\q
```

## Prisma Migrations

**Generate Prisma Client:**
```bash
pnpm --filter @bluelight-hub/backend prisma:generate
```

**Run migrations (create tables):**
```bash
pnpm --filter @bluelight-hub/backend prisma:migrate
```

This applies all migrations from `packages/backend/prisma/migrations/`.

**Seed database (optional):**
```bash
pnpm --filter @bluelight-hub/backend prisma:seed
```

**Prisma Studio (GUI):**
```bash
pnpm --filter @bluelight-hub/backend prisma:studio
```

Opens browser at `http://localhost:3093` for visual database management.

## Database Schema Overview

**9 Models:**
- User (authentication, role-based access)
- Einsatz (mission management)
- Einsatztagebuch (ETB - mission log)
- EtbEintrag (ETB entries)
- EtbEintragHistorie (ETB entry versioning)
- EtbTextbaustein (ETB text templates)
- EtbArchiv (10-year archival with SHA-256 checksums)
- Lagekarte (situation map)
- Poi (points of interest with MGRS coordinates)

**5 Enums:**
- UserRole (SUPER_ADMIN, ADMIN, USER)
- EinsatzStatus (ANGELEGT, IN_BEARBEITUNG, ABGESCHLOSSEN, ARCHIVIERT)
- EinsatztagebuchStatus (AKTIV, ABGESCHLOSSEN)
- PoiType (FAHRZEUG, EINSATZORT, etc.)
- EtbEintragPrioritaet (ROUTINE, WICHTIG, KRITISCH)

---
