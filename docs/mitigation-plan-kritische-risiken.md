# Mitigation-Plan: Kritische Risiken (Score=9)

**Datum:** 2025-12-10
**Status:** Aktionsplan
**Priorität:** BLOCKER - Vor Go-Live zu lösen

---

## Übersicht

| # | Risk ID | Kategorie | Epic | Kurzbeschreibung | Sprint | Owner |
|---|---------|-----------|------|------------------|--------|-------|
| 1 | R-E1-001 | SEC | 1 | Fehlende RBAC für Admin | Sprint 1 | Dev |
| 2 | R-E5-002 | DATA | 5 | Race Condition Rollenzuweisung | Sprint 1 | Dev |
| 3 | R-E8-001 | TECH | 8 | GeoJSON Koordinaten vertauscht | Sprint 1 | Dev |
| 4 | R-E3-001 | PERF | 3 | Transaction Timeout ETB | Sprint 2 | Dev |
| 5 | R-E6-001 | PERF | 6 | Dashboard Load >2s | Sprint 2 | Dev |
| 6 | R-E2-003 | TECH | 2 | Archiviertes Fahrzeug in Einsatz | Sprint 2 | Dev |
| 7 | R-E5-001 | BUS | 5 | Qualifikations-Validierung Race | Sprint 2 | Dev |
| 8 | R-E7-004 | DATA | 7 | HiOrg Mapping Inkonsistenz | Sprint 3 | Dev |
| 9 | R-E8-002 | PERF | 8 | Realtime Connection Exhaustion | Sprint 3 | Dev |

---

## Sprint 1 - Kritische Sofortmaßnahmen

### 1. R-E1-001: Fehlende RBAC für Admin-Funktionen

**Risiko:** Unautorisierter Zugriff auf Admin-Konfiguration (Qualifikationen, Fahrzeugtypen, Rollen)

**Auswirkung:** Kritisch - Jeder authentifizierte User könnte Stammdaten manipulieren

#### Implementierungsplan

**Schritt 1: AdminJwtAuthGuard erstellen**

```typescript
// packages/backend/src/common/guards/admin-jwt-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Guard für Admin-Only Endpoints.
 * Prüft ob der authentifizierte User die ADMIN-Rolle besitzt.
 */
@Injectable()
export class AdminJwtAuthGuard extends JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Erst normale JWT-Authentifizierung
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false;
    }

    // Dann Rollen-Check
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.roles?.includes('ADMIN')) {
      throw new ForbiddenException('Admin-Rechte erforderlich');
    }

    return true;
  }
}
```

**Schritt 2: Guard auf Admin-Controller anwenden**

```typescript
// packages/backend/src/modules/kraefte-admin/controllers/qualifikation.controller.ts
@Controller('api/admin/qualifikationen')
@ApiTags('admin-qualifikationen')
@UseGuards(AdminJwtAuthGuard) // <-- Hinzufügen
export class QualifikationAdminController {
  // ...
}
```

**Schritt 3: Tests schreiben**

```typescript
// packages/backend/src/common/guards/__tests__/admin-jwt-auth.guard.spec.ts
describe('AdminJwtAuthGuard', () => {
  it('should allow access for ADMIN users', async () => {
    // Given
    const mockRequest = { user: { id: '1', roles: ['ADMIN'] } };
    const context = createMockExecutionContext(mockRequest);

    // When
    const result = await guard.canActivate(context);

    // Then
    expect(result).toBe(true);
  });

  it('should deny access for non-ADMIN users', async () => {
    // Given
    const mockRequest = { user: { id: '1', roles: ['USER'] } };
    const context = createMockExecutionContext(mockRequest);

    // When/Then
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should deny access for unauthenticated requests', async () => {
    // Given
    const mockRequest = { user: null };
    const context = createMockExecutionContext(mockRequest);

    // When/Then
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
```

**Aufwand:** ~4h
**Verifikation:** TC-P0-001, TC-P0-002

---

### 2. R-E5-002: Inkonsistente Rollenzuweisung (Race Condition)

