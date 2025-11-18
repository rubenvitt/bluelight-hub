# Domain Services (domain/services/)

Domain Services enthalten Business Logic, die **NICHT zu einem einzelnen Aggregate gehört** und framework-unabhängig bleibt.

---

## Wann Domain Services verwenden?

### Domain Services sind für:

- **Cross-Aggregate Logic:** Koordination zwischen mehreren Aggregates
  - Beispiel: `EinsatzCompletenessService` prüft Einsatz-Vollständigkeit (könnte später auch andere Aggregates prüfen)
- **Komplexe Berechnungen:** Domänen-Logik, die nicht zu einem Aggregate gehört
  - Beispiel: `EinsatzNamingService` generiert Einsatznummern (verwendet Jahr + Sequenznummer)
- **Domain Policies:** System-weite Regeln und Richtlinien
  - Beispiel: `EinsatzArchivalPolicy` implementiert DRK 10-Jahres-Archivierungspflicht
- **External Integrations (Ports):** Schnittstellen für Infrastructure-Adapter
  - Beispiel: `IGeocodingPort` definiert Contract für Geocoding-Services (Nominatim)

### Aggregate Methods sind für:

- **Aggregate-spezifische Business Logic:** Zustandsänderungen innerhalb des Aggregates
  - Beispiel: `EinsatzAggregate.complete(userId)` (Statusübergang IN_BEARBEITUNG → ABGESCHLOSSEN)
- **Invarianten-Sicherung:** Konsistenz-Regeln des Aggregates
  - Beispiel: `UserAggregate.updateRole()` prüft "Min-1-SUPER_ADMIN" Regel
- **State Transitions:** Zustandsübergänge mit Guards
  - Beispiel: `EinsatzAggregate.archive()` prüft Status = ABGESCHLOSSEN

---

## Naming Conventions

| Typ | Pattern | Beispiel | Verwendung |
|-----|---------|----------|------------|
| **Services** | `{Context}{Purpose}Service` | `EinsatzNamingService` | Pure Functions (stateless) |
| **Policies** | `{Context}{Purpose}Policy` | `EinsatzArchivalPolicy` | Domain Policies (zeitbasierte Regeln) |
| **Ports** | `I{Service}Port` | `IGeocodingPort` | Interfaces für Infrastructure Adapter |

---

## Implementierte Domain Services

### 1. EinsatzNamingService

**Purpose:** Generierung eindeutiger Einsatznummern nach DRK-Standard.

**Type:** Pure Function (stateless)

**Location:** `domain/services/einsatz-naming.service.ts`

**Method:**
```typescript
generateEinsatzNummer(year: number, sequenceNumber: number): string
```

**Business Rules:**
- Format: `E{JAHR}-{LAUFNUMMER}` (Beispiel: `E2024-001`)
- Laufnummer wird jährlich zurückgesetzt (000-999 pro Jahr)
- Zero-Padding auf 3 Stellen für einheitliche Sortierung

**Warum Service statt Aggregate?**
- Einsatznummerngenerierung ist **keine** Zustandsänderung des Einsatz-Aggregates
- Application Layer holt Sequenznummer vom Repository (externe Abhängigkeit)
- Service bleibt framework-agnostic und testbar

**Usage Example:**
```typescript
// Application Layer (Command Handler)
const year = new Date().getFullYear();
const sequence = await this.einsatzRepo.getNextSequenceNumber(year);
const namingService = new EinsatzNamingService();
const nummer = namingService.generateEinsatzNummer(year, sequence);

const einsatz = EinsatzAggregate.create(nummer, alarmstichwort, ort);
```

---

### 2. EinsatzCompletenessService

**Purpose:** Validierung, ob Einsatz alle Voraussetzungen für Abschluss erfüllt.

**Type:** Pure Function (stateless, reads Aggregate state)

**Location:** `domain/services/einsatz-completeness.service.ts`

**Methods:**
```typescript
canBeCompleted(einsatz: EinsatzAggregate, requireOrt = true): Result<void>
getMissingRequirements(einsatz: EinsatzAggregate, requireOrt = true): string[]
```

