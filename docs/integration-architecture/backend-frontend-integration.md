# Backend → Frontend Integration

## REST API Exposure

**Backend (NestJS):**
- Controllers expose RESTful endpoints
- OpenAPI decorators generate Swagger documentation
- DTOs validate request/response payloads
- Guards enforce authentication/authorization

**Example Controller:**
```typescript
// Backend: packages/backend/src/einsaetze/einsaetze.controller.ts
@Controller('einsaetze')
@ApiTags('Einsaetze')
export class EinsaetzeController {
  @Get()
  @ApiOperation({ summary: 'Get all Einsätze' })
  @ApiResponse({ status: 200, type: [EinsatzResponseDto] })
  async findAll(): Promise<EinsatzResponseDto[]> {
    return this.einsaetzeService.findAll();
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive Einsatz' })
  @ApiResponse({ status: 200, type: EinsatzResponseDto })
  async archive(@Param('id') id: string): Promise<EinsatzResponseDto> {
    return this.einsaetzeService.archive(id);
  }
}
```

**Swagger UI:**
- Accessible at `http://localhost:3090/api` (development)
- Interactive API documentation
- Test endpoints directly from browser

**OpenAPI JSON:**
- Generated at `http://localhost:3090/api-json`
- Input for OpenAPI Generator (generates TypeScript client)

## CORS Configuration

**Backend:** Configures allowed origins for cross-origin requests

```typescript
// packages/backend/src/main.ts
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3091'],
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});
```

**Environment:**
```env
ALLOWED_ORIGINS=http://localhost:3091,http://localhost:3090
```

---
