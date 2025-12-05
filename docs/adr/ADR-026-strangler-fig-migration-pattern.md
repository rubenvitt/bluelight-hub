# ADR-026: Strangler Fig Migration Pattern

**Status:** Accepted
**Datum:** 2025-12-05
**Autoren:** Ruben (via Dev Agent)
**Context:** Epic 1-5, Migration von 3-Tier zu Hexagonaler Architektur

## Kontext

Die bestehende 3-Tier-Architektur des Bluelight-Hub Backends wies mehrere strukturelle Probleme auf:

- **Enge Kopplung:** Services waren direkt an NestJS-Framework und Prisma-Repository gekoppelt
- **Fehlende Domänen-Logik:** Business-Regeln verteilt über Controller, Services und Entities
- **Schwierige Testbarkeit:** Framework-Abhängigkeiten erschwerten Unit-Tests
- **Produktionsrisiko:** Eine "Big-Bang"-Migration hätte das Risiko von Breaking Changes mit sich gebracht

Die Entscheidung für Hexagonale Architektur (ADR-025) erforderte eine schrittweise Migrationsstrategie, die:

1. Produktionsstabilität während der Migration gewährleistet
2. Inkrementelle Verbesserungen ermöglicht
3. Rückkehr zu alter Implementation bei Problemen erlaubt
4. Team-Lernen und Musterbildung unterstützt

## Entscheidung

Wir setzen das **Strangler Fig Pattern** für die schrittweise Migration von 3-Tier zu Hexagonaler Architektur ein:

1. **Inkrementelle Migration pro Bounded Context:**
   - Neue Implementierung koexistiert mit alter Implementation
   - Migration erfolgt pro Feature/Bounded Context, nicht als Big-Bang
   - Alte Implementation wird schrittweise durch neue ersetzt und dann entfernt

2. **Feature-Toggle-Strategie:**
   - Controller können zwischen alter Service-Implementation und neuen CQRS-Handlers wechseln
   - Granulare Aktivierung pro Endpoint möglich
   - Schnelles Rollback bei Problemen

3. **Migration Timeline (5 Epics):**

   **Epic 1: Domain Layer Foundation**
   - Basis-Klassen: `AggregateRoot`, `Entity`, `ValueObject`
   - Common Patterns: `Result<T>`, `DomainEvent`, `UniqueEntityId`
   - Test-Infrastruktur für Domain Layer

   **Epic 2: Lagekarte Bounded Context**
   - Erste vollständige BC-Migration (einfachster Use Case)
   - Etablierung von Patterns: Aggregate Design, CQRS, Repository Pattern
   - Lessons Learned für nachfolgende Epics

   **Epic 3: Einsatztagebuch Bounded Context**
   - Anwendung etablierter Patterns
   - Komplexere Domain-Logik (ETB-Kategorien, Validierung)
   - Verfeinerung der Test-Strategien

   **Epic 4: Einsatz + User Bounded Contexts**
   - Migration der zentralen BCs (Einsatz, User)
   - Integration des Transactional Outbox Pattern
   - Cross-BC Event-Handling

   **Epic 5: Cleanup + Consolidation**
   - Entfernung alter Services (`lagekarte.service.ts`, etc.)
   - Konsolidierung der Dokumentation
   - Performance-Optimierung und finale Tests

4. **Koexistenz-Muster:**

```typescript
// Controller kann zwischen alt und neu wechseln
@Controller('lagekarte')
export class LagekarteController {
  constructor(
    // Alte Implementation (wird später entfernt)
    @Optional() private readonly oldService?: LagekarteService,
    // Neue Implementation (CQRS Handler)
    private readonly createHandler?: CreateLagekarteEntryHandler,
  ) {}

  @Post()
  async create(@Body() dto: CreateLagekarteDto) {
    // Feature Toggle: Schrittweise Migration
    if (this.createHandler) {
      // Neue Hexagonal Architecture
      const command = CreateLagekarteEntryCommand.create(dto);
      const result = await this.createHandler.execute(command);
      return result.unwrap(); // Result Pattern
    }

    // Fallback: Alte 3-Tier Implementation
    return this.oldService.create(dto);
  }
}
```

### Begründung

1. **Risikominimierung:**
   - Kein Big-Bang: Produktionsausfälle werden vermieden
   - Rollback-Möglichkeit: Feature-Toggle ermöglicht sofortiges Zurückschalten
   - Inkrementelle Validierung: Jeder BC wird einzeln getestet

2. **Team-Lernen:**
   - Erste Migration (Lagekarte) als Lernprojekt
   - Patterns werden etabliert und dokumentiert
   - Fehler können früh erkannt und korrigiert werden

3. **Technische Vorteile:**
   - Klare Trennung: Alte und neue Implementation sind separat
   - Graduelle Performance-Tests: Keine unerwarteten Überraschungen
   - Dokumentation parallel zur Migration

4. **Business-Kontinuität:**
   - Keine Unterbrechung des Entwicklungsflows
   - Features können parallel weiterentwickelt werden
   - Kunde sieht keine Breaking Changes

## Konsequenzen

### Positiv

- **Produktionsstabilität:** Keine Breaking Changes, jederzeit rollback-fähig
- **Lernkurve:** Team konnte Patterns schrittweise erlernen (DDD, CQRS, Hexagonal)
- **Qualitätssicherung:** Jeder BC wurde einzeln umfassend getestet (Unit + Integration)
- **Dokumentation:** ADRs und Tests dokumentieren Migration-Entscheidungen
- **Code-Qualität:** Neue Implementation folgt klaren Architektur-Prinzipien (SOLID, DDD)
- **Testbarkeit:** Framework-unabhängige Domain-Logik ist leicht testbar

