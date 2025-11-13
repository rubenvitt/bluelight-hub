# Epic 5: System Consolidation & Optimization

**Goal:** Remove old 3-Tier architecture code, optimize performance, establish test baseline.

**Business Value:**
- Technical debt completely eliminated
- Performance optimized (benchmarking)
- Test coverage established (Domain Layer)
- Migration fully completed

**Technical Scope:**
- Delete old Services (EinsatzService, EtbService, LagekarteService)
- Migrate remaining tests to new architecture
- Performance benchmarking (before/after comparison)
- Optional: Specification Pattern for complex queries
- Documentation updates (arc42, ADRs)

**Success Criteria:**
- [ ] Old services deleted
- [ ] Domain Layer test coverage >80%
- [ ] Performance regression <5%
- [ ] Documentation updated

**Estimated Effort:** 12-16h

---

## Story 5.1: Delete Old Services & Controllers

**As a** Backend Developer,
**I want** old 3-Tier architecture code deleted,
**So that** the codebase only contains the new Hexagonal Architecture.

**Acceptance Criteria:**

**Given** Migration complete (Epic 1-4)
**When** I delete old code
**Then** the following files removed:

**Deleted Files:**
- `src/modules/einsatz/einsatz.service.ts`
- `src/modules/etb/etb.service.ts`
- `src/modules/lagekarte/lagekarte.service.ts`
- Old controller implementations (if any duplicates)
- Old repository implementations (non-Aggregate-based)

**And** ESLint checks pass:
- No unused imports
- No dead code
- No circular dependencies

**And** Integration-Tests still green:
- All API endpoints functional
- NO regressions

**And** Git commit:
```bash
git commit -m "🗑️(cleanup): Remove old 3-Tier architecture services"
```

**Prerequisites:**
- Epic 1-4 complete
- All integration tests passing

**Technical Notes:**
- Create backup branch before deletion
- Run full test suite after deletion
- Rollback plan: Git revert

---

## Story 5.2: Domain Layer Unit-Test Coverage

**As a** Backend Developer,
**I want** comprehensive unit-tests for Domain Layer,
**So that** business rules are validated without framework dependencies.

**Acceptance Criteria:**

**Given** Domain Layer complete
**When** I implement unit-tests
**Then** the following coverage achieved:

**Coverage Target:**
- Aggregates: >90% coverage
- Value Objects: >80% coverage
- Domain Services: >80% coverage
- Overall Domain Layer: >80% coverage

**Example Tests:**
```typescript
describe('EinsatzAggregate', () => {
  it('should enforce NO-DELETE policy', () => {
    const einsatz = EinsatzAggregate.create({ ... });
    expect(einsatz.canBeDeleted()).toBe(false);
  });

  it('should reject backward status transition', () => {
    const einsatz = EinsatzAggregate.create({ status: EinsatzStatus.ABGESCHLOSSEN });
    const result = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG);
    expect(result.isFailure).toBe(true);
  });

  it('should emit event on complete', () => {
    const einsatz = EinsatzAggregate.create({ status: EinsatzStatus.IN_BEARBEITUNG });
    einsatz.complete(new UserId('user-1'));

    const events = einsatz.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(EinsatzCompletedEvent);
  });
});
```

**And** Test Speed:
- 100+ Domain tests in <1s (no framework overhead)

**Prerequisites:**
- Epic 1 (Domain Layer)

**Technical Notes:**
- Use Vitest for speed
- NO framework dependencies in tests
- Pure TypeScript tests

---

## Story 5.3a: Performance Baseline Measurement (BEFORE Migration) 🆕 🔴 REQUIRED

**As a** Backend Developer,
**I want** baseline performance metrics measured BEFORE starting Epic 1,
**So that** we have objective data to validate NFR-4 (API <200ms p95) and detect regressions.

**Acceptance Criteria:**

**Given** Old 3-Tier architecture is still running (BEFORE Epic 1 starts)
**When** I measure baseline performance
**Then** the following completed:

**1. Baseline Benchmark Scenarios**

Run Artillery.io load tests on OLD code (current implementation):
```yaml
# artillery-baseline.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 20 # 20 requests/second
  processor: "./artillery-helpers.js"

scenarios:
  - name: "Create Einsatz"
    flow:
      - post:
          url: "/api/einsatz"
          json:
            alarmstichwort: "B3 Brand mittel"
            einsatzort: { ort: "Teststadt" }

  - name: "Get Active Einsätze"
    flow:
      - get:
          url: "/api/einsatz"

  - name: "Add ETB Eintrag"
    flow:
      - post:
          url: "/api/etb/{{einsatzId}}/eintrag"
          json:
            text: "Einsatzkraft 1 eingetroffen"

  - name: "Complete Einsatz"
    flow:
      - post:
          url: "/api/einsatz/{{einsatzId}}/complete"
```

