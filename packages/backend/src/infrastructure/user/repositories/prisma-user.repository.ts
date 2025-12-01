import { Injectable, Logger } from '@nestjs/common';
import type { TransactionContext } from '@domain/common/transaction-context';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import type { UserAggregate } from '@domain/aggregates/user.aggregate';
import type { UserId } from '@domain/value-objects/user-id';
import type { Username } from '@domain/value-objects/username';
import { Result } from '@domain/common/result';
import { PrismaService } from '@/prisma/prisma.service';
import { PrismaUserMapper } from '../mappers/prisma-user.mapper';
import { Prisma } from '@prisma/client';

/**
 * Transaction Client Type Alias für bessere Lesbarkeit.
 * Kombiniert den Standard PrismaService mit Prisma's TransactionClient.
 */
type PrismaTransactionClient = Prisma.TransactionClient;

/**
 * Prisma-basierte Implementierung des IUserRepository.
 *
 * Persistiert UserAggregates mit Upsert-Logik und unterstützt
 * den Min-1-SUPER_ADMIN Constraint via countSuperAdmins().
 *
 * **AGGREGATE PERSISTENCE STRATEGY:**
 *
 * 1. **Upsert Pattern:**
 *    - save() prüft NICHT ob User existiert
 *    - Prisma upsert() handhabt CREATE vs UPDATE automatisch
 *    - Idempotent: save() kann mehrfach mit demselben Aggregate aufgerufen werden
 *
 * 2. **Transaction Support:**
 *    - Optional tx Parameter für atomare Multi-Aggregate Operations
 *    - Wenn tx=undefined: Verwendet this.prisma direkt (autocommit)
 *    - Wenn tx=provided: Nutzt externe Transaction (Handler-Level)
 *
 * 3. **Case-Insensitive Username:**
 *    - Username wird zu lowercase normalisiert in DB gespeichert
 *    - Alle Username Queries sind case-insensitive
 *    - Unique Constraint auf lowercase username
 *
 * 4. **Min-1-SUPER_ADMIN Constraint:**
 *    - countSuperAdmins() zählt NUR aktive (nicht gesperrte) SUPER_ADMINs
 *    - Filter: role='SUPER_ADMIN' AND isLocked=false
 *    - KRITISCH für Business Rule Enforcement im Aggregate
 *
 * **ERROR HANDLING:**
 * - save() propagiert Prisma Errors als Promise.reject()
 * - Query Methods nutzen Result Pattern für explicit Error Handling
 * - "Not found" ist SUCCESS mit null, NICHT FAILURE
 *
 * @implements IUserRepository
 */
@Injectable()
export class PrismaUserRepository implements IUserRepository {
  private readonly logger = new Logger(PrismaUserRepository.name);

