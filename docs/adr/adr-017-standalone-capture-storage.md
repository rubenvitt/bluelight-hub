# ADR-017: Standalone-Capture-Storage-Schema und ID-Remapping

## Status

Akzeptiert (2026-05-19) — verankert die technische Grundlage des Standalone-Capture-Modus (Issue #417, UX Design Spec Schritt 7 Variante A+C) und schließt die Storage-/Identitäts-/Sync-Frage für den login-freien Erstphase-Pfad.

## Kontext

Das Patienten-Dashboard im Einsatz (Issue #417) etabliert einen **Field-First-Capture-Modus**: die ersteintreffende Kraft am Schadensort beginnt die Patientenerfassung **ohne Login, ohne Einsatzkontext, ohne Netz**. Erst später — sobald der FüKW (Führungskraftwagen) im erreichbaren Netz ist und ein Einsatz eröffnet wurde — wird die lokal erfasste Capture-Session an den offiziellen Einsatz „angeheftet".

Dieser Modus ist nach UX-Spec Schritt 3 das zentrale Differenzierungsmerkmal gegenüber NIDAmanv / CommandX / Fireboard. Damit er funktioniert, müssen folgende Anforderungen technisch sauber gelöst sein:

1. **Lokaler Storage** ohne Backend-Erreichbarkeit auf Tablet (Tauri-PWA) und Smartphone (Browser-PWA), mit Persistenz über App-Crashes und Browser-Reloads.
2. **Identitäts-Erzeugung** für Patienten und Capture-Sessions ohne zentrale ID-Vergabe (kein Server erreichbar).
3. **DSGVO-konformer Umgang** mit Gesundheitsdaten lokal (Art. 9 DSGVO, Datenminimierung, Speicherbegrenzung).
4. **Verlustfreier Re-Sync** beim späteren Anhängen an einen Einsatz, inklusive ID-Remapping (lokale CUID → Backend-CUID) und nachträglicher User-Annotation (wer hat angeheftet).
5. **Multi-Session-Support** auf demselben Gerät — mehrere unabhängige Capture-Sessions koexistieren, jede einzeln anhängbar.
6. **Idempotenz** — App-Crash zwischen Counter-Tap und Persistenz darf keine Duplikate erzeugen.

### Bestehende Plattform-Bausteine

| Komponente | Status | Nutzung im Standalone-Capture |
|---|---|---|
| **Tauri Plugin Store** (`@tauri-apps/plugin-store`) | Etabliert seit Story 1.x ([`frontend-tauri-plugin-store-setup.md`](../frontend-tauri-plugin-store-setup.md)) | Persistenz auf Tauri-Desktop/-Mobile |
| **IndexedDB + Web Crypto API (AES-GCM)** | Etabliert seit Story 2.1 ([`platform-storage-research.md`](../frontend/platform-storage-research.md)) | Persistenz im Browser-PWA-Modus |
| **Platform Storage Adapter** | Etabliert (gleicher Pfad wie Eigenschutz Story 7.5 Pending-Command-Queue) | Abstraktion über Tauri-Store vs. IndexedDB |
| **Pending-Command-Queue-Pattern** (Eigenschutz Story 7.5) | Etabliert: Outbox-Pattern, FIFO-Replay, `expectedVersion`-Konflikte | Vorbild für Patienten-Sync-Queue |
| **Outbox-Pattern** (Backend, ADR-006 + Event-Deserializer) | Etabliert | Sync-Zielseite, ETB-Verzahnung |
| **`@paralleldrive/cuid2`** (oder `cuid`) | Im Backend bereits verwendet für CUIDs | Lokale CUID-Generierung möglich |
| **Tauri OS-API für Geräte-Identifikation** | Verfügbar (`@tauri-apps/plugin-os`) | Stabile Geräte-ID-Quelle |
| **Web Crypto API für UUID-Generierung** | Native Browser-API (`crypto.randomUUID()`) | Geräte-ID-Fallback im Browser-Mode |

### Konkurrierende Optionen für Lokal-Storage

Die Frage „wie speichern wir lokal" ist nicht trivial. Drei Pfade wurden evaluiert:

| Option | Tauri-Mode | Browser-Mode | Verschlüsselung | Persistenz | Quota | Bewertung |
|---|---|---|---|---|---|---|
| **a) Tauri Store + IndexedDB (Plattform-adaptiv)** | Tauri-Store | IndexedDB | OS-Schutz (Tauri) + AES-GCM (Browser) | dauerhaft | groß (>50 MB) | ✅ empfohlen — etabliertes Pattern |
| b) localStorage | nicht passend | localStorage | nein | dauerhaft | 5-10 MB | abgelehnt — kein Crypto, kleines Quota, sync API |
| c) SessionStorage / Cookies | nicht passend | flüchtig | nein | flüchtig | klein | abgelehnt — verliert Daten beim Tab-Close |

