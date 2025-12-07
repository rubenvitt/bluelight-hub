import type { Result } from '@domain/common/result';
import type { TransactionContext } from '@domain/common/transaction';
import type { UserAggregate } from '../aggregates/user.aggregate';
import type { UserId } from '../value-objects/user-id';
import type { Username } from '../value-objects/username';

/**
 * Repository Port Interface für User Aggregates (Hexagonal Architecture).
 *
 * Definiert die Persistenz-Schnittstelle für User Aggregates ohne technische Details
 * der Implementierung. Die konkrete Umsetzung erfolgt in der Infrastructure Layer
 * (z.B. PrismaUserRepository in Story 4.7).
 *
 * **Warum Port Interface:**
 * - Dependency Inversion Principle: Domain Layer hängt von Abstraktion ab, nicht von Implementierung
 * - Testability: Mock-Repository für Unit Tests ohne echte Datenbankverbindung
 * - Framework-Agnostic: Keine Prisma-Typen in Domain Layer Signaturen
 * - Separation of Concerns: Business Logic bleibt unabhängig von Persistenz-Technologie
 *
 * **Warum TransactionContext:**
 * - Opaque Type (unknown) ermöglicht Infrastructure Layer Transaktionsverwaltung
 * - Domain Layer behandelt es als Pass-Through Parameter ohne Kenntnis der Implementierung
 * - Erhält Hexagonal Architecture: Domain bleibt unabhängig von Prisma/TypeORM/etc.
 * - Ermöglicht Atomizität über mehrere Repository-Operationen hinweg
 *
 * **Warum Result<T> Pattern:**
 * - Explizite Fehlerbehandlung ohne Exceptions
 * - Type-Safe Error Handling
 * - Erleichtert Railway-Oriented Programming in Application Layer
 *
 * @example
 * ```typescript
 * // In Application Layer (Use Case)
 * async deleteUser(userId: UserId, deletedBy: UserId): Promise<Result<void>> {
 *   const userResult = await this.userRepository.findById(userId);
 *   if (userResult.isFailure) return userResult;
 *   if (!userResult.value) return Result.fail('User not found');
 *
 *   const deleteResult = await userResult.value.delete(deletedBy, this.userRepository);
 *   if (deleteResult.isFailure) return deleteResult;
 *
 *   return await this.userRepository.save(userResult.value);
 * }
 * ```
 */
export interface IUserRepository {
  /**
   * Findet einen User anhand seiner Type-Safe ID.
   *
   * Gibt null zurück wenn kein User mit dieser ID existiert (KEIN Fehler!).
   * "Not found" ist ein valides Business-Resultat, kein technischer Fehler.
   *
   * **Warum UserId statt string:**
   * - Type Safety: Compiler verhindert versehentliches Vertauschen mit anderen IDs
   * - Domain-Driven Design: ID ist ein Value Object mit Validierungslogik
   *
   * **Warum null statt Result.fail():**
   * - "Nicht gefunden" ist ein erwartetes Business-Resultat, kein Fehler
   * - Caller kann explizit auf null prüfen und entscheiden ob das ein Fehler ist
   * - Result.fail() ist für technische Fehler (DB-Connection, etc.)
   *
   * @param id - UserId Value Object mit validierter UUID
   * @param tx - Optional Transaction Context für Atomizität über mehrere Operationen
   * @returns Result<UserAggregate | null> - Success mit Aggregate oder null wenn nicht gefunden
   */
  findById(id: UserId, tx?: TransactionContext): Promise<Result<UserAggregate | null>>;

  /**
   * Findet einen User anhand seines einzigartigen Usernamens.
   *
   * Nutzt Username Value Object um Validierung (min 3 chars) zu erzwingen.
   * Gibt null zurück wenn kein User mit diesem Username existiert.
   *
   * **Warum Username statt string:**
   * - Validierung bereits im Value Object erfolgt (min 3 chars)
   * - Type Safety: Compiler verhindert ungültige Werte
   * - Self-Documenting Code: Signatur zeigt dass Username valide sein muss
   *
   * **Use Case:**
   * - Login-Flow: Username + Password Verification
   * - User existiert Check vor Registration
   * - Admin-Interface: User Lookup by Username
   *
   * @param username - Username Value Object (min 3 chars, validated)
   * @param tx - Optional Transaction Context für Atomizität
   * @returns Result<UserAggregate | null> - Success mit Aggregate oder null wenn nicht gefunden
   */
  findByUsername(username: Username, tx?: TransactionContext): Promise<Result<UserAggregate | null>>;

  /**
   * Lädt alle User Aggregates aus der Datenbank.
   *
   * **ACHTUNG:** Diese Methode sollte nur für Admin-Interfaces oder Reporting verwendet werden.
   * Für produktive User-Listen IMMER Pagination verwenden (wird in späteren Stories ergänzt).
   *
   * **Warum kein Pagination Parameter:**
   * - Story 1.6 fokussiert auf Core Aggregate + Business Rules
   * - Pagination ist Infrastructure Concern (Story 4.x oder 5.x)
   * - Einfache Implementierung für Prototyp ausreichend
   *
   * **Use Case:**
   * - Admin Dashboard: User Overview
   * - Reporting: User Statistics
   * - Initial MVP ohne große User-Basis
   *
   * @param tx - Optional Transaction Context für Atomizität
   * @returns Result<UserAggregate[]> - Success mit Array aller User (kann leer sein)
   */
  findAll(tx?: TransactionContext): Promise<Result<UserAggregate[]>>;

