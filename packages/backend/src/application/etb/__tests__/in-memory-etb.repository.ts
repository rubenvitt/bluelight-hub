import type { EinsatztagebuchAggregate } from '@domain/aggregates/einsatztagebuch.aggregate';
import type { IEtbRepository } from '@domain/repositories';
import type { TransactionContext } from '@domain/common';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import type { EtbId } from '@domain/value-objects/etb-id';
import type { EtbSnapshot } from '@domain/value-objects/etb-snapshot';

/**
 * In-Memory-Implementation des ETB-Repositories für Integration Tests.
 *
 * Diese Implementierung speichert Aggregates in einer Map und ermöglicht es,
 * Integration Tests ohne echte Datenbank auszuführen. Dadurch können wir
 * den vollen Flow (Handler -> Repository -> Domain -> Mapper) testen.
 *
 * **Warum In-Memory Repository:**
 * - Keine Datenbank erforderlich (schnellere Tests, kein Docker/Setup)
 * - Testet vollständigen Flow ohne Mocks (echte Domain-Objekte)
 * - Implementiert IEtbRepository Interface (gleicher Contract wie Prisma)
 * - Ermöglicht Validierung von Mapper -> Aggregate -> Repository Integration
 *
 * **Unterschied zu Unit Tests:**
 * - Unit Tests: Mocked Repository (jest.fn()) - testet Handler isoliert
 * - Integration Tests: In-Memory Repository - testet Handler + Domain + Repository
 *
 * **Test Helpers:**
 * - clear(): Loescht alle Aggregates (fuer beforeEach cleanup)
 * - getAll(): Gibt alle gespeicherten Aggregates zurueck (fuer Assertions)
 * - count(): Gibt Anzahl der gespeicherten Aggregates zurueck
 *
 * @example
 * ```typescript
 * // In Integration Test
 * const repository = new InMemoryEtbRepository();
 * const handler = new GetEtbQueryHandler(repository);
 *
 * // Aggregate speichern
 * const etb = createTestEtb({ entriesCount: 3 });
 * await repository.save(etb);
 *
 * // Handler ausfuehren (testet vollen Flow)
 * const result = await handler.execute(query);
 * ```
 */
export class InMemoryEtbRepository implements IEtbRepository {
  /**
   * Map zur Speicherung der Aggregates.
   * Key: EtbId.value (String)
   * Value: EinsatztagebuchAggregate
   */
  private store: Map<string, EinsatztagebuchAggregate> = new Map();

  /**
   * Map zur Speicherung der Snapshot-Historie.
   * Key: EtbId.value (String)
   * Value: Array von EtbSnapshots (neueste zuerst)
   */
  private historyStore: Map<string, EtbSnapshot[]> = new Map();

  /**
   * Speichert ein ETB-Aggregat (Upsert Pattern).
   *
   * Implementiert IEtbRepository.save() Interface.
   * Speichert das Aggregate in der Map, ueberschreibt existierende Eintraege.
   * TransactionContext wird ignoriert (In-Memory hat keine Transactions).
   *
   * @param aggregate - Das zu speichernde ETB-Aggregat
   * @param _tx - Ignoriert: In-Memory braucht keine Transaktionen
   */
  async save(aggregate: EinsatztagebuchAggregate, _tx?: TransactionContext): Promise<void> {
    this.store.set(aggregate.id.value, aggregate);
  }

  /**
   * Laedt ein ETB-Aggregat anhand seiner ID.
   *
   * Implementiert IEtbRepository.findById() Interface.
   * Gibt null zurueck wenn ETB nicht gefunden wird.
   *
   * @param id - Die ETB-ID
   * @param _tx - Ignoriert: In-Memory braucht keine Transaktionen
   * @returns Das Aggregat oder null
   */
  async findById(id: EtbId, _tx?: TransactionContext): Promise<EinsatztagebuchAggregate | null> {
    return this.store.get(id.value) ?? null;
  }

