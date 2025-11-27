import type { User as PrismaUser, UserRole as PrismaUserRole } from '@prisma/client';
import { UserAggregate } from '@domain/aggregates/user.aggregate';
import { UserId } from '@domain/value-objects/user-id';
import { Username } from '@domain/value-objects/username';
import { UserRole } from '@domain/value-objects/user-role';

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
 * - `permissions` (custom) existiert NUR in Domain, NICHT in Prisma Schema
 * - `username` wird zu lowercase normalisiert in DB gespeichert
 * - `role` ist Enum in DB, Value Object in Domain
 * - `isLocked` ist boolean in beiden, aber Semantik unterschiedlich (manual vs auto-lock)
 *
 * **Design-Entscheidungen:**
 * - Custom Permissions werden NICHT persistiert (Domain-Only, transient state)
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
    };
  }

  /**
   * Rekonstruiert ein UserAggregate aus Prisma-Daten.
   *
   * Nutzt Object.defineProperty() um private Fields des Aggregates zu setzen,
   * da der private Constructor nicht direkt aufgerufen werden kann.
   *
   * WICHTIG: Domain-Only Felder werden NICHT rekonstruiert:
   * - Custom Permissions: Werden als leeres Array initialisiert (transient state)
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
      throw new Error(`Invalid Username: ${usernameResult.error}`);
    }
    const username = usernameResult.value as Username;

    // Role Mapping: Prisma Enum String → Domain VO
    const role = PrismaUserMapper.mapPrismaRoleToDomain(prismaData.role);

    // Step 2: Erstelle Aggregate via Factory (validiert Constraints)
    // Custom Permissions werden NICHT persistiert (transient state)
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
}
