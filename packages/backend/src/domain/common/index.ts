/**
 * Central Export Point für Domain Common Module.
 *
 * Exportiert alle wiederverwendbaren Domain-Layer Basisklassen,
 * Interfaces und Types für die gesamte Anwendung.
 *
 * **Organisation:**
 * - Base Classes: AggregateRoot, ValueObject, EntityId
 * - Patterns: Result, DomainEvent
 * - Abstractions: TransactionContext, ITransactionManager
 * - Exceptions: Domain-spezifische Error Types
 */

// Base Classes
export { AggregateRoot } from './aggregate-root';
export { ValueObject } from './value-object';
export { EntityId } from './entity-id';

// Patterns
export { Result } from './result';
export { DomainEvent } from './domain-event';

// Transaction Abstractions (Framework-Agnostic)
export type { TransactionContext, ITransactionManager } from './transaction';

// Exceptions
export * from './exceptions';
