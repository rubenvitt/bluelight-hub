import type { TransactionContext } from '@domain/common/transaction';
import type { Result } from '@domain/common/result';
import type { Erinnerung } from '@domain/entities/erinnerung.entity';
import type { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';

/**
 * Repository Port Interface für Erinnerung Aggregate Persistence.
 *
 * Definiert die Abstraction zwischen Domain Layer und Infrastructure Layer
 * (Hexagonal Architecture / Ports & Adapters Pattern).
 *
 * **Warum Interface statt Klasse:**
 * - Domain Layer bleibt framework-agnostisch (kein Prisma/TypeORM/etc.)
 * - Ermöglicht einfaches Mocking in Unit Tests
 * - Infrastructure Layer implementiert das Interface mit konkreter Technologie
 *
 * **Transaction Support:**
 * - `save()` unterstützt optionalen `tx` Parameter für atomare Operationen
 * - Ermöglicht Transactional Outbox Pattern mit Event-Persistierung
 *
 * **Result Pattern:**
 * - Alle Methoden geben `Result<T>` zurück statt direkt `T`
 * - Explizites Error Handling ohne Exceptions für erwartete Fehler
 *
 * @see PrismaErinnerungRepository - Infrastructure Layer Implementierung
 * @see CreateErinnerungHandler - Application Layer Nutzung
 */
export interface IErinnerungRepository {
  /**
   * Speichert ein Erinnerung Aggregate (Create oder Update).
   *
   * **Warum kein separates update():**
   * - Aggregate Root entscheidet über Create vs Update (via ID Existenz)
   * - Infrastructure Layer prüft ob ID existiert und führt INSERT/UPDATE aus
   * - Vereinfacht Domain API (eine Methode für beide Operationen)
   *
   * **Transaction Support (Transactional Outbox Pattern):**
   * - Optional `tx` Parameter für atomare Persistierung mit Outbox Events
   * - Wenn `tx` vorhanden: Nutze Transaction Client (Application Layer Koordination)
   * - Wenn `tx` nicht vorhanden: Nutze Standard Prisma Client (Auto-Commit)
   *
   * **WICHTIG - Repository Responsibility:**
   * - Repository persistiert NUR das Aggregate (Erinnerung Domain Model → DB Row)
   * - KEINE Event-Serialisierung oder Outbox-Persistierung im Repository!
   * - Event Handling ist Application Layer Responsibility (Command Handler)
   *
   * @param aggregate - Das zu speichernde Erinnerung Aggregate
   * @param tx - Optional: Transaction Context für atomare Operationen mit Outbox
   * @returns Result<void> - Success (void) oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * // Without Transaction (Auto-Commit)
   * const erinnerung = Erinnerung.create({
   *   einsatzId,
   *   titel: 'Lagebesprechung',
   *   faelligAm: addMinutes(new Date(), 30),
   *   erstelltVon: userId,
   * }).value!;
   * const result = await repository.save(erinnerung);
   * if (result.isFailure) {
   *   console.error(result.error); // "Database connection failed"
   * }
   *
   * // With Transaction (Atomic with Outbox)
   * await prisma.$transaction(async (tx) => {
   *   await repository.save(erinnerung, tx);
   *   await outboxRepository.save(events, tx);
   * });
   * ```
   */
  save(aggregate: Erinnerung, tx?: TransactionContext): Promise<Result<void>>;

  /**
   * Findet ein Erinnerung Aggregate anhand seiner ID.
   *
   * @param id - Die ErinnerungId des gesuchten Aggregates
   * @param tx - Optional: Transaction Context für konsistente Reads innerhalb einer Transaction
   * @returns Result<Erinnerung | null> - Das gefundene Aggregate oder null wenn nicht vorhanden
   *
   * @example
   * ```typescript
   * const result = await repository.findById(erinnerungId);
   * if (result.isSuccess && result.value) {
   *   console.log(result.value.titel.value); // "Lagebesprechung"
   * }
   * ```
   */
  findById(id: ErinnerungId, tx?: TransactionContext): Promise<Result<Erinnerung | null>>;

  /**
   * Findet alle Erinnerungen eines Einsatzes.
   *
   * **Use Case:**
   * - Story 1.1 AC2: "die Erinnerung erscheint in meiner Liste"
   * - Liste aller Erinnerungen für einen Einsatz anzeigen
   *
   * **Sortierung:**
   * - Standard: Nach faelligAm aufsteigend (nächste Fälligkeit zuerst)
   *
   * @param einsatzId - Die EinsatzId für die Erinnerungen geladen werden sollen
   * @param tx - Optional: Transaction Context für konsistente Reads innerhalb einer Transaction
   * @returns Result<Erinnerung[]> - Liste der gefundenen Erinnerungen
   *
   * @example
   * ```typescript
   * const result = await repository.findByEinsatzId(einsatzId);
   * if (result.isSuccess) {
   *   console.log(`${result.value.length} Erinnerungen gefunden`);
   * }
   * ```
   */
  findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<Result<Erinnerung[]>>;

  /**
   * Prüft ob eine Erinnerung mit der gegebenen ID existiert.
   *
   * **Performance:**
   * - Effizienter als findById wenn nur Existenz geprüft werden soll
   * - Lädt nicht das gesamte Aggregate aus der Datenbank
   *
   * @param id - Die ErinnerungId die geprüft werden soll
   * @returns Result<boolean> - true wenn Erinnerung existiert, false sonst
   *
   * @example
   * ```typescript
   * const result = await repository.exists(erinnerungId);
   * if (result.isSuccess && result.value) {
   *   console.log('Erinnerung existiert');
   * }
   * ```
   */
  exists(id: ErinnerungId): Promise<Result<boolean>>;

  /**
   * Findet alle überfälligen Erinnerungen für die Eskalation.
   *
   * **Scope (Story 4.1):**
   * - Status: AUSGELOEST oder SNOOZED (triggerable)
   * - ausgeloestAm <= threshold
   *
   * @param threshold - Zeitgrenze ab der eine Erinnerung als überfällig gilt (now - timeout)
   * @param tx - Optional: Transaction Context
   */
  findOverdue(threshold: Date, tx?: TransactionContext): Promise<Result<Erinnerung[]>>;
}
