// Use non-secure nanoid for Jest compatibility (CommonJS)
// Note: In production, the secure version will be used via tree-shaking
import { nanoid } from 'nanoid/non-secure';

/**
 * Abstract Base Class für immutable Domain Events mit auto-generierter eventId und occurredAt timestamp.
 * Events repräsentieren historische Fakten im Domain Model und sind daher immutabel (keine Änderungen nach Creation).
 *
 * Charakteristika:
 * - Readonly Properties: Alle Felder sind immutabel (readonly)
 * - Auto-Generation: eventId (nanoid) und occurredAt (Date) werden im Constructor generiert
 * - Past Tense: Event Namen wie "EinsatzCreatedEvent", NICHT "CreateEinsatzEvent"
 * - Rich Data: Events enthalten alle relevanten Daten für Event Handler (vermeidet DB-Queries)
 * - Versioning: eventVersion() ermöglicht Schema Evolution
 *
 * Design Pattern:
 * - Event Sourcing: Events als Single Source of Truth für Domain-Änderungen
 * - CQRS: Events triggern Command-Handler zur State-Synchronisation
 * - Aggregate Lifecycle: aggregateId verlinkt Event mit zugehöriger Aggregate Root
 *
 * @example
 * ```typescript
 * // Concrete Event Class (Past Tense!)
 * class EinsatzCreatedEvent extends DomainEvent {
 *   constructor(
 *     public readonly einsatzId: string,
 *     public readonly name: string,
 *     aggregateId?: string
 *   ) {
 *     super(aggregateId);
 *   }
 *
 *   static eventName(): string {
 *     return 'EinsatzCreated';
 *   }
 * }
 *
 * // Event Creation (auto-generates eventId + occurredAt)
 * const event = new EinsatzCreatedEvent(
 *   'A1B2C3D4E5F6G7H8I9J0K',
 *   'Wohnungsbrand',
 *   'aggregate-123'
 * );
 *
 * console.log(event.eventId);     // "X1Y2Z3A4B5C6D7E8F9G0H" (auto-generated nanoid)
 * console.log(event.occurredAt);  // 2024-11-14T12:34:56.789Z (auto-generated)
 * console.log(event.aggregateId); // "aggregate-123"
 * console.log(EinsatzCreatedEvent.eventName()); // "EinsatzCreated"
 * console.log(EinsatzCreatedEvent.eventVersion()); // 1
 * ```
 */
export abstract class DomainEvent {
  /**
   * Eindeutige Event ID (auto-generiert via nanoid).
   * Format: 21 URL-safe Zeichen [A-Za-z0-9_-]
   * Readonly: Events sind immutabel (historische Fakten)
   */
  public readonly eventId: string;

  /**
   * Timestamp wann das Event aufgetreten ist (auto-generiert).
   * Wichtig für Event Ordering und Zeitreihen-Analysen.
   * Readonly: Events sind immutabel (historische Fakten)
   */
  public readonly occurredAt: Date;

  /**
   * Optional: ID der Aggregate Root zu der dieses Event gehört.
   * Wichtig für Event Store Contextualisierung und Aggregate Reconstruction.
   * Readonly: Events sind immutabel (historische Fakten)
   */
  public readonly aggregateId?: string;

  /**
   * Protected Constructor erzwingt Subclass-Implementierung.
   * Auto-generiert eventId (nanoid) und occurredAt (Date).
   *
   * Warum auto-generation?
   * - eventId: Garantiert Uniqueness ohne externe Dependency (z.B. Database Sequence)
   * - occurredAt: Exakte Zeitstempel für Event Ordering und Chronologie
   *
   * @param aggregateId - Optional: ID der zugehörigen Aggregate Root (für Event Store Context)
   */
  protected constructor(aggregateId?: string) {
    this.eventId = nanoid();
    this.occurredAt = new Date();
    this.aggregateId = aggregateId;
  }

  /**
   * Static Method für type-safe Event Routing.
   * Subclasses MÜSSEN diese Methode überschreiben und einen eindeutigen Event Namen definieren.
   *
   * Warum static method enforcement?
   * - Type-Safety: Event Router kann Events basierend auf eventName() dispatchen
   * - Convention: Erzwingt konsistente Event Naming (Past Tense!)
   * - Reflection: Ermöglicht Event Discovery ohne Instanz
   *
   * Design Note:
   * - TypeScript unterstützt "abstract static" seit 4.2+, aber nicht alle Tools (z.B. Biome)
   * - Runtime Error statt compile-time enforcement ist akzeptabler Trade-off
   * - Tests verifizieren dass alle Subclasses eventName() überschreiben
   *
   * @returns Eindeutiger Event Name (Past Tense, z.B. "EinsatzCreated", "EinsatzUpdated")
   * @throws Error wenn Subclass eventName() nicht überschreibt
   *
   * @example
   * ```typescript
   * class EinsatzCreatedEvent extends DomainEvent {
   *   static eventName(): string {
   *     return 'EinsatzCreated'; // ✅ Past Tense
   *   }
   * }
   * ```
   */
  static eventName(): string {
    throw new Error(`${DomainEvent.name} must override static eventName() method. Event names must be in past tense (e.g., "EinsatzCreated", not "CreateEinsatz").`);
  }

  /**
   * Static Method für Event Schema Versioning.
   * Default: Version 1. Override in Subclasses bei Breaking Changes im Event Schema.
   *
   * Warum Versioning?
   * - Schema Evolution: Ermöglicht Event Structure Changes ohne alte Events zu brechen
   * - Backward Compatibility: Event Handler können Versions-basiert entscheiden
   * - Migration Support: Event Store kann alte Versionen zu neuen migrieren
   *
   * @returns Event Schema Version (default: 1)
   *
   * @example
   * ```typescript
   * class EinsatzCreatedEvent extends DomainEvent {
   *   static eventVersion(): number {
   *     return 2; // Breaking Change: einsatzId → id renamed
   *   }
   * }
   * ```
   */
  static eventVersion(): number {
    return 1;
  }
}
