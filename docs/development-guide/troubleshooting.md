# Troubleshooting

## Database Connection Issues

**Problem:** `Error: P1001: Can't reach database server`

**Solutions:**
1. Verify PostgreSQL is running:
   ```bash
   # Docker
   docker ps | grep postgres

   # Local
   pg_isready -h localhost -p 5432
   ```

2. Check DATABASE_URL in `.env`:
   ```bash
   # Must match your database credentials
   DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"
   ```

3. Test connection manually:
   ```bash
   psql -h localhost -p 5432 -U bluelight -d bluelight_hub
   ```

## Prisma Client Out of Sync

**Problem:** `Unknown argument 'include'` or similar Prisma errors

**Solution:** Regenerate Prisma client:
```bash
pnpm --filter @bluelight-hub/backend prisma:generate
```

## API Client Type Errors

**Problem:** TypeScript errors about missing API methods

**Solution:** Regenerate API client after backend changes:
```bash
pnpm run generate-api
```

## Port Already in Use

**Problem:** `Error: listen EADDRINUSE: address already in use :::3091`

**Solutions:**
1. Kill process on port 3091:
   ```bash
   # Find PID
   lsof -i :3091

   # Kill process
   kill -9 <PID>
   ```

2. Change port in `.env`:
   ```env
   PORT=3091
   BACKEND_PORT=3091
   ```

## Tauri Build Failures

**Problem:** Tauri build fails on macOS/Linux

**Solutions:**
1. Install platform dependencies (see [Prerequisites](#prerequisites))
2. Update Rust:
   ```bash
   rustup update stable
   ```
3. Clear Tauri cache:
   ```bash
   rm -rf packages/frontend/src-tauri/target
   ```

## Docker Compose Issues

**Problem:** `database "bluelight_hub" does not exist`

**Solution:** Docker Compose auto-creates database. If missing:
```bash
docker-compose down -v  # Remove volumes
docker-compose up -d    # Recreate
```

## JWT Authentication Issues

**Problem:** `401 Unauthorized` or token refresh fails

**Solutions:**
1. Verify JWT secrets in `.env` are set and consistent
2. Check cookie settings (httpOnly, sameSite, secure)
3. Clear browser cookies and re-login
4. Verify ALLOWED_ORIGINS includes frontend URL

## File Upload Issues

**Problem:** `ENOENT: no such file or directory` for uploads

**Solution:** Create uploads directory:
```bash
mkdir -p uploads
```

Or update UPLOADS_PATH in `.env`:
```env
UPLOADS_PATH=../../uploads  # Relative to packages/backend/dist/src
```

## Lint/Biome Errors

**Problem:** Biome reports formatting errors

**Solution:** Auto-fix with:
```bash
pnpm lint
```

Or check only:
```bash
pnpm lint:check
```

## Node Version Mismatch

**Problem:** `error @tauri-apps/cli@2.9.4: The engine "node" is incompatible`

**Solution:** Upgrade Node.js to ≥ 24.0.0:
```bash
# Using nvm
nvm install 24
nvm use 24

# Using Homebrew (macOS)
brew install node@24
```

## Tests Currently Disabled

**Important Note:** Test infrastructure was removed in PR #257 (2025-01-28).

- `pnpm test` - Not functional
- `pnpm test:cov` - Not functional
- `pnpm test:ui` - Not functional

See [README.md](../README.md#tests) for migration guidance.

---
