import { Result } from '@domain/common/result';
import { ValueObject } from '@domain/common/value-object';

/**
 * Props für das Permission Value Object.
 *
 * Speichert die Permission im Format "resource:action" (z.B. "user:read", "einsatz:create").
 */
interface PermissionProps extends Record<string, unknown> {
  /**
   * Permission Value im Format "resource:action".
   *
   * Format: lowercase Buchstaben und Underscore erlaubt, getrennt durch Doppelpunkt.
   * Beispiele: "user:read", "einsatz:create", "user:*", "*:*"
   */
  value: string;
}

/**
 * Permission Value Object für RBAC (Role-Based Access Control).
 *
 * Repräsentiert eine einzelne Permission im Format "resource:action".
 * Unterstützt Wildcard-Matching für flexible Berechtigungsprüfungen
 * (z.B. "user:*" matcht alle User-Actions, "*:*" matcht alles).
 *
 * **Warum lowercase only?**
 * Verhindert Case-Sensitivity-Exploits in der Berechtigungsprüfung.
 * "User:Read" vs "user:read" könnten als unterschiedlich interpretiert werden,
 * was zu Security-Lücken führen könnte.
 *
 * **Warum Wildcard Matching?**
 * RBAC-Rollen wie SUPER_ADMIN benötigen "*:*" für alle Permissions.
 * ADMIN benötigt "user:*" für alle User-Operations ohne jede einzelne
 * Permission explizit zu vergeben.
 *
 * @example
 * ```typescript
 * // Explizite Permission erstellen
 * const permission = Permission.create('user:read');
 *
 * // Static Factory für Standard-Permissions
 * const createPerm = Permission.CREATE_EINSATZ();
 *
 * // Wildcard Matching für RBAC
 * const adminPerm = Permission.MANAGE_USERS(); // "user:*"
 * adminPerm.matches('user:read'); // true
 * adminPerm.matches('einsatz:create'); // false
 *
 * const superAdminPerm = Permission.create('*:*');
 * superAdminPerm.matches('user:read'); // true
 * superAdminPerm.matches('einsatz:delete'); // true
 * ```
 */
export class Permission extends ValueObject<PermissionProps> {
  /**
   * Private Constructor - verwende static Factories!
   *
   * @param value - Permission Value im Format "resource:action"
   */
  private constructor(value: string) {
    super({ value });
  }

  /**
   * Validiert das Permission Format.
   *
   * Erlaubt NUR lowercase Buchstaben und Underscores, getrennt durch Doppelpunkt.
   * Wildcards (*) sind erlaubt für Wildcard-Matching.
   *
   * @param value - Zu validierender Permission String
   * @returns true wenn Format valide ist
   */
  private static isValid(value: string): boolean {
    // Regex: lowercase letters + underscore OR wildcard, colon separator
    // ^[a-z_*]+:[a-z_*]+$
    // Beispiele: "user:read", "einsatz_detail:create", "user:*", "*:*"
    return /^[a-z_*]+:[a-z_*]+$/.test(value);
  }

  /**
   * Factory Method zum Erstellen einer Permission.
   *
   * Validiert das Format und gibt Result<Permission> zurück.
   * Format: "resource:action" (lowercase + underscore erlaubt).
   *
   * @param value - Permission String (z.B. "user:read", "einsatz:create")
   * @returns Result<Permission> - Success bei validem Format, Failure bei Fehler
   *
   * @example
   * ```typescript
   * const result = Permission.create('user:read');
   * if (result.isSuccess) {
   *   const permission = result.value;
   * }
   * ```
   */
  public static create(value: string): Result<Permission> {
    if (!Permission.isValid(value)) {
      return Result.fail<Permission>(`Ungültiges Permission Format: ${value}. Erwartet: resource:action (lowercase, underscore erlaubt)`);
    }
    return Result.ok<Permission>(new Permission(value));
  }

  /**
   * Static Factory für "einsatz:create" Permission.
   *
   * Berechtigung zum Erstellen neuer Einsätze.
   *
   * @returns Permission instance für einsatz:create
   */
  public static CREATE_EINSATZ(): Permission {
    return new Permission('einsatz:create');
  }

