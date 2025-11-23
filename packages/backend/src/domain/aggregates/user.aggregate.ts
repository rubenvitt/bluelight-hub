import { AggregateRoot } from '@domain/common/aggregate-root';
import { Result } from '@domain/common/result';
import { UserId } from '@domain/value-objects/user-id';
import type { Username } from '@domain/value-objects/username';
import { UserRole } from '@domain/value-objects/user-role';
import type { Permission } from '@domain/value-objects/permission';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import { UserCreatedEvent } from '@domain/events/user-created.event';
import { UserRoleChangedEvent } from '@domain/events/user-role-changed.event';
import { PermissionGrantedEvent } from '@domain/events/permission-granted.event';
import { PermissionRevokedEvent } from '@domain/events/permission-revoked.event';
import { UserDeletedEvent } from '@domain/events/user-deleted.event';

/**
 * User Aggregate Root für RBAC (Role-Based Access Control) Management.
 * Repräsentiert die transactionale Grenze für alle User-bezogenen Operations.
 *
 * Diese Klasse implementiert vollständige DDD Aggregate Patterns:
 * - RBAC Business Logic mit Role-Based Permissions
 * - Min-1-SUPER_ADMIN Constraint (System MUSS min. 1 SUPER_ADMIN haben)
 * - Account Locking (reversibel) vs Soft Delete (final)
 * - Rich Business Logic mit Invarianten-Schutz
 * - Domain Events für Event Sourcing und Integration
 *
 * **Business Rules (Invarianten):**
 * 1. Min-1-SUPER_ADMIN Constraint: System MUSS jederzeit min. 1 SUPER_ADMIN haben
 * 2. Role Assignment: updateRole() darf letzten SUPER_ADMIN NICHT demoten
 * 3. Account Locking: lock() darf letzten SUPER_ADMIN NICHT sperren
 * 4. Soft Delete: delete() darf letzten SUPER_ADMIN NICHT löschen
 * 5. Locked Accounts: Gesperrte Accounts können NICHT gelöscht werden
 * 6. Permission Grants: Permissions können NUR einmal granted werden (Idempotenz)
 * 7. Permission Revokes: Permissions können NUR revoked werden wenn granted
 *
 * **Warum Min-1-SUPER_ADMIN Constraint:**
 * - Verhindert System-Lockout (ohne SUPER_ADMIN kann niemand mehr verwaltet werden)
 * - Security: Garantiert dass immer ein Admin mit vollen Rechten existiert
 * - Recovery: Bei kritischen Fehlern kann SUPER_ADMIN System wiederherstellen
 * - Compliance: Verantwortlichkeits-Prinzip (immer mindestens 1 Verantwortlicher)
 *
 * **Event Flow:**
 * - create() → UserCreatedEvent
 * - updateRole() → UserRoleChangedEvent
 * - grantPermission() → PermissionGrantedEvent
 * - revokePermission() → PermissionRevokedEvent
 * - delete() → UserDeletedEvent
 *
 * @example
 * ```typescript
 * // User erstellen (Factory Method mit Validation)
 * const username = Username.create('ruben_admin').value!;
 * const role = UserRole.ADMIN();
 * const result = UserAggregate.create(username, role);
 *
 * if (result.isSuccess) {
 *   const user = result.value!;
 *   console.log(user.id.toString()); // "X1Y2Z3A4B5C6D7E8F9G0H"
 *   console.log(user.username.toString()); // "ruben_admin"
 *   console.log(user.role.toString()); // "ADMIN"
 *   console.log(user.isLocked); // false
 *   console.log(user.getDomainEvents().length); // 1 (UserCreatedEvent)
 *
 *   // Role ändern (mit Min-1-SUPER_ADMIN Check)
 *   const newRole = UserRole.SUPER_ADMIN();
 *   const changedBy = UserId.create().value!;
 *   const updateResult = await user.updateRole(newRole, changedBy, repository);
 *   if (updateResult.isSuccess) {
 *     console.log(user.role.toString()); // "SUPER_ADMIN"
 *   }
 *
 *   // Custom Permission gewähren
 *   const permission = Permission.LOCK_ETB();
 *   const grantedBy = UserId.create().value!;
 *   const grantResult = user.grantPermission(permission, grantedBy);
 *   if (grantResult.isSuccess) {
 *     console.log(user.hasPermission(permission)); // true
 *   }
 *
 *   // Account sperren
 *   const lockResult = await user.lock(repository);
 *   if (lockResult.isSuccess) {
 *     console.log(user.isLocked); // true
 *   }
 *
 *   // Account entsperren
 *   const unlockResult = user.unlock();
 *   if (unlockResult.isSuccess) {
 *     console.log(user.isLocked); // false
 *   }
 *
 *   // Soft Delete (mit Min-1-SUPER_ADMIN Check)
 *   const deletedBy = UserId.create().value!;
 *   const deleteResult = await user.delete(deletedBy, repository);
 *   if (deleteResult.isSuccess) {
 *     console.log('User deleted (soft delete)');
 *   }
 * }
 *
 * // Validation Fehler
 * const failResult = UserAggregate.create(Username.create('a').value!, UserRole.USER());
 * console.log(failResult.isFailure); // true (Username zu kurz)
 * ```
 */
