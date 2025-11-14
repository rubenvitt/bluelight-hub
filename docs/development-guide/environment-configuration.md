# Environment Configuration

## Backend Environment Variables

**Location:** `packages/backend/.env`

Copy example file and customize:
```bash
cp packages/backend/.env.example packages/backend/.env
```

**Required Variables:**

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/bluelight_hub?schema=public"

# Server
NODE_ENV=development
PORT=3090
BACKEND_PORT=3090
APP_URL=http://localhost:3090

# CORS
ALLOWED_ORIGINS=http://localhost:3091,http://localhost:3090

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-change-this-in-production
ADMIN_JWT_SECRET=your-super-secret-admin-jwt-key-change-this-in-production
ADMIN_JWT_EXPIRATION=15m

# File Uploads
UPLOADS_PATH=../../uploads  # Relative to packages/backend/dist/src
```

**Optional Feature Flags:**

```env
# Error Handling
ERROR_HANDLING_ENABLE_ADVANCED_RETRY=true
ERROR_HANDLING_ENABLE_DUPLICATE_DETECTION=true
ERROR_HANDLING_ENABLE_METRICS=true
ERROR_HANDLING_ENABLE_CIRCUIT_BREAKER=true
ERROR_HANDLING_ENABLE_RATE_LIMITING=true

# Logging
LOG_LEVEL=info  # debug, info, warn, error

# Cache (in-memory)
CACHE_TTL_SECONDS=3600      # 1 hour default
CACHE_MAX_ITEMS=1000

# Rate Limiting
RATE_LIMITER_WINDOW_MS=60000      # 1 minute
RATE_LIMITER_MAX_REQUESTS=100

# Geocoding (Lagekarte)
NOMINATIM_API_URL=https://nominatim.openstreetmap.org
NOMINATIM_RATE_LIMIT=1  # Requests per second (OSM policy)
```

## Frontend Environment Variables

**Location:** `packages/frontend/.env`

Copy example file and customize:
```bash
cp packages/frontend/.env.example packages/frontend/.env
```

**Required Variables:**

```env
# API Configuration
VITE_API_URL=http://localhost:3090
```

**Note:** Vite requires `VITE_` prefix for environment variables to be exposed to client.

---