  /**
   * Static Factory für "einsatz:update" Permission.
   *
   * Berechtigung zum Bearbeiten bestehender Einsätze.
   *
   * @returns Permission instance für einsatz:update
   */
  public static EDIT_EINSATZ(): Permission {
    return new Permission('einsatz:update');
  }

  /**
   * Static Factory für "einsatz:delete" Permission.
   *
   * Berechtigung zum Löschen von Einsätzen.
   *
   * @returns Permission instance für einsatz:delete
   */
  public static DELETE_EINSATZ(): Permission {
    return new Permission('einsatz:delete');
  }

  /**
   * Static Factory für "etb:lock" Permission.
   *
   * Berechtigung zum Sperren/Entsperren des Elektronischen Tagebuchs (ETB).
   * Diese Permission verhindert weitere Änderungen an abgeschlossenen Einsätzen.
   *
   * @returns Permission instance für etb:lock
   */
  public static LOCK_ETB(): Permission {
    return new Permission('etb:lock');
  }

  /**
   * Static Factory für "user:*" Permission (Wildcard).
   *
   * Berechtigung für ALLE User-Management-Operations (create, read, update, delete).
   * Typischerweise für ADMIN-Role.
   *
   * @returns Permission instance für user:* (Wildcard)
   */
  public static MANAGE_USERS(): Permission {
    return new Permission('user:*');
  }

  /**
   * Static Factory für "system:*" Permission (Wildcard).
   *
   * Berechtigung für ALLE System-Konfigurationen (settings, logs, backups).
   * Typischerweise für SUPER_ADMIN-Role.
   *
   * @returns Permission instance für system:* (Wildcard)
   */
  public static SYSTEM_CONFIG(): Permission {
    return new Permission('system:*');
  }

  /**
   * Gibt den Permission Value zurück.
   *
   * @returns Permission String im Format "resource:action"
   */
  get value(): string {
    return this.props.value;
  }

  /**
   * String Repräsentation der Permission.
   *
   * @returns Permission Value (z.B. "user:read")
   */
  public toString(): string {
    return this.value;
  }

  /**
   * Prüft ob diese Permission einem Pattern entspricht (Wildcard Matching).
   *
   * Unterstützt Wildcards (*) für flexible RBAC-Prüfungen:
   * - "*:*" matcht ALLE Permissions (SUPER_ADMIN)
   * - "resource:*" matcht alle Actions für die Resource (z.B. "user:*")
   * - "*:action" matcht alle Resources für die Action (selten genutzt)
   *
   * **Warum Wildcard Matching?**
   * Ermöglicht hierarchische Berechtigungen ohne jede einzelne Permission
   * explizit zu vergeben. ADMIN mit "user:*" hat automatisch alle User-Permissions.
   *
   * @param pattern - Pattern zum Matchen (z.B. "user:*", "*:*", "user:read")
   * @returns true wenn diese Permission dem Pattern entspricht
   *
   * @example
   * ```typescript
   * const userRead = Permission.create('user:read').value;
   * userRead.matches('user:read'); // true (exact match)
   * userRead.matches('user:*'); // true (wildcard resource)
   * userRead.matches('*:*'); // true (wildcard all)
   * userRead.matches('einsatz:*'); // false (different resource)
   * ```
   */
  public matches(pattern: string): boolean {
    // Falls pattern kein Wildcard hat, exakte Equality
    if (!pattern.includes('*')) {
      return this.value === pattern;
    }

    // Wildcard Matching
    const [patternResource, patternAction] = pattern.split(':');
    const [thisResource, thisAction] = this.value.split(':');

    // "*:*" matcht ALLES (SUPER_ADMIN)
    if (patternResource === '*' && patternAction === '*') {
      return true;
    }

    // "resource:*" matcht alle Actions für die Resource
    // Beispiel: "user:*" matcht "user:read", "user:create", "user:delete"
    if (patternResource === thisResource && patternAction === '*') {
      return true;
    }

    // "*:action" matcht alle Resources für die Action
    // Beispiel: "*:read" matcht "user:read", "einsatz:read", "system:read"
    if (patternResource === '*' && patternAction === thisAction) {
      return true;
    }

    return false;
  }
}