**Business Rules:**
- Einsatz kann nur abgeschlossen werden wenn:
  - `alarmstichwort` ist gesetzt (Pflichteingabe)
  - `einsatzort` ist gesetzt (optional, konfigurierbar via `requireOrt`)
  - Status ist IN_BEARBEITUNG (nicht ANGELEGT, ABGESCHLOSSEN, ARCHIVIERT)

**Warum Service statt Aggregate?**
- Vollständigkeitsprüfung ist **nicht** der Abschluss selbst (Separation of Concerns)
- Wird in mehreren Kontexten benötigt (UI, API, Batch-Jobs)
- Ermöglicht frühzeitige Validierung (Fail-Fast-Prinzip)

**Usage Example:**
```typescript
// Application Layer (Command Handler)
const completenessService = new EinsatzCompletenessService();
const validationResult = completenessService.canBeCompleted(einsatz, true);

if (validationResult.isFailure) {
  const missing = completenessService.getMissingRequirements(einsatz);
  throw new ValidationError(`Fehlende Felder: ${missing.join(', ')}`);
}

// Abschluss ist erlaubt
const completeResult = einsatz.complete(userId);
```

---

### 3. EinsatzArchivalPolicy

**Purpose:** Implementierung der DRK 10-Jahres-Archivierungspflicht.

**Type:** Domain Policy (stateless, zeitbasierte Regel)

**Location:** `domain/services/einsatz-archival.policy.ts`

**Methods:**
```typescript
canBeArchived(einsatz: EinsatzAggregate, currentDate: Date): boolean
getArchivalDate(einsatz: EinsatzAggregate): Date
```

**Business Rules:**
- Einsatz kann archiviert werden wenn:
  - Status ist ABGESCHLOSSEN (nicht ANGELEGT, IN_BEARBEITUNG, ARCHIVIERT)
  - `abgeschlossenAt` ist mindestens 10 Jahre vor `currentDate`
- Nach Archivierung (Status → ARCHIVIERT) ist Einsatz immutable

**Warum Policy statt Aggregate?**
- Archivierung ist zeitbasierte Regel, nicht Zustandsänderung
- Application Layer entscheidet **WANN** archiviert wird (Batch-Job, User-Trigger)
- Domain Layer definiert nur **REGELN**, nicht den Zeitpunkt
- Separation of Concerns: Timing (Application) ≠ Rules (Domain)

**Usage Example:**
```typescript
// Application Layer (Batch-Job: Archiviere alte Einsätze)
const allCompleted = await einsatzRepo.findByStatus(EinsatzStatus.ABGESCHLOSSEN);
const archivalPolicy = new EinsatzArchivalPolicy();
const now = new Date();

for (const einsatz of allCompleted) {
  if (archivalPolicy.canBeArchived(einsatz, now)) {
    einsatz.archive(); // Transitions to ARCHIVIERT
    await einsatzRepo.save(einsatz);
  }
}
```

---

## Ports (External Integrations)

### IGeocodingPort (Story 1.5)

**Purpose:** Interface für Geocoding Address → GeoCoordinate (und umgekehrt).

**Type:** Port (implementiert in Infrastructure Layer)

**Location:** `domain/services/ports/i-geocoding.port.ts`

**Methods:**
```typescript
geocodeAddress(address: Address): Promise<Result<GeoCoordinate>>
reverseGeocode(coordinate: GeoCoordinate): Promise<Result<Address>>
```

**Warum Port Pattern?**
- Domain Layer hat **KEINE** Abhängigkeit zur konkreten Geocoding-API
- Infrastructure Layer kann Nominatim, Google Maps, oder andere Services nutzen
- Austausch der Geocoding-Provider ohne Domain-Änderungen möglich
- Unit Tests können Mock-Implementierung nutzen

**Usage Example:**
```typescript
// Application Layer (Command Handler)
const addressResult = Address.create({ strasse: 'Brandenburger Tor', ort: 'Berlin' });
const geocodeResult = await this.geocodingPort.geocodeAddress(addressResult.value!);

if (geocodeResult.isSuccess) {
  const geoCoord = geocodeResult.value!;
  const mgrsCoord = MgrsCoordinate.fromLatLng(geoCoord);
  // Erstelle Lagekarte mit MGRS-Koordinaten
}
```

**Note:** Dieser Port wurde in Story 1.5 implementiert und wird hier nur dokumentiert (AC3: Port Consolidation).

