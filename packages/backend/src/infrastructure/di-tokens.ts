/**
 * Dependency Injection Tokens für Infrastructure Layer.
 *
 * Verwendet Symbol() für Compile-Time Type Safety und
 * Vermeidung von String-basierten Token Collisions.
 *
 * **Warum Symbol statt String:**
 * - Type Safety: TypeScript kann Symbol Types validieren
 * - Keine Namenskollisionen: Jedes Symbol ist einzigartig
 * - Bessere IDE-Unterstützung: Autocomplete und Refactoring
 * - Konsistent mit modernen DI Best Practices
 *
 * @example
 * ```typescript
 * // In Application Layer:
 * constructor(
 *   @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository
 * ) {}
 * ```
 */

/** Repository Token für IUserRepository */
export const USER_REPOSITORY = Symbol('IUserRepository');

/** Service Token für IJwtAuthServicePort */
export const JWT_AUTH_SERVICE = Symbol('IJwtAuthServicePort');

/** Repository Token für IEinsatzRepository (bereits in Story 4-5) */
export const EINSATZ_REPOSITORY = Symbol('IEinsatzRepository');

/** Repository Token für IEtbRepository */
export const ETB_REPOSITORY = Symbol('IEtbRepository');

/** Repository Token für IOutboxRepository */
export const OUTBOX_REPOSITORY = Symbol('IOutboxRepository');

/** Repository Token für ILagekarteRepository */
export const LAGEKARTE_REPOSITORY = Symbol('ILagekarteRepository');

/** Transaction Manager Token für ITransactionManager */
export const TRANSACTION_MANAGER = Symbol('ITransactionManager');

/** Event Publisher Token für IEventPublisher */
export const EVENT_PUBLISHER = Symbol('IEventPublisher');

/** Alert Service Token für IAlertService */
export const ALERT_SERVICE = Symbol('IAlertService');

/**
 * Event Handler Tokens für IEventHandler<TEvent> Implementations.
 *
 * Diese Tokens ermöglichen die Dependency Injection von Event Handlers
 * via Infrastructure Adapters. Der Adapter (mit @OnEvent Decorator) delegiert
 * an den Application Layer Handler (ohne Framework-Abhängigkeiten).
 *
 * **Pattern:**
 * 1. Application Layer Handler implementiert IEventHandler<TEvent>
 * 2. Handler wird mit diesem Token registriert
 * 3. Infrastructure Adapter injiziert Handler via Token
 * 4. Adapter delegiert @OnEvent Calls an Handler.handle()
 */
export const EVENT_HANDLER = {
  /** ETB Auto-Creation Handler Token */
  ETB_AUTO_CREATION: Symbol('IEventHandler<EinsatzCreatedEvent>:EtbAutoCreation'),

  /** Lagekarte Auto-Creation Handler Token */
  LAGEKARTE_AUTO_CREATION: Symbol('IEventHandler<EinsatzCreatedEvent>:LagekarteAutoCreation'),
} as const;