### DSGVO-Rahmen für lokale Patientendaten

- **Art. 9 Abs. 2 lit. c DSGVO** („lebenswichtige Interessen") deckt den Erfassungsmodus ohne Einwilligung — Patient ist im MANV nicht einwilligungsfähig, lebenswichtiges Interesse evident.
- **Art. 5 Abs. 1 lit. c DSGVO** (Datenminimierung): Standalone-Mode erfasst **nur Pflichtdaten** (SK-Kategorie + Zeitstempel + Geräte-ID), Pseudonym/Notiz optional.
- **Art. 5 Abs. 1 lit. e DSGVO** (Speicherbegrenzung): nach erfolgreicher Anhängung an Einsatz muss die lokale Kopie gelöscht oder anonymisiert werden — konkrete Frist im Schema dokumentiert.
- **Art. 32 DSGVO** (Sicherheit der Verarbeitung): Verschlüsselung im Browser-Pfad Pflicht; Tauri-Pfad erbt OS-Userspace-Schutz, sollte aber bei Mobile-Tauri (iOS/Android) zusätzlich verschlüsseln.

## Entscheidung

Wir etablieren eine **plattform-adaptive lokale Storage-Schicht** für Standalone-Capture-Sessions, eine **lokal generierte CUID-Identität** für Patienten und Sessions, und einen **definierten Re-Sync-Pfad** mit ID-Remapping, der bewährte Plattform-Patterns wiederverwendet.

### Storage-Schicht (`features/patient/lib/standalone-storage.ts`)

```typescript
// Plattform-Adapter wie in Eigenschutz Story 7.5 — keine zweite Storage-Quelle.
import { platformStorage } from '@/shared/platform-storage';

const STORAGE_NAMESPACE = 'bluelight:patient:capture-session:v1';
const PENDING_QUEUE_NAMESPACE = 'bluelight:patient:pending-commands:v1';
```

**Tauri-Mode:** `@tauri-apps/plugin-store` mit Dateiname `standalone-capture.json` im App-Data-Dir.
**Browser-Mode:** IndexedDB-Objekt-Store `bluelight-patient-capture`, verschlüsselt mit AES-GCM (Schlüssel über PBKDF2 aus Geräte-Salt + ggf. User-PIN abgeleitet).

Der `platformStorage`-Adapter abstrahiert beide Pfade — Feature-Code kennt nur eine API.

### Capture-Session-Schema

Eine Capture-Session ist ein lokales Aggregat mit folgenden Pflicht- und Optional-Feldern:

```typescript
interface CaptureSessionLocal {
  // Identität — lokal generiert, nie nachträglich geändert
  sessionId: string;              // CUID, Format "cs_xxxxxxxxxx"
  schemaVersion: 1;               // für künftige Migration

  // Geräte-Kontext — beim ersten Tap der Session festgeschrieben
  deviceId: string;               // stabile Tauri-OS-ID bzw. crypto.randomUUID() (persistent gespeichert)
  deviceLabel?: string;           // optional: "iPad-DRK-23" wenn konfiguriert
  appVersion: string;             // bluelight-hub Version, für Debugging
  platform: 'tauri' | 'browser';

  // Zeit-Kontext
  startedAt: string;              // ISO 8601, UTC, Tablet-Uhr
  startedAtDriftMarker?: number;  // optional: bekannter Uhr-Drift in s, falls erkennbar

  // Geo-Kontext (DSGVO-Opt-in über HiOrg-Konfiguration; MVP-Default: aus)
  startedAtLocation?: {
    lat: number;
    lng: number;
    accuracyMeters: number;
    capturedAt: string;
  };

  // Patienten-Liste — append-only innerhalb der Session
  patients: PatientLocal[];

  // Status — wird beim Anhängen aktualisiert
  status: 'open' | 'attaching' | 'attached' | 'failed' | 'discarded';
  attachedTo?: {
    einsatzId: string;            // Backend-Einsatz-CUID, gesetzt nach erfolgreichem Anhängen
    attachedAt: string;
    attachedByUserId: string;     // Backend-User-CUID des Anhängenden
    backendPatientIds: Record<string, string>;  // lokaleCUID → BackendCUID
  };
  failureContext?: { errorCode: string; lastTriedAt: string; retryCount: number };

  // Aufbewahrungs-Metadaten (DSGVO Art. 5 Abs. 1 lit. e)
  retentionMarkedForDeletionAt?: string;
}

interface PatientLocal {
  patientId: string;              // CUID, Format "pl_xxxxxxxxxx" — "pl" für "patient local"
  sk: 'rot' | 'gelb' | 'gruen' | 'blau' | 'schwarz';
  capturedAt: string;             // ISO 8601, UTC

  // Optionale Anreicherung — nicht Pflicht, kann nachträglich ergänzt werden
  pseudonym?: string;
  notiz?: string;
  observations?: PatientObservation[]; // Beobachtungen (Atemfrequenz, Bewusstsein, Bewegung); MDR-konform Anzeige-only

  // ETB-Vorab-Event-Spur — wird beim Anhängen in echte ETB-Events transformiert
  pendingEvents: PendingPatientEvent[];
}

type PendingPatientEvent =
  | { type: 'sichtung'; capturedAt: string; sk: SkCategory }
  | { type: 'sk-upgrade'; capturedAt: string; fromSk: SkCategory; toSk: SkCategory }
  | { type: 'observation'; capturedAt: string; data: Record<string, unknown> }
  | { type: 'note-updated'; capturedAt: string; notiz: string };
```

### Identitäts-Strategie (CUID lokal + Remapping bei Sync)

- **Lokale CUIDs** werden mit `@paralleldrive/cuid2` (oder bestehender CUID-Library) **clientseitig** generiert. Präfixe (`cs_`, `pl_`) machen Lokal-IDs auf einen Blick erkennbar.
- **Geräte-ID** ist stabil und persistent (Tauri-OS-Plugin oder im Storage gespeicherte `crypto.randomUUID()` beim ersten App-Start). Sie identifiziert das Tablet/Smartphone, nicht den Benutzer.
- **Beim Anhängen** mappt das Backend lokale CUIDs auf Backend-CUIDs:
  - Backend generiert neue CUID je Patient (Format `clx...` aus existierender Patient-Domain).
  - Mapping `lokaleCUID → BackendCUID` wird in `attachedTo.backendPatientIds` persistiert (für künftige Lookups, ETB-Cross-Reference, Debugging).
  - Sobald gemappt, nutzen alle UI-Operationen die Backend-CUID; der Nutzer sieht die lokale CUID nie.
- **Idempotenz beim Sync:** Backend prüft pro `(deviceId, sessionId, patientId)` ob bereits angeheftet — Doppelanhängen erzeugt keine Duplikate, sondern liefert das bestehende Mapping zurück.

### Sync-Pfad (Pending-Command-Queue + Backend-API)

Analog Eigenschutz Story 7.5:

1. Counter-Tap erzeugt einen `Patient` in der aktuellen Session-Datei **und** einen `AppendPatientCommand` in der Pending-Queue (`bluelight:patient:pending-commands:v1`).
2. Pending-Queue ist FIFO; Commands der gleichen Session werden **nicht** zusammengeführt (jeder Patient ist eigenes Event).
3. Solange die Session `open` ist, gehen Commands nirgends hin — sie bleiben lokal.
4. Bei „Anhängen" wird ein zusammengefasstes `AttachStandaloneSessionCommand` mit allen Pending-Patients an das Backend gesendet (REST `POST /v1/einsaetze/{einsatzId}/standalone-sessions/attach`).
5. Backend antwortet mit `attachedTo`-Payload (Backend-CUIDs + Mapping); Pending-Queue wird abgeräumt.
6. Bei 409-Konflikt (Post-MVP): Konflikt-State sichtbar machen, Pending-Queue pausieren bis manuelle Auflösung.
7. Bei Netz-Drop während Sync: Retry mit exponential backoff, max. 30 s zwischen Versuchen; Status `attaching` bleibt sichtbar.

### Sichtbarkeit für den Nutzer

- **`SyncStatusBadge`** zeigt `Offline · N Patienten lokal` solange Session offen + FüKW nicht erreichbar.
- **FüKW-Anhängen-Banner** im `StatusRail` sobald Backend erreichbar wird (mDNS oder konfigurierter Endpoint).
- **`StandaloneSessionCard`** auf `/app/.../patienten/sessions` zeigt jede ausstehende Session mit Geräte-Label, Startzeit, Patientenanzahl, optionalem Geo-Kontext.
- **Nach erfolgreichem Anhängen:** 10-s-Confirmation-State („Angehängt an EIN-… · 8 Patienten"), dann Verblassen — Patienten erscheinen in der normalen Patientenliste.

### DSGVO-Aufbewahrung lokaler Daten nach Anhängen

| Lebenszyklus-Phase | Speicherort | Aufbewahrung |
|---|---|---|
| Session offen | Lokal (Tauri/IndexedDB) | bis 7 Tage seit `startedAt` ohne Anhängen → Warnungs-Hinweis im UI, danach manuelle Verwerfen-Aktion erforderlich |
| Session `attaching` / `failed` | Lokal + Pending-Queue aktiv | unbegrenzt, bis Erfolg oder Verwerfen |
| Session `attached` | Lokal markiert mit `retentionMarkedForDeletionAt` = +30 Tage | nach 30 Tagen automatische Löschung aus lokalem Storage (Patientendaten + ETB-Events bleiben Backend-seitig erhalten) |
| Session `discarded` | Lokal sofort entfernt | — |

Die 30-Tage-Frist post-Anhängen ist eine Forensik-Reserve (Debug-Fenster bei Sync-Problemen) und konfigurierbar. Default folgt aus Empfehlungen für Backup-Aufbewahrung in HiOrgs.

### Multi-Session-Verhalten

- Eine Session ist **aktiv** (UI zeigt Counter-Tiles); weitere Sessions können „pausiert" sein (im Storage, nicht im UI aktiv).
- Beim App-Open: wenn `status === 'open'` und letzte Aktivität < 4 h → automatisch reaktivieren; wenn > 4 h → Übersichts-Screen mit „Session fortsetzen / Neue Session / Anhängen".
- Multi-Tablet-Setup: jedes Tablet erzeugt eigene Sessions; Konflikte bei Anhängen treten erst Backend-seitig auf (Post-MVP).

## Konsequenzen

### Positiv

- **Field-First-Capture funktioniert ohne Server.** Erstphase-Use-Case (Anna, ersteintreffend) ist technisch sauber gelöst. Kein Login-Wall, kein Einsatzkontext-Wall, kein Netz-Wall.
- **Plattform-adaptiv ohne Code-Duplikation.** Bestehender `platformStorage`-Adapter wird wiederverwendet (Tauri-Plugin-Store + IndexedDB+AES-GCM). Keine zweite Storage-Quelle.
- **Sync-Pfad ist etabliertes Plattform-Pattern.** Pending-Command-Queue + Outbox + ETB-Verzahnung sind aus Eigenschutz Story 7.5 + ADR-005 + ADR-006 bekannt.
- **ID-Remapping ist explizit und nachvollziehbar.** Mapping bleibt im `attachedTo`-Payload sichtbar, ETB-Spur kann später lokale + Backend-IDs cross-referenzieren.
- **DSGVO-Konformität ist im Schema verankert.** `retentionMarkedForDeletionAt`-Feld, 30-Tage-Löschfrist, Datenminimierung im Pflichtfelder-Set.
- **Idempotenz auf Schema-Level.** `(deviceId, sessionId, patientId)` ist eindeutig — Backend-Doppelverarbeitung erzeugt keine Duplikate.
- **MDR-konform (ADR-015).** Schema persistiert nur Beobachtungen und Sichtungs-Entscheidungen, keine algorithmischen Empfehlungen. Keine Score-Felder.
- **Versionsfeste Migration vorbereitet.** `schemaVersion: 1` erlaubt künftige Migrations-Pfade (z. B. neue Pflichtfelder, FHIR-Adapter).

### Negativ

- **Lokaler Storage-Footprint.** Bei 250 Patienten + 1000 Events à 200 Byte ergibt sich ~250 KB pro Session — vernachlässigbar gegenüber IndexedDB-Quotas (≥ 50 MB), aber zu beobachten bei Multi-Session-Devices.
- **Browser-Verschlüsselung erfordert PIN-Eingabe?** Standalone-Mode soll ohne Login funktionieren — ein PIN wäre Login-Surrogat. Mitigation: Verschlüsselungsschlüssel wird aus Geräte-Salt + Web-Crypto-`crypto.subtle.generateKey()` abgeleitet und im Browser-Storage gehalten (kein User-PIN nötig); ist auf BYOD-Geräten weniger sicher, aber MVP-vertretbar. Für Hochsicherheits-Pfade kann Post-MVP ein optionaler PIN-Schutz ergänzt werden.
- **Geräte-ID-Konflikt bei Browser-Cache-Clear.** Wenn der Nutzer den Browser-Cache löscht, geht die Geräte-ID verloren — neue UUID wird erzeugt, vorherige Sessions im Storage werden orphan. Mitigation: beim ersten App-Open prüfen, ob Orphan-Sessions existieren, und User-Aufforderung „Sessions wiederherstellen?" — Post-MVP, MVP akzeptiert Orphan-Risiko (geringe Häufigkeit).
- **Mehrere Tablets in derselben Erfassung erzeugen unabhängige Sessions.** Cross-Tablet-Patient-Deduplikation ist Post-MVP. MVP: jeder Tablet-Patient ist ein eigenständiger Patient im Backend, Deduplikation muss manuell erfolgen.
- **30-Tage-Aufbewahrung post-Anhängen ist eine Compromise-Entscheidung.** Strenger DSGVO-Auslegung wäre „sofort nach Anhängen löschen". Begründung für 30 Tage: Forensik bei Sync-Konflikten, Debug-Fenster bei Pilot-Problemen. Bei explizitem HiOrg-Wunsch konfigurierbar (`retentionDaysAfterAttach` als Plattform-Setting).
- **Geo-Lokation Opt-in nur konfigurierbar pro HiOrg, nicht pro Nutzer.** MVP-Vereinfachung — feinkörnige Per-Nutzer-Steuerung ist Post-MVP.

## Alternativen

### 1. Sync-Pflicht — kein echter Standalone-Mode, nur Login-Skip

Abgelehnt. Würde den Field-First-Differenzierer zerstören. NIDAmanv und CommandX gehen diesen Pfad — Bluelight Hub differenziert sich gerade dadurch, dass es ohne Server funktioniert.

### 2. UUID v4 statt CUID

Abgelehnt. CUID ist im Backend etabliert (Prisma + bestehende Domain-Entities); UUIDs würden eine zweite Identitäts-Welt einführen, mit unklarer Sortierbarkeit und größerer ID-Länge. CUID v2 ist URL-sicher, sortierbar nach Erzeugungszeit, und passt zum bestehenden Backend.

### 3. Lokal nur SQLite (Tauri) / WebSQL (Browser)

Abgelehnt. WebSQL ist deprecated. SQLite in Tauri wäre möglich, aber für ein Append-only-Pattern mit JSON-Payload Overkill — Tauri Store + IndexedDB liefern das gleiche Verhalten mit weniger Setup.

### 4. Verschlüsselung der lokalen Daten verzichten (Browser-Pfad)

Abgelehnt. Art. 32 DSGVO verlangt Verschlüsselung als Stand-der-Technik-Maßnahme bei Gesundheitsdaten. Web Crypto API ist Browser-nativ, kein zusätzlicher Bundle-Footprint, kein Performance-Problem (Hardware-beschleunigt). Verzicht wäre regulatorisch riskant und ohne Mehrwert.

### 5. Direkter Backend-Sync ohne Pending-Queue (online-only)

Abgelehnt. Bricht den Offline-First-Anspruch. Außerdem: Pending-Queue ist im Eigenschutz Story 7.5 bewährt und im Plattform-Storage-Adapter standardisiert — eine zweite Sync-Mechanik würde Code-Duplikation erzeugen.

### 6. Backend generiert IDs im Voraus (Pre-Allocated CUIDs)

Abgelehnt. Würde Backend-Erreichbarkeit beim App-Start verlangen, um IDs zu beziehen. Bricht Standalone-Default. ID-Remapping bei Sync ist die richtige Architektur für offline-first Identity.

### 7. Schema-Versionierung mit semver statt `schemaVersion: 1`

Abgelehnt. Migrations-Schritte für lokales Schema sind selten (≤ 1 pro Jahr); eine simple monoton wachsende Integer reicht. Bei größerer Komplexität jederzeit auf semver erweiterbar.

### 8. Browser-Pfad: localStorage statt IndexedDB

Abgelehnt aus drei Gründen: (a) localStorage ist synchron und blockiert Render-Pfad bei großen Payloads, (b) kein nativer Verschlüsselungs-Support, (c) Quota ≤ 10 MB bei 250-Patient-Szenarien knapp.

## Umsetzungshinweise

### Backend-API (Pflicht-Ergänzung)

```
POST /api/v1/einsaetze/{einsatzId}/standalone-sessions/attach
  Body:
    sessionId: string                # lokale CUID
    deviceId: string
    startedAt: string
    patients: PatientAttachPayload[]
    events: PendingPatientEvent[]
  Response 200:
    backendPatientIds: { [localCUID]: backendCUID }
    etbEventIds: { [localEventIndex]: etbEventId }
    attachedAt: string
  Response 409:
    conflictType: 'session-already-attached' | 'patient-cuid-collision'
    existingMapping?: { backendPatientIds }
```

Backend-Verarbeitung:

- Validierung gegen `EinsatzScopeGuard` (ADR-012) — Anhängender muss Einsatz-Mitglied sein.
- Idempotenz-Check über `(deviceId, sessionId)` — bei wiederholtem Aufruf identisches Mapping zurückgeben.
- ETB-Events werden mit `kontextType='patient'` und `kontextData` (ADR-005) angelegt; jedes `PendingPatientEvent` wird zu einem ETB-Event mit ursprünglichem `capturedAt` als `ereignisZeitpunkt` und Anhänge-Zeitpunkt als `erfasstAm`.
- Outbox-Pattern (ADR-006) verteilt Events an WebSocket-Channel → andere Geräte im Einsatz-Scope sehen Patienten sofort.

### Geräte-ID-Quelle

```typescript
// packages/frontend/src/features/patient/lib/device-id.ts
async function getOrCreateDeviceId(): Promise<string> {
  const stored = await platformStorage.get('bluelight:patient:device-id:v1');
  if (stored) return stored;

  let id: string;
  if (window.__TAURI__) {
    // Tauri-Mode: stabile OS-ID, fallback random
    id = (await tauriOsApi.machineId()) ?? crypto.randomUUID();
  } else {
    id = crypto.randomUUID();
  }
  await platformStorage.set('bluelight:patient:device-id:v1', id);
  return id;
}
```

### CUID-Präfixe

- `cs_` — Capture-Session
- `pl_` — Patient (lokal, vor Anhängen)
- Backend-Patient-IDs bleiben beim bestehenden Backend-Präfix (typisch `clx...` für CUID v2 ohne Custom-Prefix oder projektspezifisch — final wird durch Backend-Domain entschieden, nicht durch diese ADR)

### Test-Specs (Pflicht in `features/patient/lib/__tests__/`)

- `standalone-session.spec.ts` — Session erzeugen, Patient hinzufügen, persistieren, neu laden
- `pending-command-queue.spec.ts` — FIFO-Reihenfolge, Persistenz nach Crash, Replay
- `id-remapping.spec.ts` — Mapping anwenden, doppeltes Mapping idempotent
- `dsgvo-retention.spec.ts` — automatische Löschung nach `retentionMarkedForDeletionAt`
- `standalone-attach.integration.spec.ts` — End-to-End Anhängen gegen Mock-Backend
- `crash-recovery.spec.ts` — Counter-Tap → Crash → Reopen → Session intakt, Patient da

### Migration / Forward-Kompatibilität

- `schemaVersion: 1` erlaubt künftige Migrationen via separate `migrate-v1-to-v2.ts`-Funktion.
- Bei unbekannter `schemaVersion` beim Load: Migration-Pfad bestimmen oder konservatives „Session als read-only behandeln, Nutzer-Hinweis anzeigen".

### Sicherheits-Konsekutionen

- **Tauri-Mode:** lokale Datei im App-Data-Dir; OS-Userspace-Schutz reicht für MVP. Bei Mobile-Tauri (iOS/Android) zusätzliche Verschlüsselung in Phase 2 erwägenswert.
- **Browser-Mode:** AES-GCM Verschlüsselung mit Schlüssel im IndexedDB (nicht in localStorage, weniger XSS-exponiert). Schlüssel wird bei erstem App-Start generiert (`crypto.subtle.generateKey`) und in IndexedDB unter separatem Object-Store gehalten. PIN-Schutz Post-MVP.
- **Backup-Strategie:** lokaler Tauri-Store ist nicht teil von Cloud-Sync (iCloud/Drive) per Default — Pflicht prüfen bei Tauri-Setup. Sonst verlassen Patientendaten die HiOrg-Sphäre.

### CLAUDE.md-Bezug

- Pending-Command-Queue-Pattern und Platform-Storage-Adapter sind etablierte Plattform-Bausteine — kein neuer Custom-Pfad.
- ETB-Event-Registrierung (`event-deserializer.ts`) **Pflicht** für alle neuen Patienten-Events (ADR-006 + CLAUDE.md-Regel).
- DI-Imports (AC1): Backend-Service-Klassen mit `import` (nicht `import type`), wie in CLAUDE.md vorgegeben.

### Boyscout-Hinweis

Falls beim Implementieren festgestellt wird, dass der bestehende `platformStorage`-Adapter erweitert werden muss (z. B. um Namespace-Iteration für DSGVO-Cleanup), wird die Erweiterung im Adapter gemacht — nicht in einem Patient-spezifischen Wrapper. Ring-3/Plattform-Vertrag bleibt zentral.

## Referenzen

- [Issue #417 — Patienten-Dashboard im Einsatz](https://github.com/rubenvitt/bluelight-hub/issues/417)
- [PRD: Patienten-Dashboard](../../\_bmad-output/planning-artifacts/prd.md) — User Journeys Anna (Standalone-Capture, Funkloch-Re-Sync)
- [UX Design Specification](../../\_bmad-output/planning-artifacts/ux-design-specification.md) — Schritt 7 Variante A (Standalone-Counter-Tap) + Variante C (Attach-to-Einsatz)
- [ADR-005: ETB-Eintrag-Kontext als Discriminated Union](./adr-005-etb-eintrag-kontext-discriminated-union.md) — ETB-Events für Patientenereignisse
- [ADR-006: WebSocket Event-Bus einsatz-scoped](./adr-006-websocket-event-bus-einsatz-scoped.md) — Sync-Broadcast nach Anhängen
- [ADR-012: `EinsatzScopeGuard` als Plattform-Pattern](./adr-012-einsatz-scope-guard.md) — Autorisierung beim Anhängen
- [ADR-015: MDR-Grenze — Anzeige-Tool ohne Triage-Empfehlung](./adr-015-mdr-grenze-anzeige-ohne-triage-empfehlung.md) — Schema persistiert nur Beobachtungen
- [Tauri Plugin Store Setup](../frontend-tauri-plugin-store-setup.md) — Plattform-Storage-Tauri-Pfad
- [Platform Storage Research](../frontend/platform-storage-research.md) — IndexedDB + AES-GCM Browser-Pfad
- [`packages/frontend/src/features/eigenschutz/lib/`](../../packages/frontend/src/features/eigenschutz/lib/) — Pending-Command-Queue-Vorbild (Story 7.5)
- [DSGVO Art. 5, 9, 32](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679)

> **Hinweis:** Konkrete Hex-Werte, finale CUID-Präfixe und exakte Retention-Fristen werden im Token-/Patienten-Story mit Pilot-HiOrg-Feedback finalisiert. Die hier dokumentierten Werte sind plausibel und implementierungsbereit, aber bewusst noch nicht abschließend.
