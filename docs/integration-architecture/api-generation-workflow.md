# API Generation Workflow

## Step-by-Step Process

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Backend Development                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Developer adds new endpoint with OpenAPI decorators        │ │
│  │ Example: @ApiOperation({ summary: 'Get Einsatz by ID' })  │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Start Backend (Swagger Auto-Generation)                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ pnpm --filter @bluelight-hub/backend dev                   │ │
│  │ NestJS generates OpenAPI spec at /api-json                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Generate API Client (Shared Package)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ pnpm run generate-api                                       │ │
│  │ OpenAPI Generator reads /api-json                           │ │
│  │ Generates TypeScript client in packages/shared/client/      │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Frontend Uses Generated Client                               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ import { api } from '@/lib/api';                            │ │
│  │ const response = await api.einsaetze().findOne(id);        │ │
│  │ // Type-safe, auto-completion works!                       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration Files

**Backend OpenAPI Config:**
```typescript
// packages/backend/src/main.ts
const config = new DocumentBuilder()
  .setTitle('BlueLight Hub API')
  .setDescription('Emergency response management API')
  .setVersion('1.0')
  .addBearerAuth()
  .addCookieAuth('accessToken')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);

// Expose JSON for code generation
app.use('/api-json', (req, res) => {
  res.json(document);
});
```

**Shared Package Generation Script:**
```json
// packages/shared/package.json
{
  "scripts": {
    "generate-api": "openapi-generator-cli generate -i http://localhost:3090/api-json -g typescript-axios -o client --additional-properties=useSingleRequestParameter=true"
  }
}
```

## Generated Files

```
packages/shared/client/
├── apis/
│   ├── AuthApi.ts              # Auth endpoints
│   ├── EinsaetzeApi.ts         # Einsatz CRUD
│   ├── EinsatztagebuchApi.ts   # ETB management
│   ├── LagekarteApi.ts         # Lagekarte + POIs
│   ├── UsersApi.ts             # User management
│   └── ...
├── models/
│   ├── EinsatzResponseDto.ts   # Response types
│   ├── CreateEinsatzDto.ts     # Request types
│   ├── UserResponseDto.ts
│   └── ...
└── index.ts                    # Re-exports all APIs
```

**Usage in Frontend:**
```typescript
// packages/frontend/src/lib/api.ts
import { Configuration, EinsaetzeApi, AuthApi, UsersApi } from '@bluelight-hub/shared/client';

const config = new Configuration({
  basePath: import.meta.env.VITE_API_URL,
});

export const api = {
  einsaetze: () => new EinsaetzeApi(config),
  auth: () => new AuthApi(config),
  users: () => new UsersApi(config),
  // ... other APIs
};
```

---
