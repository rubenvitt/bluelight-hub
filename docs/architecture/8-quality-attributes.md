# 8. Quality Attributes

## Actually Implemented

### Security

- ✅ **JWT Authentication:** Cookie-based, 3-Token-System
- ✅ **RBAC:** Role-based access control (USER, ADMIN, SUPER_ADMIN)
- ✅ **Audit Logging:** createdBy, updatedBy, deletedBy, archivedBy on all entities
- ✅ **HTTP-Only Cookies:** XSS-Schutz
- ✅ **SameSite Cookies:** CSRF-Schutz
- ✅ **Helmet Middleware:** Security headers
- ✅ **Rate Limiting:** Throttle Guards auf kritischen Endpunkten
- ✅ **Password Hashing:** Bcrypt (für Admin-User)

### Data Integrity

- ✅ **No-Delete Policy:** Einsätze werden nur archiviert, nie gelöscht (ADR-017)
- ✅ **Soft-Delete:** User, ETB-Einträge, Textbausteine
- ✅ **10-Year Archival:** ETB mit SHA-256 Checksums (EtbArchiv)
- ✅ **Version History:** Vollständige Nachvollziehbarkeit (EtbEintragHistorie)
- ✅ **Audit Trail:** createdAt, updatedAt, deletedAt, archivedAt
- ✅ **Checksummen:** SHA-256 für Archiv-Integrität

### Reliability

- ✅ **Automatic Token Refresh:** Transparente Token-Erneuerung bei 401
- ✅ **Optimistic Updates:** Sofortiges Feedback mit Rollback (ADR-020)
- ✅ **Request Retry:** Automatic retry bei Netzwerkfehlern (TanStack Query)
- ✅ **Error Boundaries:** Globale Frontend-Error-Handling
- ✅ **Health Checks:** Liveness/Readiness Probes

### Usability

- ✅ **Dark Mode:** ColorModeContext
- ✅ **Keyboard Shortcuts:** Command Palette (CMDK)
- ✅ **Offline Maps:** Leaflet Tiles mit Offline-Region-Download
- ✅ **Toast Notifications:** Sonner für Feedback
- ✅ **Optimistic UI:** Sofortiges Feedback ohne Wartezeit
- ✅ **Form Validation:** Zod-Schemas mit klaren Fehlermeldungen
- ✅ **Responsive Design:** Tailwind CSS Breakpoints

### Maintainability

- ✅ **Hexagonale Architektur:** Klare Trennung in Domain, Application, Infrastructure Layer
- ✅ **Dependency Direction:** Domain ← Application ← Infrastructure (niemals umgekehrt)
- ✅ **Technology Independence:** Infrastructure kann ohne Domain-Änderungen ausgetauscht werden
- ✅ **CQRS Pattern:** Separate Optimierung für Reads und Writes
- ✅ **Repository Ports:** Abstraktion über Datenzugriff (ADR-024)
- ✅ **Modular Architecture:** NestJS Modules + Atomic Design (Frontend)
- ✅ **Generated API Client:** Kein manueller API-Code
- ✅ **TypeScript Everywhere:** Vollständige Type-Safety
- ✅ **OpenAPI Documentation:** Auto-generated Swagger UI
- ✅ **Consistent Code Style:** Biome Linter/Formatter

**Hexagonale Architektur Vorteile:**
| Aspekt | Vorteil |
|--------|---------|
| Testability | Domain ohne Framework testbar |
| Flexibility | Infrastructure austauschbar |
| Clarity | Klare Verantwortlichkeiten |
| Onboarding | Explizite Architektur-Regeln |

**Referenz:** Siehe ADR-025 für Hexagonale Architektur Entscheidung.

### Testability

Die Hexagonale Architektur ermöglicht umfassende Testbarkeit auf allen Ebenen:

