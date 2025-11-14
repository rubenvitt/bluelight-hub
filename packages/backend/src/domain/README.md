# Domain Layer - Bluelight Hub Backend

**Status:** In Migration (Hexagonal Architecture + DDD)
**Created:** 2025-01-13
**Architecture:** Hexagonal Architecture / Domain-Driven Design

---

## 📖 Inhaltsverzeichnis

1. [Hexagonal Architecture Principles](#hexagonal-architecture-principles)
2. [Layer Responsibilities](#layer-responsibilities)
3. [Coding Conventions](#coding-conventions)
4. [Example - How to create a new Aggregate](#example---how-to-create-a-new-aggregate)
5. [Dependency Rules](#dependency-rules)

---

## 🏛️ Hexagonal Architecture Principles

### Was ist der Domain Layer?

Der **Domain Layer** ist das Herzstück der Anwendung und enthält die **gesamte Business-Logik** des Bluelight Hub
Einsatzmanagement-Systems. Er ist **framework-agnostisch** und hat KEINE Abhängigkeiten zu NestJS, Prisma oder
anderen External Libraries.

**Kernprinzipien:**

1. **Framework Independence**
   Der Domain Layer nutzt AUSSCHLIESSLICH TypeScript Standard Library. Keine `@nestjs/*`, `@prisma/*` oder andere
   Framework-Imports erlaubt.

2. **Dependency Inversion (Ports & Adapters)**
   Der Domain Layer definiert **Interfaces (Ports)** für externe Abhängigkeiten (z.B. `IEinsatzRepository`).
   Die **Infrastructure Layer** liefert **Adapter** (z.B. `PrismaEinsatzRepository` implementiert `IEinsatzRepository`).

3. **Explicit Business Rules**
   Business-Logik wird in **Aggregates**, **Value Objects** und **Domain Services** gekapselt, NICHT in Controllern
   oder DTOs.

**Warum Hexagonal Architecture?**

Die bisherige 3-Tier-Architektur hatte kritische Probleme:
- 37+ Prisma-Imports in Business-Logik (tight coupling)
- ORM-Wechsel würde Ripple-Effekte auslösen
- Business-Regeln verstreut in Services, Controllers und DTOs
- Schwierige Testbarkeit (NestJS Test-Infrastruktur erforderlich)

Hexagonal Architecture löst diese Probleme durch klare Separation:

```
┌─────────────────────────────────────────────────┐
│          Infrastructure Layer                   │
│   (NestJS Controllers, Prisma Repositories)     │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │       Application Layer                  │   │
│  │  (Use Cases, Command/Query Handlers)     │   │
│  │                                           │   │
│  │  ┌────────────────────────────────────┐  │   │
│  │  │      Domain Layer (CORE)           │  │   │
│  │  │  - Aggregates (Einsatz, ETB)       │  │   │
│  │  │  - Value Objects (EinsatzId, ...)  │  │   │
│  │  │  - Domain Events                   │  │   │
│  │  │  - Repository Interfaces (Ports)   │  │   │
│  │  └────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**Dependency Direction:** Infrastructure → Application → Domain (NIEMALS umgekehrt!)

---

## 🔧 Layer Responsibilities

### Domain Layer (packages/backend/src/domain/)

**Was gehört in den Domain Layer?**

| Artefakt Type | Verantwortung | Beispiel |
|---------------|---------------|----------|
| **Aggregates** | Transaktionale Konsistenz-Grenzen, Business-Logik, Event-Emission | `Einsatz`, `Lagekarte`, `EinsatzTagebuch` |
| **Entities** | Business-Objekte mit Identität (Teil eines Aggregates) | `ETBEintrag` (gehört zu `EinsatzTagebuch` Aggregate) |
| **Value Objects** | Immutable, self-validating Werte | `EinsatzId`, `EinsatzStatus`, `Coordinates` |
| **Domain Events** | Fachliche Events bei Zustandsänderungen | `EinsatzCreatedEvent`, `ETBEintragAddedEvent` |
| **Repository Interfaces** | Ports für Persistence (KEINE Implementierung!) | `IEinsatzRepository`, `ILagekarteRepository` |
| **Domain Services** | Cross-Aggregate Business-Logik | `EinsatzNamingService` (generiert Einsatz-Namen) |

**Was gehört NICHT in den Domain Layer?**
- ❌ NestJS Decorators (`@Injectable()`, `@Controller()`)
- ❌ Prisma Models (`PrismaClient`, `@prisma/client`)
- ❌ DTOs (API-Layer Contracts)
- ❌ HTTP/REST Logik
- ❌ Database Queries

### Application Layer (packages/backend/src/application/)

**Orchestriert Use Cases und koordiniert Domain Objects:**

- **Use Cases / Command Handlers**
  Beispiel: `CreateEinsatzCommand` → `CreateEinsatzHandler` (nutzt `IEinsatzRepository` Port)

- **Query Handlers**
  Beispiel: `GetEinsatzByIdQuery` → `GetEinsatzByIdHandler`

- **DTOs (Data Transfer Objects)**
  Beispiel: `CreateEinsatzDto` (API Input), `EinsatzResponseDto` (API Output)

- **Application Services**
  Beispiel: `EinsatzApplicationService` (orchestriert Use Cases)

**Dependency:** Application Layer DARF Domain Layer importieren, aber NICHT umgekehrt!

### Infrastructure Layer (packages/backend/src/infrastructure/)

**Liefert Adapter für External Systems:**

- **Repositories (Adapter für Persistence)**
  Beispiel: `PrismaEinsatzRepository` implementiert `IEinsatzRepository` (Domain Port)

- **Controllers (REST API Endpoints)**
  Beispiel: `EinsatzController` (NestJS `@Controller()`, ruft Application Services auf)

- **Mappers (Domain ↔ Prisma)**
  Beispiel: `EinsatzMapper.toDomain(prismaEinsatz)`, `EinsatzMapper.toPrisma(einsatz)`

- **External Adapters**
  Beispiel: Email-Service, File-Storage, External APIs

**Dependency:** Infrastructure Layer DARF Application + Domain importieren.

---

## 📝 Coding Conventions

### 1. Aggregates

**Definition:**
Ein Aggregate ist eine transaktionale Konsistenz-Grenze, die mehrere Entities/VOs zu einer kohärenten Einheit
zusammenfasst. Änderungen am Aggregate emittieren **Domain Events**.

**Namenskonvention:** `{name}.aggregate.ts`

**Beispiel:**

```typescript
// domain/einsatz/aggregates/einsatz.aggregate.ts
import { AggregateRoot } from '@domain/shared/base/aggregate-root';
import { EinsatzId } from '../value-objects/einsatz-id.vo';
import { EinsatzStatus } from '../value-objects/einsatz-status.vo';
import { EinsatzCreatedEvent } from '../events/einsatz-created.event';
import { Result } from '@domain/common/result';

export class Einsatz extends AggregateRoot<EinsatzId> {
  private constructor(
    id: EinsatzId,
    private _nummer: string,
    private _status: EinsatzStatus,
    private _ort?: string,
  ) {
    super(id);
  }

  /**
   * Factory-Methode erstellt neuen Einsatz und emittiert EinsatzCreatedEvent.
   *
   * Nutzt Result<T> Pattern statt Exceptions für vorhersagbare Fehlerbehandlung.
   * Warum? Domain Layer hat keine Abhängigkeiten zu Exception-Handling-Frameworks.
   */
  static create(
    nummer: string,
    ort?: string,
  ): Result<Einsatz> {
    // Validierung
    if (!nummer || nummer.trim().length === 0) {
      return Result.fail('Einsatznummer darf nicht leer sein');
    }

    const id = EinsatzId.create();
    if (id.isFailure) {
      return Result.fail(id.error!);
    }

    const status = EinsatzStatus.create('AKTIV');
    if (status.isFailure) {
      return Result.fail(status.error!);
    }

    const einsatz = new Einsatz(id.value!, nummer, status.value!, ort);

    // Domain Event emittieren
    einsatz.addDomainEvent(new EinsatzCreatedEvent(einsatz.id, nummer, ort));

    return Result.ok(einsatz);
  }

  /**
   * Einsatz abschließen - Business-Logik mit Validierung.
   *
   * Warum hier statt in Service? Aggregate hat volle Kontrolle über eigenen State.
   */
  complete(): Result<void> {
    if (this._status.equals(EinsatzStatus.create('ABGESCHLOSSEN').value!)) {
      return Result.fail('Einsatz ist bereits abgeschlossen');
    }

    this._status = EinsatzStatus.create('ABGESCHLOSSEN').value!;
    this.addDomainEvent(new EinsatzCompletedEvent(this.id));

    return Result.ok(undefined);
  }

  // Getter (kein Setter - Immutability!)
  get nummer(): string { return this._nummer; }
  get status(): EinsatzStatus { return this._status; }
  get ort(): string | undefined { return this._ort; }
}
```

**Wichtig:**
- Extends `AggregateRoot<ID>` (Base-Class in `domain/shared/base/`)
- Private Constructor + Public Factory-Methode (`create()`)
- Business-Logik-Methoden (z.B. `complete()`) nutzen `Result<T>` Pattern
- Emittiert Domain Events via `addDomainEvent()`
- KEINE `@Injectable()` oder andere Framework-Decorators!

### 2. Value Objects

**Definition:**
Value Objects sind **immutable**, self-validating Werte ohne Identität. Gleichheit wird über Wert-Vergleich
bestimmt (`equals()`), nicht Referenz.

**Namenskonvention:** `{name}.vo.ts`

**Beispiel:**

```typescript
// domain/einsatz/value-objects/einsatz-status.vo.ts
import { ValueObject } from '@domain/shared/base/value-object';
import { Result } from '@domain/common/result';

type EinsatzStatusValue = 'AKTIV' | 'ABGESCHLOSSEN' | 'ARCHIVIERT';

interface EinsatzStatusProps {
  value: EinsatzStatusValue;
}

export class EinsatzStatus extends ValueObject<EinsatzStatusProps> {
  private constructor(props: EinsatzStatusProps) {
    super(props);
  }

  /**
   * Factory-Methode mit Validierung.
   *
   * Warum Result<T>? Validierungs-Fehler sind vorhersagbar (User-Input),
   * keine Exceptions in Domain Layer nötig.
   */
  static create(value: string): Result<EinsatzStatus> {
    const validStatuses: EinsatzStatusValue[] = ['AKTIV', 'ABGESCHLOSSEN', 'ARCHIVIERT'];

    if (!validStatuses.includes(value as EinsatzStatusValue)) {
      return Result.fail(
        `Ungültiger Status: ${value}. Erlaubt: ${validStatuses.join(', ')}`
      );
    }

    return Result.ok(new EinsatzStatus({ value: value as EinsatzStatusValue }));
  }

  get value(): EinsatzStatusValue {
    return this.props.value;
  }

  /**
   * Business-Logik: Darf Status gewechselt werden?
   */
  canTransitionTo(newStatus: EinsatzStatus): boolean {
    const currentValue = this.value;
    const newValue = newStatus.value;

    // AKTIV → ABGESCHLOSSEN, ARCHIVIERT
    if (currentValue === 'AKTIV') {
      return newValue === 'ABGESCHLOSSEN' || newValue === 'ARCHIVIERT';
    }

    // ABGESCHLOSSEN → ARCHIVIERT
    if (currentValue === 'ABGESCHLOSSEN') {
      return newValue === 'ARCHIVIERT';
    }

    // ARCHIVIERT → keine Transitions
    return false;
  }
}
```

**Wichtig:**
- Extends `ValueObject<Props>` (Base-Class in `domain/shared/base/`)
- Private Constructor + Factory-Methode (`create()`)
- Factory gibt `Result<VO>` zurück (KEIN `throw`)
- Immutable (nur Getter, kein Setter)
- `equals()` Methode von Base-Class (Deep-Comparison über Props)

### 3. Domain Events

**Definition:**
Domain Events repräsentieren fachliche Ereignisse, die im System passiert sind (Past Tense!).
Events werden vom Aggregate emittiert und von Event Handlers konsumiert.

**Namenskonvention:** `{aggregate}-{action}.event.ts` (z.B. `einsatz-created.event.ts`)

**Beispiel:**

```typescript
// domain/einsatz/events/einsatz-created.event.ts
import { DomainEvent } from '@domain/shared/base/domain-event';
import { EinsatzId } from '../value-objects/einsatz-id.vo';

export class EinsatzCreatedEvent extends DomainEvent {
  constructor(
    public readonly einsatzId: EinsatzId,
    public readonly nummer: string,
    public readonly ort?: string,
  ) {
    super();
  }

  /**
   * Event-Name für Event-Routing (z.B. in Event Outbox).
   *
   * Warum statische Methode? Type-Safety bei Event-Subscription.
   */
  static eventName(): string {
    return 'einsatz.created';
  }
}
```

**Wichtig:**
- Extends `DomainEvent` (Base-Class in `domain/shared/base/`)
- Readonly Properties (Events sind immutable!)
- Past Tense Naming (`Created`, `Completed`, `Archived`, NICHT `Create`, `Complete`)
- Statische `eventName()` Methode für Event-Routing
- KEINE String-Events (`'einsatz.created'`), immer typed Classes!

### 4. Repository Interfaces (Ports)

**Definition:**
Repository Interfaces definieren **Persistence-Contracts** im Domain Layer.
Infrastructure Layer liefert Implementierung (z.B. `PrismaEinsatzRepository`).

**Namenskonvention:** `i{aggregate}.repository.ts`

**Beispiel:**

```typescript
// domain/einsatz/repositories/ieinsatz.repository.ts
import { Result } from '@domain/common/result';
import { Einsatz } from '../aggregates/einsatz.aggregate';
import { EinsatzId } from '../value-objects/einsatz-id.vo';

/**
 * Port für Einsatz Persistence.
 *
 * Warum Interface im Domain Layer? Dependency Inversion Principle:
 * Domain definiert Contract, Infrastructure liefert Adapter.
 */
export interface IEinsatzRepository {
  /**
   * Einsatz anhand ID abrufen.
   *
   * @returns Result<Einsatz> - Success wenn gefunden, Failure wenn nicht existent
   */
  findById(id: EinsatzId): Promise<Result<Einsatz>>;

  /**
   * Einsatz speichern (Create oder Update).
   *
   * Warum kein separates create() + update()? Aggregate entscheidet über
   * Persistence-Strategie (Event-Sourcing könnte nur append() haben).
   */
  save(einsatz: Einsatz): Promise<Result<void>>;

  /**
   * Einsatz löschen (Soft-Delete via archiviert Flag).
   *
   * Warum Result<void>? Fehler bei Constraint-Violations (z.B. FK-Constraints).
   */
  delete(id: EinsatzId): Promise<Result<void>>;

  /**
   * Alle aktiven Einsätze abrufen.
   */
  findAllActive(): Promise<Result<Einsatz[]>>;
}
```

**Wichtig:**
- Interface (KEINE Class!)
- Nutzt Domain Objects (Aggregate, Value Objects), NICHT Prisma Models
- Alle Methoden geben `Promise<Result<T>>` zurück
- KEINE Implementierung im Domain Layer!

### 5. Domain Services

**Definition:**
Domain Services kapseln **Cross-Aggregate Business-Logik**, die nicht zu einem einzelnen Aggregate gehört.

**Namenskonvention:** `{name}.service.ts` (Interface: `i{name}.service.ts`)

**Beispiel:**

```typescript
// domain/services/ieinsatz-naming.service.ts
import { Result } from '@domain/common/result';

/**
 * Port für Einsatz-Namensgenerierung.
 *
 * Warum Domain Service? Naming-Logik benötigt Input von mehreren Aggregates
 * (Einsatz + Lagekarte Koordinaten) und gehört nicht in ein einzelnes Aggregate.
 */
export interface IEinsatzNamingService {
  /**
   * Generiert Einsatz-Namen basierend auf Ort und Koordinaten.
   *
   * Format: "Einsatz {Ort} - {Straße} {Hausnummer}" (Reverse Geocoding)
   */
  generateName(ort: string, lat: number, lng: number): Promise<Result<string>>;
}
```

**Wichtig:**
- Interface im Domain Layer, Implementierung in Infrastructure
- Nutzt Domain Objects (Value Objects, Aggregates)
- Gibt `Result<T>` zurück

---

## 🚀 Example - How to create a new Aggregate

### Schritt 1: Value Objects erstellen

Starte mit den kleinsten Bausteinen - Value Objects:

```typescript
// domain/lagekarte/value-objects/lagekarte-id.vo.ts
import { ValueObject } from '@domain/shared/base/value-object';
import { Result } from '@domain/common/result';
import { nanoid } from 'nanoid'; // Ausnahme: nanoid erlaubt für ID-Generierung

interface LagekarteIdProps {
  value: string;
}

export class LagekarteId extends ValueObject<LagekarteIdProps> {
  private constructor(props: LagekarteIdProps) {
    super(props);
  }

  static create(id?: string): Result<LagekarteId> {
    const value = id ?? nanoid();

    // Validierung: Nanoid Format (21 alphanumerische Zeichen, URL-safe)
    const nanoidRegex = /^[A-Za-z0-9_-]{21}$/;
    if (!nanoidRegex.test(value)) {
      return Result.fail('Ungültige Nanoid (erwartet: 21 alphanumerische Zeichen)');
    }

    return Result.ok(new LagekarteId({ value }));
  }

  get value(): string {
    return this.props.value;
  }
}
```

```typescript
// domain/lagekarte/value-objects/coordinates.vo.ts
import { ValueObject } from '@domain/shared/base/value-object';
import { Result } from '@domain/common/result';

interface CoordinatesProps {
  latitude: number;
  longitude: number;
}

export class Coordinates extends ValueObject<CoordinatesProps> {
  private constructor(props: CoordinatesProps) {
    super(props);
  }

  static create(lat: number, lng: number): Result<Coordinates> {
    // Validierung
    if (lat < -90 || lat > 90) {
      return Result.fail('Latitude muss zwischen -90 und 90 liegen');
    }
    if (lng < -180 || lng > 180) {
      return Result.fail('Longitude muss zwischen -180 und 180 liegen');
    }

    return Result.ok(new Coordinates({ latitude: lat, longitude: lng }));
  }

  get latitude(): number { return this.props.latitude; }
  get longitude(): number { return this.props.longitude; }
}
```

### Schritt 2: Domain Events definieren

```typescript
// domain/lagekarte/events/lagekarte-created.event.ts
import { DomainEvent } from '@domain/shared/base/domain-event';
import { LagekarteId } from '../value-objects/lagekarte-id.vo';
import { Coordinates } from '../value-objects/coordinates.vo';

export class LagekarteCreatedEvent extends DomainEvent {
  constructor(
    public readonly lagekarteId: LagekarteId,
    public readonly center: Coordinates,
  ) {
    super();
  }

  static eventName(): string {
    return 'lagekarte.created';
  }
}
```

### Schritt 3: Aggregate implementieren

```typescript
// domain/lagekarte/aggregates/lagekarte.aggregate.ts
import { AggregateRoot } from '@domain/shared/base/aggregate-root';
import { LagekarteId } from '../value-objects/lagekarte-id.vo';
import { Coordinates } from '../value-objects/coordinates.vo';
import { LagekarteCreatedEvent } from '../events/lagekarte-created.event';
import { Result } from '@domain/common/result';

export class Lagekarte extends AggregateRoot<LagekarteId> {
  private constructor(
    id: LagekarteId,
    private _center: Coordinates,
    private _zoom: number,
  ) {
    super(id);
  }

  static create(center: Coordinates, zoom: number = 13): Result<Lagekarte> {
    // Validierung
    if (zoom < 1 || zoom > 18) {
      return Result.fail('Zoom muss zwischen 1 und 18 liegen');
    }

    const id = LagekarteId.create();
    if (id.isFailure) {
      return Result.fail(id.error!);
    }

    const lagekarte = new Lagekarte(id.value!, center, zoom);
    lagekarte.addDomainEvent(new LagekarteCreatedEvent(lagekarte.id, center));

    return Result.ok(lagekarte);
  }

  // Business-Logik
  updateCenter(newCenter: Coordinates): Result<void> {
    this._center = newCenter;
    return Result.ok(undefined);
  }

  get center(): Coordinates { return this._center; }
  get zoom(): number { return this._zoom; }
}
```

### Schritt 4: Repository Interface definieren

```typescript
// domain/lagekarte/repositories/ilagekarte.repository.ts
import { Result } from '@domain/common/result';
import { Lagekarte } from '../aggregates/lagekarte.aggregate';
import { LagekarteId } from '../value-objects/lagekarte-id.vo';

export interface ILagekarteRepository {
  findById(id: LagekarteId): Promise<Result<Lagekarte>>;
  save(lagekarte: Lagekarte): Promise<Result<void>>;
  delete(id: LagekarteId): Promise<Result<void>>;
}
```

### Schritt 5: Unit Tests schreiben

```typescript
// domain/lagekarte/aggregates/lagekarte.aggregate.spec.ts
import { Lagekarte } from './lagekarte.aggregate';
import { Coordinates } from '../value-objects/coordinates.vo';

describe('Lagekarte Aggregate', () => {
  describe('create', () => {
    it('should create lagekarte with valid coordinates', () => {
      // Given: Valid coordinates
      const center = Coordinates.create(48.1351, 11.5820).value!; // München
      const zoom = 13;

      // When: Creating lagekarte
      const result = Lagekarte.create(center, zoom);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.center).toBe(center);
      expect(result.value?.zoom).toBe(zoom);
    });

    it('should fail with invalid zoom', () => {
      // Given: Invalid zoom
      const center = Coordinates.create(48.1351, 11.5820).value!;
      const invalidZoom = 25;

      // When: Creating lagekarte
      const result = Lagekarte.create(center, invalidZoom);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Zoom muss zwischen 1 und 18 liegen');
    });
  });

  describe('updateCenter', () => {
    it('should update center coordinates', () => {
      // Given: Existing lagekarte
      const oldCenter = Coordinates.create(48.1351, 11.5820).value!;
      const lagekarte = Lagekarte.create(oldCenter).value!;
      const newCenter = Coordinates.create(52.5200, 13.4050).value!; // Berlin

      // When: Updating center
      const result = lagekarte.updateCenter(newCenter);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(lagekarte.center).toBe(newCenter);
    });
  });
});
```

### Schritt 6: Repository Implementation (Infrastructure Layer)

**ACHTUNG:** Dies gehört NICHT in den Domain Layer, sondern in `infrastructure/persistence/prisma/repositories/`:

```typescript
// infrastructure/persistence/prisma/repositories/lagekarte.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ILagekarteRepository } from '@domain/lagekarte/repositories/ilagekarte.repository';
import { Lagekarte } from '@domain/lagekarte/aggregates/lagekarte.aggregate';
import { LagekarteId } from '@domain/lagekarte/value-objects/lagekarte-id.vo';
import { LagekarteMapper } from '../mappers/lagekarte.mapper';
import { Result } from '@domain/common/result';

@Injectable()
export class PrismaLagekarteRepository implements ILagekarteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: LagekarteId): Promise<Result<Lagekarte>> {
    const prismaLagekarte = await this.prisma.lagekarte.findUnique({
      where: { id: id.value },
    });

    if (!prismaLagekarte) {
      return Result.fail('Lagekarte nicht gefunden');
    }

    return LagekarteMapper.toDomain(prismaLagekarte);
  }

  async save(lagekarte: Lagekarte): Promise<Result<void>> {
    const prismaData = LagekarteMapper.toPrisma(lagekarte);

    await this.prisma.lagekarte.upsert({
      where: { id: lagekarte.id.value },
      update: prismaData,
      create: prismaData,
    });

    return Result.ok(undefined);
  }

  async delete(id: LagekarteId): Promise<Result<void>> {
    await this.prisma.lagekarte.update({
      where: { id: id.value },
      data: { archiviert: true, archiviertAt: new Date() },
    });

    return Result.ok(undefined);
  }
}
```

---

## 🚫 Dependency Rules

### ✅ ERLAUBT

**Domain Layer DARF importieren:**
- ✅ TypeScript Standard Library (`Date`, `Map`, `Set`, etc.)
- ✅ Andere Domain Objects (`import { EinsatzId } from '../value-objects/einsatz-id.vo'`)
- ✅ Shared Kernel (`import { Result } from '@domain/common/result'`)
- ✅ Nanoid Library (`nanoid` - NUR für ID-Generierung)

**Application Layer DARF importieren:**
- ✅ Domain Layer (`import { Einsatz } from '@domain/einsatz/aggregates/einsatz.aggregate'`)
- ✅ Andere Application Layer (`import { CreateEinsatzDto } from '../dto/create-einsatz.dto'`)

**Infrastructure Layer DARF importieren:**
- ✅ Domain Layer
- ✅ Application Layer
- ✅ NestJS (`@nestjs/common`, `@nestjs/core`)
- ✅ Prisma (`@prisma/client`)

### ❌ VERBOTEN

**Domain Layer DARF NIEMALS importieren:**
- ❌ Application Layer (`import { CreateEinsatzDto } from '@application/...'`)
- ❌ Infrastructure Layer (`import { PrismaService } from '@infrastructure/...'`)
- ❌ NestJS (`@nestjs/*`)
- ❌ Prisma (`@prisma/client`)
- ❌ External Libraries (außer `nanoid`)

**Enforcement:**

1. **Biome Linter** (konfiguriert in `biome.json`):
   ```json
   {
     "linter": {
       "rules": {
         "noRestrictedImports": {
           "paths": {
             "src/domain/**": {
               "forbid": ["@application/*", "@infrastructure/*", "@nestjs/*", "@prisma/*"]
             }
           }
         }
       }
     }
   }
   ```

2. **Madge Circular Dependency Check** (Pre-Commit Hook):
   ```bash
   pnpm --filter @bluelight-hub/backend check:deps
   # Führt aus: madge --circular src/domain/
   ```

3. **Pre-Commit Hook** (`.husky/pre-commit`):
   ```bash
   #!/bin/sh
   pnpm --filter @bluelight-hub/backend test:domain
   pnpm --filter @bluelight-hub/backend check:deps
   pnpm lint
   ```

**Bei Verstoß:** Commit wird blockiert! 🚨

### Dependency Direction Diagram

```
┌──────────────────────────────────────┐
│     Infrastructure Layer             │
│  ✅ imports Domain + Application     │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│      Application Layer               │
│  ✅ imports Domain                   │
│  ❌ NEVER imports Infrastructure     │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│       Domain Layer (CORE)            │
│  ✅ imports ONLY TypeScript stdlib   │
│  ❌ NEVER imports Application        │
│  ❌ NEVER imports Infrastructure     │
│  ❌ NEVER imports @nestjs/*          │
│  ❌ NEVER imports @prisma/*          │
└──────────────────────────────────────┘
```

---

## 📚 Weitere Ressourcen

- **PRD:** [docs/prds/276-hexagonale-architektur.md](../../../docs/prds/276-hexagonale-architektur.md)
- **Epics:** [docs/epics/276-hexagonale-architektur/](../../../docs/epics/276-hexagonale-architektur/)
- **Architecture Decisions:** [docs/architecture/9-architecture-decisions-adrs.md](../../../docs/architecture/9-architecture-decisions-adrs.md)
- **Hexagonal Architecture Guide:** [docs/hexagonal-architecture.md](../../../docs/hexagonal-architecture.md)

---

## 🛠️ Commands

```bash
# Domain Layer Tests (framework-agnostisch)
pnpm --filter @bluelight-hub/backend test:domain

# Circular Dependency Check
pnpm --filter @bluelight-hub/backend check:deps

# TypeScript Compilation (Domain Layer only)
tsc --noEmit --project tsconfig.json

# Linting (Biome)
pnpm lint

# Coverage
pnpm --filter @bluelight-hub/backend test:cov
```

---

**Fragen?** Siehe [CLAUDE.md](../../../../CLAUDE.md) für weitere Konventionen oder kontaktiere das Team.