**Risiko:** Zwei parallele Requests könnten beide Person A als LNA zuweisen

**Auswirkung:** Kritisch - Doppelte Rollenbesetzung führt zu Verwirrung im Einsatz

#### Implementierungsplan

**Schritt 1: Prisma Migration für UNIQUE Constraint**

```prisma
// packages/backend/prisma/schema.prisma
model EinsatzRollenbesetzung {
  id                  String   @id @default(cuid())
  einsatzId           String
  rollenDefinitionId  String
  personId            String
  besetzungszeitpunkt DateTime @default(now())

  einsatz         Einsatz         @relation(fields: [einsatzId], references: [id])
  rollenDefinition RollenDefinition @relation(fields: [rollenDefinitionId], references: [id])
  person          EinsatzPerson   @relation(fields: [personId], references: [id])

  // Nur eine Person pro Rolle pro Einsatz (für 1:1 Rollen wie LNA)
  @@unique([einsatzId, rollenDefinitionId], name: "unique_rolle_per_einsatz")
}
```

**Schritt 2: Migration erstellen und ausführen**

```bash
pnpm --filter @bluelight-hub/backend prisma migrate dev --name add_unique_rolle_constraint
```

**Schritt 3: Handler mit Upsert Pattern**

```typescript
// packages/backend/src/application/kraefte/commands/besetze-rolle.handler.ts
@Injectable()
export class BesetzeRolleHandler extends TransactionalCommandHandler<BesetzeRolleCommand, string> {
  protected async executeInTransaction(
    command: BesetzeRolleCommand,
    tx: TransactionContext
  ): Promise<{ result: string; events: DomainEvent[] }> {
    // Upsert statt Insert - bei Konflikt Update
    const besetzung = await tx.prisma.einsatzRollenbesetzung.upsert({
      where: {
        unique_rolle_per_einsatz: {
          einsatzId: command.einsatzId,
          rollenDefinitionId: command.rollenDefinitionId,
        }
      },
      create: {
        einsatzId: command.einsatzId,
        rollenDefinitionId: command.rollenDefinitionId,
        personId: command.personId,
      },
      update: {
        personId: command.personId,
        besetzungszeitpunkt: new Date(),
      },
    });

    const events = [new RolleBesetzt(besetzung)];
    return { result: besetzung.id, events };
  }
}
```

**Schritt 4: Concurrent Test**

```typescript
// packages/backend/src/application/kraefte/commands/__tests__/besetze-rolle.integration.spec.ts
describe('BesetzeRolleHandler - Concurrent', () => {
  it('should handle concurrent role assignment without duplicates', async () => {
    // Given
    const einsatzId = await createTestEinsatz();
    const rolleId = await createTestRolle('LNA');
    const person1Id = await createTestPerson('Max');
    const person2Id = await createTestPerson('Erika');

    // When - Parallel requests
    const results = await Promise.allSettled([
      handler.execute(new BesetzeRolleCommand({ einsatzId, rolleId, personId: person1Id })),
      handler.execute(new BesetzeRolleCommand({ einsatzId, rolleId, personId: person2Id })),
    ]);

    // Then - Exactly one entry in DB
    const besetzungen = await prisma.einsatzRollenbesetzung.findMany({
      where: { einsatzId, rollenDefinitionId: rolleId }
    });

    expect(besetzungen).toHaveLength(1);
    // Last writer wins
    expect([person1Id, person2Id]).toContain(besetzungen[0].personId);
  });
});
```

**Aufwand:** ~6h
**Verifikation:** TC-P0-014, TC-P0-015

---

### 3. R-E8-001: GeoJSON Koordinaten-Reihenfolge

**Risiko:** POINT(lat, lng) vs. GeoJSON [lng, lat] → Fahrzeuge auf falscher Position

**Auswirkung:** Kritisch - Fahrzeuge erscheinen auf Lagekarte an falscher Position

#### Implementierungsplan

**Schritt 1: GeoCoordinate Value Object mit Konvertierung**