**Domain Layer Tests (Unit Tests):**
- ✅ **Framework-Agnostic:** Domain Layer kann ohne NestJS-Mocks getestet werden
- ✅ **Pure TypeScript:** Aggregate und Value Object Tests sind reine TypeScript-Tests
- ✅ **Schnelle Ausführung:** Keine Datenbank oder HTTP-Layer erforderlich
- ✅ **Hohe Coverage:** Story 5-2 etablierte Domain Layer Test-Infrastruktur

**Test-Beispiel (Domain Layer):**
```typescript
// Kein NestJS, keine Mocks, reines TypeScript
describe('EinsatzAggregate', () => {
  it('should create with valid data', () => {
    const einsatz = EinsatzAggregate.create({
      alarmstichwort: 'Brand',
      createdBy: 'user-123',
    });
    expect(einsatz.isSuccess).toBe(true);
    expect(einsatz.value.status.value).toBe('ANGELEGT');
  });
});
```

**Application Layer Tests (Unit Tests mit Mocks):**
- ✅ **Handler Isolation:** Command/Query Handlers mit gemockten Repositories
- ✅ **Result Pattern:** Explizite Fehlerbehandlung testbar
- ✅ **Event Verification:** Domain Events können verifiziert werden

**Infrastructure Layer Tests (Integration Tests):**
- ✅ **E2E Tests:** Gegen echte PostgreSQL-Datenbank
- ✅ **Outbox Pattern:** Event Publishing Verification
- ✅ **Controller Tests:** HTTP Integration mit NestJS TestingModule

**Referenz:** Siehe Story 5-2 für Domain Layer Test-Infrastruktur Setup.

### Performance (NFR-4)

**Non-Functional Requirement 4:** Alle API-Endpoints müssen p95 < 200ms erreichen.

**Status:** ✅ **FULLY COMPLIANT** (Story 5-3)

| Endpoint | Baseline p95 | Current p95 | NFR-4 Status |
|----------|-------------|-------------|--------------|
| GET /einsatz | 15.54ms | 15.97ms | ✅ 92% unter Threshold |
| GET /active-with-counts | 18.20ms | 25.93ms | ✅ 87% unter Threshold |
| GET /:id/details | 4.73ms | - | ✅ 98% unter Threshold |
| POST /einsatz | 6.41ms | - | ✅ 97% unter Threshold |
| POST /etb/:id/eintrag | 4.49ms | - | ✅ 98% unter Threshold |
| **Aggregate** | **15.30ms** | **18.21ms** | ✅ **91% unter Threshold** |

**CI/CD Integration:**
- Artillery.io Thresholds: `ensure.p95: 200`
- Automatische Regression-Detection bei Threshold-Verletzung
- NPM Scripts: `test:perf`, `test:perf:quick`, `test:perf:ci`

**Referenz:** Siehe `docs/performance/performance-baseline-hexagonal.md` für vollständigen Performance Baseline Report.

## Not Implemented / Aspirational

### Advanced Performance Optimizations

- ⚠️ **Caching:** Nur TanStack Query Client-Cache (kein Redis/Backend-Cache)
- ❌ **CDN:** Kein CDN für statische Assets
- ❌ **Database Indexing:** Minimal (nur Prisma auto-indexes)
- ❌ **Query Optimization:** Keine expliziten N+1 Optimierungen

### Scalability

- ❌ **Horizontal Scaling:** Nicht implementiert (Single-Instance)
- ❌ **Load Balancing:** Nicht konfiguriert
- ❌ **Database Replication:** Nicht eingerichtet
- ❌ **Message Queue:** Keine Async-Processing

### Offline Capability

- ⚠️ **Offline Maps:** Nur Map-Tiles (keine Daten-Sync)
- ❌ **Service Worker:** Nicht implementiert
- ❌ **IndexedDB:** Keine lokale Datenbank
- ❌ **Sync Engine:** Keine Konfliktauflösung

### Real-Time Communication

- ❌ **WebSocket:** Ordner existiert, aber leer
- ❌ **Server-Sent Events:** Nicht implementiert
- ❌ **Push Notifications:** Nicht implementiert

---
