---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-04-21'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - docs/project-documentation/00-index.md
  - docs/project-documentation/01-projektueberblick.md
  - docs/project-documentation/02-backend-architektur.md
  - docs/project-documentation/03-frontend-architektur.md
  - docs/project-documentation/04-api-referenz.md
  - docs/project-documentation/06-datenmodell.md
  - docs/project-documentation/07-testing-und-qualitaet.md
  - docs/project-documentation/08-devops-und-deployment.md
  - docs/project-documentation/09-integrationen-und-extern.md
  - docs/project-documentation/10-ui-ux-design-system.md
  - docs/architecture-principles.md
  - docs/adr/adr-001-api-versioning-strategy.md
  - docs/adr/adr-002-runtime-konfigurationsmodell-und-secret-management.md
  - docs/adr/adr-005-etb-eintrag-kontext-discriminated-union.md
  - docs/adr/adr-006-websocket-event-bus-einsatz-scoped.md
  - docs/adr/adr-007-funkkanal-als-aggregat.md
  - docs/adr/adr-008-polymorphe-zuordnung-nullable-fks.md
  - docs/adr/adr-010-gefahrenzone-matrixzelle-referenz.md
workflowType: 'architecture'
project_name: 'Bluelight Hub – Modul Eigenschutz (Einsatzkräfte-Sicherheit & PSA)'
user_name: 'Rubeen'
date: '2026-04-21'
source_prd: '_bmad-output/planning-artifacts/prd.md'
source_ux: '_bmad-output/planning-artifacts/ux-design-specification.md'
source_issue: 'https://github.com/rubenvitt/bluelight-hub/issues/415'
projectContext: 'brownfield'
---

# Architecture Decision Document

_Dieses Dokument entsteht schrittweise durch kollaborative Entscheidungsfindung. Abschnitte werden nach jedem bearbeiteten Schritt angehängt._

## Project Context Analysis

### Requirements Overview

**Funktionale Anforderungen:** 54 MVP-FRs in 11 Capability-Gruppen
(Gefährdungsbeurteilung · PSA-Verwaltung · Bekanntgabe & Quittung ·
Sicherheitsregeln · Sicherungsposten · Vorfallmeldung & Export ·
Ampel-Dashboard · Versionierung/Audit · Rollen/Rechte · Offline/Sync ·
Plattform-Integration) zzgl. ~17 Phase 2/3-FRs.

**Signatur-Interaktion (Defining Experience):** CBRN-PSA-Hochstufung mit
Bekanntgabe — Multi-Select + Profil-Toggle + Begründung + Propagation +
Quittung, End-to-End ≤ 90 s (p95). Enthält alle Kernfähigkeiten in einer
Sequenz und ist Maßstab der Architektur-Entscheidungen.

**Innovations-Anker:**

1. Zeitpunktgenauer Kontext-Snapshot bei Vorfall (FR33) — unveränderlicher
   Stand von Gefährdungsbeurteilung + PSA-Profilen + Sicherheitsregeln zum
   Vorfall-Zeitpunkt.
2. Vorlagen-Versions-Stabilität im laufenden Einsatz (FR5, Phase 2 FR7) —
   laufende Einsätze bekommen keinen automatischen Vorlagen-Update.

**Bindende Review-Entscheidungen (Q1–Q8, aus PRD):**

- **Q1:** Risikomatrix 5×5 qualitativ, 4 Ergebnisklassen
  (Grün/Gelb/Orange/Rot).
- **Q2 — Modell-Änderung:** **PSA-Profile statt linearer Stufen**
  (TRBA 250 + DGUV Regel 105-003). Additiv, mehrere gleichzeitig
  aktivierbar pro Einheit/Bereich. FR10–FR16 sind entsprechend zu lesen.
- **Q3:** 5 Seed-Szenarien (MANV, VU, Großveranstaltung, Betreuung,
  CBRN-Patientenversorgung).
- **Q4 — Rollen-Hybrid:** Globale `UserRole` + `JwtAuthGuard` unverändert;
  `EigenschutzRolle`-Enum über bestehende `EinsatzRollenbesetzung`;
  feingranulare Permissions `eigenschutz:<domain>:<action>`.
- **Q5:** **Abschnitt ≡ `EinsatzEinheit`** (FK `einheitId`); keine eigene
  Abschnitts-Entity.
- **Q6:** `Gefaehrdungsbeurteilung` referenziert optional `gefahrenzoneId`
  (MVP reine Referenz; Phase 2 Auto-Übernahme via Backend-Join).
- **Q7:** Unfallkassen-Export-Schema im MVP als Obermenge; konkret in der
  Architecture-Phase als TS-Interface + Zod-Schema.
- **Q8:** Rechts-Review nach Pilot, vor Rollout — kein MVP-Release-Gate.

**UX-Spec-Abweichungen zum PRD (Architektur-relevant):**

- **FR22 Push-Notifications** von Phase 2 in den MVP gehoben
  (Tauri-Plugin-Notification + Web-Push wo technisch zumutbar).
- **`ConflictResolutionList`** als MVP-Feature (NFR-C3 Umsetzung).
- **Deep-Links pro Entität** als MVP.
- **Keyboard-Shortcuts** als MVP-First-Class-Feature.

**Nicht-funktionale Anforderungen (Architektur-treibend):**

| Kategorie       | Zielgrößen                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Performance     | Route-TTI ≤ 2 s · PSA-Propagation ≤ 2 s (p95) · Speicher ≤ 1 s (p95) · Ampel-Refresh ≤ 1 s (p95) · PDF-Export ≤ 5 s · Sync-Konsistenz ≤ 5 s · Bundle ≤ 150 kB gzip |
| Security        | Append-only Audit · Server-RBAC pro Endpoint · HTTPS (Plattform) · Löschkonzept an Einsatz-Lifetime gekoppelt · Exporte folgen Leserechten                         |
| Reliability     | Offline-Fähigkeit unabhängig vom Backend · At-least-once + Dedup via Event-ID · Rollback auf Versionsstand pro Entität                                             |
| Accessibility   | WCAG 2.1 AA + BITV 2.0 · Icon + Text immer kombiniert · `assertive`/`polite` Banner · Touch ≥ 48 px Primary / ≥ 44 px Secondary · Dark-Mode-Nachteinsatz-Pflicht   |
| Integration     | Einsatz-Routen-Nesting (`/einsaetze/:einsatzId/...`) · `@ApiWrappedResponse*` · Event-Registry 4 Stellen · MapGL (nicht Leaflet) · ADR-010 Platform Storage        |
| Scalability     | 20 Abschnitte · 100 Einheiten · 50 Clients · 500 GB-Items · 200 Vorfälle pro Einsatz ohne Regression                                                               |
| Maintainability | ≥ 80 % Domain-Coverage · `check:di:imports` · `check:arch` (no circular deps) · oxlint+oxfmt · benannte Prisma-Migrations                                          |

### Scale & Complexity

- **Domain:** GovTech / BOS (Public Safety) — weiße Hilfsorganisationen
  (DRK/JUH/MHD/ASB/DLRG), RD/SEG/KatS. Arbeitsschutz-regulatorisch
  (DGUV, ArbSchG § 5, SGB VII), DSGVO-sensibel.
- **Complexity:** **High** — safety-critical, versioniert, audit-pflichtig,
  offline-fähig, multi-device realtime, cross-modul integriert.
- **Primary technical domain:** Full-Stack Web-App + Tauri-Desktop-Shell
  (eine React-19-Codebasis, NestJS-Backend, PostgreSQL + Prisma).
- **Project Context:** **Brownfield** — hexagonale Backend-Architektur und
  Feature-basierte Frontend-Architektur bestehen; Eigenschutz fügt sich
  nahtlos in Muster ein (keine neuen Frameworks, keine Parallel-Strukturen).

**Neue Architektur-Komponenten (erwartet, wird in Step 4/6 finalisiert):**

- **5 Aggregates/Entities:** `Gefaehrdungsbeurteilung`,
  `PsaProfilZuweisung`, `Sicherheitsregel`, `Sicherungsposten`,
  `EigenschutzVorfall`.
- **3–4 Value Objects:** `Risikobewertung` (5×5), `PsaProfil`,
  `AusruestungsCheckliste`, `Quittungsstatus`.
- **6–8 Domain Events (Past Tense):** `GefaehrdungsbeurteilungErstellt`,
  `GefaehrdungsbeurteilungAktualisiert`, `PsaProfilGeaendert`,
  `SicherheitsregelAusgerufen`, `SicherungspostenEingerichtet`,
  `VorfallGemeldet`, `QuittungAbgegeben`, `LueckeGemeldet`.
- **1 Read-Model-Projektion:** Ampel-Status pro `EinsatzEinheit`
  (FR38–FR40, NFR-P4 ≤ 1 s).
- **1 Snapshot-Mechanismus:** zeitpunktgenauer Kontext bei Vorfall (FR33).
- **1 Hybrid-Auth-Layer:** `EigenschutzRolle`-Enum über
  `EinsatzRollenbesetzung` + Permissions-Array.
- **Frontend-Feature-Slice:** ~14 Komponenten (UX-Spec detailliert),
  davon 6 Shared-Promotion-Kandidaten.

### Technical Constraints & Dependencies

**Plattform-Festlegungen (nicht verhandelbar):**

- **Offline-Layer:** ADR-010 Platform Storage Adapter — kein modul-eigenes
  Sync.
- **Event-Layer:** Transactional Outbox + Event-Registry an 4 Stellen pro
  Event (Serializer, Deserializer, Adapters-Modul, Adapters-Index).
- **Transport:** bestehender WebSocket-Kanal (ADR-006, einsatz-scoped) —
  kein neuer Transport.
- **Lagekarte:** MapGL-Layer — Leaflet/Leaflet.PM verboten.
- **Forms:** `@tanstack/react-form` + Zod; Schemas zwischen Frontend und
  Backend-DTO-Validation geteilt.
- **Server-State:** `@tanstack/react-query`; **Client-State:**
  `@tanstack/react-store`; **API-Client:** generiert via
  `pnpm run generate-api` — manuelle `fetch()`-Calls verboten.
- **Route-Convention Backend:**
  `/api/einsaetze/:einsatzId/sicherheit/eigenschutz/...` (Plural).
- **Route-Convention Frontend:**
  `/app/einsatz/$einsatzId/sicherheit/eigenschutz/...` (Singular, bestehend).
- **Backend-DI:** `import` für Injectable Classes (nie `import type`,
  AC1/Pre-Commit-Hook).
- **Response-Decorators:** `@ApiWrappedResponse` /
  `@ApiWrappedCreatedResponse` (AC7).

**Auth-Hybrid (Q4):**

- Global: `UserRole` (`SUPER_ADMIN`/`ADMIN`/`USER`) + `JwtAuthGuard`.
- Einsatz-kontextuell: neuer `EigenschutzRolle`-Enum
  (`SICHERHEITSBEAUFTRAGTER`, `ABSCHNITTSLEITER`, `EINHEITSFUEHRER`,
  `NACHBEREITUNG`; Admin mappt auf globale `UserRole.ADMIN`) via
  bestehende `EinsatzRollenbesetzung`.
- Feingranular: Permissions-Array `eigenschutz:<domain>:<action>`.

**Integrations-Vorbedingungen:**

- **Gefahren-Modul:** stabile `Gefahrenzone`-API (MVP-Referenz; Phase 2
  Auto-Übernahme FR8/FR15).
- **Lagekarte:** muss Marker-Layer für Sicherungsposten aufnehmen (FR28).
- **Plattform-Notification-Kanal:** muss
  „kritisch/nicht-ignorierbar"-Priorität unterstützen (FR17); Fallback
  ist MVP-interner Banner-Mechanismus.
- **Tauri-Plugin-Notification:** MVP-Pflicht für FR22 (UX-Spec-Abweichung).

### Cross-Cutting Concerns Identified

1. **Audit & Versionierung by design** — jede sicherheitsrelevante Entität
   append-only; Event-sourced via Outbox; zeitpunktgenauer
   Kontext-Snapshot bei Vorfall (Innovations-Anker).
2. **Offline-First & Sync-Konflikte** — alle Lese-/Schreiboperationen
   offline; deterministische Merges für unkritische Felder; explizite
   Konfliktmarkierung für PSA-Profilzuweisung und
   Gefährdungsbeurteilungs-Items; Listen-UX für ≥ 20 parallele Konflikte.
3. **Echtzeit-Propagation & Quittungs-Tracking** — Event-getriebener Push
   ≤ 2 s; Quittungs-Status live; Re-Prompt nach 5 min ohne Quittung +
   Eskalation an Einsatzleiter.
4. **Authorization** — serverseitige Role-/Permission-Checks pro Endpoint;
   Hybrid aus globaler `UserRole` und einsatz-kontextueller
   `EigenschutzRolle`.
5. **Cross-Modul-Integration** — Gefahren-Modul (FK + Phase-2-Auto),
   Lagekarte (MapGL-Layer), Einsatz-Aggregate (`einsatzId` + `einheitId`),
   Plattform-Notification-Kanal.
6. **Accessibility & Internationalisierung** — WCAG AA + BITV;
   ARIA-Live-Budget (max 3 `assertive` Banner); i18n-Struktur vorbereitet,
   nicht MVP-pflichtig.
7. **Telemetrie für CBRN-Moment** — Timestamps `assess_started` /
   `all_banners_delivered`; Blind-Ack-Detection (< 2 s Tap nach Öffnen).
8. **Export-Infrastruktur** — PDF + JSON generisch im MVP;
   landesunfallkassen-spezifisch Phase 2 (FR37).
9. **Keyboard-Shortcuts First-Class** — globale + kontextuelle Shortcuts;
   Power-User-Pfad ohne Maus.
10. **Dark-Mode-Severity-Tokens** — Nachteinsatz-Pflicht (OLED-warmes Rot,
    blendarm); Kontrast-Verifikation in beiden Themes.

## Starter Template Evaluation

### Context: Brownfield Baseline

Eigenschutz ist ein neues Feature-Modul in einem bestehenden, stabilen
Monorepo. **Es gibt keine Starter-Template-Entscheidung** — die
Tech-Baseline ist durch `CLAUDE.md`, `architecture-principles.md` und
bestehende ADRs festgelegt und verbindlich. Stattdessen wird hier die
existierende Baseline als „gewählter Starter" dokumentiert und verifiziert,
dass alle für den Eigenschutz-MVP benötigten Dependencies bereits vorhanden
sind.

### Primary Technology Domain

**Full-Stack Web-App + Tauri-Desktop-Shell** in einem pnpm-Workspace-Monorepo
— Backend (NestJS hexagonal) und Frontend (React 19 + Vite + Tauri) teilen
sich den automatisch generierten API-Client (`packages/shared/client/`).

### Selected Baseline: Bluelight-Hub Monorepo (bestehend)

**Rationale for Selection:**

