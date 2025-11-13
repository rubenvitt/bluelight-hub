# Epic Overview & Sequencing

Diese Migration folgt dem **Strangler Fig Pattern** - schrittweiser Ersatz der 3-Tier-Architektur durch Hexagonal Architecture + DDD.

## Epic-Struktur (5 Epics)

**Epic 1: Hexagonal Architecture Foundation** (Woche 1 - 42-56h)
- **Value:** Framework-agnostische Domain Layer als Basis für alle zukünftigen Features
- **Scope:** Aggregates, Value Objects, Domain Events, Repository Interfaces, Base Classes
- **Why this first:** Greenfield-Setup - alle folgenden Epics bauen darauf auf
- **Deliverable:** Domain Layer kompiliert isoliert, 50+ Unit-Tests ohne Framework

**Epic 2: Lagekarte Bounded Context Migration** (Woche 2 - 30-40h)
- **Value:** Erste End-to-End Migration als Proof-of-Concept für Strangler Fig
- **Scope:** Commands/Queries, Prisma Adapters, Controller Refactoring, Frontend API-Update
- **Why this second:** Kleinster Context, isoliert, geringes Risiko - ideal für Pattern-Validierung
- **Deliverable:** Lagekarte komplett auf neue Architektur (Backend + Frontend), Integration-Tests grün

**Epic 3: Einsatztagebuch (ETB) Migration** (Woche 3 - 30-40h)
- **Value:** Revisionssicheres ETB mit Versionierung auf Clean Architecture
- **Scope:** ETB Use Cases, Versionierungs-Logic, Event-Handler (Auto-Create), Frontend-Update
- **Why this third:** Komplexere Domain-Logic (History, Locking), baut auf Epic 1 Foundation auf
- **Deliverable:** ETB mit Versionierung funktioniert, Event-basierte Auto-Erstellung nach Einsatz-Creation

**Epic 4: Einsatz Lifecycle & Authentication** (Woche 4 - 36-50h)
- **Value:** Kern-Geschäftslogik (Einsatz-Management) + RBAC auf sauberer Architektur
- **Scope:** Einsatz Use Cases, Transactional Outbox Pattern, Auth-Adapter, Frontend-Komplettmigration
- **Why this fourth:** Kern-Domain mit höchster Komplexität, benötigt alle Patterns aus Epic 2+3
- **Deliverable:** Einsatz CRUD + Status Transitions + Auth komplett migriert, Outbox verhindert Event-Verlust

**Epic 5: System Consolidation & Optimization** (Woche 5 - 12-16h)
- **Value:** Technical Debt final beseitigen, Performance optimieren, Migration abschließen
- **Scope:** Alte Services löschen, Unit-Tests für Domain, Performance-Benchmarks
- **Why this fifth:** Finaler Cleanup für vollständige Migration - alte 3-Tier-Architektur muss vollständig ersetzt werden
- **Deliverable:** Alte 3-Tier-Architektur komplett entfernt, Performance-Baseline etabliert, Migration abgeschlossen

## Sequencing-Rationale

```
Epic 1 (Foundation)
  ↓ ermöglicht
Epic 2 (Lagekarte - Proof of Concept)
  ↓ validiert Pattern für
Epic 3 (ETB - Komplexere Domain-Logic)
  ↓ validiert Pattern für
Epic 4 (Einsatz - Kern-Domain + Outbox)
  ↓ ermöglicht
Epic 5 (Cleanup - Migration Abschluss)
```

**Warum diese Gruppierung?**
- ✅ **Incremental Value:** Jedes Epic liefert funktionierende Features (außer Epic 1 = Foundation)
- ✅ **Risk Mitigation:** Strangler Fig - Rollback nach jedem Epic möglich
- ✅ **Dependency Flow:** Klare Abhängigkeiten, keine Sprünge
- ✅ **Team Velocity:** Epics passen in 1-Woche Sprints (timeboxed)
- ✅ **DRK-Compliance:** NO-DELETE Policy, Outbox Pattern, MGRS-Koordinaten in Domain-Objekten verankert

---