```typescript
// packages/backend/src/domain/kraefte/value-objects/geo-coordinate.ts
import { ValueObject } from '@domain/common/value-object';

interface GeoCoordinateProps {
  latitude: number;  // -90 to 90
  longitude: number; // -180 to 180
}

/**
 * Value Object für geographische Koordinaten.
 * Beachtet GeoJSON-Konvention: [longitude, latitude] (NICHT [lat, lng]!)
 */
export class GeoCoordinate extends ValueObject<GeoCoordinateProps> {
  private constructor(props: GeoCoordinateProps) {
    super(props);
  }

  get latitude(): number {
    return this.props.latitude;
  }

  get longitude(): number {
    return this.props.longitude;
  }

  /**
   * GeoJSON-Format: [longitude, latitude]
   * WICHTIG: Nicht verwechseln mit Google Maps [lat, lng]!
   */
  toGeoJsonCoordinates(): [number, number] {
    return [this.props.longitude, this.props.latitude];
  }

  /**
   * Für Google Maps und ähnliche: [latitude, longitude]
   */
  toLatLngArray(): [number, number] {
    return [this.props.latitude, this.props.longitude];
  }

  static create(latitude: number, longitude: number): Result<GeoCoordinate> {
    if (latitude < -90 || latitude > 90) {
      return Result.fail('Latitude muss zwischen -90 und 90 liegen');
    }
    if (longitude < -180 || longitude > 180) {
      return Result.fail('Longitude muss zwischen -180 und 180 liegen');
    }

    return Result.ok(new GeoCoordinate({ latitude, longitude }));
  }

  /**
   * Erstellt GeoCoordinate aus GeoJSON [lng, lat] Array
   */
  static fromGeoJson(coordinates: [number, number]): Result<GeoCoordinate> {
    const [lng, lat] = coordinates;
    return GeoCoordinate.create(lat, lng);
  }
}
```

**Schritt 2: POI Mapper mit korrekter Serialisierung**

```typescript
// packages/backend/src/application/lagekarte/mappers/poi.mapper.ts
import { Feature, Point } from 'geojson';

export class PoiMapper {
  static toGeoJson(poi: FahrzeugPoi): Feature<Point> {
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        // GeoJSON-Standard: [longitude, latitude]
        coordinates: poi.position.toGeoJsonCoordinates(),
      },
      properties: {
        id: poi.id,
        funkrufname: poi.funkrufname,
        status: poi.fmsStatus.code,
        statusColor: poi.fmsStatus.color,
        updatedAt: poi.updatedAt.toISOString(),
      },
    };
  }

  static toFeatureCollection(pois: FahrzeugPoi[]): FeatureCollection<Point> {
    return {
      type: 'FeatureCollection',
      features: pois.map(PoiMapper.toGeoJson),
    };
  }
}
```

**Schritt 3: Unit Tests**

```typescript
// packages/backend/src/domain/kraefte/value-objects/__tests__/geo-coordinate.spec.ts
describe('GeoCoordinate', () => {
  describe('toGeoJsonCoordinates', () => {
    it('should return [longitude, latitude] for GeoJSON', () => {
      // Given - Berlin Hauptbahnhof
      const coord = GeoCoordinate.create(52.525, 13.369).value!;

      // When
      const geoJson = coord.toGeoJsonCoordinates();

      // Then - GeoJSON: [lng, lat]
      expect(geoJson).toEqual([13.369, 52.525]);
    });
  });

  describe('toLatLngArray', () => {
    it('should return [latitude, longitude] for Google Maps', () => {
      // Given
      const coord = GeoCoordinate.create(52.525, 13.369).value!;

      // When
      const latLng = coord.toLatLngArray();

      // Then - Google: [lat, lng]
      expect(latLng).toEqual([52.525, 13.369]);
    });
  });

  describe('fromGeoJson', () => {
    it('should parse GeoJSON [lng, lat] correctly', () => {
      // Given - GeoJSON format
      const geoJsonCoords: [number, number] = [13.369, 52.525];

      // When
      const coord = GeoCoordinate.fromGeoJson(geoJsonCoords).value!;

      // Then
      expect(coord.latitude).toBe(52.525);
      expect(coord.longitude).toBe(13.369);
    });
  });

  describe('validation', () => {
    it('should reject invalid latitude', () => {
      const result = GeoCoordinate.create(91, 13);
      expect(result.isFailure).toBe(true);
    });

    it('should reject invalid longitude', () => {
      const result = GeoCoordinate.create(52, 181);
      expect(result.isFailure).toBe(true);
    });
  });
});
```