1. **Konsistenz ist Architektur-Ziel.** Der S-Stab nutzt im selben Einsatz
   Einsatz-Modul, ETB, Lagekarte und Eigenschutz — UI-/API-Brüche kosten
   Sekunden im CBRN-Moment (UX-Spec Experience Principle #1).
2. **Plattform-Muster sind Pflicht.** AC1 (DI-Imports), AC7 (Response
   Decorators), ADR-010 (Platform Storage), ADR-006 (Event Bus) machen
   einen „frischen" Ansatz nicht wählbar.
3. **Tempo.** Der MVP-Scope ist durch Pilot-Termine getrieben; eine
   Starter-Evaluation aus dem Nichts wäre Zeitverschwendung bei bereits
   etablierten, getesteten Mustern.

**Initialization Command (für neue Feature-Arbeit):**

```bash
# Nur wenn Worktree benötigt (bestehender Repo-Setup)
bash scripts/worktree-setup.sh
pnpm install
pnpm run generate-api           # nach Backend-Endpoint-Arbeit
pnpm --filter @bluelight-hub/backend prisma:migrate --name add_eigenschutz_module
pnpm -r dev                     # Backend + Frontend + Tauri starten
```

### Technische Baseline (verifizierte Versionen, Stand 2026-04-21)

**Runtime & Tooling:**

| Bereich    | Version                      | Status                                            |
| ---------- | ---------------------------- | ------------------------------------------------- |
| Node.js    | `>= 24.0.0`                  | engines                                           |
| pnpm       | `10.32.1`                    | packageManager                                    |
| TypeScript | `6.0.3`                      | gerade major-upgraded (Recent commit `ad12a9c18`) |
| Linting    | oxlint `1.60` + oxfmt `0.45` | kein Biome/ESLint/Prettier                        |

**Backend-Stack:**

| Bereich       | Paket                                                           | Version                                |
| ------------- | --------------------------------------------------------------- | -------------------------------------- |
| Framework     | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`    | `11.1.19`                              |
| CQRS          | `@nestjs/cqrs`                                                  | `11.0.3`                               |
| Event-Emitter | `@nestjs/event-emitter`                                         | `3.0.1`                                |
| WebSockets    | `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` | `11.1.19` / `4.8.3`                    |
| Scheduler     | `@nestjs/schedule`                                              | `6.1.3`                                |
| Swagger       | `@nestjs/swagger`                                               | `11.3.2`                               |
| Auth          | `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`   | `11.0.2` / `11.0.5` / `0.7.0`          |
| ORM           | `@prisma/client`, `prisma`, `@prisma/adapter-pg`, `pg`          | `7.7.0` / `7.7.0` / `7.7.0` / `8.20.0` |
| Validation    | `zod`                                                           | `4.3.6`                                |
| PDF           | `pdfkit`                                                        | `0.18.0`                               |
| ID-Gen        | `@paralleldrive/cuid2`                                          | `3.3.0`                                |
| Testing       | `jest`, `@swc/jest`                                             | `30.3.0` / `0.2.39`                    |

**Frontend-Stack:**

| Bereich             | Paket                                                   | Version                       |
| ------------------- | ------------------------------------------------------- | ----------------------------- |
| UI-Framework        | `react`, `react-dom`                                    | `19.2.5`                      |
| Build               | `vite`                                                  | `8.0.9`                       |
| Styling             | `tailwindcss`, `@tailwindcss/vite`                      | `4.2.2`                       |
| Headless-Primitives | `@headlessui/react`                                     | `2.2.10`                      |
| Variants            | `class-variance-authority`                              | `0.7.1`                       |
| Utility             | `clsx`, `tailwind-merge`                                | `2.1.1` / `3.5.0`             |
| Theming             | `next-themes`                                           | `0.4.6`                       |
| Server-State        | `@tanstack/react-query`                                 | `5.99.2`                      |
| Client-State        | `@tanstack/react-store`                                 | `0.11.0`                      |
| Routing             | `@tanstack/react-router`                                | `1.168.23`                    |
| Forms               | `@tanstack/react-form`, `zod`                           | `1.29.0` / `4.3.6`            |
| Command Palette     | `cmdk`                                                  | `1.1.1`                       |
| Keyboard-Shortcuts  | `react-hotkeys-hook`                                    | `5.2.4`                       |
| Map                 | `maplibre-gl`, `react-map-gl`, `@mapbox/mapbox-gl-draw` | `5.23.0` / `8.1.1` / `1.5.1`  |
| Taktische Zeichen   | `taktische-zeichen-core`, `taktische-zeichen-react`     | `0.10.0`                      |
| Realtime            | `socket.io-client`                                      | `4.8.3`                       |
| Date                | `date-fns`                                              | `4.1.0`                       |
| Testing             | `vitest`, `@testing-library/react`, `jsdom`             | `4.1.4` / `16.3.2` / `29.0.2` |
| Virtualisierung     | `@tanstack/react-virtual`, `@tanstack/pacer`            | `3.13.24` / `0.21.0`          |
| Toasts              | `sonner`                                                | `2.0.7`                       |

**Tauri-Plugins (MVP-relevant):**

| Plugin                            | Version  | Eigenschutz-Nutzung                           |
| --------------------------------- | -------- | --------------------------------------------- |
| `@tauri-apps/api`                 | `2.10.1` | Basis                                         |
| `@tauri-apps/plugin-notification` | `2.3.3`  | **FR22 kritische PSA-/Vorfall-Notifications** |
| `@tauri-apps/plugin-store`        | `2.4.2`  | Platform-Storage-Adapter (ADR-010)            |
| `@tauri-apps/plugin-deep-link`    | `2.4.8`  | Deep-Links pro Entität (UX-MVP)               |

### Architectural Decisions Already Provided by Baseline

**Language & Runtime:** TypeScript 6 `strict`-Modus, Node 24, ESM-only.

**Styling-Solution:** Tailwind CSS 4 + Headless UI + CVA-Variants. Kein
CSS-in-JS. Dark-Mode via `next-themes` + `prefers-color-scheme`.

**Build-Tooling:** Vite 8 (Frontend), NestJS CLI + SWC (Backend),
`@tauri-apps/cli` 2.10 für Desktop-Bundling.

**Testing-Framework:** Backend Jest 30 + `@swc/jest`; Frontend Vitest 4 +
Testing-Library + jsdom. Artillery für Performance-Tests.

**Code-Organization:** Hexagonale Layer im Backend
(`modules/infrastructure/application/domain`), Feature-Slice im Frontend
(`features/*/{api,ui,schemas,stores}`). Siehe
`docs/architecture-principles.md` als Quelle der Wahrheit.

**Development Experience:**

- `pnpm -r dev` startet Backend + Frontend + Tauri parallel
- `pnpm run generate-api` generiert Shared-Client aus OpenAPI-Spec
- Pre-Commit-Hooks: `check:di:imports`, gitmoji-validator, oxlint
- `@tanstack/*-devtools` + React-DevTools im Dev-Build

### Dependency-Bedarfsanalyse für Eigenschutz-MVP

**Bereits vorhanden — kein Installations-Aufwand:**

| Feature                                     | Genutzt wird                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Offline-Speicherung (FR48–FR50, ADR-010)    | `@tauri-apps/plugin-store` + Platform-Storage-Adapter (bestehend)                   |
| Realtime-Push (FR17, NFR-P2)                | `socket.io` + `@nestjs/websockets` (bestehend, ADR-006)                             |
| Event-Sourcing / Outbox (FR41–FR43, NFR-S4) | `@nestjs/cqrs` + `transactional-command.handler` + Outbox-Infrastruktur (bestehend) |
| PDF-Export (FR34, NFR-P5)                   | `pdfkit` (bestehend)                                                                |
| Command-Palette (UX-MVP)                    | `cmdk` (bestehend)                                                                  |
| Keyboard-Shortcuts (UX-MVP)                 | `react-hotkeys-hook` (bestehend)                                                    |
| Tauri-Notifications (FR22, UX-MVP)          | `@tauri-apps/plugin-notification` (bestehend)                                       |
| Deep-Links (UX-MVP)                         | `@tauri-apps/plugin-deep-link` + TanStack-Router (bestehend)                        |
| Lagekarte-Layer (FR28)                      | `maplibre-gl` + `react-map-gl` + `@mapbox/mapbox-gl-draw` (bestehend)               |
| Taktische Marker                            | `taktische-zeichen-react` (bestehend)                                               |
| Forms + Validation                          | `@tanstack/react-form` + `zod` (bestehend)                                          |

**Neu einzuführen (bestätigt):**

- **Web-Push für Browser-Deployments** (FR22, UX-MVP): VAPID-basiert.
  Backend nutzt `web-push` (npm), Frontend nutzt native `PushManager`-API
  - Service-Worker. Kein zusätzlicher Transport-Layer, sondern Fallback
    neben Tauri-Plugin-Notification. **Feingestaltung in Step 4.**

**Explizit AUSGESCHLOSSEN (für MVP nicht sinnvoll):**

- **`@tauri-apps/plugin-barcode-scanner`** (bereits installiert, aber
  ungenutzt): Kandidat für Phase 2 zusammen mit erweiterten
  Spezialschutz-/Material-Scan-Workflows (Einheits-/PSA-Scan), gehört nicht
  zum PRD-/UX-Scope.
- **Auto-Updater / Background-Events:** Plattform-Thema, nicht
  modul-spezifisch — bleibt bei der bestehenden Plattform-Strategie.
- **Worker-Threads / Web-Workers für Risiko-Berechnung:** Die 5×5-Matrix
  ist trivial, keine Hintergrund-Berechnung nötig.

### Key Implications für die Architektur-Phase

1. **FR22 (Push-Notifications) ist für Tauri-Clients „kostenlos"**
   (Plugin bereits installiert). Web-Push wird explizit im MVP umgesetzt
   (einzige neue Dependency: `web-push` im Backend + Service-Worker im
   Frontend).
2. **Keine Framework-Experimente.** Route-Library, State-Libs, Form-Lib,
   Map-Lib — alles festgelegt.
3. **Prisma 7.7 + `@prisma/adapter-pg`** ist der aktuelle Stand; neue
   Migrations nutzen die bestehende Pipeline (`prisma:migrate --name ...`).
4. **TypeScript 6 + Zod 4** — beide sind gerade major-upgraded. Eigenschutz
   nutzt diese direkt, muss keine Legacy-Kompatibilität berücksichtigen.

**Note:** Project initialization using this baseline ist bereits
abgeschlossen — die erste Implementation-Story für Eigenschutz startet
direkt mit Domain-Modell und Prisma-Migration.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):** B1 Versionierungs-Strategie ·
B2 Vorfall-Snapshot-Persistenz · B3 PSA-Profilzuweisungs-Modell ·
B4 Ampel-Read-Model · B10 Rollen-/Permission-Auflösung · F1/F2 Plattform-Voraussetzungen.

**Important Decisions (Shape Architecture):** B5 Propagations-Modell ·
B6 Offline-Queue & Konflikt-Erkennung · B7 Web-Push · B8 Vorlagen ·
B9 Telemetrie · B11 Export · B12 Dashboard-View-State · B13 Event-Katalog.

**Deferred Decisions (Post-MVP):** Vorlagen-Versionierungs-UI (FR7),
Landesunfallkassen-Export-Formate (FR37), PSA-Empfehlung aus Gefahren-Modul
(FR8/FR15), weitergehende Spezialschutz-/Sonderlagen-Workflows, Push-Notification pro Einheit
statt Abschnitt (FR21).

### A. Decisions Bound by Platform / PRD / UX (Bestätigungs-Block)

| Bereich             | Entscheidung                                                                     | Quelle                       |
| ------------------- | -------------------------------------------------------------------------------- | ---------------------------- |
| ORM                 | Prisma 7.7 + `@prisma/adapter-pg`                                                | Plattform                    |
| Backend-Struktur    | Hexagonal (`domain`/`application`/`infrastructure`/`modules`)                    | `architecture-principles.md` |
| Aggregate-Pattern   | `AggregateRoot<TId>` + Factory + `Result<T>` + `DomainEvent`                     | §2                           |
| Command/Query       | `TransactionalCommandHandler` + CQRS                                             | §3.2                         |
| Event-Persistenz    | Transactional Outbox                                                             | §4.3                         |
| Event-Transport     | Einsatz-scoped WebSocket (Socket.IO)                                             | ADR-006                      |
| Backend-Routen      | `/api/einsaetze/:einsatzId/sicherheit/eigenschutz/...`                           | Q5                           |
| Frontend-Routen     | `/app/einsatz/$einsatzId/sicherheit/eigenschutz/...`                             | Plattform                    |
| Offline-Layer       | Platform Storage Adapter                                                         | ADR-010                      |
| Auth-Global         | `UserRole` + `JwtAuthGuard`                                                      | Plattform                    |
| Auth-Kontextuell    | `EigenschutzRolle` via `EinsatzRollenbesetzung` + Permissions                    | Q4                           |
| Abschnitts-Modell   | Abschnitt ≡ `EinsatzEinheit` (FK `einheitId`)                                    | Q5                           |
| Gefahren-Kopplung   | optionale FK `gefahrenzoneId` (MVP)                                              | Q6                           |
| Risikomatrix        | 5×5 qualitativ, 4 Ergebnisklassen                                                | Q1                           |
| PSA-Modell          | Additive Profile (TRBA 250 + DGUV 105-003)                                       | Q2                           |
| Seed-Szenarien      | MANV · VU · Großveranstaltung · Betreuung · CBRN-Patient                         | Q3                           |
| Frontend-Struktur   | Feature-Slice `features/eigenschutz/`                                            | Plattform                    |
| Forms               | `@tanstack/react-form` + Zod                                                     | Plattform                    |
| Server-State        | `@tanstack/react-query`                                                          | Plattform                    |
| Client-State        | `@tanstack/react-store`                                                          | Plattform                    |
| Routing             | `@tanstack/react-router`                                                         | Plattform                    |
| API-Client          | Generiert via `pnpm run generate-api`                                            | Plattform                    |
| Response-Decorators | `@ApiWrappedResponse` / `@ApiWrappedCreatedResponse`                             | AC7                          |
| DI-Imports          | `import` für Injectable Classes (nie `import type`)                              | AC1                          |
| Lagekarte           | MapGL (`maplibre-gl` + `react-map-gl`)                                           | ADR-010, UX-Spec             |
| Konflikt-Semantik   | LWW für unkritische Felder; explizite Konfliktmarker für PSA + Gefährdungs-Items | FR50                         |

### B. Eigenschutz-spezifische Entscheidungen

#### B1. Versionierungs-Strategie für mutable sicherheitsrelevante Entitäten — **State + Version-Chain + Outbox**

**Gegenstand:** `Gefaehrdungsbeurteilung`, `Sicherheitsregel`, `Sicherungsposten`, `PsaProfilZuweisung`. Erfüllt FR41–FR43 (append-only Historie), FR33 (zeitpunktgenauer Kontext), NFR-P4 (≤ 1 s Ampel).

**Pattern (pro mutable Entity):**

- **Haupttabelle** hält aktuellen State + `version: int` (Optimistic-Concurrency-Token) + `updatedAt` + `updatedByUserId`.
- **`*_version`-Tabelle** hält Append-only-Historie: `(entityId, version, payload JSONB, changedFields JSONB, gueltigVon, gueltigBis NULL=aktuell, changedByUserId, begruendung TEXT?)`.
- **Domain-Event** in Outbox (`*Aktualisiert`) mit `{entityId, fromVersion, toVersion, diff}`.
- Temporal-Query für Vorfall-Snapshot: `SELECT * FROM *_version WHERE entityId = ? AND gueltigVon <= vorfallZeit AND (gueltigBis > vorfallZeit OR gueltigBis IS NULL)`.

**Rationale:** Harmoniert mit Plattform (Aggregate + Outbox, nicht reines Event-Sourcing). Schneller Read auf aktuellen Stand. Version-Tabelle ist Audit-Quelle; Outbox treibt Propagation und Read-Models.

#### B2. Zeitpunkt-Snapshot für Vorfall — **Hybrid (FK + materialisiertes JSONB)**

**Gegenstand:** FR33, Innovations-Anker.

**Schema:**

```
eigenschutz_vorfall:
  id, einsatzId, einheitId,
  vorfallZeit TIMESTAMPTZ,
  was TEXT, wann TIMESTAMPTZ, wo TEXT,
  beteiligte JSONB, massnahmen TEXT,
  unfallkasseRelevant BOOL,
  kontextSnapshot JSONB,                    -- materialisiert für Export-Performance
  gefBeurteilungVersionId TEXT?,            -- FK zu gefaehrdungsbeurteilung_version.id
  sicherheitsregelVersionIds TEXT[],        -- Array FK
  psaProfilZuweisungIds TEXT[],             -- Array FK zu Snapshot-Zeilen
  erfasstVonUserId, erfasstAm
```

**Rationale:** FK erhält Traceability (Klickpfad „zeige Version im Kontext"), JSONB macht PDF-Export self-contained (NFR-P5 ≤ 5 s ohne Join-Navigation). Minimal redundant, aber Unveränderlichkeit ist juristisch zwingend — Redundanz schadet hier nicht.

**Invariante:** `kontextSnapshot` wird im selben `TransactionalCommandHandler` wie das `VorfallGemeldet`-Event gefüllt und niemals aktualisiert.

#### B3. PSA-Profilzuweisung — **Temporale Join-Tabelle**

**Schema:**

```
psa_profil_zuweisung:
  id, einsatzId, einheitId,
  profil PsaProfilEnum,                     -- BASIS | INFEKTION | VU | CBRN_PATIENT | VOLLSCHUTZ
  gueltigVon TIMESTAMPTZ,
  gueltigBis TIMESTAMPTZ?,                  -- NULL = aktiv
  aktiviertVonUserId,
  begruendung TEXT,                         -- Pflicht (FR12)
  propagationGroupId TEXT,                  -- CUID2, gruppiert Multi-Select-Operationen
  version INT,                              -- Optimistic-Concurrency
  INDEX (einsatzId, einheitId, gueltigBis) WHERE gueltigBis IS NULL
```

**Toggle-Semantik:**

- Profil aktivieren: `INSERT` neuer Zeile mit `gueltigBis = NULL`.
- Profil deaktivieren: `UPDATE` der aktiven Zeile auf `gueltigBis = now()`.
- Multi-Select: mehrere Toggle-Operationen in einer Transaktion, gemeinsame `propagationGroupId`.

**Rationale:** Natürlich additives Modell (Q2); „Stand zum Zeitpunkt T" als Range-Query; Propagations-Gruppe für gemeinsame Bekanntgabe.

#### B4. Ampel-Dashboard Read-Model — **Materialisierte Projektion**

**Schema:**

```
ampel_projection:
  einsatzId, einheitId, PRIMARY KEY (einsatzId, einheitId),
  status AmpelStatus,                                 -- GRUEN | GELB | ROT
  aktivePsaProfile PsaProfilEnum[],
  offeneGefaehrdungenHoch INT,                        -- warnstufe-hoch ohne Schutzmassnahme
  ausstehendePsaQuittungen INT,
  ausstehendeRegelQuittungen INT,
  offeneVorfaelle INT,
  ungelestRueckmeldungen INT,                         -- "Lücke gemeldet"-Pipeline
  letzteAenderungAm TIMESTAMPTZ,
  letzteAenderungVonUserId
```

**Aktualisierung:** Event-Handler auf `GefaehrdungsbeurteilungAktualisiert`, `PsaProfilGeaendert`, `QuittungAbgegeben`, `QuittungUeberfaelligEvent`, `VorfallGemeldet`, `SicherheitsregelAusgerufen`, `SicherheitsregelQuittiert`, `LueckeGemeldet`. Re-Kalkulation der betroffenen Projection-Zeile im Event-Handler (idempotent via `eventId`-Dedup).

**Rationale:** NFR-P4 ≤ 1 s auch bei 500 GB-Items + 200 Vorfällen. Event-getriebene Updates kosten kaum extra, weil Events ohnehin emittiert werden. Rebuilds bei Schema-Änderung via Replay aus Version-Tabellen.

#### B5. Propagations-Modell für PSA-Hochstufung (Signatur-Interaktion)

**Server-Flow:**

1. `ChangePsaProfilCommand { einsatzId, einheitIds[], profilToggles[], begruendung }` → `TransactionalCommandHandler`.
2. Für jede Einheit: Zuweisungs-Änderungen in Tabelle `psa_profil_zuweisung` + `PsaProfilGeaendert`-Event in Outbox, alle mit gleicher `propagationGroupId`.
3. Outbox-Publisher sendet Events asynchron; WS-Gateway broadcastet an Room `einsatz:{einsatzId}`.
4. Push-Event-Handler (B7) sendet parallel Notification an nicht-WS-verbundene Subscribers.

**Client-Flow:**

- Optimistic-Cache-Update (TanStack Query `setQueryData`) direkt nach Submit.
- Rollback + Toast bei HTTP-Fehler; Dedup per `eventId` bei Nachrichten-Double-Delivery.

**Quittungs-Flow:**

- Separater `AckQuittungCommand { propagationGroupId, einheitId }` (Bearer = `EinsatzRollenbesetzung` des Users).
- `QuittungAbgegeben`-Event; Read-Model aktualisiert `ausstehendePsaQuittungen`.

**Re-Prompt-Scheduler:**

- `@nestjs/schedule`-Job alle 30 s sucht Events mit `occurredAt + 5min < now` ohne Quittung → emittiert `QuittungUeberfaelligEvent` + parallele Eskalations-Notification an Einsatzleiter.

#### B6. Offline-Queue und Konflikt-Erkennung

**Offline-Writes:**

- Alle mutierenden Hooks (`useCreateGefaehrdungsbeurteilung`, `useToggleProfil`, …) durchlaufen den Platform-Storage-Adapter (ADR-010): Request wird lokal serialisiert als „pending command", UI erhält optimistisches Ergebnis, Replay bei Wiederverbindung.
- Keine Eigenschutz-spezifische Queue-Implementierung.

**Optimistic Concurrency:**

- Jede mutable Entity führt `version: int`; Client sendet `expectedVersion` im Command.
- Server-seitig: Mismatch → `Result.fail('ConflictDetected', { currentVersion, attemptedVersion })` → Controller mapt auf HTTP 409 + strukturierten Body.

**Konflikt-Persistenz (neu in Eigenschutz):**

```
sync_conflict:
  id, einsatzId, einheitId,
  entityType TEXT,                        -- 'GEFAEHRDUNGSBEURTEILUNG_ITEM' | 'PSA_PROFIL_ZUWEISUNG'
  entityId, fieldPath TEXT,
  localPayload JSONB, serverVersion INT, localExpectedVersion INT,
  reportedAt TIMESTAMPTZ, reportedByUserId,
  resolvedAt TIMESTAMPTZ?, resolvedByUserId?,
  resolution TEXT?                        -- 'server_wins' | 'local_wins' | 'merged'
```

**Auto-Merge:** LWW (`updatedAt`) für Textfelder (Schutzmaßnahme, Ablösezeit), Boolean-Flags, Numeric-Fields ohne Business-Invariante.

**Konflikt-Auflösungs-UI:** `ConflictResolutionList` (UX-Spec-Organism) liest `GET /sync-conflicts?einsatzId=...`; Auflösung erzeugt `KonfliktAufgeloestEvent`.

#### B7. Web-Push + Tauri-Notifications (explizit MVP)

**Plattform-Voraussetzung (F1 resolved — neu anzulegen):**

Push-Notification-Infrastruktur wird **nicht** als Eigenschutz-Feature gebaut, sondern als plattformweites Feature in `infrastructure/push-notifications/`:

```
packages/backend/src/
  infrastructure/push-notifications/
    push-subscription.entity.ts           -- Prisma Model
    push-notifications.service.ts         -- VAPID-Signing + web-push-Integration
    push-notifications.module.ts
  modules/push-notifications/
    push-subscription.controller.ts       -- POST /api/users/me/push-subscriptions etc.
    push-subscription.dto.ts
```

**Dependencies:**

- Backend: `web-push@^3` (neu).
- VAPID-Keypair: erzeugt einmalig, Public-Key im Frontend-`import.meta.env`, Private-Key via `@dotenvx/dotenvx`.

**Frontend (plattformweit):**

- `public/sw.js` (Service-Worker) — ruft `self.registration.showNotification(...)` bei `push`-Event.
- `shared/ui/push-subscription-manager` — Subscription registrieren/ausstehen bei Login/Permission-Grant.
- Tauri-Clients: `@tauri-apps/plugin-notification` — Hook `useCriticalNotification` dispatcht plattform-abhängig (Tauri-Native vs. Web-Push).

**Eigenschutz-Integration:**

- Eigenschutz emittiert nur Events in Outbox (`PsaProfilGeaendert`, `VorfallGemeldet`, `SicherheitsregelAusgerufen`).
- Push-Notifications-Service abonniert diese Events; mappt auf Notification-Payload; sendet an passende Subscriber.

**Dedup-Strategie (Revision nach Architektur-Review):**

- **Server dedupt NICHT.** Der Backend-Push-Service sendet parallel zu
  WS-Broadcast — kein WS-Connection-Tracking im Server nötig, kein
  Shared-State-Problem in Multi-Instance-Deployments.
- **Client dedupt.** Der bestehende `eventId`-LRU-Cache (NFR-R3, §B5)
  unterdrückt doppelte Anzeige, wenn WS-Nachricht und Push-Payload die
  gleiche `eventId` tragen. Dies setzt voraus, dass Push-Payload die
  `eventId` führt — das ist Pflicht im Push-Service-Contract.

**Dokumentations-Artefakt:** separate ADR für Plattform-Push-Notifications (ADR-011 Kandidat).

#### B8. Vorlagen (Seeds)

**Schema (MVP):**

```
gefaehrdungsbeurteilung_vorlage:
  id, slug (UNIQUE), name, szenario TEXT,
  items JSONB,                            -- Array aus {title, description, defaultEintritt, defaultSchaden, schutzmassnahmen[]}
  version INT, aktiv BOOL,
  erstelltAm, erstelltVonUserId
```

**Seed-Quelle:** `packages/backend/prisma/seed.ts` erweitern um 5 Szenarien aus Q3. Idempotent via `upsert` auf `slug`.

**Import-Semantik:** Beim Anlegen einer Gefährdungsbeurteilung aus einer Vorlage werden die `items` deep-copiert (kein Live-Link). Änderungen an der Vorlage betreffen laufende Einsätze nicht (PRD-Risk „Vorlagen-Drift" Mitigation).

**Phase-2-Pfad:** zusätzliche `gefaehrdungsbeurteilung_vorlage_version`-Tabelle + Admin-UI; Pattern passt bereits.

#### B9. Client-Telemetrie für CBRN-Moment — **Backend-Endpoint + Prometheus**

**Schema:**

```
eigenschutz_telemetry_event:
  id, einsatzId, userId, sessionId,
  eventName TEXT,                         -- 'assess_started' | 'all_banners_delivered' | 'quittung_abgegeben' | 'blind_ack'
  payload JSONB,                          -- {propagationGroupId, abschnittCount, elapsedMs, ...}
  clientTime TIMESTAMPTZ, serverTime TIMESTAMPTZ,
  erzeugtAm
```

**Endpoint:** `POST /api/einsaetze/:einsatzId/sicherheit/eigenschutz/telemetry` — batched Array, `nachbereitung`/`admin`/`sicherheitsbeauftragter` dürfen senden (alle im Einsatz-Team, da nur eigener User-Scope).

**Prometheus-Metriken** (via `@willsoto/nestjs-prometheus`, im Event-Konsum abgeleitet):

- `eigenschutz_psa_propagation_duration_seconds` (Histogram, labels: `abschnittCount`).
- `eigenschutz_quittung_latency_seconds` (Histogram).
- `eigenschutz_blind_ack_total` (Counter, label: `einheitId`).

**DSGVO:** Payload enthält keine unnötigen Personenbezüge; `userId` ist einsatz-scoped und konsistent mit Audit-Trail. Retention folgt Einsatz-Lifetime (Plattform-Löschkonzept).

**Post-Pilot-Auswertung:** Grafana-Dashboard + Ad-hoc SQL auf `eigenschutz_telemetry_event`.

#### B10. Rollen-/Permission-Auflösung

**Plattform-Voraussetzung (F2 resolved — neu anzulegen):**

`EinsatzScopeGuard` ist **nicht vorhanden**. Er wird als plattform-neutraler Guard in `modules/auth/guards/einsatz-scope.guard.ts` neu angelegt:

```
Verantwortung:
  1. einsatzId aus Request-Path extrahieren (Param-Name konfigurierbar via @EinsatzParam).
  2. User ↔ Einsatz validieren über EinsatzRollenbesetzung (aktiv, nicht abgelaufen).
  3. Request um { einsatzRollenNamen: string[], einsatzPermissions: string[] } ergänzen.
  4. Bei fehlendem Zugriff: ForbiddenException.
```

**Dokumentations-Artefakt:** separate ADR (ADR-012 Kandidat).

**Guard-Kette Eigenschutz-Endpoints:**

```
@UseGuards(JwtAuthGuard, EinsatzScopeGuard, EigenschutzRolleGuard | PermissionsGuard)
```

**Rollen-Modell — Nutzung von `RollenDefinition` (Korrektur nach Advisor-Review):**

Die Plattform hat bereits eine `RollenDefinition`-Entity (mit `name`,
`funkrufname`, `beschreibung`, `istAktiv`) und `EinsatzRollenbesetzung`
als Verknüpfungsentität mit Snapshot-Feldern (`rollenName`).
**Eigenschutz führt keinen Enum und kein neues Spalten-Feld ein.**
Stattdessen:

- **Seed-Records:** In `prisma/seed.ts` werden 4 `RollenDefinition`-Records
  idempotent angelegt:
  - `Eigenschutz: Sicherheitsbeauftragter`
  - `Eigenschutz: Abschnittsleiter`
  - `Eigenschutz: Einheitsführer`
  - `Eigenschutz: Nachbereitung`
- **Konvention:** Eigenschutz-Rollen tragen den Präfix `Eigenschutz: `
  im `RollenDefinition.name`.
- **Guard-Check:** `EigenschutzRolleGuard` prüft
  `EinsatzRollenbesetzung.rollenName` mit Präfix-Pattern `^Eigenschutz: `
  - exakten Match des benötigten Rollen-Namens aus dem Decorator.
- **Domain-TS-Enum bleibt** (als `EigenschutzRolle`-Union-Type in
  `domain/eigenschutz/enums/eigenschutz-rolle.enum.ts`), aber nur für
  Typsicherheit in Decorators — nicht Prisma-persistiert.
- **Admin-Rolle:** mappt weiterhin auf globale `UserRole.ADMIN`, nicht
  auf eine `RollenDefinition`.

**Konsequenzen:**

- Kein Schema-Change an `EinsatzRollenbesetzung`.
- Kein Enum `EigenschutzRolle` in Prisma.
- Saubere Einordnung in bestehendes Rollen-System.

**Permission-Inventar (MVP):**

- `eigenschutz:gefaehrdungsbeurteilung:{read,write}`
- `eigenschutz:psa:{read,write}`
- `eigenschutz:sicherheitsregel:{read,write,acknowledge}`
- `eigenschutz:sicherungsposten:{read,write}`
- `eigenschutz:vorfall:{read,report,export}`
- `eigenschutz:telemetry:write` (implizit für alle Einsatz-Rollen)

Permissions bleiben im bestehenden `User.permissions`-JSON (Plattform-Feature).

**FR44–FR47-Mapping:**

- FR45 (Schreibzugriff auf Gefährdungs-/PSA): Rolle
  `Eigenschutz: Sicherheitsbeauftragter` oder globale `UserRole.ADMIN`
  AND Permission `eigenschutz:gefaehrdungsbeurteilung:write` +
  `eigenschutz:psa:write`.
- FR46 (Quittung): Rolle `Eigenschutz: Abschnittsleiter` oder
  `Eigenschutz: Einheitsführer` mit `eigenschutz:sicherheitsregel:acknowledge`.
- FR47 (Export): Rolle `Eigenschutz: Nachbereitung` oder globale
  `UserRole.ADMIN` mit `eigenschutz:vorfall:export`.

#### B11. Export-Infrastruktur für Unfallkasse

- **PDF:** bestehender `pdf-export.service.ts` wiederverwenden. Neuer Renderer `EigenschutzVorfallPdfRenderer` in `infrastructure/eigenschutz/export/` konstruiert PDF aus `kontextSnapshot` (selbst-enthaltend, siehe B2).
- **JSON:** Zod-Schema `EigenschutzVorfallExportV1` in `packages/shared/schemas/` + Re-Export ins Frontend-Typing. MVP-Obermenge nach Q7.
- **Route:** `GET /api/einsaetze/:einsatzId/sicherheit/eigenschutz/vorfaelle/:id/export?format=pdf|json` — Permission `eigenschutz:vorfall:export`.
- **Audit:** Export erzeugt `VorfallExportiert`-Event mit `{exportedByUserId, format, downloadedAt}` → Outbox → Audit-Timeline.

#### B12. Dashboard-View-State

- **Speicher:** `@tanstack/react-store` Slice `eigenschutz.dashboardView: 'cards' | 'focus'`.
- **Persistenz:** Platform-Storage-Adapter (ADR-010); Desktop über `@tauri-apps/plugin-store`, Browser über `localStorage`.
- **Scope:** User-global, nicht einsatz-spezifisch.
- **Default:** `'cards'`.
- **Breakpoint-Gating:** `'focus'` nur ab `lg` (1024 px+); unterhalb erzwingt UI `'cards'` mit Tooltip-Hinweis.

#### B13. Event-Katalog (MVP)

Zu registrieren an 4 Stellen (`event-serializer.ts`, `event-deserializer.ts`, `event-adapters.module.ts`, `event-adapters/index.ts`):

| Event                                 | Aggregat                              | Auslöser                             |
| ------------------------------------- | ------------------------------------- | ------------------------------------ |
| `GefaehrdungsbeurteilungErstellt`     | Gefaehrdungsbeurteilung               | neue Beurteilung (auch aus Vorlage)  |
| `GefaehrdungsbeurteilungAktualisiert` | Gefaehrdungsbeurteilung               | Item add/change/remove, neue Version |
| `PsaProfilGeaendert`                  | PsaProfilZuweisung                    | Toggle eines Profils (kritisch)      |
| `SicherheitsregelAusgerufen`          | Sicherheitsregel                      | neue/aktualisierte Regel             |
| `SicherheitsregelQuittiert`           | Sicherheitsregel                      | Abschnittsleiter quittiert           |
| `SicherungspostenEingerichtet`        | Sicherungsposten                      | CRUD                                 |
| `SicherungspostenAktualisiert`        | Sicherungsposten                      | CRUD                                 |
| `VorfallGemeldet`                     | EigenschutzVorfall                    | neue Meldung mit Snapshot            |
| `VorfallExportiert`                   | EigenschutzVorfall                    | Unfallkassen-Export                  |
| `QuittungAbgegeben`                   | PsaProfilZuweisung / Sicherheitsregel | Abschnittsleiter bestätigt           |
| `LueckeGemeldet`                      | PsaProfilZuweisung                    | Rück-Eskalation fehlende Ausrüstung  |
| `QuittungUeberfaelligEvent`           | PsaProfilZuweisung / Sicherheitsregel | Scheduler, > 5 min offen             |
| `KonfliktErkannt`                     | (entity-agnostisch)                   | Sync-Konflikt auf kritischem Feld    |
| `KonfliktAufgeloest`                  | (entity-agnostisch)                   | manuelle Auflösung                   |

### C. Plattform-Voraussetzungen (Spillover — eigene Stories)

Zwei Entscheidungen sind streng genommen nicht Eigenschutz-Scope, aber
Voraussetzung für den Eigenschutz-MVP. Sie werden als separate Stories
behandelt (parallel oder vorgelagert):

1. **Plattform-Push-Notifications** (Backend-Service `web-push` +
   Subscription-Endpoints + Service-Worker + Tauri-Bridge). Kandidat für
   ADR-011.
2. **`EinsatzScopeGuard`** als plattform-neutraler Guard. Kandidat für
   ADR-012.

Sobald beide verfügbar sind, kann Eigenschutz ohne Workaround arbeiten.
Temporäre Interimslösung bei Verzögerung: Inline-Check in
Eigenschutz-Controllern via `EinsatzRollenbesetzung`-Service-Injection.

### D. Decision Impact & Cross-Component Dependencies

**Implementation Sequence (Vorschlag, keine Zeitschätzung):**

1. Plattform-Voraussetzungen (F1/F2) — parallel zu 2.
2. Prisma-Schema + Migration (`add_eigenschutz_module`).
3. Domain-Modell: Aggregates, Value Objects (`Risikobewertung`, `PsaProfil`,
   `Quittungsstatus`), Events, Repository-Ports.
4. Application-Layer: Commands (incl. `ChangePsaProfilCommand`, `ReportVorfallCommand`,
   `ExportVorfallCommand`), Queries, Event-Handler für Ampel-Projection,
   DTOs, Response-Factories.
5. Infrastructure-Layer: Prisma-Repositories + Mapper, Outbox-Event-Adapter,
   Konflikt-Persistenz-Service, Export-Renderer, Telemetrie-Service,
   Ampel-Projection-Updater.
6. Modules-Layer: Controller mit `@ApiWrappedResponse*` und Guard-Kette.
7. `pnpm run generate-api` → Shared-Client.
8. Frontend Feature-Slice: TanStack-Query-Hooks, Stores, Forms, UI-Komponenten,
   Service-Worker-Integration (Web-Push-Consume).
9. E2E-Tests für CBRN-Signatur-Interaktion (Journey 1b) und Vorfall-Export
   (Journey 4) — kritische Pfade.
10. Seed-Migration für 5 Vorlagen (Q3).

**Cross-Component Dependencies:**

- **B1 ↔ B2:** Version-Chain liefert FK-Ziele für Snapshots.
- **B1 ↔ B6:** `version`-Feld treibt Optimistic-Concurrency und Konflikt-Erkennung.
- **B4 ↔ B13:** Ampel-Projection reagiert auf nahezu alle Status-Events.
- **B5 ↔ B7:** Propagation-Events werden parallel von WS und Push-Service konsumiert.
- **B5 ↔ B9:** Telemetrie-Events rahmen Propagations-Sequenz (`assess_started` / `all_banners_delivered`).
- **B6 ↔ B13:** Konflikt-Events aktualisieren keine Ampel-Projection, aber triggern Banner.
- **B7 ↔ F1:** Eigenschutz konsumiert Plattform-Push; keine eigene Infrastruktur.
- **B10 ↔ F2:** Guard-Kette nutzt `EinsatzScopeGuard` als Plattform-Baustein.
- **B11 ↔ B2:** Export arbeitet ausschließlich auf `kontextSnapshot` (keine Live-Joins).
- **B12 ↔ Plattform:** Persistenz via Storage-Adapter, kein Eigenbau.

### E. Deferred / Explicitly Not MVP

- **FR7 Vorlagen-Versionierung mit Admin-UI** — Schema-Vorbereitung im MVP,
  UI Phase 2.
- **FR8/FR15 Gefahren-Modul Auto-Übernahme** — MVP bleibt reine FK-Referenz.
- **FR21 Einheits-Level-Quittung** — MVP arbeitet auf Abschnitts-Level
  (`einheitId` als Führungs-Einheit).
- **FR37 Landesunfallkassen-Format** — MVP generisch, Format-Adapter Phase 2.
- **Weitergehende Spezialschutz-/Sonderlagen-Workflows** — Post-MVP,
  Architektur reserviert kein dediziertes Schema.
- **Barcode-Scan-Integration** — Plugin vorhanden, aber außerhalb MVP-Scope.
- **Worker-Threads für Risiko-Berechnung** — 5×5-Matrix trivial, nicht
  nötig.

## Implementation Patterns & Consistency Rules

### Geltungsbereich

Plattform-Konventionen sind bindend und werden in diesem Abschnitt
**nicht wiederholt, nur referenziert**. Gelistet werden nur
Eigenschutz-spezifische Patterns, bei denen AI-Agents plausibel
unterschiedlich entscheiden könnten, oder bei denen die bestehende
Konvention nicht offensichtlich greift.

**Plattform-Referenz-Dokumente (verbindlich, Quelle der Wahrheit):**

- `CLAUDE.md` — Root-Konventionen, API-Workflow, Tech-Stack-Regeln
- `docs/architecture-principles.md` — Layering, Aggregates, Result,
  Outbox, DI, Events
- `docs/adr/adr-006-websocket-event-bus-einsatz-scoped.md` — Event-Bus
- `docs/adr/adr-008-polymorphe-zuordnung-nullable-fks.md` — FK-Semantik
- `docs/adr/adr-010-gefahrenzone-matrixzelle-referenz.md` —
  Geo-Referenzierung

### A. Naming Patterns (Eigenschutz-spezifisch)

**Prisma Models / Enums:**

- **PascalCase Deutsch.** Entities: `Gefaehrdungsbeurteilung`,
  `GefaehrdungsbeurteilungVersion`, `GefaehrdungsbeurteilungVorlage`,
  `PsaProfilZuweisung`, `Sicherheitsregel`, `SicherheitsregelVersion`,
  `Sicherungsposten`, `SicherungspostenVersion`, `EigenschutzVorfall`,
  `EigenschutzTelemetryEvent`, `AmpelProjection`, `SyncConflict`.
- **Enum-Namen PascalCase, Werte SCREAMING_CASE:** `PsaProfil` →
  `BASIS | INFEKTION | VU | CBRN_PATIENT | VOLLSCHUTZ`; `Ampelstatus` →
  `GRUEN | GELB | ROT`; `Eintrittswahrscheinlichkeit` →
  `SELTEN | GELEGENTLICH | HAEUFIG | OFT | STAENDIG`; `Schadensausmass` →
  `VERNACHLAESSIGBAR | GERING | MITTEL | HOCH | KATASTROPHAL`;
  `Risikoklasse` → `GRUEN | GELB | ORANGE | ROT`;
  `KonfliktResolution` → `SERVER_WINS | LOCAL_WINS | MERGED`.
- **`EigenschutzRolle`-TS-Union-Type** (NICHT Prisma-Enum): nur im
  Domain-Code (`domain/eigenschutz/enums/eigenschutz-rolle.enum.ts`) für
  Decorator-Typsicherheit. Persistenz läuft über `RollenDefinition`-Seeds
  (siehe §B10 Revidiert).
- **Feld-Namen: camelCase Deutsch.** Beispiele: `einsatzId`, `einheitId`,
  `gueltigVon`, `gueltigBis`, `erfasstAm`, `begruendung`,
  `propagationGroupId`, `unfallkasseRelevant`, `kontextSnapshot`.
- **FK-Felder:** `{entityName}Id` (z. B. `gefahrenzoneId`,
  `gefBeurteilungVersionId`). Nullable wenn optional.

**Domain-Code (TypeScript, Backend):**

- **Dateinamen:** kebab-case mit Suffix:
  `gefaehrdungsbeurteilung.aggregate.ts`,
  `psa-profil-zuweisung.repository.ts`,
  `change-psa-profil.command.ts`, `change-psa-profil.handler.ts`,
  `psa-profil-geaendert.event.ts`,
  `gefaehrdungsbeurteilung-erstellt.handler.ts` (Event-Handler).
- **Verzeichnisnamen:** kebab-case (`eigenschutz/`, `psa-profile/`,
  `gefaehrdungsbeurteilung/`).
- **Aggregate-Klassennamen: PascalCase Deutsch.** `Gefaehrdungsbeurteilung`,
  `PsaProfilZuweisung`, `EigenschutzVorfall`.
- **Value Objects: PascalCase Deutsch.** `Risikobewertung`,
  `PsaProfilSet`, `AusruestungsCheckliste`, `Quittungsstatus`,
  `KontextSnapshot`.
- **Domain Events: Past-Tense Deutsch.** `GefaehrdungsbeurteilungErstellt`,
  `PsaProfilGeaendert`, `VorfallGemeldet`, `KonfliktErkannt`.
- **Commands: Imperativ Englisch-Präfix + Deutsch.** `CreateGefaehrdungsbeurteilungCommand`,
  `ChangePsaProfilCommand`, `ReportVorfallCommand`, `ExportVorfallCommand`,
  `AckQuittungCommand`, `ResolveKonfliktCommand` (konsistent mit
  bestehender Praxis wie `CreateEinsatzCommand`).
- **Queries:** `GetEigenschutzAmpelStatusQuery`,
  `GetVorfallSnapshotQuery`, `ListSyncConflictsQuery`.

**Frontend (React/TypeScript):**

- **Feature-Ordner:** `features/eigenschutz/` (kebab-case, einsprachig).
- **Komponenten-Dateien: PascalCase.tsx.** `AmpelDashboard.tsx`,
  `RiskMatrix5x5.tsx`, `PsaProfileMultiSelect.tsx`,
  `IncidentContextSnapshot.tsx`, `ConflictResolutionList.tsx`,
  `SeverityBanner.tsx`.
- **Hook-Dateien: camelCase.ts.** `useEigenschutzAmpelStatus.ts`,
  `useChangePsaProfil.ts`, `useReportVorfall.ts`, `useSyncConflicts.ts`.
- **Zod-Schemas: kebab-case.ts.** `gefaehrdungsbeurteilung.schema.ts`,
  `change-psa-profil.schema.ts`, `vorfall-export.schema.ts`.
- **Stores:** `eigenschutz-dashboard-view.store.ts`.

**API-Endpoints (Backend-Routen):**

- Alles unterhalb `/api/einsaetze/:einsatzId/sicherheit/eigenschutz/...`
  (Plural `einsaetze`, Q5).
- **REST-Pfade Plural, kebab-case:**
  - `/gefaehrdungsbeurteilungen` · `/gefaehrdungsbeurteilungen/:id`
  - `/psa-profile` · `/psa-profile/bulk-aendern`
  - `/sicherheitsregeln` · `/sicherheitsregeln/:id/quittieren`
  - `/sicherungsposten` · `/sicherungsposten/:id`
  - `/vorfaelle` · `/vorfaelle/:id/export`
  - `/ampel` · `/sync-conflicts` · `/sync-conflicts/:id/resolve`
  - `/telemetry`
- **Frontend-Routen (TanStack Router, Singular):**
  `/app/einsatz/$einsatzId/sicherheit/eigenschutz/{dashboard|gefaehrdungen|sicherungsposten|vorfaelle}`.

### B. Structure Patterns

**Backend Feature-Layout (konsistent mit `domain/einsatz/`, `application/einsatz/`, …):**

```
packages/backend/src/
  domain/eigenschutz/
    aggregates/            # *.aggregate.ts (AggregateRoot-Erben)
    value-objects/         # *.vo.ts
    events/                # *.event.ts (DomainEvent-Erben)
    repositories/          # i-*.repository.ts (Interface-Ports)
    enums/                 # psa-profil.enum.ts, ampel-status.enum.ts
    errors/                # eigenschutz-error.codes.ts
  application/eigenschutz/
    commands/              # pro Use-Case: *.command.ts + *.handler.ts
    queries/               # *.handler.ts
    event-handlers/        # *.handler.ts für Event-Reaktion
    dto/                   # *.dto.ts + *-response.factory.ts
    errors/
  infrastructure/eigenschutz/
    repositories/          # prisma-*.repository.ts + *-mapper.ts
    projections/           # ampel-projection.updater.ts
    export/                # eigenschutz-vorfall-pdf.renderer.ts
    telemetry/             # telemetry-ingest.service.ts
    conflict/              # sync-conflict.service.ts
    event-adapters/        # pro Event ein Adapter (@OnEvent)
    eigenschutz.module.ts
  modules/eigenschutz/
    controllers/           # *.controller.ts mit @ApiWrappedResponse*
    guards/                # eigenschutz-rolle.guard.ts
    eigenschutz.module.ts
```

**Frontend Feature-Layout (konsistent mit `features/einsatz/`):**

```
packages/frontend/src/features/eigenschutz/
  api/                     # queries.ts, mutations.ts (TanStack Query)
  hooks/                   # useXxx.ts
  schemas/                 # Zod-Schemas
  stores/                  # TanStack Store Slices
  utils/                   # reine Helper
  ui/
    atoms/                 # z. B. StatusIndicator.tsx
    molecules/             # z. B. AcknowledgmentStatusBadge.tsx
    organisms/             # z. B. AmpelDashboard.tsx, SeverityBanner.tsx
    pages/                 # Route-Komponenten
  constants/               # Enums, Feature-Flags, Shortcut-Tabellen
  index.ts                 # Public Re-Exports
```

**Test-Lokation:**

- Backend: co-located `__tests__/` je Feature-Unterordner (konsistent mit
  bestehender Praxis: `infrastructure/outbox/__tests__/`,
  `modules/auth/guards/__tests__/`).
- Frontend: co-located `__tests__/` pro UI-Unterebene.

### C. API-Response-Format

**Generisch:** Plattform-Wrapper `@ApiWrappedResponse` /
`@ApiWrappedCreatedResponse` — erzeugt `{ data: T }` bzw. `{ data: T }` mit
HTTP-201. **NIEMALS** `@ApiOkResponse({ type: ...})` (AC7).

**Fehler-Format:** Standard-NestJS `HttpException` mit strukturiertem Body:

```json
{
  "statusCode": 409,
  "error": "ConflictDetected",
  "message": "Entity wurde zwischenzeitlich geändert",
  "context": {
    "entityId": "...",
    "currentVersion": 12,
    "attemptedVersion": 11
  }
}
```

- **HTTP 400**: Client-Validierung fehlgeschlagen (Zod-Fehler).
- **HTTP 403**: Autorisierungs-Fehler (`EinsatzScopeGuard` /
  `EigenschutzRolleGuard` / `PermissionsGuard`).
- **HTTP 404**: Entität in diesem Einsatz nicht vorhanden.
- **HTTP 409**: Optimistic-Concurrency-Konflikt (`version`-Mismatch).
- **HTTP 422**: Business-Rule-Fehler (z. B. „Basis-Profil kann nicht
  deaktiviert werden, solange andere Profile aktiv sind, die es voraussetzen").

**Datumsformat:** ISO-8601 mit Zeitzone (`TIMESTAMPTZ` in Postgres,
`Date.toISOString()` im Transport).

**JSON-Feld-Konvention:** camelCase Deutsch (wie Prisma-Felder;
Passthrough).

### D. Event-Patterns

**Event-Payload-Schema:**

Jedes Domain-Event führt zwingend:

- `eventId: string` (CUID2, auto-gen in Basis-Klasse).
- `occurredAt: Date` (auto-gen).
- `aggregateId: string` (Eigenschutz-Aggregat).
- `einsatzId: string` (für WS-Scope-Filter).
- `einheitId?: string` (wo relevant).
- `userId: string` (Urheber).
- Event-spezifisches Payload-Objekt.

**Beispiel `PsaProfilGeaendert`:**

```typescript
class PsaProfilGeaendertEvent extends DomainEvent {
  constructor(
    public readonly einsatzId: string,
    public readonly einheitId: string,
    public readonly zuweisungId: string,
    public readonly propagationGroupId: string,
    public readonly profil: PsaProfil,
    public readonly aktion: 'AKTIVIERT' | 'DEAKTIVIERT',
    public readonly begruendung: string,
    public readonly userId: string,
    aggregateId?: string,
  ) {
    super(aggregateId ?? zuweisungId);
  }

  static eventName(): string {
    return 'PsaProfilGeaendert';
  }
}
```

**4-Stellen-Registrierung verpflichtend** (`architecture-principles.md` §4.3/§4.4):

1. `infrastructure/outbox/event-serializer.ts`
2. `infrastructure/outbox/event-deserializer.ts`
3. `infrastructure/events/event-adapters.module.ts`
4. `infrastructure/events/event-adapters/index.ts`

**Event-Adapter-Pattern:** Pro Event ein Adapter in
`infrastructure/eigenschutz/event-adapters/` mit `@OnEvent(EventName)` —
Adapter delegiert an Application-Layer-Handler via DI Token.

**WebSocket-Filter (ADR-006):** Outbox-Publisher broadcastet an Room
`einsatz:{einsatzId}`. Clients subscriben auf den Raum, filtern im Hook
nach `einheitId` wenn nötig.

**Deduplication:** Client hält ein kleines `eventId`-Set pro
WS-Subscription (LRU, ~200 Entries) — verworfen bei bereits gesehenem
`eventId`. Konsistent mit NFR-R3.

### E. Versioning + Optimistic Concurrency

**Version-Feld-Konvention:** jede mutable Eigenschutz-Entity führt
`version: Int @default(1)`. Steigt bei jedem `UPDATE`; der Bump erfolgt
im Aggregate-Mutator.

**Command-Signatur:**

- Jeder State-ändernde Command führt `expectedVersion: number`.
- TransactionalCommandHandler lädt Aggregate, ruft
  `aggregate.assertVersion(expectedVersion)` auf — Mismatch →
  `Result.fail('ConflictDetected', { currentVersion, attemptedVersion })`.

**Controller-Mapping:** `Result.fail('ConflictDetected', ctx)` wird als
HTTP 409 mit `context`-Payload gemapped. Client-Hook zeigt Konflikt-UI.

**Version-Tabellen-Naming:** `{haupttabelle}_version` (snake_case in DB
via Prisma `@@map`, Model in PascalCase: `GefaehrdungsbeurteilungVersion`).

### F. Snapshot-Patterns

**JSONB-Felder heißen `kontextSnapshot` (Vorfall) / `items` (Gefährdungsbeurteilung-Version-Payload).**

**Snapshot-Shape (stabil, Versionierung via Zod-Schema `v1`/`v2`):**

```typescript
// packages/shared/schemas/eigenschutz-snapshot.schema.ts
export const EigenschutzKontextSnapshotV1 = z
  .object({
    schemaVersion: z.literal(1),
    snapshotAt: z.string().datetime(),
    einsatzId: z.string(),
    einheitId: z.string(),
    // versionId-Felder unterhalb sind "reference hints", keine authoritativen FKs.
    // Der Snapshot ist selbst authoritativ (Revision nach Architektur-Review).
    gefaehrdungsbeurteilung: GefaehrdungsbeurteilungV1.nullable(), // inkl. embedded versionId
    aktivePsaProfile: z.array(PsaProfilZuweisungV1), // inkl. embedded id + gueltigVon
    sicherheitsregeln: z.array(SicherheitsregelV1), // inkl. embedded versionId
  })
  .strict();
```

**Snapshot-Unveränderlichkeit:** kein Endpoint darf `kontextSnapshot`
nachträglich patchen. Migrations-Pfad bei Schema-Evolution: neues
Schema-Version-Feld, alte Snapshots bleiben V1-readable.

**Authoritative-Quelle-Semantik (Revision nach Architektur-Review):**
Der `kontextSnapshot` ist die **authoritative Historie** für
Unfallkassen-Export. Die einzige echte FK ist `gefBeurteilungVersionId`
(zeigt auf `GefaehrdungsbeurteilungVersion.id` für Navigations-UI).
Sicherheitsregel-Versionen und PSA-Zuweisungs-Historie werden
ausschließlich im JSONB geführt — Prisma-Array-FK-Felder sind **bewusst
nicht** im Schema, weil sie keine referentielle Integrität bieten und bei
Ziel-Row-Löschung zu Dangling-References würden. Der JSONB-Inhalt
überdauert unabhängig von späteren Schema-Änderungen an Versions-Tabellen.

### G. Formulare & Validation

- **Shared Zod-Schemas** in `packages/shared/schemas/eigenschutz/` — Backend
  nutzt sie in DTOs, Frontend in Forms. Kein Backend-DTO ohne Zod-Pendant,
  kein Frontend-Form ohne geteiltes Schema.
- **Pflicht-/Optional-Unterscheidung im Schema, nicht im UI.** UI leitet
  `aria-required` aus dem Schema ab.
- **Begründungs-Felder:** `z.string().min(3).max(500)` — keine
  Null-Begründungen bei kritischen Aktionen (FR12).

### H. Autorisierung — Guard-Composition

**Reihenfolge (immer):**

```typescript
@UseGuards(JwtAuthGuard, EinsatzScopeGuard, EigenschutzRolleGuard | PermissionsGuard)
```

- `JwtAuthGuard`: Token-Gültigkeit (Plattform).
- `EinsatzScopeGuard`: `einsatzId`-Pfadparameter + User-Zugehörigkeit
  (Plattform, neu, ADR-012 Kandidat).
- `EigenschutzRolleGuard` ODER `PermissionsGuard`: Feingranular. Niemals
  beide gleichzeitig am selben Endpoint — Entscheidung explizit nach
  Granularität.

**Decorator-Muster:**

- `@RequiresEigenschutzRolle(SICHERHEITSBEAUFTRAGTER, ADMIN)` — grobes
  Gating.
- `@RequiresPermission('eigenschutz:psa:write')` — feingranular.
- `@PublicTelemetry()` (Marker-Decorator) für `POST /telemetry`, das jeder
  Einsatz-Teilnehmer senden darf.

### I. Communication + State-Update-Patterns (Frontend)

**Server-State (TanStack Query):**

- **Query-Keys: strukturiert, präfixiert.**
  ```typescript
  ['eigenschutz', einsatzId, 'ampel'][('eigenschutz', einsatzId, 'gefaehrdungsbeurteilungen')][('eigenschutz', einsatzId, 'gefaehrdungsbeurteilungen', id)][
    ('eigenschutz', einsatzId, 'psa-zuweisungen')
  ][('eigenschutz', einsatzId, 'sync-conflicts')];
  ```
- **Invalidierung:** bei Mutationen nur die passenden Subtrees
  invalidieren; bei WS-Events gezielt `setQueryData` oder
  `invalidateQueries` auf den betroffenen Keys.
- **Optimistic Updates:** `onMutate` setzt den neuen Wert im Cache,
  `onError` rollt zurück, `onSettled` invalidiert.

**Client-State (TanStack Store):**

- **Slice-Pro-Feature.** Eigenschutz-Slice hält nur UI-State (Dashboard-View,
  Filter-Toolbar-Zustand, lokale Drawer-Open-Flags).
- **Kein Server-State im Store** (würde TanStack Query duplizieren).
- **Persistenz** via Platform-Storage-Adapter für View-Toggle (B12).

### J. Loading / Error / Empty States

- **Loading:** Skeleton-Loader für Listen/Karten; Inline-Spinner mit Label
  für Submits (`„Wird propagiert…"`). Kein Blocker-Overlay auf Seiten-Ebene.
- **Error (Seite):** `EmptyState` mit Retry + Offline-Badge.
- **Error (Feld):** Inline unter `FormField` mit `aria-describedby`.
- **Error (Submit):** `SeverityBanner variant="warning" tone="polite"`
  über der Form; Form-Daten bleiben.
- **Empty:** dezent, 1-Satz-Kontext + primärer CTA. Kein Tutorial-Overlay.

### K. Logging & Observability

- **Backend:** Bestehenden `consola`-Wrapper/`LoggerService` nutzen.
  Log-Level: `error` für Sync-Fehler, `warn` für Konflikt-Erkennung,
  `info` für Export-Erzeugung.
- **Prometheus-Metriken** (B9) — konsistente Label-Keys: `einsatz_id`,
  `einheit_id`, `propagation_group_id`, `event_type`.
- **Korrelation:** Request-Id aus Plattform-Middleware in jedes Event und
  jeden Log-Eintrag propagieren.

### L. Migrations-Policy

- **Ein Feature = eine Migration** (Ausnahme: wenn Schema-Änderung nach
  Review nötig wird): `add_eigenschutz_module`.
- **Keine ALTER-Migrations auf bestehenden Plattform-Tabellen** ohne
  separate ADR (z. B. Hinzufügen von `EigenschutzRolle` zu
  `EinsatzRollenbesetzung` muss explizit in derselben Migration dokumentiert
  sein).
- **Seeds** in `prisma/seed.ts` — idempotent per `upsert` auf `slug`.

### M. Enforcement Guidelines

**Automatisiert (CI / Pre-Commit):**

- `check:di:imports` — `import type` für Injectable verboten (AC1).
- `check:arch` — keine neuen Circular Dependencies.
- `oxlint` + `oxfmt` — Style.
- API-Contract-Tests (Jest) — Swagger-Output unverändert zu Snapshots.
- Backend ≥ 80 % Domain-Coverage (`pnpm test:cov`).
- axe-core in Vitest-Tests je neuer Komponente (WCAG AA).

**Manuell (Review-Checkliste, neu für Eigenschutz):**

- Neues Domain-Event: alle 4 Registry-Stellen bedient?
- Neuer State-ändernder Endpoint: Guard-Kette vollständig?
- Neue Mutation: `expectedVersion`-Parameter? 409-Handling?
- Neues Formular: Zod-Schema in `packages/shared/schemas/`?
- Neue `kontextSnapshot`-Relevanz: in `EigenschutzKontextSnapshotV1` enthalten?
- Touch-Target ≥ 48 px Primary / ≥ 44 px Secondary (UX-QA-Checkliste).

### N. Anti-Patterns (AI-Agent-Fallstricke)

| Anti-Pattern                                           | Stattdessen                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `import type` für Injectable                           | Regulärer `import` (AC1)                                    |
| `@ApiOkResponse({ type: ... })`                        | `@ApiWrappedResponse(...)` (AC7)                            |
| Manuelles `fetch()` im Frontend                        | Generierter Client + TanStack-Hook                          |
| Direktes Prisma im Application-Layer                   | Repository-Port (Interface)                                 |
| Neues Event nur serializer, nicht deserializer         | Alle 4 Registry-Stellen                                     |
| Lineares PSA-Stufen-Modell                             | Additives Profil-Set (Q2)                                   |
| Modal-Stacking bei Konflikten                          | `ConflictResolutionList` (Tabelle)                          |
| `kontextSnapshot` nachträglich aktualisieren           | Append-only (FR42)                                          |
| Risiko-Klasse on-the-fly im Frontend berechnen         | Backend ermittelt + speichert Klasse                        |
| `@ApiParam`-Typ ohne `EinsatzParam`-Decorator          | Dedizierter Decorator, damit `EinsatzScopeGuard` zieht      |
| Command ruft anderen Command auf                       | Command → Event → Command                                   |
| Eigene Sync-Queue im Feature                           | Platform-Storage-Adapter (ADR-010)                          |
| Leaflet-Layer                                          | MapGL                                                       |
| `features/Eigenschutz/` (PascalCase)                   | `features/eigenschutz/` (kebab)                             |
| Template-Live-Link zu Einsatz                          | Deep-Copy bei Import                                        |
| WebSocket-Broadcast ohne Room-Scope                    | `einsatz:{einsatzId}` Room (ADR-006)                        |
| Gemischtes snake_case+camelCase in Payloads            | camelCase Deutsch durchgängig                               |
| `text` / `String` ohne Längen-Limit bei kurzen Feldern | `@db.VarChar(...)`-Limit konsistent mit bestehendem Pattern |

### O. Gute Beispiele (Ausschnitte)

**Command-Handler-Skeleton:**

```typescript
@Injectable()
export class ChangePsaProfilHandler extends TransactionalCommandHandler<ChangePsaProfilCommand, { propagationGroupId: string }> {
  constructor(
    prisma: PrismaService,
    outbox: IOutboxRepository,
    @Inject(PSA_PROFIL_ZUWEISUNG_REPOSITORY)
    private readonly repo: IPsaProfilZuweisungRepository,
  ) {
    super(prisma, outbox);
  }

  protected async executeInTransaction(cmd: ChangePsaProfilCommand, tx: TransactionContext) {
    const propagationGroupId = createId();
    const events: DomainEvent[] = [];

    for (const einheitId of cmd.einheitIds) {
      const result = await this.toggleForEinheit(cmd.einsatzId, einheitId, cmd.toggles, cmd.begruendung, cmd.userId, propagationGroupId, tx);
      if (result.isFailure) return Result.fail(result.error!);
      events.push(...result.value!);
    }
    return { result: { propagationGroupId }, events };
  }
}
```

**Frontend-Query-Hook:**

```typescript
export function useEigenschutzAmpelStatus(einsatzId: string) {
  return useQuery({
    queryKey: ['eigenschutz', einsatzId, 'ampel'] as const,
    queryFn: () => apiClient.eigenschutz.getAmpel({ einsatzId }),
    staleTime: 15_000,
    select: (res) => res.data,
  });
}
```

## Project Structure & Boundaries

### Scope der Strukturdefinition

Dieser Abschnitt spiegelt den **physischen Repository-Footprint** des
Eigenschutz-Moduls im bestehenden Monorepo wider. Jedes File entspricht
einer klaren architektonischen Verantwortung; FR/NFRs sind explizit auf
Dateien gemappt. Plattform-Voraussetzungen (Push-Notifications,
EinsatzScopeGuard) sind als separate Struktur-Blöcke ausgewiesen.

### Prisma Schema-Additions (`packages/backend/prisma/schema.prisma`)

```prisma
// -------- Enums --------
// HINWEIS (Revision nach Architektur-Review):
// Das frühere Enum `EigenschutzRolle` wurde entfernt — Eigenschutz-Rollen
// werden stattdessen als `RollenDefinition`-Seed-Records angelegt und
// über `EinsatzRollenbesetzung.rollenName` mit Präfix-Pattern
// `^Eigenschutz: ` verifiziert. Siehe §B10 (Revidiert).

enum PsaProfil {
  BASIS
  INFEKTION
  VU
  CBRN_PATIENT
  VOLLSCHUTZ
}

enum Eintrittswahrscheinlichkeit {
  SELTEN
  GELEGENTLICH
  HAEUFIG
  OFT
  STAENDIG
}

enum Schadensausmass {
  VERNACHLAESSIGBAR
  GERING
  MITTEL
  HOCH
  KATASTROPHAL
}

enum Risikoklasse {
  GRUEN
  GELB
  ORANGE
  ROT
}

enum Ampelstatus {
  GRUEN
  GELB
  ROT
}

enum SyncConflictEntityType {
  GEFAEHRDUNGSBEURTEILUNG_ITEM
  PSA_PROFIL_ZUWEISUNG
}

enum SyncConflictResolution {
  SERVER_WINS
  LOCAL_WINS
  MERGED
}

// -------- Core Entities --------
model Gefaehrdungsbeurteilung {
  id              String    @id @default(cuid())
  einsatzId       String
  einheitId       String
  gefahrenzoneId  String?
  vorlageId       String?
  items           Json
  version         Int       @default(1)
  erstelltAm      DateTime  @default(now())
  erstelltVonUserId String
  aktualisiertAm  DateTime  @updatedAt
  aktualisiertVonUserId String

  einsatz    Einsatz       @relation(fields: [einsatzId], references: [id])
  versionen  GefaehrdungsbeurteilungVersion[]
  vorlage    GefaehrdungsbeurteilungVorlage? @relation(fields: [vorlageId], references: [id])

  @@unique([einsatzId, einheitId])
  @@index([einsatzId])
}

model GefaehrdungsbeurteilungVersion {
  id                     String   @id @default(cuid())
  gefBeurteilungId       String
  version                Int
  items                  Json
  changedFields          Json
  gueltigVon             DateTime
  gueltigBis             DateTime?
  changedByUserId        String
  begruendung            String?  @db.VarChar(500)
  eventId                String?  @unique

  gefBeurteilung Gefaehrdungsbeurteilung @relation(fields: [gefBeurteilungId], references: [id], onDelete: Cascade)
  vorfaelle      EigenschutzVorfall[]                    // Revision: FK kommt vom Vorfall auf diese Version

  @@unique([gefBeurteilungId, version])
  @@index([gefBeurteilungId, gueltigVon])
}

model GefaehrdungsbeurteilungVorlage {
  id              String   @id @default(cuid())
  slug            String   @unique @db.VarChar(100)
  name            String   @db.VarChar(200)
  szenario        String   @db.VarChar(80)
  items           Json
  version         Int      @default(1)
  aktiv           Boolean  @default(true)
  erstelltAm      DateTime @default(now())
  erstelltVonUserId String?

  nutzerBeurteilungen Gefaehrdungsbeurteilung[]
}

model PsaProfilZuweisung {
  id                    String    @id @default(cuid())
  einsatzId             String
  einheitId             String
  profil                PsaProfil
  gueltigVon            DateTime
  gueltigBis            DateTime?
  aktiviertVonUserId    String
  begruendung           String    @db.VarChar(500)
  propagationGroupId    String
  version               Int       @default(1)

  einsatz Einsatz @relation(fields: [einsatzId], references: [id])

  @@index([einsatzId, einheitId, gueltigBis])
  @@index([propagationGroupId])
}

model Sicherheitsregel {
  id                    String    @id @default(cuid())
  einsatzId             String
  einheitId             String?              // null = gilt für gesamten Einsatz
  titel                 String    @db.VarChar(200)
  inhalt                String    @db.Text
  version               Int       @default(1)
  erstelltAm            DateTime  @default(now())
  erstelltVonUserId     String
  aktualisiertAm        DateTime  @updatedAt
  aktualisiertVonUserId String

  versionen  SicherheitsregelVersion[]
  quittungen SicherheitsregelQuittung[]
  einsatz Einsatz @relation(fields: [einsatzId], references: [id])

  @@index([einsatzId])
}

model SicherheitsregelVersion {
  id                String   @id @default(cuid())
  regelId           String
  version           Int
  titel             String   @db.VarChar(200)
  inhalt            String   @db.Text
  gueltigVon        DateTime
  gueltigBis        DateTime?
  changedByUserId   String
  eventId           String?  @unique

  regel Sicherheitsregel @relation(fields: [regelId], references: [id], onDelete: Cascade)

  @@unique([regelId, version])
}

model SicherheitsregelQuittung {
  id                 String   @id @default(cuid())
  regelId            String
  einheitId          String
  quittiertAm        DateTime @default(now())
  quittiertVonUserId String

  regel Sicherheitsregel @relation(fields: [regelId], references: [id])

  @@unique([regelId, einheitId])
}

model PsaProfilQuittung {
  id                   String   @id @default(cuid())
  propagationGroupId   String
  einsatzId            String
  einheitId            String
  quittiertAm          DateTime @default(now())
  quittiertVonUserId   String
  lueckeGemeldet       Boolean  @default(false)
  lueckeNotiz          String?  @db.VarChar(1000)

  @@unique([propagationGroupId, einheitId])
  @@index([einsatzId, einheitId])
}

model Sicherungsposten {
  id                    String   @id @default(cuid())
  einsatzId             String
  einheitId             String?
  bezeichnung           String   @db.VarChar(200)
  standort              Json     // GeoJSON Point
  zustaendigkeitsbereich String? @db.Text
  personal              Json     // Array {name, rolle}
  abloesezeiten         String?  @db.VarChar(2000) // Hochsetzung 500 → 2000 in Story 4.2 (Epic-Verfeinerung); LWW-Auto-Merge bleibt unverändert.
  version               Int      @default(1)
  erstelltAm            DateTime @default(now())
  erstelltVonUserId     String
  aktualisiertAm        DateTime @updatedAt
  aktualisiertVonUserId String
  geloescht             Boolean  @default(false)

  versionen SicherungspostenVersion[]
  einsatz Einsatz @relation(fields: [einsatzId], references: [id])

  @@index([einsatzId])
}

model SicherungspostenVersion {
  id                 String   @id @default(cuid())
  postenId           String
  version            Int
  payload            Json
  gueltigVon         DateTime
  gueltigBis         DateTime?
  changedByUserId    String
  eventId            String?  @unique

  posten Sicherungsposten @relation(fields: [postenId], references: [id], onDelete: Cascade)

  @@unique([postenId, version])
}

model EigenschutzVorfall {
  id                      String    @id @default(cuid())
  einsatzId               String
  einheitId               String
  vorfallZeit             DateTime
  was                     String    @db.Text
  wann                    DateTime
  wo                      String    @db.VarChar(500)
  beteiligte              Json      // Array {rolle, name?, anonymisiert}
  massnahmen              String    @db.Text
  unfallkasseRelevant     Boolean   @default(false)
  // HINWEIS (Revision nach Architektur-Review):
  // kontextSnapshot ist die authoritative Quelle für den historischen Stand.
  // Einzige FK ist gefBeurteilungVersionId (zeigt auf die Versions-Tabelle).
  // Sicherheitsregel-Versionen und PSA-Zuweisungen werden ausschließlich als
  // Liste im kontextSnapshot JSONB geführt — keine Array-FK-Felder, weil
  // Prisma/Postgres darauf keine referentielle Integrität erzwingen kann
  // (Snapshot muss unveränderlich sein, auch wenn Ziel-Rows gelöscht würden).
  kontextSnapshot         Json      // EigenschutzKontextSnapshotV1
  gefBeurteilungVersionId String?
  erfasstAm               DateTime  @default(now())
  erfasstVonUserId        String

  gefBeurteilungVersion GefaehrdungsbeurteilungVersion? @relation(fields: [gefBeurteilungVersionId], references: [id])

  @@index([einsatzId, einheitId])
  @@index([einsatzId, unfallkasseRelevant])
  @@index([vorfallZeit])
}

model EigenschutzTelemetryEvent {
  id          String   @id @default(cuid())
  einsatzId   String
  userId      String
  sessionId   String   @db.VarChar(80)
  eventName   String   @db.VarChar(80)
  payload     Json
  clientTime  DateTime
  serverTime  DateTime @default(now())

  @@index([einsatzId, eventName])
  @@index([einsatzId, serverTime])
}

model AmpelProjection {
  einsatzId                  String
  einheitId                  String
  status                     Ampelstatus
  aktivePsaProfile           PsaProfil[]
  offeneGefaehrdungenHoch    Int
  ausstehendePsaQuittungen   Int
  ausstehendeRegelQuittungen Int
  offeneVorfaelle            Int
  ungeloesteRueckmeldungen   Int
  letzteAenderungAm          DateTime
  letzteAenderungVonUserId   String?

  @@id([einsatzId, einheitId])
  @@index([einsatzId])
}

model SyncConflict {
  id                    String   @id @default(cuid())
  einsatzId             String
  einheitId             String?
  entityType            SyncConflictEntityType
  entityId              String
  fieldPath             String   @db.VarChar(200)
  localPayload          Json
  serverVersion         Int
  localExpectedVersion  Int
  reportedAt            DateTime @default(now())
  reportedByUserId      String
  resolvedAt            DateTime?
  resolvedByUserId      String?
  resolution            SyncConflictResolution?

  @@index([einsatzId, resolvedAt])
}

// -------- Plattform-Voraussetzungen (Spillover) --------
// model PushSubscription — Plattform-Feature (ADR-011 Kandidat), nicht Eigenschutz-scope.
//
// HINWEIS (Revision nach Architektur-Review):
// Keine Schema-Änderungen an `EinsatzRollenbesetzung` nötig — siehe §B10
// (Revidiert): Rollen werden als RollenDefinition-Seeds angelegt, keine
// neue Spalte und kein Eigenschutz-Enum.
```

**Kein Add-Column auf Plattform-Tabellen.** Nach Architektur-Review wurde
das frühere Feld `EinsatzRollenbesetzung.eigenschutzRolle` entfernt —
Eigenschutz-Rollen werden über `RollenDefinition`-Seeds abgebildet (§B10
Revidiert). Damit ist die Migration `add_eigenschutz_module` rein additiv
zu Eigenschutz-eigenen Tabellen und berührt keine Plattform-Tabelle.

### Backend Directory Tree (Eigenschutz)

```
packages/backend/
├── prisma/
│   ├── schema.prisma                                  # Enum- & Model-Additions (s.o.)
│   ├── migrations/
│   │   └── YYYYMMDDHHMMSS_add_eigenschutz_module/
│   │       └── migration.sql
│   └── seed.ts                                        # + 5 Vorlagen-Seeds (MANV, VU, Großveranstaltung, Betreuung, CBRN-Patient)
└── src/
    ├── domain/eigenschutz/
    │   ├── aggregates/
    │   │   ├── gefaehrdungsbeurteilung.aggregate.ts
    │   │   ├── psa-profil-zuweisung.aggregate.ts
    │   │   ├── sicherheitsregel.aggregate.ts
    │   │   ├── sicherungsposten.aggregate.ts
    │   │   └── eigenschutz-vorfall.aggregate.ts
    │   ├── value-objects/
    │   │   ├── gefaehrdung-item.vo.ts                # Value Object eines einzelnen Items
    │   │   ├── risikobewertung.vo.ts                 # 5×5 + Klasse-Mapping
    │   │   ├── psa-profil-set.vo.ts                  # additive Menge aktiver Profile
    │   │   ├── ausruestungs-checkliste.vo.ts         # pro PSA-Profil
    │   │   ├── quittungsstatus.vo.ts                 # Aggregation pro Propagation-Group
    │   │   └── kontext-snapshot.vo.ts                # Wrapper um EigenschutzKontextSnapshotV1
    │   ├── events/
    │   │   ├── gefaehrdungsbeurteilung-erstellt.event.ts
    │   │   ├── gefaehrdungsbeurteilung-aktualisiert.event.ts
    │   │   ├── psa-profil-geaendert.event.ts
    │   │   ├── sicherheitsregel-ausgerufen.event.ts
    │   │   ├── sicherheitsregel-quittiert.event.ts
    │   │   ├── sicherungsposten-eingerichtet.event.ts
    │   │   ├── sicherungsposten-aktualisiert.event.ts
    │   │   ├── vorfall-gemeldet.event.ts
    │   │   ├── vorfall-exportiert.event.ts
    │   │   ├── quittung-abgegeben.event.ts
    │   │   ├── luecke-gemeldet.event.ts
    │   │   ├── quittung-ueberfaellig.event.ts
    │   │   ├── konflikt-erkannt.event.ts
    │   │   ├── konflikt-aufgeloest.event.ts
    │   │   └── index.ts                               # Re-Export
    │   ├── repositories/
    │   │   ├── i-gefaehrdungsbeurteilung.repository.ts
    │   │   ├── i-gefaehrdungsbeurteilung-version.repository.ts
    │   │   ├── i-gefaehrdungsbeurteilung-vorlage.repository.ts
    │   │   ├── i-psa-profil-zuweisung.repository.ts
    │   │   ├── i-psa-profil-quittung.repository.ts
    │   │   ├── i-sicherheitsregel.repository.ts
    │   │   ├── i-sicherheitsregel-version.repository.ts
    │   │   ├── i-sicherheitsregel-quittung.repository.ts
    │   │   ├── i-sicherungsposten.repository.ts
    │   │   ├── i-sicherungsposten-version.repository.ts
    │   │   ├── i-eigenschutz-vorfall.repository.ts
    │   │   ├── i-ampel-projection.repository.ts
    │   │   ├── i-sync-conflict.repository.ts
    │   │   └── i-eigenschutz-telemetry.repository.ts
    │   ├── enums/
    │   │   ├── psa-profil.enum.ts                     # Prisma-Enum-Mirror
    │   │   ├── ampelstatus.enum.ts
    │   │   ├── risikoklasse.enum.ts
    │   │   ├── eintrittswahrscheinlichkeit.enum.ts
    │   │   ├── schadensausmass.enum.ts
    │   │   ├── eigenschutz-rolle.enum.ts              # TS-Union-Type (Revision: nicht Prisma-persistiert)
    │   │   └── sync-conflict.enums.ts
    │   └── errors/
    │       └── eigenschutz-error.codes.ts
    ├── application/eigenschutz/
    │   ├── commands/
    │   │   ├── create-gefaehrdungsbeurteilung/{command,handler}.ts
    │   │   ├── update-gefaehrdungsbeurteilung/{command,handler}.ts
    │   │   ├── change-psa-profil/{command,handler}.ts           # Multi-Select + propagationGroupId
    │   │   ├── ack-psa-quittung/{command,handler}.ts
    │   │   ├── melde-luecke/{command,handler}.ts
    │   │   ├── create-sicherheitsregel/{command,handler}.ts
    │   │   ├── update-sicherheitsregel/{command,handler}.ts
    │   │   ├── ack-sicherheitsregel/{command,handler}.ts
    │   │   ├── create-sicherungsposten/{command,handler}.ts
    │   │   ├── update-sicherungsposten/{command,handler}.ts
    │   │   ├── delete-sicherungsposten/{command,handler}.ts
    │   │   ├── report-vorfall/{command,handler}.ts              # erzeugt kontextSnapshot
    │   │   ├── export-vorfall/{command,handler}.ts
    │   │   └── resolve-konflikt/{command,handler}.ts
    │   ├── queries/
    │   │   ├── get-eigenschutz-ampel-status/
    │   │   ├── get-gefaehrdungsbeurteilung/
    │   │   ├── list-gefaehrdungsbeurteilungen/
    │   │   ├── list-psa-zuweisungen/
    │   │   ├── list-sicherheitsregeln/
    │   │   ├── list-sicherungsposten/
    │   │   ├── get-vorfall/
    │   │   ├── list-vorfaelle/
    │   │   ├── get-entity-version-history/
    │   │   └── list-sync-conflicts/
    │   ├── event-handlers/
    │   │   ├── update-ampel-projection.handler.ts               # reagiert auf alle Status-Events
    │   │   ├── emit-critical-push.handler.ts                    # Brücke zu Plattform-Push
    │   │   ├── start-quittung-ueberwachung.handler.ts
    │   │   └── collect-telemetry-on-propagation.handler.ts
    │   ├── schedulers/
    │   │   └── quittung-ueberfaellig.scheduler.ts               # @Interval(30s)
    │   ├── dto/
    │   │   ├── gefaehrdungsbeurteilung.dto.ts + .factory.ts
    │   │   ├── gefaehrdung-item.dto.ts
    │   │   ├── psa-profil-zuweisung.dto.ts + .factory.ts
    │   │   ├── psa-profil-change-request.dto.ts
    │   │   ├── sicherheitsregel.dto.ts + .factory.ts
    │   │   ├── sicherungsposten.dto.ts + .factory.ts
    │   │   ├── eigenschutz-vorfall.dto.ts + .factory.ts
    │   │   ├── vorfall-export-request.dto.ts
    │   │   ├── ampel-status.dto.ts + .factory.ts
    │   │   ├── sync-conflict.dto.ts + .factory.ts
    │   │   └── telemetry-event.dto.ts
    │   └── errors/
    │       └── eigenschutz-application-errors.ts
    ├── infrastructure/eigenschutz/
    │   ├── repositories/
    │   │   ├── prisma-gefaehrdungsbeurteilung.repository.ts
    │   │   ├── prisma-gefaehrdungsbeurteilung-version.repository.ts
    │   │   ├── prisma-gefaehrdungsbeurteilung-vorlage.repository.ts
    │   │   ├── prisma-psa-profil-zuweisung.repository.ts
    │   │   ├── prisma-psa-profil-quittung.repository.ts
    │   │   ├── prisma-sicherheitsregel.repository.ts
    │   │   ├── prisma-sicherheitsregel-version.repository.ts
    │   │   ├── prisma-sicherheitsregel-quittung.repository.ts
    │   │   ├── prisma-sicherungsposten.repository.ts
    │   │   ├── prisma-sicherungsposten-version.repository.ts
    │   │   ├── prisma-eigenschutz-vorfall.repository.ts
    │   │   ├── prisma-ampel-projection.repository.ts
    │   │   ├── prisma-sync-conflict.repository.ts
    │   │   ├── prisma-eigenschutz-telemetry.repository.ts
    │   │   └── mappers/
    │   │       ├── gefaehrdungsbeurteilung.mapper.ts
    │   │       ├── psa-profil-zuweisung.mapper.ts
    │   │       ├── sicherheitsregel.mapper.ts
    │   │       ├── sicherungsposten.mapper.ts
    │   │       └── eigenschutz-vorfall.mapper.ts
    │   ├── projections/
    │   │   └── ampel-projection.updater.ts                       # idempotent via eventId
    │   ├── export/
    │   │   ├── eigenschutz-vorfall-pdf.renderer.ts
    │   │   └── eigenschutz-vorfall-json.renderer.ts
    │   ├── telemetry/
    │   │   ├── telemetry-ingest.service.ts
    │   │   └── prometheus-eigenschutz.collector.ts
    │   ├── conflict/
    │   │   └── sync-conflict.service.ts
    │   ├── snapshot/
    │   │   └── kontext-snapshot.builder.ts                       # materialisiert B2 JSONB
    │   ├── event-adapters/
    │   │   ├── gefaehrdungsbeurteilung-erstellt.adapter.ts
    │   │   ├── gefaehrdungsbeurteilung-aktualisiert.adapter.ts
    │   │   ├── psa-profil-geaendert.adapter.ts
    │   │   ├── sicherheitsregel-ausgerufen.adapter.ts
    │   │   ├── sicherheitsregel-quittiert.adapter.ts
    │   │   ├── sicherungsposten-eingerichtet.adapter.ts
    │   │   ├── sicherungsposten-aktualisiert.adapter.ts
    │   │   ├── vorfall-gemeldet.adapter.ts
    │   │   ├── vorfall-exportiert.adapter.ts
    │   │   ├── quittung-abgegeben.adapter.ts
    │   │   ├── luecke-gemeldet.adapter.ts
    │   │   ├── quittung-ueberfaellig.adapter.ts
    │   │   ├── konflikt-erkannt.adapter.ts
    │   │   ├── konflikt-aufgeloest.adapter.ts
    │   │   └── index.ts                                          # ← Registry-Stelle 4
    │   ├── eigenschutz-infrastructure.module.ts
    │   └── di-tokens.eigenschutz.ts                              # Symbol-Tokens für alle Repos/Services
    ├── modules/eigenschutz/
    │   ├── controllers/
    │   │   ├── gefaehrdungsbeurteilung.controller.ts
    │   │   ├── psa-profil.controller.ts                          # incl. bulk-aendern + quittieren
    │   │   ├── sicherheitsregel.controller.ts
    │   │   ├── sicherungsposten.controller.ts
    │   │   ├── eigenschutz-vorfall.controller.ts                 # incl. export
    │   │   ├── eigenschutz-ampel.controller.ts
    │   │   ├── eigenschutz-sync-conflict.controller.ts
    │   │   └── eigenschutz-telemetry.controller.ts
    │   ├── guards/
    │   │   └── eigenschutz-rolle.guard.ts
    │   ├── decorators/
    │   │   ├── requires-eigenschutz-rolle.decorator.ts
    │   │   └── public-telemetry.decorator.ts
    │   └── eigenschutz.module.ts
    └── infrastructure/
        ├── outbox/                                                # ← Registry-Stellen 1,2
        │   ├── event-serializer.ts                                # + 14 neue Eigenschutz-Events
        │   └── event-deserializer.ts                              # + 14 neue Eigenschutz-Events
        └── events/                                                # ← Registry-Stelle 3
            └── event-adapters.module.ts                           # + Eigenschutz-Adapter importieren
```

### Plattform-Spillover (eigene Stories, nicht Eigenschutz-Scope)

```
packages/backend/src/
├── infrastructure/push-notifications/                   # F1 (ADR-011 Kandidat)
│   ├── push-subscription.entity.ts
│   ├── push-subscription.mapper.ts
│   ├── prisma-push-subscription.repository.ts
│   ├── web-push.service.ts                              # web-push-Lib-Integration
│   └── push-notifications.module.ts
├── modules/push-notifications/
│   ├── push-subscription.controller.ts                  # POST/DELETE /api/users/me/push-subscriptions
│   ├── push-subscription.dto.ts
│   └── push-notifications.module.ts
└── modules/auth/guards/
    └── einsatz-scope.guard.ts                           # F2 (ADR-012 Kandidat)

packages/frontend/public/
└── sw.js                                                # Service Worker für Web-Push

packages/frontend/src/shared/ui/push-subscription-manager/
└── useCriticalNotification.ts                           # Plattform-Hook, Tauri|Web|In-App
```

### Frontend Directory Tree

```
packages/frontend/src/features/eigenschutz/
├── api/
│   ├── queries.ts                                       # zentrale TanStack-Query-Hooks
│   ├── mutations.ts
│   └── websocket-subscriptions.ts                       # registriert einsatz:{id}-Room-Handler
├── hooks/
│   ├── useEigenschutzAmpelStatus.ts
│   ├── useGefaehrdungsbeurteilung.ts
│   ├── useCreateGefaehrdungsbeurteilung.ts
│   ├── useUpdateGefaehrdungsbeurteilung.ts
│   ├── usePsaProfilZuweisungen.ts
│   ├── useChangePsaProfil.ts
│   ├── useAckPsaQuittung.ts
│   ├── useMeldeLuecke.ts
│   ├── useSicherheitsregeln.ts
│   ├── useAckSicherheitsregel.ts
│   ├── useSicherungsposten.ts
│   ├── useVorfaelle.ts
│   ├── useReportVorfall.ts
│   ├── useExportVorfall.ts
│   ├── useSyncConflicts.ts
│   ├── useResolveKonflikt.ts
│   ├── useEigenschutzTelemetry.ts                       # emittiert Timestamps
│   └── useEigenschutzShortcuts.ts                       # registriert globale Hotkeys
├── schemas/
│   ├── gefaehrdungsbeurteilung.schema.ts
│   ├── gefaehrdung-item.schema.ts
│   ├── psa-profil-change.schema.ts
│   ├── sicherheitsregel.schema.ts
│   ├── sicherungsposten.schema.ts
│   ├── vorfall-report.schema.ts
│   └── vorfall-export.schema.ts
├── stores/
│   ├── eigenschutz-dashboard-view.store.ts
│   └── eigenschutz-selection.store.ts                   # Multi-Select-Zustand
├── constants/
│   ├── psa-profile.constants.ts                         # Checklisten + Farb-Mapping
│   ├── seed-szenarien.constants.ts
│   ├── risiko-matrix.constants.ts
│   └── shortcuts.constants.ts
├── utils/
│   ├── risikoklasse-berechnung.ts                       # Mirror der Backend-Logik (UI-Preview)
│   ├── quittungs-counter.ts
│   └── snapshot-viewer.ts
├── ui/
│   ├── atoms/
│   │   ├── StatusIndicator.tsx
│   │   └── PsaProfilChip.tsx
│   ├── molecules/
│   │   ├── AcknowledgmentStatusBadge.tsx
│   │   ├── VersionTimestampFooter.tsx
│   │   ├── SyncStatusBadge.tsx
│   │   ├── SeedTemplateEntryCard.tsx
│   │   ├── AmpelCard.tsx
│   │   └── AmpelDashboardRow.tsx
│   ├── organisms/
│   │   ├── AmpelDashboard.tsx
│   │   ├── SeverityBanner.tsx
│   │   ├── RiskMatrix5x5.tsx
│   │   ├── PsaProfileMultiSelect.tsx
│   │   ├── EquipmentChecklist.tsx
│   │   ├── GefaehrdungseditorDrawer.tsx
│   │   ├── PsaChangeDrawer.tsx
│   │   ├── SicherheitsregelDrawer.tsx
│   │   ├── SicherungspostenPanel.tsx
│   │   ├── VorfallReportDrawer.tsx
│   │   ├── VorfallDetailPage.tsx
│   │   ├── IncidentContextSnapshot.tsx
│   │   ├── ConflictResolutionList.tsx
│   │   ├── RiskEvaluationDiff.tsx                       # opportunistic (UX-Spec)
│   │   └── SecurityPostMapMarker.tsx                    # MapGL-Layer
│   └── pages/
│       ├── DashboardPage.tsx
│       ├── GefaehrdungenPage.tsx
│       ├── SicherungspostenPage.tsx
│       ├── VorfaellePage.tsx
│       ├── VorfallDetailPage.tsx
│       └── SyncConflictsPage.tsx
└── index.ts                                             # public exports

packages/frontend/src/routes/_app/einsatz/$einsatzId/sicherheit/eigenschutz/
├── __root.tsx                                           # Feature-Root (Navigation, Guards)
├── index.tsx                                            # → redirect to /dashboard
├── dashboard.tsx                                        # AmpelDashboard-Page
├── gefaehrdungen.tsx
├── gefaehrdungen.$id.tsx                                # Deep-Link pro Entität
├── sicherungsposten.tsx
├── vorfaelle.tsx
├── vorfaelle.$id.tsx                                    # Deep-Link pro Entität
└── sync-konflikte.tsx
```

### Shared Schemas (`packages/shared/schemas/eigenschutz/`)

```
packages/shared/schemas/eigenschutz/
├── index.ts
├── gefaehrdungsbeurteilung.schema.ts                    # geteilt zwischen BE-DTO + FE-Form
├── gefaehrdung-item.schema.ts
├── psa-profil-change.schema.ts
├── sicherheitsregel.schema.ts
├── sicherungsposten.schema.ts
├── vorfall-report.schema.ts
├── vorfall-export.schema.ts                             # Q7 Obermenge
├── eigenschutz-kontext-snapshot.schema.ts               # V1 (evolutionsfähig)
├── ampel-status.schema.ts
├── sync-conflict.schema.ts
└── telemetry-event.schema.ts
```

### Architectural Boundaries

**API-Grenzen:**

- **Externe API (Client-facing):** ausschließlich unter
  `/api/einsaetze/:einsatzId/sicherheit/eigenschutz/*`. Kein
  Top-Level-Endpoint.
- **Internal boundaries:** Controller → Command/Query → Domain →
  Repository-Port. Kein direkter Prisma-Zugriff außerhalb
  `infrastructure/eigenschutz/repositories/`.
- **Guard-Boundary:** Jeder Eigenschutz-Controller läuft durch die Kette
  `JwtAuthGuard → EinsatzScopeGuard → EigenschutzRolleGuard | PermissionsGuard`.
  Telemetrie-Endpoint nutzt `@PublicTelemetry()`-Bypass (trotzdem nach
  `EinsatzScopeGuard`).

**Component-Grenzen (Frontend):**

- **Feature-Slice Isolation:** `features/eigenschutz/*` darf andere
  Features nur über deren `index.ts` (Public API) importieren. Kein
  Tiefen-Import in `features/gefahrenzone/ui/...`.
- **MapGL-Integration:** `SecurityPostMapMarker` nutzt Map-Primitives aus
  `features/lagekarte/` (deren Public API). Eigener MapContainer wird nicht
  eingeführt.
- **Shared-UI-Promotion:** Promotion-Kandidaten bleiben zunächst im
  Feature-Ordner; Migration nach `shared/ui/` erst bei zweitem
  plattformweiten Use-Case.

**Service-Grenzen (Backend):**

- **Cross-Modul-Aufrufe verboten.** Eigenschutz greift nie direkt auf
  Einsatz-/Gefahren-/Lagekarte-Modul-Services zu. Kommunikation
  ausschließlich über:
  1. FK-Referenzen in der DB (`einsatzId`, `einheitId`, `gefahrenzoneId`).
  2. Outbox-Events (Eigenschutz abonniert/emittiert).
  3. Shared Utils (z. B. `packages/shared/schemas/`).
- **Push-Service-Bridge:** `emit-critical-push.handler.ts`
  (Application-Layer) ist der einzige Kontaktpunkt zum Plattform-Push-Service.
  DI via Interface-Port `IPushNotificationService`.

**Daten-Grenzen:**

- **Schema-Hoheit:** Eigenschutz-Tabellen in eigener Domäne; kein
  Eigenschutz-Code verändert Plattform-Tabellen außer die dokumentierte
  `EinsatzRollenbesetzung.eigenschutzRolle`-Ergänzung.
- **JSONB-Verantwortung:** Shape von `items`, `kontextSnapshot`, `payload`
  wird ausschließlich durch Zod-Schemas aus
  `packages/shared/schemas/eigenschutz/` bestimmt. Keine losen JSONB-Reads.

### Requirements-to-Structure Mapping

| FR-Block                                  | Hauptdateien                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Gefährdungsbeurteilung (FR1–FR6)**   | `domain/eigenschutz/aggregates/gefaehrdungsbeurteilung.aggregate.ts`, `application/eigenschutz/commands/{create,update}-gefaehrdungsbeurteilung/`, `modules/eigenschutz/controllers/gefaehrdungsbeurteilung.controller.ts`, `features/eigenschutz/ui/organisms/GefaehrdungseditorDrawer.tsx`, `features/eigenschutz/ui/organisms/RiskMatrix5x5.tsx`                                                                                                                                                                                                                                             |
| **FR5 Seed-Vorlagen**                     | `prisma/seed.ts` + `features/eigenschutz/ui/molecules/SeedTemplateEntryCard.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **B. PSA-Verwaltung (FR10–FR14)**         | `domain/eigenschutz/aggregates/psa-profil-zuweisung.aggregate.ts`, `domain/eigenschutz/value-objects/psa-profil-set.vo.ts`, `application/eigenschutz/commands/change-psa-profil/`, `modules/eigenschutz/controllers/psa-profil.controller.ts`, `features/eigenschutz/ui/organisms/PsaProfileMultiSelect.tsx`, `features/eigenschutz/ui/organisms/PsaChangeDrawer.tsx`                                                                                                                                                                                                                           |
| **C. Bekanntgabe & Quittung (FR17–FR20)** | `application/eigenschutz/commands/ack-psa-quittung/`, `application/eigenschutz/commands/melde-luecke/`, `application/eigenschutz/event-handlers/emit-critical-push.handler.ts`, `application/eigenschutz/schedulers/quittung-ueberfaellig.scheduler.ts`, `features/eigenschutz/ui/organisms/SeverityBanner.tsx`, `features/eigenschutz/ui/organisms/EquipmentChecklist.tsx`, `features/eigenschutz/ui/molecules/AcknowledgmentStatusBadge.tsx`                                                                                                                                                  |
| **D. Sicherheitsregeln (FR23–FR25)**      | `domain/eigenschutz/aggregates/sicherheitsregel.aggregate.ts`, `application/eigenschutz/commands/{create,update,ack}-sicherheitsregel/`, `modules/eigenschutz/controllers/sicherheitsregel.controller.ts`, `features/eigenschutz/ui/organisms/SicherheitsregelDrawer.tsx`                                                                                                                                                                                                                                                                                                                       |
| **E. Sicherungsposten (FR27–FR29)**       | `domain/eigenschutz/aggregates/sicherungsposten.aggregate.ts`, `application/eigenschutz/commands/{create,update,delete}-sicherungsposten/`, `modules/eigenschutz/controllers/sicherungsposten.controller.ts`, `features/eigenschutz/ui/organisms/SicherungspostenPanel.tsx`, `features/eigenschutz/ui/organisms/SecurityPostMapMarker.tsx`                                                                                                                                                                                                                                                      |
| **F. Vorfall + Export (FR31–FR36)**       | `domain/eigenschutz/aggregates/eigenschutz-vorfall.aggregate.ts`, `domain/eigenschutz/value-objects/kontext-snapshot.vo.ts`, `application/eigenschutz/commands/{report,export}-vorfall/`, `infrastructure/eigenschutz/snapshot/kontext-snapshot.builder.ts`, `infrastructure/eigenschutz/export/eigenschutz-vorfall-pdf.renderer.ts`, `infrastructure/eigenschutz/export/eigenschutz-vorfall-json.renderer.ts`, `features/eigenschutz/ui/organisms/VorfallReportDrawer.tsx`, `features/eigenschutz/ui/organisms/IncidentContextSnapshot.tsx`, `features/eigenschutz/ui/pages/VorfaellePage.tsx` |
| **G. Ampel-Dashboard (FR38–FR40)**        | `application/eigenschutz/queries/get-eigenschutz-ampel-status/`, `application/eigenschutz/event-handlers/update-ampel-projection.handler.ts`, `infrastructure/eigenschutz/projections/ampel-projection.updater.ts`, `modules/eigenschutz/controllers/eigenschutz-ampel.controller.ts`, `features/eigenschutz/ui/organisms/AmpelDashboard.tsx`, `features/eigenschutz/ui/molecules/AmpelCard.tsx`                                                                                                                                                                                                |
| **H. Versionierung & Audit (FR41–FR43)**  | Version-Tabellen in `prisma/schema.prisma`, `application/eigenschutz/queries/get-entity-version-history/`, `features/eigenschutz/ui/molecules/VersionTimestampFooter.tsx`, `features/eigenschutz/ui/organisms/RiskEvaluationDiff.tsx`                                                                                                                                                                                                                                                                                                                                                           |
| **I. Rollen & Rechte (FR44–FR47)**        | `prisma/schema.prisma` (Enum + Feldzusatz an `EinsatzRollenbesetzung`), `modules/eigenschutz/guards/eigenschutz-rolle.guard.ts`, `modules/eigenschutz/decorators/requires-eigenschutz-rolle.decorator.ts`, Plattform: `modules/auth/guards/einsatz-scope.guard.ts`                                                                                                                                                                                                                                                                                                                              |
| **J. Offline & Sync (FR48–FR50)**         | Kein Feature-Code (Platform-Storage-Adapter, ADR-010), aber `features/eigenschutz/api/mutations.ts` nutzt Optimistic-Updates; `infrastructure/eigenschutz/conflict/sync-conflict.service.ts`, `application/eigenschutz/commands/resolve-konflikt/`, `features/eigenschutz/ui/organisms/ConflictResolutionList.tsx`, `features/eigenschutz/ui/pages/SyncConflictsPage.tsx`                                                                                                                                                                                                                       |
| **K. Plattform-Integration (FR51–FR54)**  | Routen (Backend + Frontend, wie oben), `features/eigenschutz/ui/organisms/SecurityPostMapMarker.tsx`, FK `gefahrenzoneId` in Schema                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **NFR-P (Performance)**                   | `ampel-projection.updater.ts` (≤ 1 s), `eigenschutz-vorfall-pdf.renderer.ts` (≤ 5 s), Feature-Chunking in `routes/.../eigenschutz/*` (Bundle ≤ 150 kB)                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **NFR-S (Security)**                      | Guard-Kette, Audit via Outbox, `infrastructure/eigenschutz/export/*` respektiert Permissions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **NFR-A (Accessibility)**                 | `SeverityBanner.tsx` (`role="alert"`, `focus-ring-critical`), `RiskMatrix5x5.tsx` (`role="grid"`), axe-Tests in jedem `__tests__/`                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **UX-MVP Web-Push + Tauri**               | `infrastructure/push-notifications/web-push.service.ts` (Spillover), `application/eigenschutz/event-handlers/emit-critical-push.handler.ts`, `public/sw.js`, `shared/ui/push-subscription-manager/useCriticalNotification.ts`                                                                                                                                                                                                                                                                                                                                                                   |
| **UX-MVP Keyboard-Shortcuts**             | `features/eigenschutz/constants/shortcuts.constants.ts`, `features/eigenschutz/hooks/useEigenschutzShortcuts.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **UX-MVP Telemetrie CBRN-Moment**         | `features/eigenschutz/hooks/useEigenschutzTelemetry.ts`, `modules/eigenschutz/controllers/eigenschutz-telemetry.controller.ts`, `infrastructure/eigenschutz/telemetry/*`                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **UX-MVP Dashboard-View-Toggle**          | `features/eigenschutz/stores/eigenschutz-dashboard-view.store.ts`, `AmpelDashboard.tsx` mit Direction B/C                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **UX-MVP Deep-Links**                     | `routes/_app/einsatz/$einsatzId/sicherheit/eigenschutz/{gefaehrdungen,vorfaelle}.$id.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Integration Points

**Intern (innerhalb des Monorepos):**

- **Frontend ↔ Backend:** ausschließlich über generierten Client
  (`packages/shared/client/`) + TanStack Query. WebSocket-Subscriptions
  über bestehenden `socket.io-client`-Wrapper.
- **Frontend ↔ Shared Schemas:** `packages/shared/schemas/eigenschutz/*`
  wird in Forms importiert; Backend-DTOs nutzen dasselbe.
- **Application ↔ Infrastructure:** ausschließlich via DI-Tokens aus
  `infrastructure/eigenschutz/di-tokens.eigenschutz.ts`.
- **Cross-Modul Backend:** nur Events und DB-FKs; keine
  Service-zu-Service-Aufrufe.

**Extern (außerhalb des Monorepos):**

- **Gefahren-Modul:** nur Datenbank-FK `gefahrenzoneId` — Phase 2 wird
  darauf ein Backend-Join aufgesetzt (`gefahrenzone`-Service als Port
  injiziert).
- **Plattform-Push-Service:** ein Port/Interface, Plattform-Feature
  implementiert.
- **Unfallkassen:** im MVP nur Download durch Nutzer
  (Browser-Download-Flow); kein automatischer API-Upload. Phase 2 FR37
  führt ggf. Outbound-Adapter ein.

**Datenfluss (Signatur-Interaktion CBRN):**

```
Frontend (PsaChangeDrawer)
  ↳ useChangePsaProfil (mutation) — Optimistic-Update
      ↳ POST /api/einsaetze/:id/sicherheit/eigenschutz/psa-profile/bulk-aendern
          ↳ PsaProfilController (Guard-Kette)
              ↳ ChangePsaProfilHandler (TransactionalCommandHandler)
                  ↳ Repositories: PsaProfilZuweisung + Outbox (atomisch)
                     → EVENT: PsaProfilGeaendert (1 pro Einheit)
  ↳ Outbox-Publisher (async)
      ↳ WS-Gateway → Room `einsatz:{id}` → Client-Cache-Update
      ↳ EmitCriticalPushHandler → Plattform-Push-Service → Tauri + Web-Push
      ↳ UpdateAmpelProjectionHandler → AmpelProjection-Tabelle
      ↳ StartQuittungUeberwachungHandler → Scheduler-Entry
```

### File Organization Patterns (verbindlich)

- **Eine Domain-Verantwortung = ein Ordner.** `commands/create-*/` enthält
  genau `*.command.ts` + `*.handler.ts`.
- **Co-located Tests:** jeweils `__tests__/` auf derselben Ebene.
- **Public API je Ordner:** optional `index.ts` mit Re-Exports; intern
  direkt importieren.
- **Keine orphaned Files:** Jede Datei hängt entweder an einer FR/NFR oder
  an einer Plattform-Voraussetzung.

### Development Workflow Integration

**Startup-Reihenfolge:**

1. `pnpm install`
2. `pnpm --filter @bluelight-hub/backend prisma:migrate --name add_eigenschutz_module`
3. `pnpm --filter @bluelight-hub/backend prisma:seed`
4. `pnpm run generate-api`
5. `pnpm -r dev`

**Build:**

- Backend: `nest build` erzeugt `dist/`, Migrations ausgeschlossen.
- Frontend: `vite build` produziert Route-Code-Splitting —
  Eigenschutz-Route eigene Chunks.
- Tauri: `tauri build` bündelt Frontend-Build in Desktop-Shell.

**Deployment:**

- Keine Eigenschutz-spezifischen Deploy-Schritte.
- Migrations laufen in CI/CD über `prisma:deploy`.
- Service-Worker-Deploy (`public/sw.js`) ist Plattform-Feature,
  Versionierungs-Strategie folgt dem Push-Notifications-Setup.

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:**

| Entscheidungs-Paar                                                   | Kompatibilität                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| B1 (State + Version-Chain) ↔ B2 (Hybrid Snapshot)                    | ✅ FK auf `*_version`-Tabelle belegt Traceability, JSONB bleibt self-contained              |
| B1 ↔ B6 (Optimistic Concurrency)                                     | ✅ `version`-Feld ist Single Source of Truth für Konflikt-Erkennung                         |
| B3 (Temporale PSA-Join-Tabelle) ↔ B5 (Propagation)                   | ✅ `propagationGroupId` gruppiert Multi-Select-Änderungen atomar                            |
| B4 (Ampel-Projection) ↔ B13 (Event-Katalog)                          | ✅ Alle relevanten Events sind Projection-Trigger                                           |
| B5 ↔ B7 (Web-Push)                                                   | ✅ Event-Bridge via `EmitCriticalPushHandler` — keine doppelten Alerts (WS-Connected-Check) |
| B9 (Prometheus-Telemetrie) ↔ Plattform `@willsoto/nestjs-prometheus` | ✅ keine neue Dependency                                                                    |
| B10 (Guard-Kette) ↔ F2 (`EinsatzScopeGuard`)                         | ⚠️ hängt an F2-Story (Spillover)                                                            |
| B11 (Export) ↔ B2 (Snapshot)                                         | ✅ Export arbeitet nur auf `kontextSnapshot`, keine Live-Joins                              |

Keine widersprüchlichen Entscheidungen gefunden.

**Pattern Consistency:**

- Naming: deutsche PascalCase-Models + camelCase-Felder durchgängig
  (verifiziert gegen bestehende Prisma-Schemas wie `Einsatz`,
  `EtbEintragHistorie`, `OutboxEvent`).
- Command-Pattern: `TransactionalCommandHandler`-Pattern wird in allen
  14 Commands durchgehalten (Step 4 §B13, Step 6 directory tree).
- Event-Pattern: 4-Stellen-Registrierung ist in Step 6 als
  Prüfkriterium verankert.
- Frontend-Feature-Slice: `features/eigenschutz/` folgt exakt dem
  bestehenden Muster `features/einsatz/`.

**Structure Alignment:**

- Hexagonale Abhängigkeits-Richtung gewahrt: `domain` → nichts,
  `application` → `domain`, `infrastructure` → `application` + `domain`,
  `modules` → `application`.
- Keine Cross-Modul-Imports vorgesehen — Kommunikation via Events/FKs/
  Shared-Schemas.
- `packages/shared/schemas/eigenschutz/` als einzige geteilte Vertrags-
  Zone zwischen Backend und Frontend.

### Requirements Coverage Validation

**FR-Abdeckung (MVP):**

| FR            | Abgedeckt durch                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| FR1–FR6       | Aggregate `Gefaehrdungsbeurteilung` + `GefaehrdungsbeurteilungVersion`; `RiskMatrix5x5.tsx`; Vorlagen-Seed                           |
| FR7, FR8, FR9 | Phase 2/3, Schema Phase-2-ready (Vorlage-Modell existiert)                                                                           |
| FR10–FR14     | Aggregate `PsaProfilZuweisung` (temporale Tabelle, additiv), `PsaChangeDrawer`, `change-psa-profil.handler.ts`, `propagationGroupId` |
| FR15, FR16    | Phase 2 — markiert                                                                                                                   |
| FR17          | `EmitCriticalPushHandler` + `SeverityBanner` mit `role="alert"` + Tauri-Plugin-Notification                                          |
| FR18, FR19    | `AckPsaQuittungCommand` + `PsaProfilQuittung`-Tabelle + `AcknowledgmentStatusBadge`                                                  |
| FR20          | `MeldeLueckeCommand` + `LueckeGemeldet`-Event                                                                                        |
| FR21, FR22    | FR22 in MVP gehoben (UX-Spec), via `PushNotificationsService` + `plugin-notification` + `sw.js`; FR21 bleibt Phase 2                 |
| FR23–FR25     | Aggregate `Sicherheitsregel` + `SicherheitsregelQuittung` + Drawer-UI                                                                |
| FR26          | Phase 2 — Schema Phase-2-ready (analoge Vorlagen-Tabelle möglich)                                                                    |
| FR27–FR29     | Aggregate `Sicherungsposten` + `SicherungspostenPanel` + `SecurityPostMapMarker`                                                     |
| FR30          | Phase 2                                                                                                                              |
| FR31–FR36     | Aggregate `EigenschutzVorfall` + `kontextSnapshot` (Innovations-Anker) + PDF/JSON-Export + Filter-Query                              |
| FR37          | Phase 2                                                                                                                              |
| FR38–FR40     | `AmpelProjection`-Tabelle + `update-ampel-projection.handler.ts` + `AmpelDashboard`                                                  |
| FR41–FR43     | Version-Tabellen pro Aggregat + `get-entity-version-history`-Query + `VersionTimestampFooter` + `RiskEvaluationDiff`                 |
| FR44–FR47     | `EigenschutzRolle`-Enum + Guard-Kette + Permission-Inventar                                                                          |
| FR48          | Platform-Storage-Adapter (ADR-010); offline kein Feature-Code                                                                        |
| FR49          | Optimistic-Updates + Replay bei Sync                                                                                                 |
| FR50          | `SyncConflict`-Tabelle + `ConflictResolutionList` + `ResolveKonfliktCommand`                                                         |
| FR51          | `einsatzId` FK in allen Eigenschutz-Tabellen + Einsatz-Routen-Nesting                                                                |
| FR52          | TanStack-Router-Pfad + Navigations-Integration                                                                                       |
| FR53          | `EmitCriticalPushHandler` als Bridge zum Plattform-Kanal                                                                             |
| FR54          | Optionaler FK `gefahrenzoneId`                                                                                                       |

**Nicht-Funktionale Abdeckung:**

| NFR                             | Abgedeckt durch                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------- |
| NFR-P1 (TTI ≤ 2 s)              | Vite-Route-Code-Splitting                                                        |
| NFR-P2 (Propagation ≤ 2 s)      | Outbox + WS-Gateway (ADR-006)                                                    |
| NFR-P3 (Speicher ≤ 1 s)         | Prisma-Transaction; kein N+1                                                     |
| NFR-P4 (Ampel ≤ 1 s)            | `AmpelProjection` (materialisiert)                                               |
| NFR-P5 (PDF ≤ 5 s)              | Bestehender `pdf-export.service` + selbst-enthaltender Snapshot                  |
| NFR-P6 (Sync ≤ 5 s)             | ADR-010                                                                          |
| NFR-P7 (Bundle ≤ 150 kB)        | Feature-Chunking + tree-shakable Atoms                                           |
| NFR-S1–S3                       | Plattform-Defaults                                                               |
| NFR-S4 (Append-only Audit)      | Version-Tabellen + Outbox — keine UPDATE/DELETE auf Historie                     |
| NFR-S5 (Löschkonzept)           | Retention an Einsatz-Lifetime; `EigenschutzTelemetryEvent` dokumentiert gebunden |
| NFR-S6 (Exporte rechte-konform) | `eigenschutz:vorfall:export`-Guard                                               |
| NFR-S7 (Security-Log)           | Plattform-Standard (fehlgeschlagene Autz.)                                       |
| NFR-R1                          | Plattform-SLO                                                                    |
| NFR-R2                          | ADR-010 + Offline-First                                                          |
| NFR-R3                          | At-least-once + `eventId`-LRU-Dedup am Client                                    |
| NFR-R4                          | Version-Chain ermöglicht Rollback auf definierten Stand                          |
| NFR-A1–A7                       | UX-Spec-Patterns, Komponenten-Level-Pflicht, axe-Tests                           |
| NFR-I1–I5                       | Alle 5 Integrations-NFRs explizit adressiert                                     |
| NFR-C1 (Scale)                  | `AmpelProjection` + Indexe                                                       |
| NFR-C2 (Historie-Wachstum)      | Projection entkoppelt von Version-Tabellen-Größe                                 |
| NFR-C3 (Konflikt-UI skaliert)   | `ConflictResolutionList` statt Modal-Stack                                       |
| NFR-M1–M5                       | CI-Gates + benannte Migration                                                    |

**Review-Entscheidungen (Q1–Q8):** Alle 8 Review-Entscheidungen sind in
Architektur und Schema verankert (siehe §A des Entscheidungs-Blocks).

**UX-Spec-Abweichungen (bindend):**

| Abweichung                     | Status                               |
| ------------------------------ | ------------------------------------ |
| FR22 Push-Notifications → MVP  | ✅ B7                                |
| `ConflictResolutionList` → MVP | ✅ B6 + Frontend-Organism            |
| Keyboard-Shortcuts → MVP       | ✅ Hooks + Constants                 |
| Deep-Links pro Entität         | ✅ Route-Dateien                     |
| Senior-Operator-Testing (50+)  | Plan-Artefakt, kein Architektur-Item |

### Implementation Readiness Validation

**Decision Completeness:** ✅

- Alle kritischen Entscheidungen (B1–B13) dokumentiert mit Rationale und
  Alternativen-Diskussion.
- Plattform-Voraussetzungen (F1 Push-Notifications, F2
  `EinsatzScopeGuard`) explizit als Spillover markiert und als eigene
  ADR-Kandidaten benannt.
- Deferred Decisions (FR7, FR15, FR21, FR30, FR37, Spezialschutz-/Sonderlagen-Workflows)
  explizit scope-out.

**Structure Completeness:** ✅

- Vollständiger Directory-Tree (Backend + Frontend + Shared Schemas)
  mit konkreten Datei-Namen.
- Prisma-Schema-Additions komplett ausgeschrieben (11 Models, 8 Enums).
- FR-zu-Datei-Mapping für alle 11 Capability-Gruppen + NFR-Kategorien +
  UX-MVP-Features.

**Pattern Completeness:** ✅

- Naming für Models, Enums, Dateien, Ordner, Endpoints, Frontend-Routen,
  Events, Commands, Queries, Hooks festgelegt.
- 17 Anti-Patterns explizit gelistet (Step 5 §N).
- Review-Checkliste mit 6 MVP-Pflicht-Prüfpunkten (Step 5 §M).

### Gap Analysis

**Wichtige Gaps (Entscheidungen vorweggenommen, keine Blocker):**

- **G1 Konflikt-Erkennungs-Flow.** `409 ConflictDetected`-Response enthält
  `context.conflictId`. Server erzeugt in derselben Transaktion wie der
  rejected Command eine `SyncConflict`-Zeile + `KonfliktErkannt`-Event.
  Client navigiert bei 409 direkt auf `SyncConflictsPage` mit der
  `conflictId` — **kein Auto-Retry**.

- **G2 `Sicherheitsregel.einheitId = null` Fanout-Semantik.** Regeln ohne
  `einheitId` gelten einsatz-weit. Quittungs-Pflicht gilt pro aktiv
  besetzter `EinsatzEinheit` (Führungs-Ebene). Der
  `UpdateAmpelProjectionHandler` liest bei `SicherheitsregelAusgerufen`
  mit `einheitId=null` die aktiven Einheiten und markiert jede als
  quittungs-pflichtig.

- **G3 `BASIS`-PSA-Profil als Default.** Neu angelegte `EinsatzEinheit`
  erhält automatisch `BASIS` aktiv. **Plattform-Event existiert** —
  `EinheitErstellt` (`domain/kraefte/events/einheit-erstellt.event.ts`
  verifiziert im Repo). Eigenschutz registriert einen Event-Handler
  `create-basis-psa-on-einheit-erstellt.handler.ts` in
  `application/eigenschutz/event-handlers/`, der bei jedem
  `EinheitErstellt`-Event eine `PsaProfilZuweisung` mit `BASIS` anlegt.
  **Kein Spillover nötig.**

- **G4 Vorlagen-Seed-Idempotenz.** Seed-Skript nutzt `upsert` nur auf
  neuen `slug`-Werten; bestehende Slugs werden nicht überschrieben.
  `aktiv`-Flag-Änderungen laufen über manuelle Migrationen.

**Nice-to-Have Gaps (Implementation-Detail oder Phase 2):**

- **N1** Telemetrie-Batch-Format: Flush alle 10 s oder bei 50 Events
  (Implementation-Detail).
- **N2** Konflikt-Bulk-Resolution: MVP-UI löst einzeln; Bulk-Apply Phase 2.
- **N3** Push-Content-Internationalisierung: Deutsch hardcoded im MVP.
- **N4** Event-Handler-Fehler-Isolation: Plattform-Konvention
  (Outbox-`FAILED`-Status mit Retry).

**Keine Critical Gaps.**

### Risk Analysis (Architektur-Sicht)

- **R1 Spillover-Risiko.** F1 (Push-Notifications) und F2
  (`EinsatzScopeGuard`) sind Plattform-Arbeit, die bisher nicht existiert.
  Verzögerung erfordert temporäre Inline-Checks. **Mitigation:** beide
  Spillover als eigene Stories früh einplanen, parallel zum Domain-Modell;
  Inline-Fallback nur als letzte Option.

- **R2 Outbox-Backpressure bei CBRN-Propagation.** Bulk-Änderungen an 8+
  Einheiten parallel erzeugen 8+ Events. Outbox-Publisher verarbeitet
  sequentiell — NFR-P2 ≤ 2 s kann gefährdet sein. **Mitigation:**
  Outbox-Publisher benchmarken vor Integrations-Test; ggf. Batching pro
  `propagationGroupId`.

- **R3 `AmpelProjection`-Drift bei Event-Verlust.** Event-Handler-Fehler
  kann Dashboard-Status driften lassen. **Mitigation:** Rebuild-Befehl
  (`RebuildAmpelProjectionCommand`) — nachgelagert in Phase 2, MVP
  akzeptiert manuelle Wartung via Admin-Tooling.

- **R4 Snapshot-Schema-Evolution.** `EigenschutzKontextSnapshotV1`
  unveränderlich gespeichert. Schema-Änderung erfordert V2-Variante +
  Migrations-Strategie. **Mitigation:** `schemaVersion`-Feld ist
  eingebaut und wird beim Rendern strikt geprüft.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Projekt-Kontext analysiert (PRD + UX-Spec)
- [x] Scale & Complexity bewertet (high, brownfield)
- [x] Technische Constraints identifiziert (Plattform-Stack, ADRs)
- [x] Cross-Cutting Concerns gemappt (10 identifiziert)

**✅ Architektur-Entscheidungen**

- [x] Alle kritischen Entscheidungen (B1–B13) mit Begründung dokumentiert
- [x] Tech-Stack-Versionen verifiziert (aus Repo-`package.json`)
- [x] Integrations-Patterns definiert (Outbox, WS, Push)
- [x] Performance-Überlegungen adressiert (Projection, Route-Splitting)

**✅ Implementation Patterns**

- [x] Naming-Konventionen etabliert (gegen bestehendes Repo abgeglichen)
- [x] Structure-Patterns definiert (Feature-Slices beider Seiten)
- [x] Communication-Patterns spezifiziert (Events, WS, Query-Keys)
- [x] Process-Patterns dokumentiert (Error-Handling, Loading, Konflikt)

**✅ Project Structure**

- [x] Vollständiger Directory-Tree (Backend + Frontend + Shared)
- [x] Component Boundaries etabliert (Feature-Slice, Cross-Modul-Verbote)
- [x] Integration Points gemappt (intern + extern)
- [x] Requirements-zu-Struktur-Mapping vollständig

**✅ Validation**

- [x] 54 MVP-FRs + alle NFRs gegen Architektur abgeglichen
- [x] Keine Critical Gaps
- [x] 4 Important Gaps mit Entscheidungsvorschlag dokumentiert
- [x] 4 Architektur-Risiken mit Mitigation benannt

### Architecture Readiness Assessment

**Overall Status:** ✅ **READY FOR IMPLEMENTATION** (nach Klärung der
Plattform-Voraussetzungen F1/F2 — parallel machbar).

**Confidence Level:** **High.**

- Die Architektur fußt vollständig auf bestehenden Plattform-Mustern
  (hexagonal, Outbox, ADR-010, ADR-006, AC1/AC7) — keine unerprobten
  Strukturen.
- Alle MVP-FRs und NFRs sind auf konkrete Strukturelemente abgebildet.
- Die Signatur-Interaktion (CBRN-PSA-Hochstufung) ist durchgängig von
  UI bis DB nachvollziehbar (Datenfluss in Step 6).
- Gaps sind mit Entscheidungen adressiert, nicht offen.

**Key Strengths:**

- Zeitpunkt-Snapshot (B2) realisiert den Innovations-Anker rechtssicher.
- `AmpelProjection` (B4) löst NFR-P4/C2 ohne Ad-hoc-Queries.
- Temporale PSA-Zuweisung (B3) passt natürlich zum additiven Modell (Q2).
- Explizite Spillover-Markierung (F1/F2) verhindert Scope-Creep.
- Event-getriebene Cross-Modul-Integration hält Eigenschutz von
  Nachbar-Modulen entkoppelt.

**Areas for Future Enhancement (Phase 2+):**

- Vorlagen-Versionierungs-UI mit Benachrichtigung (FR7, FR26).
- Automatische PSA-Empfehlung aus Gefahren-Modul-Daten (FR15).
- Landesunfallkassen-spezifische Export-Formate (FR37).
- Weitergehende Spezialschutz-/Sonderlagen-Workflows in separatem Folge-PRD.
- `RebuildAmpelProjectionCommand` für Projection-Recovery.
- Bulk-Konflikt-Resolution-UX.

### Implementation Handoff

**AI-Agent-Richtlinien:**

- Architektur-Entscheidungen (B1–B13) sind **bindend**; Abweichungen
  verlangen explizite Rücksprache.
- Implementation-Patterns aus dem Patterns-Kapitel sind **verpflichtend**
  an allen Files.
- Projekt-Struktur wird **nicht** umorganisiert.
- Bei Unklarheiten: zuerst dieses Dokument, dann `CLAUDE.md` + ADRs.

**First Implementation Priorities (Vorschlag):**

1. Plattform-Voraussetzungen (F1, F2) als Stories anlegen — parallel zu 2.
2. `add_eigenschutz_module`-Prisma-Migration mit vollem Schema aus
   Step 6 + Enum-Additions (ohne `EigenschutzRolle`-Enum — siehe Revision).
3. Seed-Migration: 5 Vorlagen + 4 `RollenDefinition`-Records für Eigenschutz-Rollen.
4. Domain-Layer (Aggregates + Value-Objects + Events + Repository-Ports).
5. Event-Handler `create-basis-psa-on-einheit-erstellt.handler.ts` für
   BASIS-Default (G3).
6. `ChangePsaProfilHandler` als erster Command (Signatur-Interaktion).
7. `AmpelProjection`-Updater + Query.
8. Frontend-Route-Skeleton + `AmpelDashboard` mit Mock-Daten.
9. Durchstich CBRN-Signatur-Interaktion End-to-End.
10. Restliche Capability-Gruppen (Gefährdungsbeurteilung, Sicherheitsregeln,
    Sicherungsposten, Vorfallmeldung + Export) in beliebiger Reihenfolge.
11. Konflikt-UX-Flow + `ConflictResolutionList`.
12. Telemetrie-Endpoint + Prometheus-Aggregation.
13. E2E-Tests für Journey 1b und Journey 4.

### Revisionen nach Architektur-Review

Nach einem Review wurden fünf Korrekturen inline eingearbeitet. Diese
Liste dokumentiert sie konsolidiert:

| #   | Thema                           | Alte Fassung                                                                                      | Revidierte Fassung                                                                                                                                                                 | Ort                                                                                 |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| R1  | Vorfall-FK auf Versions-Tabelle | `EigenschutzVorfall.gefBeurteilungVersionId` zeigte fehlerhaft auf `Gefaehrdungsbeurteilung.id`   | FK auf `GefaehrdungsbeurteilungVersion.id`; Relation-Namen korrigiert                                                                                                              | §B2, Prisma-Schema §Project Structure, §B1 Version-Tabelle                          |
| R2  | Rollen-Modell                   | Neuer `EigenschutzRolle`-Prisma-Enum + Zusatzspalte `EinsatzRollenbesetzung.eigenschutzRolle`     | `RollenDefinition`-Seeds mit Präfix `Eigenschutz: `; kein Prisma-Enum; kein Schema-Change an Plattform-Tabelle; TS-Union-Type im Domain-Code bleibt für Decorator-Typsicherheit    | §B10 Revidiert, §A Prisma-Enums-Hinweis, Naming-Section, Prisma-Spillover-Kommentar |
| R3  | BASIS-PSA-Default               | G3 parkierte den Mechanismus als unklares Detail                                                  | `EinheitErstellt`-Event existiert bereits (`domain/kraefte/events/einheit-erstellt.event.ts`); Eigenschutz registriert Handler, kein Spillover                                     | §Gap Analysis G3                                                                    |
| R4  | Array-FKs im Vorfall            | `sicherheitsregelVersionIds: String[]` + `psaProfilZuweisungIds: String[]` als pseudo-FKs ohne RI | Felder entfernt. `kontextSnapshot` ist authoritative Quelle für historische Versions-IDs; einzige FK bleibt `gefBeurteilungVersionId` (Traceability-Anchor in die Version-Tabelle) | §B2, Prisma-Schema, §F Snapshot-Patterns                                            |
| R5  | Push-Dedup                      | Server-seitiger WS-Connection-Check (brauchte Shared-State in Multi-Instance)                     | Keine Server-Dedup; Client dedupt via `eventId`-LRU (bestand bereits aus B5/NFR-R3); Push-Payload trägt `eventId` verpflichtend                                                    | §B7                                                                                 |

**Impact auf Frontmatter / Done-Kriterien:** Keine Auswirkung — MVP-Scope
und Funktions-Deckung unverändert. Die Architektur ist durch die
Revisionen schlanker (kein Schema-Change an Plattform, weniger
FK-Rauschen im Schema) und robuster (keine dangling Array-FKs, keine
Shared-State-Abhängigkeit im Push-Service).

## Workflow-Abschluss

**Status:** ✅ Architektur-Workflow abgeschlossen (2026-04-21).

Alle 8 Schritte des BMad `create-architecture`-Workflows wurden durchlaufen:

1. **Init** — Input-Dokumente (PRD, UX-Spec, 10 Projekt-Docs, 7 ADRs, Principles) gesichtet und geladen.
2. **Project Context Analysis** — 54 MVP-FRs + 7 NFR-Kategorien + 10 Cross-Cutting Concerns analysiert.
3. **Starter Template / Brownfield Baseline** — Bestehender Stack als gewählte Baseline dokumentiert; Dependency-Bedarf verifiziert (nur `web-push` neu).
4. **Core Architectural Decisions** — 13 Eigenschutz-Entscheidungen (B1–B13) + 2 Plattform-Spillover (F1, F2).
5. **Implementation Patterns** — Naming, Structure, API, Events, Versioning, Snapshots, Forms, Guards, State, Logging, Migrations, Anti-Patterns.
6. **Project Structure** — Prisma-Schema, vollständige Directory-Trees, FR-zu-Datei-Mapping, Integration Points.
7. **Validation** — Coherence, Coverage, Readiness; 4 Important Gaps adressiert, 4 Risks mit Mitigation; 5 Revisionen nach Architektur-Review eingearbeitet.
8. **Complete** — Handoff an Implementierung.

### Dokument-Artefakt

`_bmad-output/planning-artifacts/architecture.md` — vollständig, selbstständig lesbar, als Referenz für AI-Agent-Implementierung geeignet.

### Implementation-Handoff-Kurzanleitung

**Vor Code-Arbeit:**

1. **Plattform-Voraussetzungen als Stories anlegen** — F1 Web-Push + F2 `EinsatzScopeGuard` (je eigene ADR-Kandidaten: ADR-011, ADR-012).
2. **Story-Breakdown** aus PRD/Epic-Breakdown gegen die FR-zu-Datei-Mapping-Tabelle abgleichen.

**Erste Implementation-Story:**

- `add_eigenschutz_module`-Prisma-Migration: 11 Models + 7 Enums (ohne `EigenschutzRolle`-Enum) + Seed-Skript für Vorlagen und `RollenDefinition`-Records.

**Gate vor Feature-Start:**

- F1 und F2 als Voraussetzungen erfüllt oder explizite Interims-Inline-Lösung beschlossen.

**CBRN-Durchstich als Integrations-Meilenstein:**

- Signatur-Interaktion (PSA-Hochstufung mit Bekanntgabe + Quittung) End-to-End lauffähig, Telemetrie misst `assess_started` → `all_banners_delivered`, E2E-Test validiert ≤ 90 s unter typischer Last.

### Offene Folge-Artefakte (nicht Teil dieses Workflows)

- **Epic & Story-Breakdown** — empfohlen: `bmad-create-epics-and-stories`.
- **ADR-011 Plattform-Push-Notifications** — Dependency-Entscheidung dokumentieren.
- **ADR-012 `EinsatzScopeGuard`** — Plattform-Pattern festlegen.
- **Retrospektive Update** — sobald Pilot-Einsatz durchgelaufen ist, Lessons Learned für Phase 2.