  /**
   * Constructor mit Dependency Injection.
   *
   * @param prisma - PrismaService (NestJS-managed Singleton)
   */
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Speichert oder aktualisiert ein UserAggregate.
   *
   * Verwendet Upsert-Pattern für Create/Update in einer Operation.
   * Domain Events werden nach erfolgreicher Transaktion gecleart.
   *
   * **Transaction Handling:**
   * - Wenn tx=undefined: Nutzt this.prisma direkt (autocommit)
   * - Wenn tx=provided: Nutzt externe Transaction (Handler-Level)
   *
   * **passwordHash Handling:**
   * - Aggregate kennt KEIN passwordHash (Security by Design)
   * - passwordHash muss SEPARAT gesetzt werden (via AuthService)
   * - Hier wird passwordHash=null gesetzt (für neue User ohne Passwort)
   *
   * @param aggregate - Das zu speichernde UserAggregate
   * @param tx - Optionale externe Transaktion
   * @returns Result<void> - Success oder Failure mit Error Message
   */
  async save(aggregate: UserAggregate, tx?: TransactionContext): Promise<Result<void>> {
    // Transaction Client: externe tx oder Standard Prisma Client
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    try {
      // Aggregate → Prisma Data Mapping
      const data = PrismaUserMapper.toPersistence(aggregate);

      // UPSERT User Record (CREATE or UPDATE)
      await client.user.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          username: data.username,
          passwordHash: data.passwordHash,
          role: data.role,
          isActive: data.isActive,
          lastLoginAt: data.lastLoginAt,
          failedLoginCount: data.failedLoginCount,
          lockedUntil: data.lockedUntil,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          isDeleted: data.isDeleted,
          deletedAt: data.deletedAt,
          deletedBy: data.deletedBy,
          isLocked: data.isLocked,
          lockedManuallyAt: data.lockedManuallyAt,
        },
        update: {
          // Mutable Felder - können bei Update geändert werden
          username: data.username,
          role: data.role,
          isActive: data.isActive,
          lastLoginAt: data.lastLoginAt,
          failedLoginCount: data.failedLoginCount,
          lockedUntil: data.lockedUntil,
          updatedAt: data.updatedAt,
          isDeleted: data.isDeleted,
          deletedAt: data.deletedAt,
          deletedBy: data.deletedBy,
          isLocked: data.isLocked,
          lockedManuallyAt: data.lockedManuallyAt,
          // id, createdAt, passwordHash sind readonly - werden NICHT geupdated
        },
      });

      // Clear Domain Events AFTER successful save
      // WICHTIG: clearDomainEvents() verhindert Event-Replay bei erneutem save()
      aggregate.clearDomainEvents();

      return Result.ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to save User', { userId: aggregate.id.value, error: message });
      return Promise.reject(error);
    }
  }

  /**
   * Lädt ein UserAggregate anhand der UserId.
   *
   * @param id - UserId Value Object mit validierter Nanoid
   * @param tx - Optional Transaction Context für Atomizität
   * @returns Result<UserAggregate | null> - Success mit Aggregate oder null wenn nicht gefunden
   */
  async findById(id: UserId, tx?: TransactionContext): Promise<Result<UserAggregate | null>> {
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    try {
      const user = await client.user.findUnique({
        where: { id: id.value },
      });

      // NULL Handling: User nicht gefunden = SUCCESS mit null
      if (!user) {
        return Result.ok(null);
      }

      // Prisma → Domain Mapping (Aggregate Reconstruction)
      const aggregate = PrismaUserMapper.toAggregate(user);
      return Result.ok(aggregate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to find User by ID', { userId: id.value, error: message });
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Lädt ein UserAggregate anhand des Usernamens.
   *
   * Case-insensitive Suche (Username wird zu lowercase normalisiert).
   *
   * @param username - Username Value Object (min 3 chars, validated)
   * @param tx - Optional Transaction Context für Atomizität
   * @returns Result<UserAggregate | null> - Success mit Aggregate oder null wenn nicht gefunden
   */
  async findByUsername(username: Username, tx?: TransactionContext): Promise<Result<UserAggregate | null>> {
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    try {
      const user = await client.user.findUnique({
        where: { username: username.value.toLowerCase() },
      });

      // NULL Handling: User nicht gefunden = SUCCESS mit null
      if (!user) {
        return Result.ok(null);
      }

      // Prisma → Domain Mapping (Aggregate Reconstruction)
      const aggregate = PrismaUserMapper.toAggregate(user);
      return Result.ok(aggregate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to find User by username', { username: username.value, error: message });
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Prüft ob ein Username bereits existiert.
   *
   * Effiziente EXISTS Query ohne Full-Load.
   * Case-insensitive Suche via lowercase Normalisierung.
   *
   * @param username - Username Value Object (min 3 chars, validated)
   * @param tx - Optional Transaction Context für Race Condition Prevention
   * @returns Result<boolean> - Success mit true wenn Username existiert, false sonst
   */
  async existsByUsername(username: Username, tx?: TransactionContext): Promise<Result<boolean>> {
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    try {
      const count = await client.user.count({
        where: { username: username.value.toLowerCase() },
      });

      return Result.ok(count > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to check username existence', { username: username.value, error: message });
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Lädt alle User für Admin Dashboard.
   *
   * **ACHTUNG:** Keine Pagination - nur für MVP geeignet!
   * Für Production IMMER Pagination verwenden (Story 5.x).
   *
   * @param tx - Optional Transaction Context für Atomizität
   * @returns Result<UserAggregate[]> - Success mit Array aller User (kann leer sein)
   */
  async findAll(tx?: TransactionContext): Promise<Result<UserAggregate[]>> {
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    try {
      const users = await client.user.findMany({
        orderBy: { createdAt: 'desc' },
      });

      // Prisma → Domain Mapping für alle Ergebnisse
      const aggregates = users.map((u) => PrismaUserMapper.toAggregate(u));
      return Result.ok(aggregates);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to find all Users', { error: message });
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Zählt aktive (nicht gesperrte, nicht gelöschte) SUPER_ADMIN User.
   *
   * KRITISCH für Min-1-SUPER_ADMIN Constraint:
   * - Nur role = 'SUPER_ADMIN'
   * - Nur isLocked = false
   * - Nur isDeleted = false
   *
   * **Warum isLocked Filter:**
   * - Gesperrte SUPER_ADMINs zählen NICHT für Min-1-SUPER_ADMIN Constraint
   * - Verhindert Lock-Out Scenario: letzter aktiver SUPER_ADMIN kann nicht gesperrt werden
   * - Ermöglicht temporäres Sperren von SUPER_ADMINs wenn mindestens 1 anderer aktiv ist
   *
   * **Warum isDeleted Filter:**
   * - Soft-gelöschte SUPER_ADMINs zählen NICHT für Min-1-SUPER_ADMIN Constraint
   * - Verhindert System-Lockout nach versehentlicher Soft-Delete Operation
   * - Konsistent mit isLocked Filter (beide sind "deaktiviert" States)
   *
   * @param tx - Optional Transaction Context (WICHTIG für Atomizität mit save())
   * @returns Result<number> - Success mit Anzahl aktiver SUPER_ADMINs (>= 1 expected)
   */
  async countSuperAdmins(tx?: TransactionContext): Promise<Result<number>> {
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    try {
      const count = await client.user.count({
        where: {
          role: 'SUPER_ADMIN',
          isLocked: false,
          isDeleted: false,
        },
      });

      return Result.ok(count);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to count SuperAdmins', { error: message });
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Lädt den bcrypt Password Hash für einen User.
   *
   * **Security Separation:**
   * - Password Hash ist NICHT Teil des User Aggregates (Security by Design)
   * - Nur Infrastructure Layer hat Zugriff auf passwordHash
   * - Separate Query verhindert unnötiges Laden bei normalen User Operations
   *
   * **Use Case:**
   * - Login Flow: Password Verification via bcrypt.compare()
   * - Password Change: Verify Old Password before setting New Password
   *
   * **PASSWORDLESS Auth:**
   * - USER-Accounts haben passwordHash = NULL
   * - null ist valides Business-Resultat (KEIN Fehler)
   *
   * @param id - UserId Value Object mit validierter Nanoid
   * @param tx - Optional Transaction Context für Atomizität
   * @returns Result<string | null> - Success mit bcrypt Hash oder null wenn User kein Passwort hat
   */
  async getPasswordHash(id: UserId, tx?: TransactionContext): Promise<Result<string | null>> {
    const client = (tx as PrismaTransactionClient | undefined) ?? this.prisma;

    try {
      const user = await client.user.findUnique({
        where: { id: id.value },
        select: { passwordHash: true }, // Only select passwordHash (Performance)
      });

      // NULL Handling: User nicht gefunden = FAILURE (User muss existieren für Password Check)
      if (!user) {
        return Result.fail('User nicht gefunden');
      }

      // NULL Handling: passwordHash = null ist valid (PASSWORDLESS USER Account)
      return Result.ok(user.passwordHash);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to get password hash', { userId: id.value, error: message });
      return Result.fail(`Database error: ${message}`);
    }
  }
}
