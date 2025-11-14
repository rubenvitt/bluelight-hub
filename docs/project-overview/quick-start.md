# Quick Start

## Prerequisites

- Node.js ≥ 24.0.0
- pnpm 10.20.0+
- PostgreSQL 17.x (or Docker)
- Rust (for Tauri frontend)

## Installation

```bash
# Clone repository
git clone https://github.com/rubenvitt/bluelight-hub.git
cd bluelight-hub

# Install dependencies
pnpm install

# Setup database (Docker)
docker-compose up -d postgres

# Run migrations
pnpm --filter @bluelight-hub/backend prisma:migrate

# Generate API client
pnpm run generate-api

# Start all services
pnpm -r dev
```

**Access Points:**
- Frontend (Vite): http://localhost:3091
- Backend API: http://localhost:3090
- Swagger Docs: http://localhost:3090/api
- Prisma Studio: http://localhost:3093 (`pnpm --filter @bluelight-hub/backend prisma:studio`)

---