  /**
   * Laedt ein ETB-Aggregat anhand der Einsatz-ID.
   *
   * Implementiert IEtbRepository.findByEinsatzId() Interface.
   * Durchsucht alle Aggregates und findet das erste mit passender EinsatzId.
   * (1:1 Beziehung: Ein Einsatz hat maximal ein ETB)
   *
   * @param einsatzId - Die Einsatz-ID
   * @param _tx - Ignoriert: In-Memory braucht keine Transaktionen
   * @returns Das Aggregat oder null
   */
  async findByEinsatzId(einsatzId: EinsatzId, _tx?: TransactionContext): Promise<EinsatztagebuchAggregate | null> {
    for (const aggregate of this.store.values()) {
      if (aggregate.einsatzId.equals(einsatzId)) {
        return aggregate;
      }
    }
    return null;
  }

  /**
   * Laedt die Versions-Historie eines ETBs.
   *
   * Implementiert IEtbRepository.getHistory() Interface.
   * Gibt die gespeicherten Snapshots zurueck (neueste zuerst).
   *
   * @param id - ETB Aggregate ID
   * @returns Array von Snapshots (neueste zuerst)
   */
  async getHistory(id: EtbId): Promise<EtbSnapshot[]> {
    return this.historyStore.get(id.value) ?? [];
  }

  // ============================================
  // TEST HELPER METHODS
  // ============================================

  /**
   * Test Helper: Loescht alle gespeicherten Aggregates und Snapshots.
   *
   * Wird in afterEach() verwendet um Test-Isolation zu gewaehrleisten.
   * Jeder Test startet mit leerem Repository.
   */
  clear(): void {
    this.store.clear();
    this.historyStore.clear();
  }

  /**
   * Test Helper: Gibt alle gespeicherten Aggregates zurueck.
   *
   * Nuetzlich fuer Assertions in Tests (z.B. Verifizierung aller gespeicherten ETBs).
   *
   * @returns Array aller Aggregates in der Map
   */
  getAll(): EinsatztagebuchAggregate[] {
    return Array.from(this.store.values());
  }

  /**
   * Test Helper: Gibt Anzahl der gespeicherten Aggregates zurueck.
   *
   * Nuetzlich fuer Assertions in Tests (z.B. "expect(repo.count()).toBe(1)").
   *
   * @returns Anzahl der Aggregates in der Map
   */
  count(): number {
    return this.store.size;
  }

  /**
   * Test Helper: Fuegt einen Snapshot zur Historie hinzu.
   *
   * Ermoeglicht manuelle Snapshot-Erstellung in Tests ohne echte
   * Repository-Logik. Snapshots werden vorne eingefuegt (neueste zuerst).
   *
   * @param etbId - ETB Aggregate ID
   * @param snapshot - Der hinzuzufuegende Snapshot
   */
  addSnapshot(etbId: EtbId, snapshot: EtbSnapshot): void {
    const existing = this.historyStore.get(etbId.value) ?? [];
    existing.unshift(snapshot); // Neueste zuerst
    this.historyStore.set(etbId.value, existing);
  }

  /**
   * Test Helper: Gibt Anzahl der Snapshots fuer ein ETB zurueck.
   *
   * @param etbId - ETB Aggregate ID
   * @returns Anzahl der Snapshots
   */
  getSnapshotCount(etbId: EtbId): number {
    return this.historyStore.get(etbId.value)?.length ?? 0;
  }

  /**
   * Test Helper: Prueft ob ein ETB existiert.
   *
   * @param einsatzId - Einsatz-ID zum Pruefen
   * @returns true wenn ETB fuer Einsatz existiert
   */
  async exists(einsatzId: EinsatzId): Promise<boolean> {
    for (const aggregate of this.store.values()) {
      if (aggregate.einsatzId.equals(einsatzId)) {
        return true;
      }
    }
    return false;
  }
}