**Aufwand:** ~4h
**Verifikation:** TC-P0-019

---

## Sprint 2 - Performance & Business Logic

### 4. R-E3-001: Transaction Timeout ETB-Auto-Creation

**Risiko:** Bei langsamer DB (>1s) wird NFR4 (<1s bis ETB) verfehlt

**Auswirkung:** Status-Updates verzögert, Lagezentrum arbeitet mit veralteten Daten

#### Implementierungsplan

**Schritt 1: Outbox Event asynchron verarbeiten**

Das bestehende Outbox Pattern ist korrekt, aber der ETB-Creation Handler muss optimiert werden:

```typescript
// packages/backend/src/application/etb/event-handlers/etb-auto-creation.handler.ts
@Injectable()
export class EtbAutoCreationHandler {
  constructor(
    @Inject(DI_TOKENS.REPOSITORIES.ETB)
    private readonly etbRepository: IEtbRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('fahrzeug.status.updated', { async: true })
  async handleFahrzeugStatusUpdated(event: FahrzeugStatusUpdatedEvent): Promise<void> {
    // ETB-Eintrag in separater Transaction (nicht blockierend)
    const etbEintrag = EtbEintrag.create({
      einsatzId: event.einsatzId,
      timestamp: event.timestamp,
      typ: 'FMS_STATUS',
      inhalt: `${event.funkrufname}: Status ${event.oldStatus} → ${event.newStatus}`,
      quelle: 'SYSTEM',
    });

    await this.etbRepository.save(etbEintrag.value!);
  }
}
```

**Schritt 2: Performance-Test**

```typescript
// packages/backend/src/application/etb/__tests__/etb-auto-creation.performance.spec.ts
describe('ETB Auto-Creation Performance', () => {
  it('NFR4: should process 20 concurrent status updates in <1s each', async () => {
    // Given
    const einsatzId = await createTestEinsatz();
    const fahrzeuge = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createTestFahrzeug(einsatzId, `RTW ${i + 1}`)
      )
    );

    // When - 20 parallele Updates
    const results = await Promise.all(
      fahrzeuge.map(async (f) => {
        const start = Date.now();
        await updateFahrzeugStatus(f.id, 'STATUS_3');
        return Date.now() - start;
      })
    );

    // Then - Alle unter 1000ms
    results.forEach((duration, i) => {
      expect(duration).toBeLessThan(1000);
    });

    // Und alle ETB-Einträge erstellt
    const etbEntries = await prisma.etbEintrag.findMany({
      where: { einsatzId },
    });
    expect(etbEntries.length).toBeGreaterThanOrEqual(20);
  });
});
```

**Aufwand:** ~6h
**Verifikation:** TC-P0-007, TC-P0-008

---

### 5. R-E6-001: Dashboard Initial Load Timeout

**Risiko:** Bei 20 Fahrzeugen/80 Personen NFR1 (<2s) gefährdet

**Auswirkung:** Schlechte UX, besonders bei Großschadenslagen

#### Implementierungsplan

**Schritt 1: Prisma Query Optimierung**

