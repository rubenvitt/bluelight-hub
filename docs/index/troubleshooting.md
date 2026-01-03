# Troubleshooting

## Common Issues

| Problem | Solution |
|---------|----------|
| **Database connection fails** | Check `DATABASE_URL` in `.env`, verify PostgreSQL is running |
| **API client type errors** | Run `pnpm run generate-api` to regenerate client |
| **Port 3091 already in use** | Kill process: `lsof -i :3091` then `kill -9 <PID>` |
| **Prisma client out of sync** | Run `pnpm --filter @bluelight-hub/backend prisma:generate` |
| **JWT 401 errors** | Verify JWT secrets in `.env`, clear browser cookies |
| **Tauri build fails** | Install platform dependencies (see [Development Guide](./development-guide.md)) |

**Detailed Troubleshooting:** [Development Guide - Troubleshooting](./development-guide.md#troubleshooting)

---