### Negativ

- **Boilerplate-Duplikation:** Während Migration existieren alte und neue Implementation parallel
- **Code-Komplexität:** Feature-Toggles und Koexistenz-Muster erhöhen temporär Komplexität
- **Lernkurve:** Initiale Verzögerung durch Einarbeitung in DDD/CQRS (Epic 1-2)
- **Aufwand:** Mehr Arbeit als Big-Bang (aber sicherer und nachhaltiger)
- **Konsistenz-Herausforderung:** Sicherstellen, dass alte und neue Implementation identisches Verhalten zeigen

### Migration

**Empfohlene Vorgehensweise für zukünftige Migrations-Projekte:**

1. **Start mit einfachstem Bounded Context:**
   - Lagekarte war ideal: einfache Domain-Logik, wenige Dependencies
   - Ermöglicht Fokus auf Architektur-Patterns statt komplexe Business-Logik

2. **Etabliere Patterns früh:**
   - Base-Klassen (`AggregateRoot`, `Entity`, `ValueObject`) im Epic 1
   - Test-Patterns und Mocks im Epic 1
   - Dokumentation (ADRs) parallel zur Entwicklung

3. **Umfassende Tests vor Migration:**
   - Unit-Tests für Domain Layer (>80% Coverage)
   - Integration-Tests für Handler und Repositories
   - Manuelle E2E-Tests mit Chrome DevTools MCP

4. **Feature-Toggle-Strategie:**
   - Constructor Injection mit `@Optional()` für alte Services
   - Graduelle Aktivierung pro Endpoint
   - Monitoring und Logging für Vergleich alt/neu

5. **Cleanup erst am Ende:**
   - Alte Implementation NICHT löschen während Migration
   - Epic 5 dediziert für Cleanup und Konsolidierung
   - Finale Validierung vor Entfernung

**Lessons Learned:**

- ✅ **Was gut funktioniert hat:**
  - Inkrementeller Ansatz: Ein BC nach dem anderen
  - Domain Layer Foundation (Epic 1): Klare Basis für alle BCs
  - Result Pattern: Eliminiert Exception-Handling-Komplexität
  - TransactionalCommandHandler: Atomar Events + Domain-Operationen
  - Umfassende Unit-Tests: Frühe Fehlererkennung

- ❌ **Was nicht optimal war:**
  - Initiale Boilerplate-Overhead: Viele Base-Klassen und Interfaces
  - Lernkurve: Team brauchte Zeit für DDD/CQRS-Konzepte
  - Duplikation: Alte und neue Implementation parallel

- 💡 **Empfehlungen:**
  - Start mit einfachstem BC (Lagekarte) war richtig
  - Mehr Pair-Programming für Wissensverteilung
  - Code-Reviews fokussiert auf Architektur-Prinzipien
  - Dokumentation (ADRs, JSDoc) parallel zur Entwicklung

## Verwandte Entscheidungen

- **ADR-025: Hexagonale Architektur mit DDD und CQRS**
  - Ziel-Architektur, zu der migriert wird
  - Definiert strukturelle Prinzipien (Ports, Adapters, Application Layer)

- **ADR-022: Domain Layer als Backend Subfolder**
  - Organisationsstruktur für Domain-Logik
  - Bounded Contexts als Top-Level-Ordner

- **ADR-024: Result Pattern statt Exceptions** *(Annahme: existiert)*
  - Error-Handling-Strategie in neuem System
  - Eliminiert Exception-basierte Control-Flow

- **ADR-027: Transactional Outbox Pattern** *(wird in Epic 4 erstellt)*
  - Event-Handling-Strategie
  - Garantiert atomare Domain-Operationen + Events

## Validierung

**Erfolgskriterien für abgeschlossene Migration:**

1. **Funktionale Korrektheit:**
   - ✅ Alle Endpoints liefern identische Responses (alt vs. neu)
   - ✅ Keine Breaking Changes für API-Konsumenten
   - ✅ Alle Business-Regeln korrekt implementiert

2. **Code-Qualität:**
   - ✅ Domain Layer: >80% Unit-Test Coverage
   - ✅ Application Layer: Alle Handler getestet
   - ✅ Infrastructure Layer: Repository-Integration-Tests

3. **Architektur-Prinzipien:**
   - ✅ Domain Layer framework-agnostic (keine NestJS-Imports außer `@Injectable`)
   - ✅ Application Layer nutzt Result Pattern (keine Exceptions für Business-Fehler)
   - ✅ DI-Tokens als Constants (keine String-Literals)
   - ✅ Transactional Outbox für alle Domain-Events

4. **Dokumentation:**
   - ✅ ADRs für alle Architektur-Entscheidungen
   - ✅ JSDoc für public APIs (Deutsch, "warum" nicht "was")
   - ✅ README.md aktualisiert (neue Struktur, Commands)

5. **Cleanup:**
   - ✅ Alte Services entfernt (`*.service.ts` aus 3-Tier)
   - ✅ Keine Feature-Toggles mehr im Code
   - ✅ Keine toten Code-Pfade (Linter-Check)

**Monitoring nach Migration:**

- API Response Times: Keine Regression gegenüber alter Implementation
- Error Rates: Keine Zunahme von 4xx/5xx Errors
- Database Query Performance: N+1-Queries vermieden durch Repository-Optimierung
- Event Processing: Outbox-Events werden korrekt verarbeitet (Monitoring-Dashboard)

**Rollback-Plan (falls benötigt):**

1. Feature-Toggle auf alte Implementation zurückschalten
2. Deployment der letzten stabilen Version (vor Migration)
3. Post-Mortem: Root-Cause-Analyse und Lessons Learned
4. Fix und erneute Migration mit verbesserter Strategie