export class UserAggregate extends AggregateRoot<UserId> {
  /**
   * Username Value Object (normalisiert zu lowercase).
   */
  private _username: Username;

  /**
   * UserRole Value Object mit RBAC Permission Mappings.
   */
  private _role: UserRole;

  /**
   * Custom Permissions (zusätzlich zu Role-Default-Permissions).
   * Array von Permission Value Objects.
   */
  private _permissions: Permission[];

  /**
   * Account-Sperr-Status.
   * true = Account ist gesperrt (Login disabled)
   * false = Account ist aktiv
   */
  private _isLocked: boolean;

  /**
   * Private Constructor erzwingt Factory Method Nutzung.
   * Verhindert direkte Instanziierung ohne Validation.
   *
   * @param id - Type-Safe UserId
   * @param username - Username Value Object
   * @param role - UserRole Value Object
   * @param permissions - Custom Permissions Array
   * @param isLocked - Account-Sperr-Status
   * @param createdAt - Optional: Creation timestamp (für Rekonstruktion aus DB)
   * @param updatedAt - Optional: Update timestamp (für Rekonstruktion aus DB)
   */
  private constructor(id: UserId, username: Username, role: UserRole, permissions: Permission[], isLocked: boolean, createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt);
    this._username = username;
    this._role = role;
    this._permissions = permissions;
    this._isLocked = isLocked;
  }

  /**
   * Readonly getter für Username.
   * @returns Username Value Object
   */
  get username(): Username {
    return this._username;
  }

  /**
   * Readonly getter für UserRole.
   * @returns UserRole Value Object
   */
  get role(): UserRole {
    return this._role;
  }

  /**
   * Readonly getter für Custom Permissions.
   * @returns Array von Permission Value Objects (shallow copy für Immutability)
   */
  get permissions(): Permission[] {
    return [...this._permissions]; // Shallow copy (mutation-safe)
  }

  /**
   * Readonly getter für Account-Sperr-Status.
   * @returns true wenn Account gesperrt, false wenn aktiv
   */
  get isLocked(): boolean {
    return this._isLocked;
  }

  /**
   * Factory Method zur Erstellung eines User Aggregates mit Business Validation.
   * Verwendet Result<T> Pattern zur expliziten Fehlerbehandlung.
   *
   * **Business Rules:**
   * - Username ist required und muss valid sein (3-50 Zeichen, alphanumerisch + underscore)
   * - UserRole ist required
   * - Initial permissions sind optional (default: empty array)
   * - Initial isLocked ist false (Account ist aktiv)
   * - Bei Erfolg wird UserCreatedEvent emittiert
   *
   * **Warum permissions optional:**
   * - Default: User bekommt NUR Role-Default-Permissions (z.B. ADMIN → user:*, einsatz:*)
   * - Custom Permissions können später via grantPermission() hinzugefügt werden
   * - Verhindert Permission-Overload bei User-Erstellung (Principle of Least Privilege)
   *
   * @param username - Username Value Object (required)
   * @param role - UserRole Value Object (required)
   * @param permissions - Optional custom permissions (default: [])
   * @returns Result<UserAggregate> - Success mit User oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * // Success: User mit Default-Permissions
   * const username = Username.create('ruben_admin').value!;
   * const role = UserRole.ADMIN();
   * const result = UserAggregate.create(username, role);
   * if (result.isSuccess) {
   *   const user = result.value!;
   *   user.getDomainEvents(); // [UserCreatedEvent]
   * }
   *
   * // Success: User mit Custom-Permissions
   * const customPerms = [Permission.LOCK_ETB()];
   * const result2 = UserAggregate.create(username, role, customPerms);
   *
   * // Failure: UserId Generation Failed
   * // (kann nur passieren wenn nanoid() fehlschlägt - sehr unwahrscheinlich)
   * ```
   */
  static create(username: Username, role: UserRole, permissions?: Permission[]): Result<UserAggregate> {
    // Generate type-safe UserId
    const idResult = UserId.create();
    if (idResult.isFailure || !idResult.value) {
      return Result.fail<UserAggregate>(idResult.error ?? 'Failed to create UserId');
    }
    const id = idResult.value;

    // Create aggregate
    const user = new UserAggregate(
      id,
      username,
      role,
      permissions ?? [], // Default: keine Custom-Permissions
      false, // Default: Account ist aktiv (nicht gesperrt)
    );

    // Emit UserCreatedEvent
    user.addDomainEvent(new UserCreatedEvent(id, username, role, id.toString()));

    return Result.ok<UserAggregate>(user);
  }

  /**
   * Business Method: Ändert die Role des Users mit Min-1-SUPER_ADMIN Constraint Check.
   * Emittiert UserRoleChangedEvent bei erfolgreicher Änderung.
   *
   * **Business Rules:**
   * - Neue Role darf nicht gleich alter Role sein (No-Op, kein Event)
   * - Min-1-SUPER_ADMIN Constraint: Wenn User aktuell SUPER_ADMIN ist,
   *   darf nur demoted werden wenn mindestens 1 weiterer SUPER_ADMIN existiert
   * - Repository.countSuperAdmins() wird aufgerufen für Constraint Check
   *
   * **Warum Repository als Parameter (Hexagonal Architecture):**
   * - Aggregate benötigt External State (Anzahl SUPER_ADMINs) für Business Rule
   * - Repository Interface ist Port (Domain Layer), Implementierung ist Adapter (Infrastructure)
   * - Dependency Injection via Method Parameter (kein Constructor Injection im Aggregate!)
   * - Testbarkeit: Mock Repository kann verschiedene Szenarien simulieren
   *
   * **Event-Carried State Transfer:**
   * - UserRoleChangedEvent enthält oldRole + newRole
   * - Event Handler können Delta verstehen OHNE DB Query
   * - Ermöglicht Event Replay für Audit Trail
   *
   * @param newRole - Neue UserRole
   * @param changedBy - UserId des Benutzers der die Änderung durchführt (Audit Trail)
   * @param repository - IUserRepository für Min-1-SUPER_ADMIN Check
   * @returns Result<void> - Success oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * const user = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;
   * const changedBy = UserId.create().value!;
   *
   * // Success: Role ändern (≥2 SUPER_ADMINs vorhanden)
   * const result = await user.updateRole(UserRole.ADMIN(), changedBy, repository);
   * if (result.isSuccess) {
   *   console.log(user.role.toString()); // "ADMIN"
   * }
   *
   * // No-Op: Gleiche Role (kein Event)
   * const noOpResult = await user.updateRole(UserRole.ADMIN(), changedBy, repository);
   * console.log(noOpResult.isSuccess); // true (No-Op)
   *
   * // Failure: Demote letzten SUPER_ADMIN
   * // (repository.countSuperAdmins() gibt 1 zurück)
   * const failResult = await user.updateRole(UserRole.USER(), changedBy, repository);
   * console.log(failResult.error); // "Cannot demote last SUPER_ADMIN"
   * ```
   */
  public async updateRole(newRole: UserRole, changedBy: UserId, repository: IUserRepository): Promise<Result<void>> {
    // Check if same role (no-op)
    if (this._role.equals(newRole)) {
      return Result.ok<void>(undefined); // No change, no event
    }

    // Min-1-SUPER_ADMIN Constraint Check
    // Prüfe ob User aktuell SUPER_ADMIN ist UND zu anderer Role demoted werden soll
    if (this._role.equals(UserRole.SUPER_ADMIN())) {
      const countResult = await repository.countSuperAdmins();
      if (countResult.isFailure || countResult.value === undefined) {
        return Result.fail<void>(countResult.error ?? 'Failed to count SUPER_ADMINs');
      }
      if (countResult.value <= 1) {
        return Result.fail<void>('Cannot demote last SUPER_ADMIN');
      }
    }

    // Update role
    const oldRole = this._role;
    this._role = newRole;

    // Emit event (Event-Carried State Transfer: oldRole + newRole)
    this.addDomainEvent(new UserRoleChangedEvent(this.id, oldRole, newRole, changedBy, this.id.toString()));

    return Result.ok<void>(undefined);
  }

  /**
   * Business Method: Gewährt dem User eine Custom Permission.
   * Emittiert PermissionGrantedEvent bei erfolgreicher Änderung.
   *
   * **Business Rules:**
   * - Permission darf nicht bereits granted sein (Idempotenz)
   * - Permission wird zu _permissions Array hinzugefügt
   * - grantedBy User-ID wird für Audit Trail im Event gespeichert
   *
   * **Warum Custom Permissions ZUSÄTZLICH zu Role-Defaults:**
   * - RBAC Flexibility: User können granulare Permissions erhalten
   * - Temporary Permissions: z.B. ADMIN bekommt temporär system:backup Permission
   * - Principle of Least Privilege: User bekommt nur benötigte Permissions
   * - Role + Custom Permissions = Finale Permission Set
   *
   * **Idempotenz:**
   * - Falls Permission bereits granted, wird Result.fail() zurückgegeben
   * - Verhindert Duplikate in _permissions Array
   * - Verhindert mehrfache PermissionGrantedEvents für selbe Permission
   *
   * @param permission - Permission Value Object das gewährt werden soll
   * @param grantedBy - UserId des Users der die Permission gewährt (Audit Trail)
   * @returns Result<void> - Success oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * const user = UserAggregate.create(username, UserRole.USER()).value!;
   * const permission = Permission.LOCK_ETB();
   * const grantedBy = UserId.create().value!;
   *
   * // Success: Permission gewähren
   * const result = user.grantPermission(permission, grantedBy);
   * if (result.isSuccess) {
   *   console.log(user.hasPermission(permission)); // true
   * }
   *
   * // Failure: Permission bereits granted (Idempotenz)
   * const failResult = user.grantPermission(permission, grantedBy);
   * console.log(failResult.error); // "Permission already granted"
   * ```
   */
  public grantPermission(permission: Permission, grantedBy: UserId): Result<void> {
    // Check if permission already granted (idempotency)
    const alreadyGranted = this._permissions.some((p) => p.equals(permission));
    if (alreadyGranted) {
      return Result.fail<void>('Permission already granted');
    }

    // Add permission to custom permissions array
    this._permissions.push(permission);

    // Emit event
    this.addDomainEvent(new PermissionGrantedEvent(this.id, permission, grantedBy, this.id.toString()));

    return Result.ok<void>(undefined);
  }

  /**
   * Business Method: Entzieht dem User eine Custom Permission.
   * Emittiert PermissionRevokedEvent bei erfolgreicher Änderung.
   *
   * **Business Rules:**
   * - Permission muss aktuell granted sein (sonst Fehler)
   * - Permission wird aus _permissions Array entfernt
   * - revokedBy User-ID wird für Audit Trail im Event gespeichert
   *
   * **Wichtig: Nur Custom Permissions revokable!**
   * - Role-Default-Permissions können NICHT revoked werden (nur via Role-Change)
   * - Beispiel: ADMIN hat user:* per Role-Default → kann nicht einzeln revoked werden
   * - Nur Custom Permissions (via grantPermission() hinzugefügt) sind revokable
   *
   * **Warum "not granted" ein Fehler ist:**
   * - Vermeidet Silent Failures (Caller erwartet dass Permission revoked wird)
   * - Explizites Error Handling (Caller kann auf Fehler reagieren)
   * - Audit Trail: Revoke-Events nur für tatsächlich revoked Permissions
   *
   * @param permission - Permission Value Object das entzogen werden soll
   * @param revokedBy - UserId des Users der die Permission entzieht (Audit Trail)
   * @returns Result<void> - Success oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * const user = UserAggregate.create(username, UserRole.USER()).value!;
   * const permission = Permission.LOCK_ETB();
   * const grantedBy = UserId.create().value!;
   * const revokedBy = UserId.create().value!;
   *
   * // Setup: Permission gewähren
   * user.grantPermission(permission, grantedBy);
   *
   * // Success: Permission revoken
   * const result = user.revokePermission(permission, revokedBy);
   * if (result.isSuccess) {
   *   console.log(user.hasPermission(permission)); // false
   * }
   *
   * // Failure: Permission nicht granted
   * const failResult = user.revokePermission(permission, revokedBy);
   * console.log(failResult.error); // "Permission not granted"
   * ```
   */
  public revokePermission(permission: Permission, revokedBy: UserId): Result<void> {
    // Check if permission is granted
    const permissionIndex = this._permissions.findIndex((p) => p.equals(permission));
    if (permissionIndex === -1) {
      return Result.fail<void>('Permission not granted');
    }

    // Remove permission from custom permissions array
    this._permissions.splice(permissionIndex, 1);

    // Emit event
    this.addDomainEvent(new PermissionRevokedEvent(this.id, permission, revokedBy, this.id.toString()));

    return Result.ok<void>(undefined);
  }

  /**
   * Business Method: Sperrt den User Account mit Min-1-SUPER_ADMIN Constraint Check.
   * Account Locking ist reversibel (kann via unlock() entsperrt werden).
   *
   * **Business Rules:**
   * - Min-1-SUPER_ADMIN Constraint: Letzter SUPER_ADMIN darf NICHT gesperrt werden
   * - Repository.countSuperAdmins() wird aufgerufen für Constraint Check
   * - Setzt isLocked = true
   * - KEIN Event emittiert (lock ist technischer State Change, kein Domain Event)
   *
   * **Warum Lock KEIN Domain Event emittiert:**
   * - Account Locking ist technischer State Change (nicht fachlich relevant)
   * - Kein External System muss über Lock benachrichtigt werden
   * - Lock kann implizit bei Login-Validierung geprüft werden
   * - ABER: Bei Bedarf kann später LockEvent hinzugefügt werden (YAGNI)
   *
   * **Warum Repository als Parameter:**
   * - Gleiche Hexagonal Architecture wie updateRole()
   * - Min-1-SUPER_ADMIN Constraint benötigt External State
   * - Testbarkeit via Mock Repository
   *
   * @param repository - IUserRepository für Min-1-SUPER_ADMIN Check
   * @returns Result<void> - Success oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * const user = UserAggregate.create(username, UserRole.ADMIN()).value!;
   *
   * // Success: User sperren
   * const result = await user.lock(repository);
   * if (result.isSuccess) {
   *   console.log(user.isLocked); // true
   * }
   *
   * // Failure: Letzten SUPER_ADMIN sperren
   * const superAdmin = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;
   * const failResult = await superAdmin.lock(repository); // countSuperAdmins() = 1
   * console.log(failResult.error); // "Cannot lock last SUPER_ADMIN"
   * ```
   */
  public async lock(repository: IUserRepository): Promise<Result<void>> {
    // Min-1-SUPER_ADMIN Constraint Check
    // Prüfe ob User SUPER_ADMIN ist UND letzter SUPER_ADMIN im System
    if (this._role.equals(UserRole.SUPER_ADMIN())) {
      const countResult = await repository.countSuperAdmins();
      if (countResult.isFailure || countResult.value === undefined) {
        return Result.fail<void>(countResult.error ?? 'Failed to count SUPER_ADMINs');
      }
      if (countResult.value <= 1) {
        return Result.fail<void>('Cannot lock last SUPER_ADMIN');
      }
    }

    // Lock user
    this._isLocked = true;

    return Result.ok<void>(undefined);
  }

  /**
   * Business Method: Entsperrt den User Account.
   * Macht Account Lock rückgängig.
   *
   * **Business Rules:**
   * - Setzt isLocked = false
   * - No-Op wenn User bereits entsperrt (kein Fehler)
   * - KEIN Event emittiert (unlock ist technischer State Change)
   *
   * **Warum No-Op bei bereits entsperrt:**
   * - Idempotenz: unlock() kann mehrfach aufgerufen werden ohne Fehler
   * - Convenience: Caller muss nicht erst isLocked prüfen
   * - Consistency: Gleiche Semantik wie andere State Changes
   *
   * @returns Result<void> - Success (immer erfolgreich, auch bei No-Op)
   *
   * @example
   * ```typescript
   * const user = UserAggregate.create(username, UserRole.ADMIN()).value!;
   *
   * // Setup: User sperren
   * await user.lock(repository);
   *
   * // Success: User entsperren
   * const result = user.unlock();
   * if (result.isSuccess) {
   *   console.log(user.isLocked); // false
   * }
   *
   * // No-Op: User bereits entsperrt
   * const noOpResult = user.unlock();
   * console.log(noOpResult.isSuccess); // true (No-Op)
   * ```
   */
  public unlock(): Result<void> {
    // Unlock user (idempotent - no-op if already unlocked)
    this._isLocked = false;

    return Result.ok<void>(undefined);
  }

  /**
   * Business Method: Löscht den User (Soft Delete) mit Min-1-SUPER_ADMIN Constraint Check.
   * Emittiert UserDeletedEvent bei erfolgreicher Löschung.
   *
   * **Business Rules:**
   * - Min-1-SUPER_ADMIN Constraint: Letzter SUPER_ADMIN darf NICHT gelöscht werden
   * - Gesperrte Users dürfen NICHT gelöscht werden (erst entsperren)
   * - Repository.countSuperAdmins() wird aufgerufen für Constraint Check
   * - Emittiert UserDeletedEvent (Infrastructure Layer führt Soft Delete aus)
   *
   * **Warum "Soft Delete" statt "Hard Delete":**
   * - Aggregate emittiert nur Event, Infrastructure Layer entscheidet über Implementierung
   * - Typischerweise: Soft Delete (deletedAt Timestamp setzen, nicht physisch löschen)
   * - Ermöglicht Audit Trail und Recovery bei fehlerhaften Löschungen
   * - Compliance: DSGVO erlaubt Soft Delete für rechtliche Aufbewahrungsfristen
   *
   * **Warum gesperrte Users NICHT gelöscht werden können:**
   * - Verhindert Daten-Verlust bei versehentlicher Löschung
   * - Erzwingt explizites Entsperren vor Löschung (Safeguard)
   * - Auditability: Unlock + Delete = 2 separate Aktionen im Audit Log
   *
   * @param deletedBy - UserId des Users der die Löschung durchführt (Audit Trail)
   * @param repository - IUserRepository für Min-1-SUPER_ADMIN Check
   * @returns Result<void> - Success oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * const user = UserAggregate.create(username, UserRole.ADMIN()).value!;
   * const deletedBy = UserId.create().value!;
   *
   * // Success: User löschen
   * const result = await user.delete(deletedBy, repository);
   * if (result.isSuccess) {
   *   console.log('User deleted'); // Soft Delete via Infrastructure Layer
   * }
   *
   * // Failure: Letzten SUPER_ADMIN löschen
   * const superAdmin = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;
   * const failResult = await superAdmin.delete(deletedBy, repository); // countSuperAdmins() = 1
   * console.log(failResult.error); // "Cannot delete last SUPER_ADMIN"
   *
   * // Failure: Gesperrten User löschen
   * await user.lock(repository);
   * const failResult2 = await user.delete(deletedBy, repository);
   * console.log(failResult2.error); // "Cannot delete locked user"
   * ```
   */
  public async delete(deletedBy: UserId, repository: IUserRepository): Promise<Result<void>> {
    // Check if user is locked (prevent deletion of locked users)
    if (this._isLocked) {
      return Result.fail<void>('Cannot delete locked user');
    }

    // Min-1-SUPER_ADMIN Constraint Check
    // Prüfe ob User SUPER_ADMIN ist UND letzter SUPER_ADMIN im System
    if (this._role.equals(UserRole.SUPER_ADMIN())) {
      const countResult = await repository.countSuperAdmins();
      if (countResult.isFailure || countResult.value === undefined) {
        return Result.fail<void>(countResult.error ?? 'Failed to count SUPER_ADMINs');
      }
      if (countResult.value <= 1) {
        return Result.fail<void>('Cannot delete last SUPER_ADMIN');
      }
    }

    // Emit UserDeletedEvent (Infrastructure Layer performs Soft Delete)
    this.addDomainEvent(new UserDeletedEvent(this.id, deletedBy, this.id.toString()));

    return Result.ok<void>(undefined);
  }

  /**
   * Helper Method: Prüft ob User eine bestimmte Role hat.
   * Verwendet Value Object Equality für typsicheren Vergleich.
   *
   * **Warum Value Object Equality statt String Comparison:**
   * - Type Safety: UserRole.equals() verhindert String-Tippfehler
   * - Encapsulation: Role Comparison Logic in UserRole Value Object
   * - Testability: Mock UserRole kann custom equals() implementieren
   *
   * @param role - UserRole zum Vergleichen
   * @returns true wenn User diese Role hat, false sonst
   *
   * @example
   * ```typescript
   * const user = UserAggregate.create(username, UserRole.ADMIN()).value!;
   *
   * console.log(user.hasRole(UserRole.ADMIN())); // true
   * console.log(user.hasRole(UserRole.USER())); // false
   * console.log(user.hasRole(UserRole.SUPER_ADMIN())); // false
   * ```
   */
  public hasRole(role: UserRole): boolean {
    return this._role.equals(role);
  }

  /**
   * Helper Method: Prüft ob User eine bestimmte Permission hat.
   * Kombiniert Role-Default-Permissions + Custom Permissions.
   *
   * **Permission Resolution:**
   * 1. Prüfe Role-Default-Permissions (via UserRole.hasPermission())
   * 2. Prüfe Custom Permissions (via _permissions Array)
   * 3. Wenn EINE der beiden true ist, hat User die Permission
   *
   * **Warum ODER-Verknüpfung (Role ODER Custom):**
   * - Additive Permissions: Custom Permissions erweitern Role-Defaults
   * - Flexibility: User kann temporäre Permissions erhalten ohne Role-Change
   * - RBAC Standard: Role + Custom Permissions = Finale Permission Set
   *
   * **Wildcard Matching:**
   * - Permission.matches() nutzt Wildcard Matching (user:* matcht user:read)
   * - SUPER_ADMIN hat *:* → matcht ALLE Permissions
   * - ADMIN hat user:*, einsatz:* → matcht alle user/einsatz Permissions
   *
   * @param permission - Permission zum Prüfen
   * @returns true wenn User Permission hat (via Role ODER Custom Grant)
   *
   * @example
   * ```typescript
   * const admin = UserAggregate.create(username, UserRole.ADMIN()).value!;
   *
   * // Role-Default-Permission
   * const userRead = Permission.create('user:read').value!;
   * console.log(admin.hasPermission(userRead)); // true (ADMIN hat user:*)
   *
   * // Custom Permission (nicht in Role-Defaults)
   * const etbLock = Permission.LOCK_ETB();
   * console.log(admin.hasPermission(etbLock)); // false (ADMIN hat NICHT etb:*)
   *
   * // Grant Custom Permission
   * admin.grantPermission(etbLock, UserId.create().value!);
   * console.log(admin.hasPermission(etbLock)); // true (via Custom Grant)
   *
   * // SUPER_ADMIN hat ALLE Permissions
   * const superAdmin = UserAggregate.create(username, UserRole.SUPER_ADMIN()).value!;
   * console.log(superAdmin.hasPermission(userRead)); // true (*:*)
   * console.log(superAdmin.hasPermission(etbLock)); // true (*:*)
   * ```
   */
  public hasPermission(permission: Permission): boolean {
    // Check role default permissions
    if (this._role.hasPermission(permission)) {
      return true;
    }

    // Check custom granted permissions
    return this._permissions.some((p) => p.equals(permission));
  }
}
