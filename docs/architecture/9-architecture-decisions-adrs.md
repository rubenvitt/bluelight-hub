# 9. Architecture Decisions (ADRs)

## Implemented ADRs (✅)

### ADR-005: Event Sourcing → CRUD + Audit Log

**Status:** ✅ Fully implemented

**Decision:** CRUD-basierter Ansatz mit Versionierung und Audit-Trail

**Implementation:**
- Soft-Delete only (keine physischen Löschungen)
- Versionierte Einträge (EtbEintragHistorie)
- Separater Audit-Table für alle Aktionen
- Status-Feld für ETB (DRAFT → ACTIVE → LOCKED)

**Rationale:**
- Konsistenz mit Prisma/PostgreSQL Stack
- Einfachere Implementierung
- Schnellere Time-to-Market
- Performance: Direkte Queries ohne Event-Replay

### ADR-007: JWT-Authentifizierung

**Status:** ✅ Fully implemented

**Implementation:**
- Cookie-basierte JWT-Tokens (HTTP-Only, Secure, SameSite)
- 3-Token-System: Access (15min), Refresh (7d), Admin
- Passport JWT Strategy
- Automatic token refresh on 401

### ADR-010: MFA Removal

**Status:** ✅ Implemented

**Decision:** Vollständige Entfernung von Multi-Factor Authentication

**Rationale:**
- Zu komplex für initialen Release
- Fokus auf Kernfeatures
- Kann später ergänzt werden

### ADR-011: Admin Roles System

**Status:** ✅ Fully implemented

**Implementation:**
- 3 Rollen: USER, ADMIN, SUPER_ADMIN
- Role-based Guards (`JwtAuthGuard`, `AdminJwtAuthGuard`)
- Granular permissions per endpoint

### ADR-013: Tailwind CSS + Headless UI Migration

**Status:** ✅ Fully implemented

**Decision:** Migration von Chakra UI zu Tailwind CSS + Headless UI

**Implementation:**
- Atomic Design mit Tailwind-Klassen
- Headless UI für accessible Komponenten
- Bundle-Size Reduktion um ~60%
- Performance-Verbesserung (kein CSS-in-JS Runtime)

**Rationale:**
- Bessere Performance (Zero-Runtime)
- Kleinere Bundle-Size
- Tailwind IntelliSense in IDE
- Headless UI für Accessibility

### ADR-016: Unified Authentication

**Status:** ✅ Fully implemented

**Decision:** Ein einziger `/api/auth/unified` Endpunkt für Login & Auto-Register

**Implementation:**
```typescript
POST /api/auth/unified
{
  username: string,
  password?: string // optional
}

// Backend prüft:
if (userExists) {
  // Login-Flow
  validatePassword();
  return { user, token, isNewUser: false };
} else {
  // Auto-Register-Flow
  createUser();
  return { user, token, isNewUser: true };
}
```

**Rationale:**
- Bessere UX (keine Verwirrung Login vs. Register)
- Schnellerer Onboarding
- Weniger Code (ein Formular, ein Endpunkt)

### ADR-017: No-Delete Policy für Einsätze

**Status:** ✅ Fully implemented

**Decision:** Einsätze werden NIEMALS physisch gelöscht

**Implementation:**
- `archivedAt`, `archivedBy` Felder
- Status-Transition: → ARCHIVIERT
- Prisma-Query-Filter für archivierte Einsätze
- Expliziter `/archive` Endpunkt

**Rationale:**
- Compliance (DRK-Anforderungen)
- Audit-Trail
- Datenintegrität
- Nachvollziehbarkeit

### ADR-018: Minimale Einsatzerstellung

**Status:** ✅ Fully implemented

**Decision:** Einsätze können ohne Pflichtparameter erstellt werden

**Implementation:**
- Alle Felder optional (außer ID)
- Automatische Namengenerierung aus verfügbaren Feldern
- Inkrementelle Vervollständigung
- Completeness-Score (0-100%)

**Rationale:**
- Flexibilität im Einsatz
- Schnelle Anlage ohne Vorkenntnisse
- Nachträgliche Vervollständigung

### ADR-019: Computed Fields für Einsatzdaten

**Status:** ✅ Fully implemented

**Decision:** `name` und `completeness` als Computed Fields