```typescript
// packages/backend/src/infrastructure/kraefte/repositories/prisma-dashboard.repository.ts
async getDashboardData(einsatzId: string): Promise<DashboardData> {
  // Optimiert: Nur benötigte Felder selektieren
  const [fahrzeuge, personen, rollen] = await Promise.all([
    this.prisma.einsatzFahrzeug.findMany({
      where: { einsatzId, archivedAt: null },
      select: {
        id: true,
        funkrufname: true,
        fmsStatus: true,
        position: true,
        _count: { select: { personen: true } },
      },
      orderBy: { funkrufname: 'asc' },
    }),
    this.prisma.einsatzPerson.findMany({
      where: { einsatzId },
      select: {
        id: true,
        vorname: true,
        nachname: true,
        funktion: true,
        fahrzeugId: true,
      },
    }),
    this.prisma.einsatzRollenbesetzung.findMany({
      where: { einsatzId },
      select: {
        id: true,
        rollenDefinition: { select: { name: true, kuerzel: true } },
        person: { select: { id: true, vorname: true, nachname: true } },
      },
    }),
  ]);

  return { fahrzeuge, personen, rollen };
}
```

**Schritt 2: Response Caching (optional)**

```typescript
// packages/backend/src/modules/kraefte/controllers/dashboard.controller.ts
@Get(':einsatzId/dashboard')
@CacheKey('dashboard')
@CacheTTL(5) // 5 Sekunden Cache
async getDashboard(@Param('einsatzId') einsatzId: string) {
  return this.dashboardService.getDashboardData(einsatzId);
}
```

**Schritt 3: Performance-Test**

```typescript
describe('Dashboard Performance', () => {
  it('NFR1: should load dashboard in <2s with 20 vehicles and 80 persons', async () => {
    // Given - Realistische Testdaten
    const einsatzId = await createTestEinsatz();
    await createTestFahrzeuge(einsatzId, 20);
    await createTestPersonen(einsatzId, 80);

    // When
    const start = Date.now();
    const response = await request(app.getHttpServer())
      .get(`/api/einsatz/${einsatzId}/dashboard`)
      .expect(200);
    const duration = Date.now() - start;

    // Then
    expect(duration).toBeLessThan(2000);
    expect(response.body.fahrzeuge).toHaveLength(20);
    expect(response.body.personen).toHaveLength(80);
  });
});
```

**Aufwand:** ~8h
**Verifikation:** TC-P0-016

---

### 6. R-E2-003: Archiviertes Fahrzeug in aktivem Einsatz

**Risiko:** Fahrzeug wird archiviert, obwohl es noch aktivem Einsatz zugeordnet ist

**Auswirkung:** Inkonsistente Daten, "Geister-Fahrzeuge" auf Dashboard

#### Implementierungsplan

**Schritt 1: Domain-Rule im Aggregate**

```typescript
// packages/backend/src/domain/kraefte/aggregates/stamm-fahrzeug.ts
export class StammFahrzeug extends AggregateRoot<StammFahrzeugProps> {
  archive(): Result<void> {
    // Business Rule: Nicht archivieren wenn aktiv zugeordnet
    if (this.props.aktiveEinsaetze.length > 0) {
      return Result.fail(
        `Fahrzeug kann nicht archiviert werden: Noch ${this.props.aktiveEinsaetze.length} aktive(n) Einsätzen zugeordnet`
      );
    }

    this.props.archivedAt = new Date();
    this.addDomainEvent(new FahrzeugArchiviert(this.id));

    return Result.ok();
  }
}
```

**Schritt 2: Handler mit Validation**

```typescript
// packages/backend/src/application/stammdaten/commands/archiviere-fahrzeug.handler.ts
@Injectable()
export class ArchiviereFahrzeugHandler {
  async execute(command: ArchiviereFahrzeugCommand): Promise<Result<void>> {
    const fahrzeug = await this.repository.findById(command.fahrzeugId);
    if (!fahrzeug) {
      return Result.fail('Fahrzeug nicht gefunden');
    }

    // Prüfe aktive Einsätze
    const aktiveEinsaetze = await this.einsatzRepository.findAktiveByFahrzeugId(
      command.fahrzeugId
    );

    if (aktiveEinsaetze.length > 0) {
      return Result.fail(
        `Fahrzeug "${fahrzeug.funkrufname}" ist noch ${aktiveEinsaetze.length} Einsätzen zugeordnet`
      );
    }

    return fahrzeug.archive();
  }
}
```

**Aufwand:** ~4h
**Verifikation:** TC-P0-006

---

### 7. R-E5-001: Qualifikations-Validierung Race Condition

