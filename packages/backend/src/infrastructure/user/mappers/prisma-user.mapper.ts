import type { User as PrismaUser, UserRole as PrismaUserRole } from '@/generated/prisma/client';
import { UserAggregate } from '@domain/aggregates/user.aggregate';
import { UserId } from '@domain/value-objects/user-id';
import { Username } from '@domain/value-objects/username';
import { UserRole } from '@domain/value-objects/user-role';
import { Permission } from '@domain/value-objects/permission';

/**
 * Typ-Definition für User Prisma-Daten.
 * Wird für toAggregate() verwendet.
 */
export type UserWithRelations = PrismaUser;

/**
 * Persistence-Daten Struktur für Prisma Upsert.
 * Enthält alle Felder die für CREATE/UPDATE benötigt werden.
 */
export interface UserPersistenceData {
  id: string;
  username: string;
  passwordHash: string | null;
  role: PrismaUserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: string | null;
  isLocked: boolean;
  lockedManuallyAt: Date | null;
  permissions: string | null;
}

/**
 * Statische Utility-Klasse für Domain ↔ Prisma Konvertierungen (User Aggregate).
 *
 * Diese Klasse kapselt alle Mapping-Logik zwischen dem UserAggregate (Domain Layer)
 * und dem Prisma User Model (Infrastructure Layer).
 *
 * **Warum statische Klasse:**
 * - Keine Instanz-State benötigt (pure functions)
 * - Einfache Testbarkeit ohne DI
 * - Konsistent mit anderen Mappern im Projekt (PrismaEinsatzMapper)
 *
 * **Mapping-Herausforderungen:**
 * - `permissions` wird als JSON Array String serialisiert (["user:read", "einsatz:create"])
 * - `username` wird zu lowercase normalisiert in DB gespeichert
 * - `role` ist Enum in DB, Value Object in Domain
 * - `isLocked` ist boolean in beiden, aber Semantik unterschiedlich (manual vs auto-lock)
 *
 * **Design-Entscheidungen:**
 * - Custom Permissions werden als JSON Array String persistiert (AC2.6)
 * - Leeres Permission Array → NULL in DB (keine unnötigen leeren Arrays)
 * - JSON Parse Fehler → graceful degradation zu leerem Array
 * - Username wird immer lowercase in DB gespeichert (case-insensitive uniqueness)
 * - passwordHash ist optional (nur ADMIN/SUPER_ADMIN haben Passwort)
 */
export class PrismaUserMapper {
  /**
   * Konvertiert ein UserAggregate zu Prisma Persistence-Daten.
   *
   * Extrahiert alle Properties aus dem Aggregate und mappt sie auf das Prisma Schema.
   * Domain-Only Felder (custom permissions) werden NICHT persistiert.
   *
   * **WICHTIG:** passwordHash muss separat gesetzt werden (via separate Setter Methode).
   * Das Aggregate kennt KEIN passwordHash (Security by Design).
   *
   * @param aggregate - Das UserAggregate
   * @returns UserPersistenceData für Prisma Upsert
   */
  static toPersistence(aggregate: UserAggregate): UserPersistenceData {
    // Role Mapping: Domain VO → Prisma Enum String
    const role = PrismaUserMapper.mapDomainRoleToPrisma(aggregate.role);

    // Permission Serialization: Domain Permission[] → JSON String
    const permissions = PrismaUserMapper.serializePermissions(aggregate.permissions);

    return {
      id: aggregate.id.value,
      username: aggregate.username.value.toLowerCase(), // Case-insensitive uniqueness
      passwordHash: null, // MUSS separat gesetzt werden (Aggregate kennt kein Hash)
      role,
      isActive: !aggregate.isLocked, // Domain: isLocked ↔ DB: !isActive (invertiert)
      lastLoginAt: null, // Wird von AuthService gesetzt, nicht vom Aggregate
      failedLoginCount: 0, // Wird von AuthService verwaltet
      lockedUntil: null, // Auto-Lock nach Failed Login Attempts (separate von isLocked)
      createdAt: aggregate.createdAt,
      updatedAt: aggregate.updatedAt,
      isDeleted: false, // Wird bei delete() gesetzt (Soft Delete)
      deletedAt: null, // Wird bei delete() gesetzt
      deletedBy: null, // Wird bei delete() gesetzt
      isLocked: aggregate.isLocked, // Manual Lock (admin-initiated)
      lockedManuallyAt: aggregate.isLocked ? new Date() : null,
      permissions, // Serialized JSON Array oder NULL
    };
  }

