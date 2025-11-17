import type { Permission } from './permission';
import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * Props Interface für UserRole Value Object
 */
interface UserRoleProps extends Record<string, unknown> {
  value: string;
}

/**
 * UserRole Value Object - Repräsentiert Benutzerrollen mit RBAC Permission Hierarchy
 *
 * Dieses Value Object implementiert eine Role-Based Access Control (RBAC) Hierarchie,
 * die es ermöglicht, Permissions basierend auf Rollen zu prüfen. Die Hierarchie ist
 * bewusst flach gehalten (keine Role-Vererbung), um die Komplexität zu reduzieren
 * und explizite Permission-Zuweisungen zu erzwingen.
 *
 * RBAC Permission Hierarchie:
 * - SUPER_ADMIN: Hat ALLE Permissions (Wildcard *:*) - für System-Administration
 * - ADMIN: Hat user:*, einsatz:*, fahrzeug:*, dienst:* - für Organisations-Verwaltung
 * - USER: Hat nur user:read_self - für Standard-Benutzer mit minimalen Rechten
 *
 * Die Permission-Prüfung erfolgt über Wildcard-Matching, um flexible Permission-Patterns
 * zu unterstützen (z.B. user:* matcht user:read, user:create, user:update, etc.).
 *
 * @example
 * ```typescript
 * const admin = UserRole.ADMIN();
 * const userReadPermission = Permission.create('user:read').value!;
 * console.log(admin.hasPermission(userReadPermission)); // true (matches user:*)
 *
 * const superAdmin = UserRole.SUPER_ADMIN();
 * const anyPermission = Permission.create('custom:action').value!;
 * console.log(superAdmin.hasPermission(anyPermission)); // true (matches *:*)
 * ```
 */
export class UserRole extends ValueObject<UserRoleProps> {
  /**
   * Erlaubte Role-Werte (as const für Type Narrowing)
   */
  private static readonly ALLOWED_VALUES = ['SUPER_ADMIN', 'ADMIN', 'USER'] as const;

  /**
   * Private Constructor - erzwingt Nutzung von Factory Methods
   *
   * @param value - Der Role-Wert (SUPER_ADMIN | ADMIN | USER)
   */
  private constructor(value: string) {
    super({ value });
  }

  /**
   * Validiert einen Role-Wert
   *
   * @param value - Der zu validierende Role-Wert
   * @returns true wenn der Wert erlaubt ist, sonst false
   */
  private static isValidRole(value: string): boolean {
    return UserRole.ALLOWED_VALUES.includes(value as (typeof UserRole.ALLOWED_VALUES)[number]);
  }

  /**
   * Factory Method - Erstellt UserRole aus String mit Validierung
   *
   * Diese Methode validiert, dass nur die definierten Role-Werte akzeptiert werden.
   * Die explizite Validierung verhindert ungültige Rollen, die zu unerwarteten
   * Permission-Prüfungen führen könnten.
   *
   * @param value - Der Role-Wert (SUPER_ADMIN | ADMIN | USER)
   * @returns Result<UserRole> - Success mit UserRole oder Failure mit Fehler
   *
   * @example
   * ```typescript
   * const result = UserRole.create('ADMIN');
   * if (result.isSuccess) {
   *   console.log(result.value.toString()); // 'ADMIN'
   * }
   *
   * const invalid = UserRole.create('MODERATOR');
   * console.log(invalid.isFailure); // true
   * console.log(invalid.getErrorValue()); // 'Ungültige Role: MODERATOR. Erlaubte Werte: SUPER_ADMIN, ADMIN, USER'
   * ```
   */
  public static create(value: string): Result<UserRole> {
    if (!UserRole.isValidRole(value)) {
      return Result.fail<UserRole>(`Ungültige Role: ${value}. Erlaubte Werte: ${UserRole.ALLOWED_VALUES.join(', ')}`);
    }
    return Result.ok<UserRole>(new UserRole(value));
  }

  /**
   * Static Factory für SUPER_ADMIN Role
   *
   * SUPER_ADMIN hat ALLE Permissions (*:*) und wird typischerweise nur für
   * System-Administratoren verwendet, die vollständigen Zugriff auf alle
   * Funktionen benötigen.
   *
   * @returns UserRole mit Wert SUPER_ADMIN
   *
   * @example
   * ```typescript
   * const superAdmin = UserRole.SUPER_ADMIN();
   * console.log(superAdmin.toString()); // 'SUPER_ADMIN'
   * ```
   */
  public static SUPER_ADMIN(): UserRole {
    return new UserRole('SUPER_ADMIN');
  }

