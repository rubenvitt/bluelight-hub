# ADR-018: Patient-Aggregat-Schema und Domain-Events

## Status

Akzeptiert (2026-05-22) — verankert das Patient-Aggregat (Issue #417, Epic 1 „Patienten-Dashboard im Einsatz") nach Abschluss der Stories 1.1–1.8. Diese ADR konsolidiert die in den Sub-Stories getroffenen Entscheidungen und macht sie für Folge-Epics (2: Capture/Attach, 3: WebSocket-Sync) verbindlich.

## Kontext

Issue #417 etabliert die Patienten-Domäne als zentrales Modul im Sanitätsdienst-/Katastrophenschutz-Kontext für weiße Hilfsorganisationen (DRK, JUH, MHD, ASB, DLRG). Der Pilot-Setting ist der Behandlungsplatz (BHP) im MANV: dort werden Patienten gesichtet (SK_I/II/III/IV/TOT nach SiKoKo/DIN 13050), behandelt und transportiert. Das System unterstützt LNA, OrgL und Schichtablöser bei der lückenlosen Übersicht.

Aus diesem Use-Case ergeben sich harte Rahmenbedingungen, die das Aggregat-Schema und die Event-Modellierung tragen müssen:

- **Append-only / Audit-Pflicht (NFR-S5):** DIN-13050-konforme Dokumentation, 10-Jahre-Aufbewahrung. Jeder Status-Wechsel ist ein eigenes Event, kein In-Place-Update.
- **ETB-Verzahnung (ADR-005):** Jeder Patienten-Vorgang wird mit `kontextType='patient'` als ETB-Eintrag persistiert — innerhalb derselben Prisma-Transaktion wie das `PatientEvent`.
- **MDR-Grenze (ADR-015):** Das System persistiert ausschließlich Beobachtungen und LNA/Voraussichter-Entscheidungen — keine algorithmischen Triage-Empfehlungen, keine Score-Berechnungen. Snapshot-Felder reflektieren ausschließlich menschliche Setzungen.
- **Read-Performance (NFR-P1/P2):** KPI-Queries (Story 1.5, KpiStrip, ≤ 100 ms) und Listen-Queries (Story 1.6, virtualisierte Tabelle, 1000+ Items) benötigen denormalisierte Snapshot-Felder. Reine Event-Replay-Aggregation skaliert nicht für den 250-Patient-MANV-Fall.
- **Multi-Device-Konsistenz (Epic 3):** Mehrere Tablets im selben Einsatz müssen Patienten-State synchron halten. Outbox-Pattern + `eventVersion` als Optimistic-Lock + WebSocket-Push sind die Plattform-Mechanik (ADR-006).
- **Korrektur-Workflow (FR42, Story 1.4 + 1.7):** Falsche Sichtungs-/Status-/Notiz-Einträge müssen rückwirkend korrigierbar sein, ohne den Original-Event-Stream zu zerstören. Korrektur ist ein eigenes Event mit `vorher`/`neu`/`grund`.

### Bestehende Plattform-Bausteine

| Komponente | Status | Nutzung im Patient-Aggregat |
|---|---|---|
| Hexagonale Architektur (domain → application → infrastructure → modules) | Etabliert | Layer-Disziplin per `madge` + `oxlint` erzwungen |
| `Result<T>`-Pattern | Etabliert (`domain/common/result.ts`) | Patient-Aggregat-Methoden returnen `Result`, keine Exceptions |
| `AggregateRoot<TId>` + `EntityId` | Etabliert (`domain/common/`) | `PatientId extends EntityId<'Patient'>` |
| Outbox + 4-Punkt-Registry (ADR-006) | Etabliert | Patient-Events durchlaufen die Plattform-Pipeline |
| ETB-Discriminated-Union (ADR-005) | Etabliert | `kontextType='patient'` + `PatientEtbContextSchema` |
| `EinsatzScopeGuard` (ADR-012) | Etabliert | Alle Patient-Endpoints einsatz-scoped |
| `TransactionalCommandHandler` | Etabliert (`application/common/handlers/`) | Aggregat + Event + ETB in derselben Tx |
| `@paralleldrive/cuid2` | Etabliert | Patient-IDs als CUIDs |
| Zod 4.4 + `class-validator` | Etabliert | DTO-Validation, Schema-Übereinstimmung FE/BE |

## Entscheidung

Wir etablieren **Patient als Aggregate Root** mit Value Objects, denormalisiertem Read-Snapshot in der Patient-Tabelle und einem append-only `PatientEvent`-Stream. Acht Domain-Events decken alle Patient-Lebenszyklus-Übergänge ab. Alle Events durchlaufen den **4-Punkt-Registry-Vertrag** (AR20).

### Aggregat-Schema (Domain-Layer)

Ort: `packages/backend/src/domain/patienten/`

```
domain/patienten/
├── aggregates/
│   └── patient.aggregate.ts         ← AggregateRoot<PatientId>
├── value-objects/
│   ├── patientennummer.vo.ts        ← Pflicht, einsatz-eindeutige Sequenz "P-001"
│   ├── divi-vak-nummer.vo.ts        ← Optional, DIVI-konform
│   ├── sichtung.vo.ts               ← Sichtung + SichterRef + SichtungArt
│   ├── sichtungskategorie.vo.ts     ← SK_I/SK_II/SK_III/SK_IV/TOT (SkCode)
│   ├── behandlungsstatus.vo.ts      ← UNVERSORGT/IN_BEHANDLUNG/VERSORGT/TRANSPORTBEREIT
│   ├── transportstatus.vo.ts        ← WARTEND/IM_TRANSPORT/IM_KRANKENHAUS
│   └── erfasser-ref.vo.ts           ← discriminated union { user | device | session }
├── events/
│   ├── patient-domain-event.ts      ← Basis-Event-Klasse
│   ├── patient-erfasst.event.ts
│   ├── patient-gesichtet.event.ts
│   ├── patient-sichtung-aktualisiert.event.ts
│   ├── patient-behandlung-begonnen.event.ts
│   ├── patient-behandlung-abgeschlossen.event.ts
│   ├── patient-transport-gestartet.event.ts
│   ├── patient-transport-abgeschlossen.event.ts
│   └── patient-korrigiert.event.ts
├── repositories/
│   └── patient.repository.ts        ← Port (Interface)
└── schemas/
    └── etb-context.schema.ts        ← PatientEtbContextSchema (Discriminated Union)
```

### Value Objects

| VO | Pflicht | Inhalt | Regel |
|---|---|---|---|
| `Patientennummer` | ✔ | String `"P-001"` ff. | Einsatz-eindeutige Sequenz, monoton steigend |
| `DiviVakNummer` | optional | DIVI-VAK-konformer Code | DIVI-Validierung; `null` zulässig |
| `Sichtung` | optional bis Erst-Sichtung | `{ sk, sichtungArt, sichter }` | `sichtungArt: 'voraussichtung' \| 'ärztlich'` |
| `Sichtungskategorie` | embedded | `SkCode` | Werte aus `SK_CODES` |
| `Behandlungsstatus` | embedded | `BehandlungsstatusCode` | Übergangs-Validierung im Aggregat |
| `Transportstatus` | embedded | `TransportstatusCode` | Übergangs-Validierung im Aggregat |
| `ErfasserRef` | ✔ | discriminated union | `{ type: 'user' \| 'device' \| 'session', … }` |

Alle Value Objects sind immutabel, privat konstruiert, mit statischer Factory `static create()`. Validierung erfolgt in der Factory und liefert `Result<VO>`.

### Enums

- **`SkEnum`** (SiKoKo / DIN 13050): `SK_I` (rot, akut lebensbedrohlich), `SK_II` (gelb, schwer verletzt), `SK_III` (grün, leicht), `SK_IV` (blau, abwartend), `TOT` (schwarz, separate Kategorie). Farb-Token: ADR-016 (`sk-token-familie-ring-1`).
- **`BehandlungsstatusEnum`**: `UNVERSORGT` → `IN_BEHANDLUNG` → `VERSORGT` → `TRANSPORTBEREIT`. Übergänge linear, nur via Korrektur rückwärts.
- **`TransportstatusEnum`**: `WARTEND` → `IM_TRANSPORT` → `IM_KRANKENHAUS`. Übergänge linear, nur via Korrektur rückwärts.

### Snapshot-Spalten in der `Patient`-Tabelle

Die `Patient`-Tabelle (Prisma) ist ein **denormalisierter Read-Snapshot** — keine eigene Source of Truth. Schreib-Konsistenz mit dem Event-Stream wird durch die Prisma-Transaktion garantiert (UPSERT `Patient` + INSERT `PatientEvent` + INSERT `EtbEintrag` in derselben Tx).

| Spalte | Typ | Pflicht | Quelle |
|---|---|---|---|
| `id` | TEXT (CUID) | ✔ | `Patient.create()` |
| `einsatzId` | TEXT (CUID, FK) | ✔ | Aggregat-Konstruktor |
| `patientennummer` | TEXT | ✔ | `Patientennummer` VO |
| `diviVakNummer` | TEXT | optional | `DiviVakNummer` VO |
| `aktuelleSk` | TEXT (`SkCode`) | ✔ | `Sichtungskategorie` (Default `null`/keine Sichtung) |
| `behandlungsstatus` | TEXT | ✔ | `Behandlungsstatus` (Default `UNVERSORGT`) |
| `transportstatus` | TEXT | ✔ | `Transportstatus` (Default `WARTEND`) |
| **`notiz`** (Story 1.7) | VARCHAR(500) | optional | Freitext-Notiz via `patient.korrigiert.feld='notiz'` |
| `erfasstAm` | TIMESTAMP | ✔ | Aggregat-Erfassung |
| `erfasserRef` | JSONB | ✔ | `ErfasserRef` VO |
| `eventVersion` | INTEGER | ✔ | `MAX(eventVersion)` über `PatientEvent` |
| `clockDriftSeconds` | INTEGER | optional | Tablet-Drift-Marker |
| `createdAt` / `updatedAt` | TIMESTAMP | ✔ | Standard |

### Append-only-Event-Stream (`PatientEvent`)

Eigene Tabelle, append-only. Pflicht-Invariante über `@@unique([patientId, eventVersion])` — Doppel-Inserts schlagen DB-seitig fehl, Optimistic-Lock funktioniert ohne separates Versionsfeld.

| Spalte | Typ | Inhalt |
|---|---|---|
| `id` | TEXT (CUID) | Primary Key |
| `patientId` | TEXT (FK) | Referenz auf `Patient` |
| `einsatzId` | TEXT (FK) | Referenz auf `Einsatz` (Convenience-Filter) |
| `eventType` | TEXT | Einer der 8 `patient.*`-Werte |
| `eventVersion` | INTEGER | Monoton steigend pro Patient, beginnend bei 1 (`patient.erfasst`) |
| `payload` | JSONB | Event-Type-spezifisches Payload (Schema je Event) |
| `actorUserId` | TEXT | optional, FK auf `User` |
| `actorDeviceId` | TEXT | optional, Geräte-ID (Standalone-Mode, ADR-017) |
| `originSessionId` | TEXT | optional, Capture-Session-ID (ADR-017) |
| `clockDriftSeconds` | INTEGER | optional, bekannter Drift zum Server bei Erfassung |
| `occurredOn` | TIMESTAMP | Ereignis-Zeitpunkt (Tablet-Uhr) |
| `recordedAt` | TIMESTAMP | DB-Insert-Zeitpunkt (Server-Uhr) |

### Notiz-Snapshot (Story 1.7-Erweiterung)

Die Notiz wurde in Story 1.7 (AC9) als Snapshot-Spalte auf `Patient` ergänzt und über das bestehende `patient.korrigiert`-Event ohne neuen Event-Typ versorgt. Der Discriminator-Slot `feld='notiz'` macht das eindeutig:

- `vorher: string | null` — vorheriger Notiz-Text, `null` zulässig (Notiz war leer)
- `neu: string | null` — neuer Notiz-Text, `null` = Notiz löschen
- `grund: string` — Pflicht (Audit-Trail-Hygiene)
- Max-Länge: 500 Zeichen nach Trim (DB-Constraint `VARCHAR(500)`)

Bewusste Spec-Entscheidung: Notiz hat keinen eigenen Event-Typ (`patient.notiz-aktualisiert`), weil sie semantisch eine *Korrektur eines Snapshot-Felds* ist — analog zu Sichtung, Behandlung, Transport. Der vereinheitlichte Korrektur-Workflow (`grund` Pflicht, Discriminator-Union) gilt damit auch für die Notiz.

### Die acht Patient-Events

| # | `eventType` | Story | Discriminator | Payload-Felder |
|---|-------------|-------|--------------|----------------|
| 1 | `patient.erfasst` | 1.1/1.2 | — | `patientennummer`, `initialeSk?`, `erfasserRef`, `diviVakNummer?`, `notiz?` |
| 2 | `patient.gesichtet` | 1.2 (Initial-Sichtung) | — | `sk`, `sichtungArt: 'voraussichtung' \| 'ärztlich'`, `sichter` |
| 3 | `patient.sichtung-aktualisiert` | 1.3 (Reevaluierung) | — | `vorher`, `neu`, `sichtungArt`, `sichter`, `grund?` |
| 4 | `patient.behandlung-begonnen` | 1.4 | — | `vorher` (`UNVERSORGT`), `neu` (`IN_BEHANDLUNG`), `actor` |
| 5 | `patient.behandlung-abgeschlossen` | 1.4 | — | `vorher` (`IN_BEHANDLUNG`), `neu` (`VERSORGT` \| `TRANSPORTBEREIT`), `actor` |
| 6 | `patient.transport-gestartet` | 1.4 | — | `vorher` (`WARTEND`), `neu` (`IM_TRANSPORT`), `actor`, `transportZiel?` |
| 7 | `patient.transport-abgeschlossen` | 1.4 | — | `vorher` (`IM_TRANSPORT`), `neu` (`IM_KRANKENHAUS`), `actor` |
| 8 | `patient.korrigiert` | 1.4 + 1.7 | `feld: 'sichtung' \| 'behandlungsstatus' \| 'transportstatus' \| 'notiz'` | discriminated Union mit `vorher`, `neu`, `grund` (Pflicht) |

Vollständige Payload-Schemata: `packages/backend/src/domain/patienten/schemas/etb-context.schema.ts` (`PatientEtbContextSchema`, Zeilen 36–164). Diese Datei ist die Single Source of Truth für FE und BE; sie wird im OpenAPI-Schema referenziert und im Frontend über den generierten Client typisiert konsumiert.

**Anti-Pattern (verboten):** Eigene `patient.notiz-aktualisiert`-, `patient.gestorben`- oder `patient.entlassen`-Events. Notiz läuft über `korrigiert.feld='notiz'`, TOT-Markierung über `korrigiert.feld='sichtung', neu='TOT'` (mit `bestaetigeTotKorrektur=true`-Schutz), Entlassung über `transport-abgeschlossen`.

### 4-Punkt-Registry-Vertrag (AR20)

**Jedes** neue Patient-Event MUSS an **vier** Stellen registriert werden, sonst wird es stumm geschluckt — kein Laufzeit-Fehler, aber kein Round-Trip durch die Outbox und keine ETB-Persistierung. Diese Regel ist nicht verhandelbar und gilt repo-weit (siehe `architecture.md` §`4-Punkt-Registry-Vertrag` und Event-Adapter-Sektion).

#### 1. Event-Serializer

Datei: `packages/backend/src/infrastructure/outbox/event-serializer.ts`

Switch-Case pro `eventType` im `serialize`-Methoden-Block des `EventSerializer`-Services, der das Domain-Event auf das persistierte JSONB-Payload mappt:

```typescript
// ===== PATIENT EVENTS (Story 1.2/1.3/1.4, Architecture §D-6) =====
case 'patient.erfasst':
  return this.serializePatientErfasst(event as unknown as PatientErfasst);
case 'patient.gesichtet':
  return this.serializePatientGesichtet(event as unknown as PatientGesichtet);
case 'patient.sichtung-aktualisiert':
  return this.serializePatientSichtungAktualisiert(event as unknown as PatientSichtungAktualisiert);
case 'patient.behandlung-begonnen':
  return this.serializePatientBehandlungBegonnen(event as unknown as PatientBehandlungBegonnen);
case 'patient.behandlung-abgeschlossen':
  return this.serializePatientBehandlungAbgeschlossen(event as unknown as PatientBehandlungAbgeschlossen);
case 'patient.transport-gestartet':
  return this.serializePatientTransportGestartet(event as unknown as PatientTransportGestartet);
case 'patient.transport-abgeschlossen':
  return this.serializePatientTransportAbgeschlossen(event as unknown as PatientTransportAbgeschlossen);
case 'patient.korrigiert':
  return this.serializePatientKorrigiert(event as unknown as PatientKorrigiert);
```

#### 2. Event-Deserializer

Datei: `packages/backend/src/infrastructure/outbox/event-deserializer.ts`

Map-Eintrag pro `eventType` im `eventTypeMap`-Konstrukt, der das JSONB-Payload zurück auf die Domain-Event-Klasse mappt. Jede Deserializer-Funktion validiert Pflichtfelder und liefert `Result<EventClass>`:

```typescript
// ===== PATIENT EVENTS (Story 1.2/1.3/1.4, Architecture §D-6) =====
['patient.erfasst', deserializePatientErfasst],
['patient.gesichtet', deserializePatientGesichtet],
['patient.sichtung-aktualisiert', deserializePatientSichtungAktualisiert],
['patient.behandlung-begonnen', deserializePatientBehandlungBegonnen],
['patient.behandlung-abgeschlossen', deserializePatientBehandlungAbgeschlossen],
['patient.transport-gestartet', deserializePatientTransportGestartet],
['patient.transport-abgeschlossen', deserializePatientTransportAbgeschlossen],
['patient.korrigiert', deserializePatientKorrigiert],
```

#### 3. Event-Adapters-Module

Datei: `packages/backend/src/infrastructure/events/event-adapters.module.ts`

NestJS-Provider-Registrierung für domänenspezifische Event-Handler. Für die Patient-Domain ist mindestens der zentrale `PatientEventLoggerHandler` registriert; weitere Adapter (ETB-Bridge, WebSocket-Broadcast) folgen dem Eigenschutz-Vorbild.

```typescript
import { PatientEventLoggerHandler } from './handlers/patient-event-logger.handler';
// ...
@Module({
  // ...
  providers: [
    // ...
    PatientEventLoggerHandler,
    // ggf. weitere Patient-Adapter
  ],
})
export class EventAdaptersModule {}
```

#### 4. Infrastructure-Index

Datei: `packages/backend/src/infrastructure/events/index.ts`

Public-Barrel-Export der `EventAdaptersModule`. Diese Datei sorgt dafür, dass der Application-Layer das Module einbinden kann, ohne Pfad-Imports zu kennen:

```typescript
export { EventAdaptersModule } from './event-adapters.module';
```

**Folge:** Neue Domain-Events ohne Eintrag in einer der vier Stellen werden serialisiert, aber nie deserialisiert / nie an Adapter weitergegeben / nie aus dem Modul exportiert. Im Test schlägt der Outbox-Roundtrip-Test fehl (oder schlimmer: er fehlt, weil keiner ihn schreibt).

**Diese ADR fordert:** Jeder neue Patient-Event-Typ (z. B. später `patient.angeheftet` für Standalone-Capture, ADR-017) wird mit einer Code-Review-Checkliste eingereicht, die jeden der vier Punkte abhakt.

### Konsequenzen

#### Positiv

- **Audit-Pflicht erfüllt (NFR-S5).** Append-only-Stream + ETB-Verzahnung garantieren DIN-13050-konforme 10-Jahre-Rückverfolgung.
- **KPI-Read-Performance erreichbar (NFR-P1).** Denormalisierter Snapshot in `Patient` macht KPI-Aggregationen zur reinen `GROUP BY`-Query.
- **Multi-Device-Konsistenz via Event-Replay.** WebSocket-Push (Epic 3) liefert `eventVersion` mit; Clients können fehlende Events nachladen.
- **Korrektur-Workflow vereinheitlicht.** Vier Felder, ein Event, eine Discriminator-Logik — keine Sonder-Pfade pro Korrektur-Art.
- **MDR-konform (ADR-015).** Snapshot reflektiert ausschließlich menschliche Setzungen, keine algorithmischen Empfehlungen.
- **Capture-Mode-Integration vorgezeichnet (ADR-017).** `erfasserRef` als Discriminated Union erlaubt `device`/`session`-Typen ohne Schema-Bruch.
- **Folge-Epics 2/3 setzen auf stabilem Vertrag auf.** Capture/Attach kann lokale Patient-Events mit denselben Typen nutzen; WS-Sync kann auf `eventVersion` als Optimistic-Lock vertrauen.

#### Negativ

- **Schema-Komplexität.** Acht Events plus Discriminated-Union-Korrektur sind mehr State als ein einfaches CRUD-Patient-Modell. Mitigation: `PatientEtbContextSchema` als Zod-Schema, FE/BE konsumieren identische Typen über den generierten Client.
- **Snapshot-Sync-Risiko.** Wenn ein Event nicht in derselben Tx persistiert wird, drift Snapshot vs. Stream. Mitigation: `TransactionalCommandHandler` als Pflicht-Basisklasse; reine `@Injectable`-Services dürfen Patient-Events nicht direkt schreiben.
- **4-Punkt-Registry wartungslastig.** Neue Events erfordern 4 Edits in 4 verschiedenen Dateien. Mitigation: Code-Review-Checkliste; Outbox-Roundtrip-Test als CI-Gate für jeden neuen `eventType`.
- **Korrektur-Discriminator als String-Literal-Union.** Erweiterung um neue Felder (z. B. `feld='diviVakNummer'`) erfordert Edit an mehreren Stellen. Mitigation: Discriminator-Werte zentral in `PATIENT_KORREKTUR_FELDER`-Konstante, Zod-Schema als Single Source of Truth.
- **Notiz max. 500 Zeichen.** Reicht für Kurzhinweise, nicht für volle Anamnese. Bewusste Spec-Entscheidung (Story 1.7): Lange Texte gehören in den ETB-Eintrag, nicht in den Patient-Snapshot. Bei späterer Pilot-Anforderung „mehr Notiz-Raum" erfolgt eine Folge-Story.

### Affects

- **Folge-Epic 2 (Capture / Attach):** Übernimmt das Aggregat-Schema unverändert. Standalone-Capture (ADR-017) erzeugt lokale Patient-Events mit `erfasserRef.type='device'` und `originSessionId`. Beim Anhängen mappt das Backend lokale CUIDs auf Backend-CUIDs und schreibt die Events 1:1 in den Stream.
- **Folge-Epic 3 (WebSocket-Sync):** Pusht jedes Patient-Event in den Einsatz-scoped Channel (`einsatz:{einsatzId}`). Clients reconcile per `eventVersion`.
- **Migrationspfad für Schema-Erweiterungen:** Jede Erweiterung um ein neues Snapshot-Feld oder einen neuen Event-Typ erfordert eine eigene Folge-ADR (`ADR-019` ff.). Diese ADR bleibt als Vertrag stabil.
- **API-Versionierung (ADR-001):** Solange wir in der Alpha-Phase sind, sind Schema-Erweiterungen ohne BC-Bruch (additive Felder, neue Event-Typen) möglich. Breaking Changes (Umbenennung, Feld-Entfernung) erzeugen `v2`-Endpoints — siehe ADR-001.

### Querverweise

- [ADR-001](./adr-001-api-versioning-strategy.md) — API-Versionierung; bestimmt, wie Schema-Änderungen am Patient-Vertrag versioniert werden.
- [ADR-005](./adr-005-etb-eintrag-kontext-discriminated-union.md) — `EtbEintrag.kontextType='patient'` + `kontextData` als JSONB-Discriminated-Union. Hier verankert sich die ETB-Verzahnung jedes Patient-Events.
- [ADR-006](./adr-006-websocket-event-bus-einsatz-scoped.md) — WebSocket-Event-Bus mit Outbox-Pattern; Liefer-Mechanik der Patient-Events an mehrere Tablets.
- [ADR-012](./adr-012-einsatz-scope-guard.md) — `EinsatzScopeGuard` als Plattform-Pattern; alle Patient-Endpoints sind einsatz-scoped.
- [ADR-015](./adr-015-mdr-grenze-anzeige-ohne-triage-empfehlung.md) — MDR-Grenze; Snapshot persistiert nur menschliche Setzungen, keine Triage-Empfehlung.
- [ADR-016](./adr-016-sk-token-familie-ring-1.md) — SK-Farb-Token-Familie; UI-Visualisierung der Sichtungskategorien.
- [ADR-017](./adr-017-standalone-capture-storage.md) — Standalone-Capture-Storage; lokale Patient-Erfassung ohne Einsatzkontext, integriert sich über `erfasserRef.type='device'`.

### Konsens-Naming-Klarstellung

In den Story-Specs 1.5/1.6/1.7/1.8 sind unterschiedliche Namens-Varianten für UI-Komponenten aufgetaucht (`KpiTile` vs. `KpiCard`, `PatientenListe` vs. `PatientList`). Diese ADR legt fest:

- **UX-Naming gewinnt** — die in den UI-Komponenten verwendeten Namen sind verbindlich.
- Konkret: `KpiStrip` (mit `KpiTile`-Slots intern, siehe `packages/frontend/src/shared/ui/molecules/kpi-tile.molecule.tsx`), `PatientenListe`, `PatientDetailPanel`, `PatientPill`, `EntityFlowStrip`, `PatientenDashboard`.
- Story-Specs und arc42-Sicht sind entsprechend zu lesen.

### Umsetzungshinweise

- **Aggregat-Methoden returnen `Result<Patient>` oder `Result<void>`** — niemals Exception aus Domain-Logik.
- **Übergangs-Validierung** erfolgt im Aggregat (`Behandlungsstatus.darfWechselnZu()`), nicht im Controller.
- **TOT-Schutz:** `korrigieren(feld='sichtung', neu='TOT')` erfordert `bestaetigeTotKorrektur=true`. Frontend zeigt eine harte Confirm-Schranke (Story 1.4 Code-Review Feature 2).
- **`patient.erfasst` muss erstes Event sein** — durchgesetzt im Patient-Aggregat (`Patient.create()` emittiert `patient.erfasst` als ersten Event, alle anderen Mutationen verlangen einen geladenen Aggregat-State).
- **Outbox-Roundtrip-Test** für neue Patient-Events Pflicht — Serializer- + Deserializer-Test in einem (`*.outbox.integration.spec.ts`).

> **Diese ADR ist der finale Vertrag für das Patient-Aggregat in Epic 1.** Folge-Epics dürfen das Schema *additiv* erweitern (neue optionale Snapshot-Felder, neue Event-Typen mit eigener Folge-ADR), aber keine bestehenden Felder umbenennen oder entfernen.