**Risiko:** Bei Rollenzuweisung werden nicht alle erforderlichen Qualifikationen validiert

**Auswirkung:** Unqualifizierte Person auf sicherheitskritischer Rolle (z.B. LNA ohne Notarzt)

#### Implementierungsplan

**Schritt 1: Domain Service für Qualifikations-Check**

```typescript
// packages/backend/src/domain/kraefte/services/qualifikations-validator.service.ts
@Injectable()
export class QualifikationsValidatorService {
  validatePersonForRolle(
    person: EinsatzPerson,
    rolle: RollenDefinition
  ): Result<void> {
    const fehlend = rolle.erforderlicheQualifikationen.filter(
      (reqQual) => !person.qualifikationen.some((pQual) => pQual.id === reqQual.id)
    );

    if (fehlend.length > 0) {
      return Result.fail(
        `Person "${person.vollname}" fehlen Qualifikationen: ${fehlend.map((q) => q.name).join(', ')}`
      );
    }

    return Result.ok();
  }
}
```

**Schritt 2: Optimistic Locking**

```typescript
// packages/backend/prisma/schema.prisma
model EinsatzPerson {
  // ... existing fields
  version Int @default(1) // Für Optimistic Locking
}
```

```typescript
// packages/backend/src/application/kraefte/commands/besetze-rolle.handler.ts
const person = await tx.prisma.einsatzPerson.findUnique({
  where: { id: command.personId },
  include: { qualifikationen: true },
});

// Optimistic Lock Check
const updated = await tx.prisma.einsatzPerson.updateMany({
  where: {
    id: command.personId,
    version: person.version, // Nur wenn Version noch stimmt
  },
  data: {
    version: { increment: 1 },
  },
});

if (updated.count === 0) {
  throw new OptimisticLockException('Person wurde zwischenzeitlich geändert');
}
```

**Aufwand:** ~6h
**Verifikation:** TC-P0-013

---

## Sprint 3 - Integration & Stabilität

### 8. R-E7-004: HiOrg Qualifikations-Mapping Inkonsistenz

**Risiko:** HiOrg externe Namen vs. interne IDs → Duplikate bei Import

**Auswirkung:** Qualifikationen mehrfach angelegt, Zuordnungen fehlerhaft

#### Implementierungsplan

**Schritt 1: Mapping-Tabelle**

```prisma
// packages/backend/prisma/schema.prisma
model QualifikationMapping {
  id                String   @id @default(cuid())
  hiorgExternalName String   @unique // z.B. "Rettungssanitäter"
  qualifikationId   String
  confidence        Float    @default(1.0) // 1.0 = manuell bestätigt
  createdAt         DateTime @default(now())

  qualifikation Qualifikation @relation(fields: [qualifikationId], references: [id])

  @@index([hiorgExternalName])
}
```

**Schritt 2: Fuzzy Matching Service**

```typescript
// packages/backend/src/application/hiorg/services/qualifikation-mapper.service.ts
import Fuse from 'fuse.js';

@Injectable()
export class QualifikationMapperService {
  private fuse: Fuse<Qualifikation>;

  constructor(
    @Inject(DI_TOKENS.REPOSITORIES.QUALIFIKATION)
    private readonly qualRepo: IQualifikationRepository,
  ) {}

  async mapHiorgQualifikation(hiorgName: string): Promise<QualifikationMapping> {
    // 1. Exaktes Mapping suchen
    const existing = await this.mappingRepo.findByHiorgName(hiorgName);
    if (existing) {
      return existing;
    }

    // 2. Fuzzy Match
    const allQuals = await this.qualRepo.findAll();
    this.fuse = new Fuse(allQuals, {
      keys: ['name', 'kuerzel'],
      threshold: 0.3, // 70% Übereinstimmung
    });

    const matches = this.fuse.search(hiorgName);

    if (matches.length > 0 && matches[0].score! < 0.3) {
      // Guter Match - automatisch zuordnen mit niedriger Confidence
      return this.mappingRepo.create({
        hiorgExternalName: hiorgName,
        qualifikationId: matches[0].item.id,
        confidence: 1 - matches[0].score!, // z.B. 0.8
      });
    }

    // 3. Kein Match - manuelles Mapping erforderlich
    throw new MappingRequiredException(
      `Keine passende Qualifikation für "${hiorgName}" gefunden. Manuelles Mapping erforderlich.`
    );
  }
}
```