---

## Testing Guidelines

### Framework-Agnostic Tests

Domain Services sind framework-unabhängig und sollten **OHNE** NestJS TestingModule getestet werden:

```typescript
// ✅ RICHTIG: Direct Instantiation
describe('EinsatzNamingService', () => {
  let service: EinsatzNamingService;

  beforeEach(() => {
    service = new EinsatzNamingService(); // NO TestingModule
  });

  it('should format number with zero-padding', () => {
    // Given
    const year = 2024;
    const sequence = 1;

    // When
    const result = service.generateEinsatzNummer(year, sequence);

    // Then
    expect(result).toBe('E2024-001');
  });
});
```

```typescript
// ❌ FALSCH: NestJS TestingModule
// NIEMALS für Domain Services verwenden!
const module: TestingModule = await Test.createTestingModule({
  providers: [EinsatzNamingService],
}).compile();

const service = module.get<EinsatzNamingService>(EinsatzNamingService);
```

### Test Structure (Given-When-Then)

Alle Domain Services Tests folgen dem Given-When-Then Pattern:

```typescript
it('should validate complete Einsatz successfully', () => {
  // Given: Einsatz with all required fields
  const einsatz = createCompleteEinsatz();

  // When: Validate completeness
  const result = service.canBeCompleted(einsatz);

  // Then: Should be valid
  expect(result.isSuccess).toBe(true);
});
```

### Deterministic Tests (Date-Based Policies)

Policies mit Datum-Logik (z.B. `EinsatzArchivalPolicy`) sollten **deterministische** Tests haben:

```typescript
it('should return true when Einsatz is 10 years old', () => {
  // Given: Einsatz completed 10 years ago (FIXED DATE)
  const completedAt = new Date('2014-11-17');
  const einsatz = createCompletedEinsatz(completedAt);
  const currentDate = new Date('2024-11-17'); // FIXED DATE (NOT new Date())

  // When: Check if archivable
  const canArchive = policy.canBeArchived(einsatz, currentDate);

  // Then: Should be archivable
  expect(canArchive).toBe(true);
});
```

**Warum currentDate als Parameter?**
- Deterministische Tests (kein Flaky-Test durch `new Date()`)
- Batch-Jobs können festes Datum übergeben (z.B. Monatsende)
- NO Side Effects in Domain Layer

---

## Verzeichnisstruktur

```
domain/services/
├── einsatz-naming.service.ts           # EinsatzNamingService
├── einsatz-naming.service.spec.ts      # Unit Tests
├── einsatz-completeness.service.ts     # EinsatzCompletenessService
├── einsatz-completeness.service.spec.ts# Unit Tests
├── einsatz-archival.policy.ts          # EinsatzArchivalPolicy
├── einsatz-archival.policy.spec.ts     # Unit Tests
├── README.md                            # Diese Dokumentation
├── ports/                               # Port Interfaces
│   ├── i-geocoding.port.ts             # Geocoding Port (Story 1.5)
│   └── i-token-service.port.ts         # Token Service Port (Story 1.7)
└── __tests__/                           # Integration Tests
    └── domain-services.integration.spec.ts
```

---

## Zusammenfassung

| Service | Typ | Purpose | Location | Framework |
|---------|-----|---------|----------|-----------|
| **EinsatzNamingService** | Service | Einsatznummern generieren | `einsatz-naming.service.ts` | NO (Pure Function) |
| **EinsatzCompletenessService** | Service | Einsatz-Vollständigkeit prüfen | `einsatz-completeness.service.ts` | NO (Pure Function) |
| **EinsatzArchivalPolicy** | Policy | 10-Jahres-Archivierung prüfen | `einsatz-archival.policy.ts` | NO (Pure Function) |
| **IGeocodingPort** | Port | Geocoding Interface (Nominatim) | `ports/i-geocoding.port.ts` | NO (Interface Only) |

**Alle Domain Services sind:**
- ✅ Framework-agnostic (NO NestJS decorators)
- ✅ Stateless (Pure Functions)
- ✅ German JSDoc mit "Warum"-Erklärung
- ✅ Getestet mit Given-When-Then Struktur
- ✅ Result<T> Pattern für Error Handling (wo anwendbar)
