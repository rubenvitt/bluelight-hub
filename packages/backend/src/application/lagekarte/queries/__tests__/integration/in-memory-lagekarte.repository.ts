import type { ILagekarteRepository } from '@domain/repositories/i-lagekarte.repository';
import type { LagekarteAggregate } from '@domain/aggregates/lagekarte.aggregate';
import type { LagekarteId } from '@domain/value-objects/lagekarte-id';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';

/**
 * In-Memory-Implementation des Lagekarte-Repositories für Integration Tests.
 *
 * Diese Implementierung speichert Aggregates in einer Map und ermöglicht es,
 * Integration Tests ohne echte Datenbank auszuführen. Dadurch können wir
 * den vollen Flow (Handler → Repository → Domain → Mapper) testen.
 *
 * **Warum In-Memory Repository:**
 * - Keine Datenbank erforderlich (schnellere Tests, kein Docker/Setup)
 * - Testet vollständigen Flow ohne Mocks (echte Domain-Objekte)
 * - Implementiert ILagekarteRepository Interface (gleicher Contract wie Prisma)
 * - Ermöglicht Validierung von Mapper → Aggregate → Repository Integration
 *
 * **Unterschied zu Unit Tests:**
 * - Unit Tests: Mocked Repository (jest.fn()) - testet Handler isoliert
 * - Integration Tests: In-Memory Repository - testet Handler + Domain + Repository
 *
 * **Test Helpers:**
 * - clear(): Löscht alle Aggregates (für beforeEach cleanup)
 * - count(): Gibt Anzahl der gespeicherten Aggregates zurück (für Assertions)
 *
 * @example
 * ```typescript
 * // In Integration Test
 * const repository = new InMemoryLagekarteRepository();
 * const handler = new GetLagekarteQueryHandler(repository);
 *
 * // Aggregate speichern
 * const aggregate = LagekarteAggregate.create({ ... }).value!;
 * await repository.save(aggregate);
 *
 * // Handler ausführen (testet vollen Flow)
 * const result = await handler.execute(query);
 * // Testet: Handler → Repository → Domain → Mapper → DTO
 * ```
 */
export class InMemoryLagekarteRepository implements ILagekarteRepository {
  /**
   * Map zur Speicherung der Aggregates.
   * Key: LagekarteId.value (String)
   * Value: LagekarteAggregate
   */
  private aggregates: Map<string, LagekarteAggregate> = new Map();

  /**
   * Speichert ein Lagekarte-Aggregat (Upsert Pattern).
   *
   * Implementiert ILagekarteRepository.save() Interface.
   * Speichert das Aggregate in der Map, überschreibt existierende Einträge.
   *
   * @param aggregate - Das zu speichernde Lagekarte-Aggregat
   */
  async save(aggregate: LagekarteAggregate): Promise<void> {
    this.aggregates.set(aggregate.id.value, aggregate);
  }

  /**
   * Lädt eine Lagekarte anhand ihrer ID.
   *
   * Implementiert ILagekarteRepository.findById() Interface.
   * Gibt null zurück wenn Lagekarte nicht gefunden wird.
   *
   * @param id - Die Lagekarte-ID
   * @returns Das Aggregat oder null
   */
  async findById(id: LagekarteId): Promise<LagekarteAggregate | null> {
    return this.aggregates.get(id.value) ?? null;
  }

  /**
   * Lädt eine Lagekarte anhand der Einsatz-ID.
   *
   * Implementiert ILagekarteRepository.findByEinsatzId() Interface.
   * Durchsucht alle Aggregates und findet das erste mit passender EinsatzId.
   *
   * @param einsatzId - Die Einsatz-ID
   * @returns Das Aggregat oder null
   */
  async findByEinsatzId(einsatzId: EinsatzId): Promise<LagekarteAggregate | null> {
    // Find first aggregate matching einsatzId
    for (const aggregate of this.aggregates.values()) {
      if (aggregate.einsatzId.equals(einsatzId)) {
        return aggregate;
      }
    }
    return null;
  }

  /**
   * Prüft ob eine Lagekarte für einen Einsatz existiert.
   *
   * Implementiert ILagekarteRepository.exists() Interface.
   * Performance-optimiert: Stoppt beim ersten Match.
   *
   * @param einsatzId - Die Einsatz-ID
   * @returns true wenn Lagekarte existiert, false sonst
   */
  async exists(einsatzId: EinsatzId): Promise<boolean> {
    for (const aggregate of this.aggregates.values()) {
      if (aggregate.einsatzId.equals(einsatzId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Test Helper: Löscht alle gespeicherten Aggregates.
   *
   * Wird in afterEach() verwendet um Test-Isolation zu gewährleisten.
   * Jeder Test startet mit leerem Repository.
   */
  clear(): void {
    this.aggregates.clear();
  }

  /**
   * Test Helper: Gibt Anzahl der gespeicherten Aggregates zurück.
   *
   * Nützlich für Assertions in Tests (z.B. "expect(repo.count()).toBe(1)").
   *
   * @returns Anzahl der Aggregates in der Map
   */
  count(): number {
    return this.aggregates.size;
  }
}