  /**
   * Static Factory für ADMIN Role
   *
   * ADMIN hat Permissions für user:*, einsatz:*, fahrzeug:*, dienst:* und wird
   * für Organisations-Administratoren verwendet, die Benutzer, Einsätze, Fahrzeuge
   * und Dienste verwalten, aber keine System-weiten Änderungen vornehmen können.
   *
   * @returns UserRole mit Wert ADMIN
   *
   * @example
   * ```typescript
   * const admin = UserRole.ADMIN();
   * console.log(admin.toString()); // 'ADMIN'
   * ```
   */
  public static ADMIN(): UserRole {
    return new UserRole('ADMIN');
  }

  /**
   * Static Factory für USER Role
   *
   * USER hat nur die Permission user:read_self und repräsentiert Standard-Benutzer
   * mit minimalen Rechten. Diese können nur ihre eigenen Daten lesen, aber keine
   * Änderungen an anderen Entitäten vornehmen.
   *
   * @returns UserRole mit Wert USER
   *
   * @example
   * ```typescript
   * const user = UserRole.USER();
   * console.log(user.toString()); // 'USER'
   * ```
   */
  public static USER(): UserRole {
    return new UserRole('USER');
  }

  /**
   * Getter für den Role-Wert
   *
   * @returns Der Role-Wert als String (SUPER_ADMIN | ADMIN | USER)
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * Prüft, ob diese Role eine bestimmte Permission hat
   *
   * Die Permission-Prüfung erfolgt über Wildcard-Matching und implementiert
   * eine flache RBAC-Hierarchie ohne Role-Vererbung. Dies macht das Permission-
   * Modell explizit und vorhersehbar, da jede Role ihre eigenen Permissions
   * definiert.
   *
   * RBAC Permission Mappings:
   * - SUPER_ADMIN: *:* (ALLE Permissions)
   * - ADMIN: user:*, einsatz:*, fahrzeug:*, dienst:*
   * - USER: user:read_self (nur spezifische Permission)
   *
   * Die Nutzung von Wildcards ermöglicht es, neue Permissions hinzuzufügen
   * (z.B. user:export), ohne die Role-Definitionen ändern zu müssen.
   *
   * @param permission - Die zu prüfende Permission (z.B. Permission.create('user:read'))
   * @returns true wenn die Role diese Permission hat, sonst false
   *
   * @example
   * ```typescript
   * const admin = UserRole.ADMIN();
   * const userRead = Permission.create('user:read').value!;
   * console.log(admin.hasPermission(userRead)); // true (matches user:*)
   *
   * const etbLock = Permission.create('etb:lock').value!;
   * console.log(admin.hasPermission(etbLock)); // false (no etb:* permission)
   *
   * const superAdmin = UserRole.SUPER_ADMIN();
   * console.log(superAdmin.hasPermission(etbLock)); // true (matches *:*)
   * ```
   */
  public hasPermission(permission: Permission): boolean {
    // SUPER_ADMIN hat ALLE Permissions - prüfe ob Permission gegen *:* matcht
    // Da *:* ALLES matcht, ist dies immer true für beliebige Permissions
    if (this.value === 'SUPER_ADMIN') {
      return permission.matches('*:*');
    }

    // ADMIN hat user:*, einsatz:*, fahrzeug:*, dienst:*
    // Prüfe ob Permission gegen eines dieser Wildcard-Patterns matcht
    if (this.value === 'ADMIN') {
      return permission.matches('user:*') || permission.matches('einsatz:*') || permission.matches('fahrzeug:*') || permission.matches('dienst:*');
    }

    // USER hat nur user:read_self (keine Wildcards)
    // Prüfe explizite Permission-Übereinstimmung
    if (this.value === 'USER') {
      return permission.matches('user:read_self');
    }

    // Unbekannte Role (sollte nie passieren durch Validierung)
    return false;
  }

  /**
   * String-Repräsentation der Role
   *
   * @returns Der Role-Wert als String
   *
   * @example
   * ```typescript
   * const admin = UserRole.ADMIN();
   * console.log(admin.toString()); // 'ADMIN'
   * console.log(`User has role: ${admin}`); // 'User has role: ADMIN'
   * ```
   */
  public toString(): string {
    return this.value;
  }
}
