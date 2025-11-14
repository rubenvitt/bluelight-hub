# Docker Setup

## Development with Docker Compose

**Services:**
- `postgres`: PostgreSQL 17 database
- `app`: Backend application (production build)

**Start all services:**
```bash
docker-compose up
```

**Start in background:**
```bash
docker-compose up -d
```

**View logs:**
```bash
docker-compose logs -f          # All services
docker-compose logs -f postgres # PostgreSQL only
docker-compose logs -f app      # Backend only
```

**Stop services:**
```bash
docker-compose down
```

**Rebuild and restart:**
```bash
docker-compose up --build
```

## Docker Environment Variables

Override defaults in `.env` file (project root):

```env
DATABASE_USER=bluelight
DATABASE_PASSWORD=bluelight
DATABASE_NAME=bluelight-hub
DATABASE_PORT=3092  # Host port (container uses 5432)
```

## Database Persistence

PostgreSQL data is persisted in named volume:
```yaml
volumes:
  postgres_data:
    name: bluelight-hub-postgres-data
```

**Reset database:**
```bash
docker-compose down -v  # Remove volumes
docker-compose up -d
```

## Dockerfile

Location: `/Dockerfile`

**Multi-stage build:**
1. **Build stage:** Compile TypeScript, generate Prisma client
2. **Production stage:** Minimal Node.js runtime with compiled artifacts

**Image features:**
- Health check endpoint: `/api/health`
- Volume mount for uploads: `./uploads:/app/uploads`
- Resource limits: 1GB max, 512MB reserved

---
