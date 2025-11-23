# Lagekarte Migration Rollback Plan

## Übersicht

Dieser Rollback-Plan dokumentiert die Schritte zur Rückgängigmachung der Lagekarte CQRS-Migration (Epic 2, Stories 2.1-2.9) falls kritische Probleme auftreten.

**Migration Scope:**
- LagekarteController: Legacy Service → CQRS (CommandBus/QueryBus)
- Domain Layer: LagekarteAggregate, POI Entity, Value Objects
- Application Layer: Commands, Queries, Handlers
- Infrastructure Layer: PrismaLagekarteRepository

**Rollback Time Target:** < 30 Minuten

---

## 1. Rollback Trigger Conditions

### 1.1 Automatische Trigger (CI/CD)

| Trigger | Schwellenwert | Action |
|---------|---------------|--------|
| Integration Tests Failing | > 0 kritische Tests | Block Deployment |
| Performance Regression | > 20% über Baseline | Alert + Manual Review |
| Error Rate | > 5% in 5 Minuten | Auto-Rollback |

### 1.2 Manuelle Trigger

- **Critical Production Bug:** Datenverlust oder Korruption
- **Security Vulnerability:** Entdeckte Auth/AuthZ Lücke
- **Data Consistency Issues:** MGRS/LatLng Konvertierungsfehler

### 1.3 Performance Baselines (Regression Threshold = +20%)

| Operation | Baseline | Regression Trigger |
|-----------|----------|-------------------|
| Create Lagekarte mit POI | < 100ms | > 120ms |
| Load Lagekarte (50 POIs) | < 50ms | > 60ms |
| Add POI | < 50ms | > 60ms |
| Query POIs by Category | < 30ms | > 36ms |
| Full CRUD Cycle | < 500ms | > 600ms |

---

## 2. Backend Rollback Steps

### 2.1 Code Revert (< 15 Minuten)

#### Option A: Git Revert (Empfohlen)

```bash
# Identifiziere den letzten stabilen Commit vor CQRS Migration
git log --oneline --grep="CQRS" --since="2025-01-01"

# Revert der CQRS-Migration Commits
git revert <commit-hash>..HEAD --no-commit
git commit -m "🚑 Rollback: Revert Lagekarte CQRS Migration"

# Deploy
git push origin main
```

#### Option B: Feature Flag (Falls implementiert)

```typescript
// In lagekarte.module.ts
const useCqrs = this.configService.get('LAGEKARTE_USE_CQRS', 'true') === 'true';

if (useCqrs) {
  // CQRS Controllers + Handlers
} else {
  // Legacy LagekarteService
}
```

### 2.2 Controller Revert Details

**Betroffene Dateien:**
- `src/modules/lagekarte/controllers/lagekarte.controller.ts`
- `src/modules/lagekarte/lagekarte.module.ts`

**Revert Pattern:**
```typescript
// VORHER (CQRS):
@Post()
async createLagekarte(@Body() dto: CreateLagekarteDto) {
  const command = CreateLagekarteCommand.create(...);
  return this.commandBus.execute(command.value);
}

// NACHHER (Legacy):
@Post()
async createLagekarte(@Body() dto: CreateLagekarteDto) {
  return this.lagekarteService.create(dto);
}
```

### 2.3 Verification Steps

```bash
# 1. Run Integration Tests
pnpm --filter @bluelight-hub/backend test -- --testPathPattern="lagekarte"

# 2. Run E2E Tests
pnpm --filter @bluelight-hub/backend test -- lagekarte.e2e

# 3. Manual API Check
curl -X GET http://localhost:3090/api/alpha/lagekarte/einsatz/{einsatzId} \
  -H "Authorization: Bearer {token}"
```

---

## 3. Frontend Rollback Steps

### 3.1 API Client Revert (< 5 Minuten)

```bash
# Regenerate API Client from old spec
git checkout HEAD~1 -- packages/shared/client/

# Or regenerate from current backend
pnpm run generate-api
```

### 3.2 Cache Invalidation

```typescript
// In Frontend: Clear TanStack Query Cache
queryClient.invalidateQueries({ queryKey: ['lagekarte'] });
queryClient.clear();

// Clear Browser Cache (User Action)
// Ctrl+Shift+R oder Cache-Clear im DevTools
```