**2. Baseline Report Document**

Create `docs/performance-baseline.md`:
```markdown
# Performance Baseline Report

**Date:** {DATE}
**Branch:** main (BEFORE Epic 1)
**Commit:** {COMMIT_SHA}
**Environment:** Development (localhost, PostgreSQL 17)

## Baseline Metrics (Old 3-Tier Architecture)

### Response Time (p95)
| Scenario | p50 | p95 | p99 | Max |
|----------|-----|-----|-----|-----|
| Create Einsatz | {Xms} | {Yms} | {Zms} | {Wms} |
| Get Active Einsätze | {Xms} | {Yms} | {Zms} | {Wms} |
| Add ETB Eintrag | {Xms} | {Yms} | {Zms} | {Wms} |
| Complete Einsatz | {Xms} | {Yms} | {Zms} | {Wms} |

### Throughput
- **Total Requests:** {N}
- **Success Rate:** {X%}
- **Requests/Second:** {RPS}

### Memory Usage
- **Initial:** {Xmb} MB
- **Peak:** {Ymb} MB
- **Average:** {Zmb} MB

## Acceptance Range for Migration

**NFR-4 Requirement:** API <200ms p95

**Acceptable Variance:** ±5% (stricter than initial ±10% for quality)
- If baseline p95 = 150ms → Acceptable range: 142ms - 157ms
- If baseline p95 = 180ms → Acceptable range: 171ms - 189ms

**Red Flags:**
- p95 >200ms in new architecture (NFR-4 violation)
- Regression >10% (performance degradation)
- Memory increase >20% (memory leak risk)

## Baseline Command

```bash
# Run baseline benchmark
artillery run artillery-baseline.yml -o baseline-report.json

# Generate HTML report
artillery report baseline-report.json -o baseline-report.html
```
```

**3. Baseline Artifacts Saved**

Store in version control:
- `artillery-baseline.yml` - Load test configuration
- `baseline-report.json` - Raw Artillery results
- `baseline-report.html` - Human-readable report
- `docs/performance-baseline.md` - Documented baseline

**4. Acceptance Criteria**

- ✅ Baseline measured on old 3-Tier architecture (BEFORE any Epic 1 changes)
- ✅ Baseline report document created with actual metrics
- ✅ Acceptance range calculated (±5% from baseline p95)
- ✅ Baseline artifacts committed to Git
- ✅ Baseline p95 <200ms for all scenarios (validates current system meets NFR-4)
- ✅ If baseline p95 >200ms: Document as existing issue (not regression from migration)

**Prerequisites:**
- Old 3-Tier architecture functional
- Artillery.io installed (`npm install -g artillery`)
- PostgreSQL seeded with test data
- Backend running on localhost:3000

**Technical Notes:**
- **Timing:** Run BEFORE Epic 1 starts (critical sequencing)
- Baseline is ONE-TIME measurement (not repeated)
- Use same test data seed for all benchmarks (consistency)
- Run during low-load hours (avoid noise from background processes)
- Warm-up phase: Discard first 10 requests (JIT compilation, cold start)
- Document environmental factors (CPU, RAM, Docker vs native, etc.)
- Baseline establishes objective truth for "acceptable" performance

**Effort Estimate:** 1-1.5h
- 15min: Setup Artillery.io + test configuration
- 30min: Run baseline benchmarks (multiple runs for consistency)
- 15min: Generate reports + document findings
- 15min: Commit baseline artifacts

**Priority:** 🔴 REQUIRED (Blocker for Epic 1 - NFR-4 validation dependency)

**Sequencing:** **MUST RUN BEFORE EPIC 1 STARTS**

---

## Story 5.3: Performance Benchmarking & Optimization (AFTER Migration) 🔄 REQUIRED

**As a** Backend Developer,
**I want** performance benchmarks AFTER migration compared to baseline,
**So that** we verify no performance regression (NFR-4 compliance).

**Acceptance Criteria:**

**Given** Migration complete (Epic 1-4) AND Baseline exists (Story 5.3a)
**When** I run post-migration benchmarks
**Then** the following metrics validated:

**1. Post-Migration Benchmarks**

Run SAME Artillery.io configuration on NEW architecture:
```bash
# Use SAME artillery-baseline.yml from Story 5.3a
artillery run artillery-baseline.yml -o migration-report.json
artillery report migration-report.json -o migration-report.html
```

