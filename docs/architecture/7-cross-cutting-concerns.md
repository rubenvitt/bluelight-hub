# 7. Cross-Cutting Concerns

## Logging & Monitoring

**NOT FULLY IMPLEMENTED** (minimal logging only)

**Current State:**
- Console logging in development
- Error logging via NestJS exception filters
- No structured logging (Winston/Pino)
- No centralized monitoring

**TODO:**
- Structured logging framework
- Log aggregation (e.g., ELK Stack)
- APM (Application Performance Monitoring)
- Metrics collection (Prometheus)

## Error Handling

**Frontend:**
```typescript
// TanStack Query Error Handling
const useEinsaetze = () => {
  return useQuery({
    queryKey: ['einsaetze'],
    queryFn: () => api.einsatz().getEinsaetze(),
    onError: (error) => {
      if (error.status === 401) {
        // Auto-redirect to login
        router.navigate('/login');
      } else {
        toast.error(error.message);
      }
    }
  });
};

// Global Error Boundary
<ErrorBoundary
  fallback={<ErrorPage />}
  onError={(error) => {
    console.error('Global error:', error);
  }}
>
  {children}
</ErrorBoundary>
```

**Backend:**
```typescript
// Global Exception Filter
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString()
    });
  }
}
```

## Testing Strategy

**Status:** **Tests temporarily disabled** (per project notes)

**Current State:**
- ❌ Unit tests: Skipped
- ❌ Integration tests: Skipped
- ❌ E2E tests: Removed
- ❌ Testing infrastructure: Exists but not actively used

**Planned Strategy:**
- Unit tests: Jest (Backend + Frontend)
- Integration tests: Supertest (Backend API)
- E2E tests: Playwright (Frontend flows)
- Component tests: Testing Library (Frontend)

## Build & Deployment

### Development Workflow

```bash
# Install dependencies
pnpm install

# Start all services
pnpm -r dev
# → Backend: http://localhost:3091
# → Frontend: http://localhost:3090
# → Tauri: Desktop app with webview

# Generate API client
pnpm run generate-api

# Build all
pnpm -r build
```

### Production Deployment

**Backend:**
- Docker image with NestJS app
- PostgreSQL 17 container
- Environment variables via .env
- Health checks: `/api/health`

**Frontend:**
- Vite build for production
- Tauri bundle for desktop
- Static assets with CDN (optional)

**Workflow:**
```bash
# Build backend
cd packages/backend
pnpm build
docker build -t bluelight-hub-backend .

# Build frontend
cd packages/frontend
pnpm build

# Build Tauri app
pnpm tauri build
```

---