  /**
   * Persistiert ein User Aggregate (Create oder Update).
   *
   * Entscheidung zwischen Create/Update erfolgt automatisch in Infrastructure Layer
   * basierend auf Aggregate State (neue Events vs. modifizierte Properties).
   *
   * **Warum keine separaten create()/update() Methods:**
   * - Aggregate entscheidet über seinen Zustand (Domain-Driven Design)
   * - Infrastructure Layer kennt Persistenz-Details (neue vs. existierende Entität)
   * - Vereinfacht Domain Layer API: nur save() statt create()/update()/delete()
   *
   * **Event Handling:**
   * - Aggregate enthält Domain Events (UserCreatedEvent, UserRoleChangedEvent, etc.)
   * - Infrastructure Layer dispatched Events NACH erfolgreicher Persistierung
   * - Transaktionale Konsistenz: Events nur bei erfolgreichem Commit
   *
   * **Transaction Requirement:**
   * - MUSS in Transaction laufen wenn User Aggregate Teil einer größeren Operation ist
   * - Beispiel: User + Role Change + Audit Log = eine Transaktion
   *
   * @param user - User Aggregate mit allen Business Rules bereits validiert
   * @param tx - Optional Transaction Context für Atomizität
   * @returns Result<void> - Success ohne Rückgabewert, Failure bei Persistenz-Fehler
   */
  save(user: UserAggregate, tx?: TransactionContext): Promise<Result<void>>;

  /**
   * Zählt die Anzahl der User mit SUPER_ADMIN Role.
   *
   * **Business Rule Enforcement:**
   * - Mindestens 1 SUPER_ADMIN muss IMMER existieren
   * - Verhindert Lock-Out Scenario (letzter Admin kann sich nicht löschen)
   * - Wird verwendet in UserAggregate.delete() und UserAggregate.changeRole()
   *
   * **Warum im Repository statt in Service:**
   * - Persistenz-Operation: benötigt Datenbankzugriff
   * - Business Rule Check: wird von Aggregate selbst aufgerufen
   * - Transaction Safety: Zählung MUSS in gleicher Transaktion wie save() erfolgen
   *
   * **Use Cases:**
   * - Before Delete: SUPER_ADMIN kann sich nur löschen wenn min. 2 SUPER_ADMINs existieren
   * - Before Role Change: SUPER_ADMIN kann Role nur ändern wenn min. 2 SUPER_ADMINs existieren
   * - System Health Check: Monitoring ob SUPER_ADMIN existiert
   *
   * @param tx - Optional Transaction Context (WICHTIG für Atomizität mit save())
   * @returns Result<number> - Success mit Anzahl SUPER_ADMINs (>= 1 expected)
   */
  countSuperAdmins(tx?: TransactionContext): Promise<Result<number>>;

  /**
   * Prüft ob ein User mit dem gegebenen Username bereits existiert.
   *
   * **Uniqueness Constraint Enforcement:**
   * - Username MUSS unique sein (Business Rule)
   * - Prüfung erfolgt VOR save() um DB Constraint Violation zu vermeiden
   * - Race Condition Protection durch Transaction Context
   *
   * **Warum nicht einfach findByUsername() verwenden:**
   * - Performance: EXISTS query ist schneller als SELECT *
   * - Intent: Code zeigt explizit dass nur Existenz geprüft wird
   * - Return Type: boolean ist präziser als "UserAggregate | null"
   *
   * **Race Condition Scenario:**
   * ```
   * User A: existsByUsername("alice") -> false
   * User B: existsByUsername("alice") -> false  // Race Condition!
   * User A: save(new User("alice"))
   * User B: save(new User("alice"))  // DB Constraint Violation!
   * ```
   *
   * **Lösung durch Transaction:**
   * - Beide Operationen (exists + save) in EINER Transaktion
   * - Database Lock verhindert Race Condition
   * - Application Layer muss tx Parameter durchreichen
   *
   * @param username - Username Value Object (min 3 chars, validated)
   * @param tx - Optional Transaction Context (WICHTIG für Race Condition Prevention)
   * @returns Result<boolean> - Success mit true wenn Username existiert, false sonst
   */
  existsByUsername(username: Username, tx?: TransactionContext): Promise<Result<boolean>>;

  /**
   * Lädt den bcrypt Password Hash für einen User.
   *
   * **Security Separation:**
   * - Password Hash ist NICHT Teil des User Aggregates (Security by Design)
   * - Aggregate kennt KEIN passwordHash (Domain Layer bleibt unabhängig von Auth Details)
   * - Nur Infrastructure Layer (Repository) hat Zugriff auf passwordHash
   *
   * **Warum separater Query:**
   * - Password Hash wird nur bei Login benötigt (nicht bei normalen User Operations)
   * - Vermeidet unnötiges Laden von sensitiven Daten bei findById/findByUsername
   * - Explizite Abfrage zeigt Intent (Password Verification)
   *
   * **Use Case:**
   * - Login Flow: Username + Password Verification via bcrypt.compare()
   * - Password Change: Verify Old Password before setting New Password
   *
   * **Warum null zurückgeben:**
   * - USER-Accounts haben KEIN Passwort (PASSWORDLESS Auth)
   * - null ist valides Business-Resultat für USER Role
   * - Result.fail() ist für technische Fehler (DB-Connection, etc.)
   *
   * @param id - UserId Value Object mit validierter Nanoid
   * @param tx - Optional Transaction Context für Atomizität
   * @returns Result<string | null> - Success mit bcrypt Hash oder null wenn User kein Passwort hat
   */
  getPasswordHash(id: UserId, tx?: TransactionContext): Promise<Result<string | null>>;
}