**2. Comparison Report Document**

Create `docs/performance-comparison.md`:
```markdown
# Performance Comparison Report

**Date:** {DATE}
**Branch:** hexagonal-architecture (AFTER Epic 1-4)
**Commit:** {COMMIT_SHA}
**Baseline Commit:** {BASELINE_COMMIT_SHA}

## Comparison: Old vs New Architecture

### Response Time (p95)
| Scenario | Baseline p95 | New p95 | Delta | Status |
|----------|--------------|---------|-------|--------|
| Create Einsatz | {Xms} | {Yms} | {±Zms} | ✅/❌ |
| Get Active Einsätze | {Xms} | {Yms} | {±Zms} | ✅/❌ |
| Add ETB Eintrag | {Xms} | {Yms} | {±Zms} | ✅/❌ |
| Complete Einsatz | {Xms} | {Yms} | {±Zms} | ✅/❌ |

**Legend:**
- ✅ Green: Within ±5% of baseline
- ⚠️ Yellow: 5-10% regression (acceptable, monitor)
- ❌ Red: >10% regression (requires optimization)

### Throughput Comparison
- **Baseline RPS:** {X}
- **New RPS:** {Y}
- **Delta:** {±Z%}

### Memory Comparison
- **Baseline Peak:** {Xmb} MB
- **New Peak:** {Ymb} MB
- **Delta:** {±Z%}

## NFR-4 Validation

**Requirement:** API <200ms p95

| Scenario | New p95 | NFR-4 Status |
|----------|---------|--------------|
| Create Einsatz | {Xms} | ✅/❌ |
| Get Active Einsätze | {Xms} | ✅/❌ |
| Add ETB Eintrag | {Xms} | ✅/❌ |
| Complete Einsatz | {Xms} | ✅/❌ |

## Optimization Actions

**IF Regression >5%:**
- [ ] Implement lazy loading for Aggregates
- [ ] Add CQRS Read Models for complex queries
- [ ] Enable query result caching (Redis)
- [ ] Profile slow endpoints (Node.js --inspect)

**IF Regression >10% (CRITICAL):**
- [ ] MANDATORY optimization before Epic 5 completion
- [ ] Re-run benchmarks after optimization
- [ ] Document optimization approach in ADR
```

**3. Acceptance Criteria (Strict)**

- ✅ **REQUIRED:** All scenarios p95 <200ms (NFR-4 compliance)
- ✅ **REQUIRED:** Performance regression ≤5% from baseline (preferred)
- ⚠️ **ACCEPTABLE:** Performance regression 5-10% (with justification + monitoring plan)
- ❌ **UNACCEPTABLE:** Performance regression >10% (MUST optimize before Epic 5 completion)

**4. Optimization if Regression >5%**

**Lazy Loading for Aggregates:**
```typescript
// Instead of loading full aggregate:
const einsatz = await repo.findById(id);

// Load only metadata (lightweight):
const einsatzMetadata = await repo.findMetadataById(id);
```

**CQRS Read Models:**
```typescript
// Bypass Aggregate for queries:
const activeEinsaetze = await prisma.einsatz.findMany({
  where: { status: { not: 'ARCHIVIERT' } },
  select: { id: true, nummer: true, alarmstichwort: true, status: true }
});
```

**Caching (Optional):**
```typescript
@UseInterceptors(CacheInterceptor)
@CacheTTL(300) // 5 minutes
@Get('/einsatz')
async getActiveEinsaetze() { ... }
```

**Prerequisites:**
- Epic 1-4 complete
- Story 5.3a (Baseline) measured

**Technical Notes:**
- **Timing:** Run AFTER Epic 4 complete (all migrations done)
- Use SAME test data seed as baseline (apples-to-apples comparison)
- Run multiple iterations for statistical significance (5 runs, report median)
- Acceptable variance: ±5% (stricter than initial ±10% for quality assurance)
- If regression >10%: MANDATORY optimization before Epic 5 sign-off
- Document any performance improvements (e.g., CQRS may be FASTER than old code)

**Effort Estimate:** 3-5h
- 30min: Run post-migration benchmarks (multiple iterations)
- 1h: Generate comparison report + analysis
- 2-3h: Optimization if regression detected (conditional)
- 30min: Re-run benchmarks after optimization (if needed)

**Priority:** 🔴 REQUIRED (Blocker for Epic 5 sign-off - NFR-4 validation)

**Sequencing:** **RUNS AFTER EPIC 1-4 COMPLETE**

---