**Implementation:**
```typescript
// name: Automatisch generiert
name = alarmstichwort || `Einsatz ${id.slice(0,8)}` || 'Unbenannter Einsatz';

// completeness: Berechnet aus ausgefüllten Feldern
completeness = (filledFields / totalFields) * 100;
```

**Rationale:**
- User Experience (sinnvoller Name ohne Pflicht)
- Übersicht über Datenvollständigkeit
- Keine Duplikation in Datenbank

### ADR-020: Optimistic UI Updates

**Status:** ✅ Fully implemented with TanStack Query

**Decision:** Sofortige UI-Aktualisierung mit Rollback bei Fehler

**Implementation:**
- TanStack Query `onMutate`, `onError`, `onSuccess`, `onSettled`
- Automatic rollback bei Server-Fehler
- Visuelle Indikatoren für Pending-Status
- Toast-Notifications für Feedback

**Rationale:**
- Beste UX (sofortiges Feedback)
- Gefühlte Performance verbessern
- User-Flow nicht unterbrechen
- Stresssituationen berücksichtigen

### ADR-021: BMAD Documentation Integration

**Status:** ✅ This document

**Decision:** Nutzung von BMAD Method für Architektur-Dokumentation

**Rationale:**
- arc42 teilweise veraltet
- BMAD für brownfield-Analyse geeignet
- Single Source of Truth aus Code

### ADR-022: Domain Layer als Backend Subfolder

**Status:** ✅ Accepted
**Date:** 2025-11-13
**Context:** Hexagonal Architecture Migration (Epic-1)
**Decision Makers:** Architect + Scrum Master

#### Context and Problem Statement

Im Rahmen der Migration zu Hexagonaler Architektur (Epic-1, Story 1.1) muss entschieden werden, wo die Domain Layer strukturell leben soll. Die Domain Layer ist das Herzstück der Geschäftslogik und muss vollständig unabhängig von Infrastruktur (Prisma, HTTP, externe Services) sein.

**Problem:** Zwei mögliche Ansätze stehen zur Diskussion:
1. Separates Monorepo-Package (`packages/domain/`)
2. Backend-Subfolder (`packages/backend/src/domain/`)

#### Considered Options

**Option 1: Monorepo Package (`packages/domain/`)**
- Eigenes NPM-Package mit separatem `package.json`
- Explizite Abhängigkeiten über `package.json`
- Eigener Build-Step
- Vollständige physische Isolation

**Option 2: Backend Subfolder (`packages/backend/src/domain/`)**
- Subfolder innerhalb des Backend-Packages
- TypeScript Path Aliases (`@domain/*` → `src/domain/*`)
- Kein separater Build-Step
- Statische Analyse mit Madge für Dependency-Checking

#### Decision Outcome

**Chosen option:** "Backend Subfolder" (`packages/backend/src/domain/`)

**Rationale:**
- ✅ Einfachere Maintenance (kein separates Package)
- ✅ TypeScript-Konfiguration via Backend `tsconfig.json`
- ✅ Kein zusätzlicher Build-Step erforderlich
- ✅ Schnellerer Development-Workflow
- ✅ Weniger Boilerplate-Code
- ⚠️ Erfordert disziplinierte Dependency-Rules

#### Consequences

**Positive:**
- Einfachere Projektstruktur (weniger Packages)
- Schnellere Builds (kein Cross-Package-Linking)
- TypeScript Paths bieten logische Trennung
- Entwickler-Erfahrung verbessert (keine `pnpm --filter` Commands nötig)

**Negative:**
- Keine physische Package-Boundary
- Risiko ungewollter Imports aus `application/` oder `infrastructure/`
- Abhängig von statischer Analyse (Madge) für Enforcement

**Mitigation:**
- **Madge Circular Dependency Check:** CI-Pipeline-Integration
  ```bash
  pnpm --filter @bluelight-hub/backend check:madge
  ```
- **ESLint no-restricted-imports:** Blockiere Imports von nicht-Domain-Code in Domain Layer
- **Pre-commit Hooks:** Husky + lint-staged validieren Dependency Rules

#### Technical Implementation

