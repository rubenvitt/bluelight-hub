# Environment Variables

## Required
- `DATABASE_URL`: PostgreSQL Connection String
- `JWT_SECRET`: Secret für JWT-Signierung
- `JWT_REFRESH_SECRET`: Secret für Refresh-Token-Signierung
- `JWT_ADMIN_SECRET`: Secret für Admin-Token-Signierung

## Optional
- `NODE_ENV`: `development` | `production` (default: development)
- `APP_URL`: Base URL der Anwendung (default: http://localhost:3091)
- `UPLOADS_PATH`: Pfad für File-Uploads (default: uploads)
- `PORT`: Server-Port (default: 3091)

---
