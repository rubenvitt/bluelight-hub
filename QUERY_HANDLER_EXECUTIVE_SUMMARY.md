# Query Handler Implementation - Executive Summary for Story 2.2

**Research Complete:** November 18, 2025
**Status:** Ready for Implementation
**Risk Level:** LOW (proven patterns from Story 2.1)

---

## Key Findings

### 1. CQRS Pattern is Already Established

**From Story 2.1 (Commands):**
- ✅ Command classes with validation in constructor
- ✅ @Injectable() Handlers with Result<T> error handling
- ✅ Repository pattern for data access
- ✅ Comprehensive unit tests with jest.fn() mocks

**For Story 2.2 (Queries):**
- Apply SAME patterns as Commands, but for read operations
- NO events, NO saves, NO side effects
- DTO mapping is the main difference

### 2. DTO Patterns Already Exist

**From EinsatzService:**
- EinsatzResponseDto with @ApiProperty decorators
- EinsatzQueryDto with filters + pagination
- Direct Prisma→DTO mapping (no intermediate Aggregate always)

**For Lagekarte Queries:**
- Create LagekarteDto (response) + PoiDto (nested)
- Add both MGRS and Lat/Lng to PoiDto (frontend flexibility)
- Use pure mapper functions

### 3. Testing Patterns are Proven

**From CreateLagekarteCommandHandler.spec.ts:**
- Direct handler instantiation (no NestJS TestingModule)
- jest.fn() mocks for repositories
- BDD Given-When-Then structure
- Success + Failure + Edge case tests

**For Query Handlers:**
- Same test structure
- Focus on DTO mapping (coordinate conversion)
- Test null handling (not found = success with null)

---

## Critical Implementation Notes

### Pattern: Query Handler Orchestration

```
Query Object (validation)
    ↓
Handler.execute()
    ├─ Step 1: Validate input (EinsatzId format)
    ├─ Step 2: Load from repository (findByEinsatzId, etc.)
    ├─ Step 3: Handle not-found (return null, not error)
    ├─ Step 4: Map Aggregate → DTO (via mapper)
    └─ Step 5: Return Result<DTO>
```

### Key Differences from Commands

| Aspect | Commands | Queries |
|--------|----------|---------|
| **Side Effects** | YES (save to DB) | NO |
| **Event Publishing** | YES | NO |
| **Return Type** | Created ID | DTO or null |
| **Null Case** | Error | Valid response |
| **Validation** | Heavy (business rules) | Light (format only) |

### Result<T> Pattern Usage

```typescript
// Success with data
return Result.ok(lagekarteDto);

// Success with no data (not an error!)
return Result.ok<LagekarteDto | null>(null);

// Failure
return Result.fail<LagekarteDto | null>('Error message');
```

---

## Implementation Checklist

- [ ] Create `src/application/lagekarte/queries/` directory
- [ ] Implement 3 Query classes:
  - `GetLagekarteQuery` (by einsatzId)
  - `GetPoisQuery` (with optional category filter)
  - `GetLagekarteExistsQuery` (boolean check)
- [ ] Implement 3 Handlers (mirror command structure)
- [ ] Create DTOs: `LagekarteDto`, `PoiDto`
- [ ] Create Mappers: `LagekarteDtoMapper`, `PoiDtoMapper`
- [ ] Write unit tests for all 3 handlers (>90% coverage)
- [ ] Verify coordinate conversion (MGRS↔Lat/Lng) in tests
- [ ] Export from `queries/index.ts`

**Estimated Effort:** 6-8 hours (based on 2.1 pattern reuse)

---

## Risk Assessment

### Low Risk Areas
- ✅ Query classes (simple data holders)
- ✅ Handler structure (proven in Story 2.1)
- ✅ DTOs (standard NestJS pattern)
- ✅ Testing approach (jest.fn() mocks)

### Medium Risk Areas
- ⚠️ Coordinate conversion (MGRS→Lat/Lng)
  - Mitigation: Use existing GeoCoordinate VO with unit tests
- ⚠️ DTO mapping edge cases (null beschreibung, empty pois)
  - Mitigation: Test coverage >90%

### No Risk Areas
- ✅ API integration (Story 2.6)
- ✅ Frontend client generation (standard pnpm run generate-api)

---

## Code Readiness

### Complete & Ready (0 modifications needed)
1. **Query Handler Template** - CreateLagekarteCommandHandler pattern
2. **DTO Patterns** - EinsatzResponseDto, EinsatzQueryDto examples
3. **Mapper Functions** - toUserResponseDto example
4. **Test Structure** - CreateLagekarteCommandHandler.spec.ts

### Needs Minimal Adaptation
1. **Domain Aggregate** - LagekarteAggregate (already has PDOs + events)
2. **Repository Interface** - ILagekarteRepository (already defined)
3. **Value Objects** - EinsatzId, LagekarteId, etc. (all ready)

