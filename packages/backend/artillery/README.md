# Artillery Performance Tests

Performance Load Tests für Bluelight Hub Backend (Hexagonal Architecture).

## Quick Start

```bash
# 1. Backend starten (in separatem Terminal)
pnpm --filter @bluelight-hub/backend dev

# 2. Optional: Performance-Testdaten seeden
pnpm --filter @bluelight-hub/backend seed:perf

# 3. Load Tests ausführen
pnpm --filter @bluelight-hub/backend test:perf

# 4. HTML Report generieren
pnpm --filter @bluelight-hub/backend perf:report
```

## Test-Konfiguration

### Phasen

| Phase | Dauer | RPS | Beschreibung |
|-------|-------|-----|--------------|
| Warmup | 60s | 5 | Virtual Users aufbauen |
| Sustained Load | 120s | 20 | Hauptmessphase |

### Getestete Endpoints (Szenarien)

| Szenario | Weight | Endpoint | Beschreibung |
|----------|--------|----------|--------------|
| Create Einsatz | 20% | POST /api/v-alpha/einsatz | Neuen Einsatz erstellen |
| Get All Einsätze | 30% | GET /api/v-alpha/einsatz | Einsatz-Liste abrufen |
| Dashboard Query | 20% | GET /api/v-alpha/einsatz/active-with-counts | Dashboard Aggregation |
| Get Einsatz Details | 15% | GET /api/v-alpha/einsatz/:id/details | Einsatz + ETB + Lagekarte |
| Add ETB Eintrag | 10% | POST /api/v-alpha/etb/:etbId/eintrag | Neuen ETB-Eintrag erstellen |
| Complete Einsatz | 5% | POST /api/v-alpha/einsatz/:id/complete | Einsatz abschließen |

## NFR-4 Acceptance Criteria

| Metrik | PASS | WARN | FAIL |
|--------|------|------|------|
| p95 Response Time | <200ms | 200-250ms | >250ms |
| Success Rate | >99% | 95-99% | <95% |
| Throughput | ≥20 RPS | 15-20 RPS | <15 RPS |

## Dateien

```
artillery/
├── artillery-performance.yml   # Artillery Testkonfiguration
├── artillery-helpers.js        # Auth & Payload Generator
├── run-performance-test.js     # Node.js Performance Test (Alternative)
├── seed-performance-data.ts    # Testdaten-Seeding
├── results/                    # Generierte Reports
│   ├── results.json            # Rohdaten (JSON)
│   ├── PERFORMANCE-REPORT.md   # Markdown Report
│   └── report.html             # HTML Report (Artillery)
└── README.md                   # Diese Datei
```

## Alternative: Node.js Performance Test

Falls Artillery aufgrund von Dependency-Konflikten (js-yaml v4) nicht funktioniert,
kann das Node.js-basierte Test-Script verwendet werden:

```bash
cd packages/backend
node artillery/run-performance-test.js
```

Dieses Script:
- Führt 30s Warmup @ 5 RPS durch
- Testet 60s @ 20 RPS
- Sammelt p50, p95, p99, Max Latenzen
- Speichert Ergebnisse in `artillery/results/results.json`
- Gibt NFR-4 Status für jeden Endpoint aus

## Authentifizierung

Die Tests nutzen Passwordless Auth:
- Jeder Virtual User erstellt automatisch einen eindeutigen Username
- Login via `POST /api/auth/unified` mit nur `{ username }`
- Cookies werden gecached und für alle Requests wiederverwendet

## Testdaten Seeding

Das Seed-Script erstellt:
- 1 Performance-Test User (`perf-test-seed-user`)
- 10 Einsätze (7 ANGELEGT, 2 ABGESCHLOSSEN, 1 ARCHIVIERT)
- 50 ETB-Einträge verteilt über alle Einsätze

```bash
pnpm --filter @bluelight-hub/backend seed:perf
```

## Reports

### JSON Report
```bash
# Direkt nach test:perf verfügbar
cat artillery/results/results.json
```

### HTML Report
```bash
pnpm --filter @bluelight-hub/backend perf:report
open artillery/results/report.html
```

## Troubleshooting

### "Login failed: No cookies received"
- Backend läuft nicht auf Port 3090
- Rate Limiting aktiv (5 req/min für /api/auth/unified)

### Hohe Fehlerrate
- Datenbank nicht erreichbar
- Prisma Client nicht generiert (`pnpm --filter @bluelight-hub/backend prisma:generate`)

### Langsame Responses
- Backend nicht im Production Mode
- Datenbank ohne Indexes
- Zu viele Testdaten ohne Cleanup