**Verzeichnisstruktur:**
```
packages/backend/src/
├── domain/                    # ✅ Kern-Geschäftslogik
│   ├── entities/              # Aggregates, Entities, Value Objects
│   ├── repositories/          # Repository-Interfaces (KEINE Implementierung!)
│   ├── services/              # Domain Services
│   └── events/                # Domain Events
├── application/               # Use Cases, DTOs
├── infrastructure/            # Prisma, HTTP, externe Services
└── presentation/              # Controller
```

**TypeScript Path Configuration (`tsconfig.json`):**
```json
{
  "compilerOptions": {
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@application/*": ["src/application/*"],
      "@infrastructure/*": ["src/infrastructure/*"]
    }
  }
}
```

**Madge Dependency Rule (`.madgerc`):**
```json
{
  "detectiveOptions": {
    "ts": {
      "skipTypeImports": true
    }
  },
  "noCircular": true,
  "noOrphans": true
}
```

**ESLint Rule (`eslint.config.js`):**
```javascript
{
  files: ['src/domain/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        '@application/*',
        '@infrastructure/*',
        '@nestjs/*',
        '@prisma/*'
      ]
    }]
  }
}
```

#### Related Decisions

- **ADR-006:** Hexagonal Architecture (Kontext für diese Entscheidung)
- **ADR-003:** Monolith vs. Microservice (Modularer Monolith gewählt)
- **Story 1.1:** Domain Layer Implementation (direkte Umsetzung)

#### Validation Criteria

✅ **Acceptance Criteria:**
1. Domain Layer importiert NIEMALS aus `application/` oder `infrastructure/`
2. Madge-Check läuft erfolgreich in CI/CD
3. ESLint blockiert unerlaubte Imports
4. TypeScript Paths funktionieren korrekt

## Partially Implemented ADRs (⚠️)

### ADR-001: Verbindungskonzept

**Status:** ⚠️ Partially implemented

**Decision:** Verschiedene Konnektivitätsszenarien (lokal, vollständig, autonom)

**Reality:**
- ✅ HTTP REST API (lokal + remote)
- ❌ Keine Offline-Sync
- ❌ Kein autonomer Modus
- ⚠️ Nur Offline-Maps (Leaflet Tiles)

### ADR-004: Tauri Desktop App

**Status:** ⚠️ Implemented, but limited

**Reality:**
- ✅ Tauri 2.8.5 Desktop App
- ✅ Cross-Platform (Windows, macOS, Linux)
- ❌ Keine nativen Features genutzt (z.B. Dateisystem)
- ❌ Keine Offline-Features

### ADR-006: Docker Deployment

**Status:** ⚠️ Partially implemented

**Reality:**
- ✅ Dockerfile vorhanden
- ✅ docker-compose.yml für Development
- ❌ Production-Deployment nicht dokumentiert
- ❌ Kubernetes nicht evaluiert

### ADR-009: Dashboard-Architektur

**Status:** ⚠️ Frontend-only

**Reality:**
- ✅ 4 Dashboard-Komponenten im Frontend
- ❌ Kein Backend-Dashboard-Modul
- ❌ Keine Echtzeit-Updates

### ADR-015: ETB Filter Implementation

**Status:** ⚠️ Not fully verified

**Reality:**
- Implementierung nicht im Detail verifiziert
- Wahrscheinlich vorhanden (13 ETB-Molecules)

## Not Implemented ADRs (❌)

### ADR-002: CRDTs für Datensynchronisation

**Status:** ❌ "In Prüfung", not implemented

**Reality:**
- Keine CRDT-Bibliotheken
- Keine Konfliktauflösung
- Nur Standard HTTP REST

### ADR-003: Monolith vs. Microservice

**Status:** ❌ Monolith gewählt, aber keine klaren Service-Grenzen

**Reality:**
- Modularer Monolith (NestJS Modules)
- Keine Service-Grenzen definiert
- Keine Microservice-Architektur

### ADR-008: Offene Entscheidungen

**Status:** ❌ Dokument mit TODOs, keine finalen Entscheidungen

### ADR-012: API Versioning Strategy

**Status:** ⚠️ `alpha` implementiert, aber keine v1/v2-Strategie

**Reality:**
- `/api/alpha/{resource}` für Domain-Endpunkte
- Keine Backward-Compatibility-Strategie
- Kein Deprecation-Prozess

---