### New Code Required
1. Query classes (3 files, ~100 LOC each)
2. Handlers (3 files, ~50-80 LOC each)
3. DTOs (1 file, ~100 LOC)
4. Mappers (2 files, ~50-70 LOC each)
5. Tests (3 files, ~150-200 LOC each)

**Total New Code:** ~1,500-2,000 LOC (mostly test code)

---

## Files to Reference During Implementation

### Must Read
1. `/packages/backend/src/application/lagekarte/commands/create-lagekarte.handler.ts` - Handler pattern
2. `/packages/backend/src/application/lagekarte/commands/__tests__/create-lagekarte.handler.spec.ts` - Test pattern
3. `/packages/backend/src/einsatz/dto/einsatz-response.dto.ts` - DTO pattern
4. `/packages/backend/src/auth/mappers/user-response.mapper.ts` - Mapper pattern

### Should Read
1. `/packages/backend/src/domain/aggregates/lagekarte.aggregate.ts` - Domain model
2. `/packages/backend/src/domain/repositories/i-lagekarte.repository.ts` - Repository contract
3. `/docs/epics/276-hexagonale-architektur/epic-2-lagekarte-bounded-context-migration.md` - Story 2.2 spec

### Reference Only
1. `/packages/backend/src/einsatz/einsatz.service.ts` - Query examples (old pattern)
2. `/docs/architecture/3-backend-architecture.md` - Architecture overview

---

## Potential Questions & Answers

**Q: Should handlers extend a base class?**
A: No. Direct instantiation pattern used (simpler testing, no NestJS overhead).

**Q: What if query parameter is invalid?**
A: Return Result.fail() with error message. Handler doesn't throw exceptions.

**Q: Can queries return partial data?**
A: Yes. Use `null` for "not found" (valid success). Use `Result.fail()` for errors only.

**Q: Should mappers have dependencies?**
A: No. Mappers are pure functions. All dependencies passed via handler.

**Q: Can I cache query results?**
A: Architecture supports it (future: QueryBus pattern). For MVP: no caching needed.

**Q: Do queries need to check authorization?**
A: No. Authorization happens in Controller/Guard layer. Handlers are business logic only.

**Q: Should I test the mapper separately?**
A: Yes. At least one test case per mapper function (unit test).

---

## Success Criteria Checklist

### Code Quality
- [ ] All 3 query handlers implemented
- [ ] All 3 handlers fully tested (>90% coverage)
- [ ] No NestJS TestingModule in tests
- [ ] jest.fn() mocks for repositories
- [ ] Result<T> for all returns

### Functionality
- [ ] GetLagekarteQuery returns LagekarteDto with POI array
- [ ] PoiDto includes both MGRS and Lat/Lng coordinates
- [ ] GetPoisQuery filters by category if provided
- [ ] GetLagekarteExistsQuery returns boolean
- [ ] Null handling works (not found ≠ error)

### Testing
- [ ] Success cases (data found + not found)
- [ ] Failure cases (repository errors)
- [ ] DTO mapping validation
- [ ] Coordinate conversion tests
- [ ] Edge cases (empty collections, null fields)

### Integration
- [ ] Exported from `queries/index.ts`
- [ ] Controller ready for Story 2.6 (QueryBus)
- [ ] API spec generation ready (pnpm run generate-api)

---

## Next Steps

1. **Review** this research document
2. **Read** referenced files above
3. **Use** code templates from QUERY_HANDLER_CODE_TEMPLATES.md
4. **Implement** 3 Query classes (copy-paste from templates)
5. **Implement** 3 Handlers (adapt from Command pattern)
6. **Write** unit tests (use test template)
7. **Validate** >90% coverage
8. **Commit** with message: `✨(application): Add Lagekarte Query Handlers (Story 2.2)`

---

## Research Documents Created

1. **QUERY_HANDLER_RESEARCH.md** (comprehensive)
   - Complete pattern analysis
   - Existing code examples
   - Testing strategies
   - Implementation guide

2. **QUERY_HANDLER_CODE_TEMPLATES.md** (ready-to-use)
   - Copy-paste code snippets
   - All required classes
   - Handlers, DTOs, Mappers
   - Test templates

3. **QUERY_HANDLER_EXECUTIVE_SUMMARY.md** (this file)
   - Overview for decision makers
   - Risk assessment
   - Implementation checklist
   - Quick reference

---

## Conclusion

Query Handler implementation for Story 2.2 is **LOW RISK** and **STRAIGHTFORWARD** because:

1. ✅ CQRS pattern proven in Story 2.1 (Commands)
2. ✅ DTO patterns already used throughout codebase (Einsatz Service)
3. ✅ Testing approach proven (Command handler tests)
4. ✅ Repository interface ready (Story 2.1)
5. ✅ Domain Aggregate complete (Story 2.1)

**Estimated Implementation Time:** 6-8 hours
**Risk Level:** LOW
**Complexity:** MEDIUM (coordinate conversion, mapping)

Ready to proceed with implementation using provided templates and patterns.