## Story 5.4: Documentation Updates (ADRs + arc42)

**As a** Backend Developer,
**I want** architecture documentation updated,
**So that** the new architecture is documented for future developers.

**Acceptance Criteria:**

**Given** Migration complete
**When** I update documentation
**Then** the following completed:

**1. ADRs Created:**
- `docs/adr/001-hexagonal-architecture.md`
- `docs/adr/002-strangler-fig-pattern.md`
- `docs/adr/003-cqrs.md`
- `docs/adr/004-transactional-outbox.md`

**2. arc42 Updated:**
- `docs/architecture/05-building-block-view.md` - New layer structure
- `docs/architecture/08-concepts.md` - DDD, CQRS, Outbox patterns
- `docs/architecture/09-architecture-decisions.md` - Link to ADRs

**3. README Updated:**
- Domain Layer README (`packages/backend/src/domain/README.md`)
- Application Layer README
- Infrastructure Layer README

**Prerequisites:**
- Epic 1-4 complete

**Technical Notes:**
- ADRs follow standard format
- arc42 sections updated incrementally
- READMEs include code examples

---

## Story 5.5: Final Validation & Migration Completion

**As a** Backend Developer,
**I want** final validation checklist completed,
**So that** migration is officially done.

**Acceptance Criteria:**

**Given** Epic 1-5 complete
**When** I run final validation
**Then** the following checklist completed:

**Checklist:**
- [ ] All old services deleted
- [ ] All integration tests green
- [ ] Domain test coverage >80%
- [ ] Performance benchmarks ±10%
- [ ] Frontend functional
- [ ] ADRs written
- [ ] arc42 updated
- [ ] NO Prisma imports outside Infrastructure Layer
- [ ] NO circular dependencies
- [ ] Event publishing via Outbox working
- [ ] NO-DELETE policy enforced
- [ ] RBAC working (Min 1 SUPER_ADMIN)

**And** Git tag:
```bash
git tag -a v2.0.0-hexagonal-architecture -m "Complete migration to Hexagonal Architecture + DDD"
```

**And** Retrospective:
- Document lessons learned
- Note any technical debt remaining
- Plan future optimizations

**Prerequisites:**
- All Stories 5.1-5.4 complete

**Technical Notes:**
- Final smoke test run manually
- Migration officially complete
- Celebrate! 🎉

---

## Story 5.6: Bulk Archive Command (DRK Compliance) 🆕

**As a** Backend Developer,
**I want** a bulk archival command for old Einsätze,
**So that** DRK 10-year retention is easily maintainable.

**Acceptance Criteria:**

**Given** EinsatzArchivalPolicy (Story 1.7) defines 10-year policy
**When** I implement bulk archival
**Then** the following exist:

**1. ArchiveOldEinsaetzeCommand & Handler**

Command:
```typescript
class ArchiveOldEinsaetzeCommand {
  constructor(
    public readonly archivedBy: string,
    public readonly dryRun: boolean = true // Safety: default to dry-run
  ) {}
}
```

Handler:
```typescript
@CommandHandler(ArchiveOldEinsaetzeCommand)
class ArchiveOldEinsaetzeHandler {
  async execute(command: ArchiveOldEinsaetzeCommand): Promise<Result<BulkArchiveResultDto>> {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    // Find eligible Einsätze
    const einsaetze = await this.einsatzRepo.findEligibleForArchival(tenYearsAgo);

    const results = {
      eligible: einsaetze.length,
      archived: 0,
      failed: [] as { id: string; error: string }[]
    };

    if (command.dryRun) {
      this.logger.log(`DRY RUN: ${einsaetze.length} Einsätze eligible for archival`);
      return Result.ok(results);
    }

    // Batch processing: 100 per transaction
    const batches = this.chunk(einsaetze, 100);

    for (const batch of batches) {
      await this.prisma.$transaction(async (tx) => {
        for (const einsatz of batch) {
          try {
            const result = einsatz.archive(new UserId(command.archivedBy));
            if (result.isFailure) {
              results.failed.push({ id: einsatz.id.value, error: result.error });
              continue;
            }

            await this.einsatzRepo.save(einsatz);
            results.archived++;
          } catch (error) {
            results.failed.push({ id: einsatz.id.value, error: error.message });
          }
        }
      });
    }

    this.logger.log(`Archived ${results.archived}/${results.eligible} Einsätze`);
    return Result.ok(results);
  }

  private chunk<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size)
    );
  }
}
```

**2. Repository Method**

Add to `IEinsatzRepository`:
```typescript
findEligibleForArchival(olderThan: Date): Promise<EinsatzAggregate[]>;
```