### 3.3 Manual Testing Checklist

- [ ] Lagekarte für Einsatz abrufen
- [ ] POI hinzufügen (mit Lat/Lng)
- [ ] POI hinzufügen (mit MGRS)
- [ ] POI Position aktualisieren
- [ ] POI entfernen
- [ ] MGRS-Anzeige in UI korrekt

---

## 4. Database Considerations

### 4.1 Schema Kompatibilität

Die CQRS-Migration ändert **NICHT** das Datenbankschema. Rollback erfordert keine DB-Migration.

**Unveränderte Tabellen:**
- `lagekarte` (id, einsatzId, state, createdAt, updatedAt)
- `lagekarte_poi` (id, lagekarteId, name, type, mgrs, latitude, longitude, ...)

### 4.2 Daten-Integrität Check

```sql
-- Verify no orphaned POIs
SELECT COUNT(*) FROM lagekarte_poi lp
LEFT JOIN lagekarte l ON lp."lagekarteId" = l.id
WHERE l.id IS NULL;

-- Verify MGRS/LatLng consistency
SELECT id, name, mgrs, latitude, longitude
FROM lagekarte_poi
WHERE mgrs IS NULL OR latitude IS NULL OR longitude IS NULL;
```

---

## 5. Monitoring Checklist

### 5.1 Logs zu prüfen

| Log Source | Was prüfen | Command |
|------------|------------|---------|
| Backend Logs | Error Rate, Response Times | `docker logs backend --since 10m` |
| PostgreSQL | Query Performance | `SELECT * FROM pg_stat_statements WHERE query LIKE '%lagekarte%'` |
| Application Insights | Exception Rate | Dashboard: Lagekarte Errors |

### 5.2 Metriken

| Metrik | Erwarteter Wert | Alert Threshold |
|--------|-----------------|-----------------|
| API Response Time (p95) | < 200ms | > 500ms |
| Error Rate | < 0.1% | > 1% |
| DB Query Time (avg) | < 50ms | > 100ms |

### 5.3 Health Check Endpoints

```bash
# Backend Health
curl http://localhost:3090/health

# Lagekarte-spezifischer Check
curl -X GET http://localhost:3090/api/alpha/lagekarte/einsatz/{test-einsatz-id} \
  -H "Authorization: Bearer {token}"
```

---

## 6. Communication Plan

### 6.1 Bei Rollback-Entscheidung

1. **Slack/Teams:** `#bluelight-hub-alerts` - Rollback angekündigt
2. **Stakeholder:** Product Owner informieren
3. **Documentation:** Incident Report erstellen

### 6.2 Nach Rollback

1. **Post-Mortem:** Root Cause Analysis innerhalb 24h
2. **Fix Plan:** Dokumentation der erforderlichen Fixes
3. **Re-Migration:** Neuer Deployment-Plan nach Fixes

---

## 7. Rollback Validation

Nach erfolgreichem Rollback:

- [ ] Integration Tests: 100% passing
- [ ] E2E Tests: 100% passing
- [ ] Manual Testing: Alle Checklist-Items grün
- [ ] Performance: Innerhalb Baselines
- [ ] Error Rate: < 0.1%
- [ ] Stakeholder: Informiert

---

## Anhang

### A. Betroffene Commits (Epic 2)

| Story | Beschreibung | Commit Range |
|-------|--------------|--------------|
| 2.1 | Application Layer Commands | abc123..def456 |
| 2.2 | Application Layer Queries | def456..ghi789 |
| 2.3 | Infrastructure Repository | ghi789..jkl012 |
| 2.6 | Controller Refactoring | mno345..pqr678 |
| 2.7 | Event Publishing | pqr678..stu901 |

### B. Kontakte

| Rolle | Name | Kontakt |
|-------|------|---------|
| Tech Lead | [Name] | [Email/Slack] |
| DevOps | [Name] | [Email/Slack] |
| Product Owner | [Name] | [Email/Slack] |

---

*Dokument erstellt: 2025-11-22*
*Letzte Aktualisierung: 2025-11-22*
*Version: 1.0*