  /**
   * Rekonstruiert ein UserAggregate aus Prisma-Daten.
   *
   * Nutzt Object.defineProperty() um private Fields des Aggregates zu setzen,
   * da der private Constructor nicht direkt aufgerufen werden kann.
   *
   * WICHTIG: Custom Permissions werden aus DB rekonstruiert (AC2.6).
   * Permissions werden aus JSON String deserialisiert via deserializePermissions().
   *
   * @param prismaData - User Daten aus Prisma findFirst/findUnique
   * @returns Vollständig rekonstruiertes UserAggregate
   * @throws Error wenn ID, Username oder Role Validierung fehlschlägt
   */
  static toAggregate(prismaData: UserWithRelations): UserAggregate {
    // Step 1: Reconstruct Value Objects mit Validierung
    const userIdResult = UserId.create(prismaData.id);
    if (userIdResult.isFailure) {
      throw new Error(`Invalid UserId: ${userIdResult.error}`);
    }
    const userId = userIdResult.value as UserId;

    const usernameResult = Username.create(prismaData.username);
    if (usernameResult.isFailure) {
      throw new Error(`Invalid Username '${prismaData.username}': ${usernameResult.error}`);
    }
    const username = usernameResult.value as Username;

    // Role Mapping: Prisma Enum String → Domain VO
    const role = PrismaUserMapper.mapPrismaRoleToDomain(prismaData.role);

    // Permission Deserialization: JSON String → Domain Permission[]
    const permissions = PrismaUserMapper.deserializePermissions(prismaData.permissions);

    // Step 2: Erstelle Aggregate via Factory (validiert Constraints)
    const aggregateResult = UserAggregate.create(username, role);

    if (aggregateResult.isFailure) {
      throw new Error(`Failed to create UserAggregate: ${aggregateResult.error}`);
    }
    const aggregate = aggregateResult.value as UserAggregate;

    // Step 3: Override private fields mit DB-Werten via Object.defineProperty
    // (Factory generiert neue Werte, wir brauchen die aus der DB)

    // _id (Factory generiert neue ID, wir wollen DB-ID)
    Object.defineProperty(aggregate, '_id', {
      value: userId,
      writable: false,
      configurable: true,
    });

    // _isLocked (Factory setzt false, wir wollen DB-Wert)
    Object.defineProperty(aggregate, '_isLocked', {
      value: prismaData.isLocked,
      writable: true,
      configurable: true,
    });

    // _permissions (Factory setzt leeres Array, wir wollen DB-Werte)
    Object.defineProperty(aggregate, '_permissions', {
      value: permissions,
      writable: true,
      configurable: true,
    });

    // Timestamps (Factory setzt new Date(), wir wollen DB-Werte)
    Object.defineProperty(aggregate, '_createdAt', {
      value: prismaData.createdAt,
      writable: false,
      configurable: true,
    });

    Object.defineProperty(aggregate, '_updatedAt', {
      value: prismaData.updatedAt,
      writable: true,
      configurable: true,
    });

    // Step 4: Clear transient State (darf nicht aus DB kommen)
    // Factory hat UserCreatedEvent emittiert - das wollen wir nicht bei Rekonstruktion
    aggregate.clearDomainEvents();

    return aggregate;
  }

  /**
   * Mappt Domain UserRole Value Object zu Prisma Enum String.
   *
   * @param role - Domain UserRole Value Object
   * @returns Prisma UserRole Enum Wert
   */
  private static mapDomainRoleToPrisma(role: UserRole): PrismaUserRole {
    // Domain VO hat .value Property die den String-Wert enthält
    // Das stimmt 1:1 mit Prisma Enum überein
    return role.value as PrismaUserRole;
  }

  /**
   * Mappt Prisma UserRole Enum zu Domain Value Object.
   *
   * @param role - Prisma UserRole Enum Wert
   * @returns Domain UserRole Value Object
   * @throws Error wenn unbekannte Role
   */
  private static mapPrismaRoleToDomain(role: PrismaUserRole): UserRole {
    switch (role) {
      case 'USER':
        return UserRole.USER();
      case 'ADMIN':
        return UserRole.ADMIN();
      case 'SUPER_ADMIN':
        return UserRole.SUPER_ADMIN();
      default:
        throw new Error(`Unknown UserRole: ${role}`);
    }
  }