**Aufwand:** ~8h
**Verifikation:** TC-P0-018

---

### 9. R-E8-002: Realtime Sync Connection Pool Exhaustion

**Risiko:** Polling alle 5s mit 50 Fahrzeugen → Connection Pool Exhaustion

**Auswirkung:** System wird unter Last unresponsive

#### Implementierungsplan

**Schritt 1: Hybrid WebSocket + Polling**

```typescript
// packages/backend/src/modules/lagekarte/gateways/lagekarte.gateway.ts
@WebSocketGateway({ namespace: '/lagekarte' })
export class LagekarteGateway implements OnGatewayConnection {
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { einsatzId: string }
  ) {
    client.join(`einsatz:${data.einsatzId}`);

    // Initial Data
    const pois = await this.lagekarteService.getFahrzeugPois(data.einsatzId);
    client.emit('initialData', pois);
  }

  // Wird von Event Handler aufgerufen
  async broadcastUpdate(einsatzId: string, poi: FahrzeugPoi) {
    this.server.to(`einsatz:${einsatzId}`).emit('poiUpdated', poi);
  }
}
```

**Schritt 2: Connection Pool Konfiguration**

```typescript
// packages/backend/src/prisma/prisma.service.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection Pool Tuning
  log: ['warn', 'error'],
});

// Prisma connection pool ist per Default 1 connection per CPU core
// Bei hoher Last: connection_limit in DATABASE_URL erhöhen
// z.B. ?connection_limit=20&pool_timeout=10
```

**Schritt 3: Load Test**

```typescript
// packages/backend/tests/load/lagekarte.load.spec.ts
describe('Lagekarte Load Test', () => {
  it('should handle 50 concurrent WebSocket connections', async () => {
    const connections: Socket[] = [];

    // 50 parallele Verbindungen
    for (let i = 0; i < 50; i++) {
      const socket = io('ws://localhost:3091/lagekarte');
      socket.emit('subscribe', { einsatzId: testEinsatzId });
      connections.push(socket);
    }

    // Warte auf alle Verbindungen
    await Promise.all(
      connections.map(
        (s) => new Promise((resolve) => s.on('initialData', resolve))
      )
    );

    expect(connections.every((s) => s.connected)).toBe(true);

    // Cleanup
    connections.forEach((s) => s.disconnect());
  });
});
```

**Aufwand:** ~10h
**Verifikation:** TC-P0-021

---

## Zusammenfassung Aufwände

| Sprint | Risiken | Geschätzter Aufwand |
|--------|---------|---------------------|
| Sprint 1 | R-E1-001, R-E5-002, R-E8-001 | ~14h |
| Sprint 2 | R-E3-001, R-E6-001, R-E2-003, R-E5-001 | ~24h |
| Sprint 3 | R-E7-004, R-E8-002 | ~18h |
| **Gesamt** | **9 kritische Risiken** | **~56h (~7 Tage)** |

---

## Tracking

| Risk ID | Status | Sprint | Story | PR |
|---------|--------|--------|-------|-----|
| R-E1-001 | 🔴 Open | 1 | - | - |
| R-E5-002 | 🔴 Open | 1 | - | - |
| R-E8-001 | 🔴 Open | 1 | - | - |
| R-E3-001 | 🔴 Open | 2 | - | - |
| R-E6-001 | 🔴 Open | 2 | - | - |
| R-E2-003 | 🔴 Open | 2 | - | - |
| R-E5-001 | 🔴 Open | 2 | - | - |
| R-E7-004 | 🔴 Open | 3 | - | - |
| R-E8-002 | 🔴 Open | 3 | - | - |

---

*Erstellt mit BMad TEA Agent | Version 4.0*