Implementation in `PrismaEinsatzRepository`:
```typescript
async findEligibleForArchival(olderThan: Date): Promise<EinsatzAggregate[]> {
  const einsaetze = await this.prisma.einsatz.findMany({
    where: {
      status: 'ABGESCHLOSSEN',
      abgeschlossenAt: { lte: olderThan }
    }
  });

  return einsaetze.map(PrismaEinsatzMapper.toDomain);
}
```

**3. CLI Command** (NestJS Console)

```typescript
@Console()
class ArchivalConsole {
  @Command({
    command: 'archive:old-einsaetze',
    description: 'Archive Einsätze older than 10 years (DRK policy)'
  })
  async archiveOld(
    @Option({ flags: '--dry-run', description: 'Preview without archiving' }) dryRun: boolean,
    @Option({ flags: '--user <userId>', description: 'User performing archival' }) userId: string
  ) {
    const command = new ArchiveOldEinsaetzeCommand(userId, dryRun);
    const result = await this.commandBus.execute(command);

    console.log(result.value);
  }
}
```

**And** Integration-Tests validate:
- Dry-run mode returns eligible count without archiving
- Batch processing archives 100 Einsätze per transaction
- Failed archival logged (doesn't block batch)
- Events emitted for each archived Einsatz

**And** CLI Usage:
```bash
# Dry-run (preview)
pnpm cli archive:old-einsaetze --dry-run --user admin-id

# Actual archival
pnpm cli archive:old-einsaetze --user admin-id
```

**Prerequisites:**
- Story 1.7 (EinsatzArchivalPolicy)
- Story 4.2 (ArchiveEinsatzCommand)

**Technical Notes:**
- **Safety First:** Default to dry-run (prevents accidental mass archival)
- Batch processing prevents long-running transactions (100/batch)
- Failed archival logged, doesn't block batch (resilience)
- CLI command for manual maintenance (cron job optional)

**Effort Estimate:** 4-5h

**Priority:** 🟠 MEDIUM (DRK Compliance - improves operational efficiency)

---

## Story 5.7: Linter Rules for Dependency Direction 🆕

**As a** Backend Developer,
**I want** automated linter rules enforcing dependency direction,
**So that** architecture doesn't drift over time.

**Acceptance Criteria:**

**Given** Hexagonal Architecture enforces Domain → Application → Infrastructure
**When** I configure linter rules
**Then** the following validated:

**1. Biome/ESLint Configuration**

Add to `packages/backend/biome.json`:
```json
{
  "linter": {
    "rules": {
      "nursery": {
        "noRestrictedImports": {
          "level": "error",
          "options": {
            "paths": {
              "domain/**": {
                "importNames": ["Application", "Infrastructure"],
                "message": "Domain layer cannot import from Application or Infrastructure layers"
              },
              "application/**": {
                "importNames": ["Infrastructure"],
                "message": "Application layer cannot import from Infrastructure layer (use Ports)"
              }
            }
          }
        }
      }
    }
  }
}
```

**2. Madge Circular Dependency Check**

Add to `package.json`:
```json
{
  "scripts": {
    "lint:deps": "madge --circular --extensions ts src/",
    "lint:arch": "madge --circular src/domain/ && madge --circular src/application/"
  }
}
```

**3. CI/CD Integration**

Add to `.github/workflows/ci.yml`:
```yaml
- name: Lint Architecture Dependencies
  run: pnpm lint:deps && pnpm lint:arch
```

**4. Pre-Commit Hook**

Add to `.husky/pre-commit`:
```bash
pnpm lint:deps || (echo "❌ Circular dependencies detected!" && exit 1)
```

**And** Validation Tests:
```typescript
describe('Architecture Rules', () => {
  it('should prevent Domain importing from Application', () => {
    const domainFiles = glob.sync('src/domain/**/*.ts');
    domainFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/from ['"].*\/application\//);
    });
  });

  it('should prevent Application importing from Infrastructure', () => {
    const appFiles = glob.sync('src/application/**/*.ts');
    appFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).not.toMatch(/from ['"].*\/infrastructure\//);
    });
  });
});
```

**Prerequisites:**
- Epic 1 (Domain Layer structure)

**Technical Notes:**
- Biome/ESLint rules catch violations at compile-time
- Madge detects circular dependencies (graph analysis)
- CI/CD enforces rules (pull request gate)
- Pre-commit hook prevents local violations

**Effort Estimate:** 2-3h

**Priority:** 🟠 HIGH (Architecture Drift Prevention)

---