  /**
   * Serialisiert Permission Array zu JSON String fuer Prisma Persistence.
   *
   * Konvertiert Domain Permission VOs zu einem JSON Array String.
   * Leeres Array wird zu NULL optimiert (keine unnötigen leeren Arrays in DB).
   *
   * **Warum NULL statt "[]":**
   * - Spart Speicherplatz für Users ohne Custom Permissions
   * - Macht Queries einfacher (WHERE permissions IS NULL vs WHERE permissions = "[]")
   * - Semantisch klarer: NULL = "keine Custom Permissions" vs "[]" = "explizit leer"
   *
   * @param permissions - Array von Permission Value Objects
   * @returns JSON String (z.B. '["user:read","einsatz:create"]') oder null bei leerem Array
   *
   * @example
   * ```typescript
   * serializePermissions([]) // null
   * serializePermissions([Permission.CREATE_EINSATZ()]) // '["einsatz:create"]'
   * serializePermissions([Permission.LOCK_ETB(), Permission.EDIT_EINSATZ()])
   * // '["etb:lock","einsatz:update"]'
   * ```
   */
  private static serializePermissions(permissions: Permission[]): string | null {
    // Leeres Array → NULL (Optimierung)
    if (permissions.length === 0) {
      return null;
    }

    // Extrahiere Permission Value Strings und serialisiere als JSON
    const permissionStrings = permissions.map((p) => p.value);
    return JSON.stringify(permissionStrings);
  }

  /**
   * Deserialisiert JSON String zu Permission Array fuer Domain Reconstruction.
   *
   * Parsed JSON String aus DB und konvertiert zu Permission Value Objects.
   * Implementiert graceful degradation bei Parse Fehlern (JSON corrupt oder invalid).
   *
   * **Warum graceful degradation:**
   * - Verhindert System-Crash bei DB-Corruption oder Schema-Migration Fehler
   * - User kann sich weiterhin einloggen (mit Role-Permissions only)
   * - Fehler wird geloggt für spätere Analyse (zukünftig)
   * - Security: Im Zweifel KEINE Permissions gewähren (fail-closed)
   *
   * @param json - JSON String aus Prisma (z.B. '["user:read"]') oder null
   * @returns Array von Permission VOs, leeres Array bei null oder Parse Error
   *
   * @example
   * ```typescript
   * deserializePermissions(null) // []
   * deserializePermissions('') // []
   * deserializePermissions('["user:read","einsatz:create"]')
   * // [Permission("user:read"), Permission("einsatz:create")]
   * deserializePermissions('invalid json') // [] (graceful degradation)
   * deserializePermissions('["invalid:format:too:many:colons"]') // [] (skip invalid)
   * ```
   */
  private static deserializePermissions(json: string | null): Permission[] {
    // NULL oder leerer String → leeres Array
    if (!json || json.trim() === '') {
      return [];
    }

    try {
      // Parse JSON Array
      const parsed = JSON.parse(json);

      // Validiere dass es ein Array ist
      if (!Array.isArray(parsed)) {
        // Graceful degradation: Ungültiges Format → leeres Array
        console.warn(`[PrismaUserMapper] Invalid permissions format (not an array): ${json}`);
        return [];
      }

      // Konvertiere String Array zu Permission VOs
      const permissions: Permission[] = [];
      for (const permissionString of parsed) {
        // Validiere dass es ein String ist
        if (typeof permissionString !== 'string') {
          console.warn(`[PrismaUserMapper] Skipping non-string permission: ${permissionString}`);
          continue;
        }

        // Erstelle Permission VO mit Validierung
        const result = Permission.create(permissionString);
        if (result.isSuccess) {
          permissions.push(result.value as Permission);
        } else {
          // Skip invalid permission (graceful degradation)
          console.warn(`[PrismaUserMapper] Skipping invalid permission: ${permissionString} (${result.error})`);
        }
      }

      return permissions;
    } catch (error) {
      // JSON Parse Fehler → graceful degradation
      console.warn(`[PrismaUserMapper] Failed to parse permissions JSON: ${json}`, error);
      return [];
    }
  }
}
