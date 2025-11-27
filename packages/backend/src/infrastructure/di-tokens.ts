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
