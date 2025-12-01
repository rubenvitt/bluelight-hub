import { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Result } from '@domain/common/result';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { PrismaTransaction } from '@/infrastructure/outbox/prisma-outbox.repository';
import { EinsatzStatus as PrismaEinsatzStatus } from '@prisma/client';

/**
 * Prisma Implementation des IEinsatzRepository (Hexagonal Architecture).
 *
 * Diese Klasse implementiert das Domain Repository Port Interface
 * für Einsatz-bezogene Operationen. Sie ist Teil der Infrastructure Layer
 * und dient als Adapter zwischen Domain und Persistence.
 *
 * **WICHTIG: Partielle Implementierung (Outbox Pattern Migration)**
 *
 * Diese Implementierung unterstützt jetzt Transactional Outbox Pattern via
 * optionalen Transaction Parameter in save(). Andere Methoden sind noch nicht
 * vollständig implementiert.
 *
 * **Implementierungsstatus:**
 * - [x] exists(id) - Benötigt für Lagekarte-Erstellung
 * - [x] save(aggregate, tx?) - Transactional Outbox Pattern Support (Story 0-1)
 * - [ ] findById(id) - Kommt in Epic 4
 * - [ ] findActive() - Kommt in Epic 4
 * - [ ] findByNummer(nummer) - Kommt in Epic 4
 * - [ ] countByStatus() - Kommt in Epic 4
 *
 * **Transactional Outbox Pattern:**
 * ```typescript
 * // Application Layer koordiniert Transaction
 * await this.prisma.$transaction(async (tx) => {
 *   await this.einsatzRepository.save(aggregate, tx);
 *   await this.outboxRepository.save(aggregate.domainEvents, tx);
 * });
 * aggregate.clearDomainEvents();
 * ```
 *
 * @example
 * ```typescript
 * // In Command Handler (Application Layer)
 * constructor(
 *   @Inject('IEinsatzRepository')
 *   private readonly einsatzRepository: IEinsatzRepository
 * ) {}
 *
 * async execute(command: CreateLagekarteCommand): Promise<Result<void>> {
 *   const exists = await this.einsatzRepository.exists(command.einsatzId);
 *   if (exists.isFailure || !exists.value) {
 *     return Result.fail('Einsatz not found');
 *   }
 * }
 * ```
 */
@Injectable()
export class PrismaEinsatzRepositoryAdapter implements IEinsatzRepository {
  private readonly logger = new Logger(PrismaEinsatzRepositoryAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Prüft ob ein Einsatz mit gegebener ID existiert.
   *
   * Diese Methode ist implementiert, da sie von anderen Aggregates
   * (z.B. Lagekarte) benötigt wird, um Referenzen zu validieren.
   *
   * **Performance:**
   * - COUNT Query statt SELECT * (keine Row Materialization)
   * - Primärschlüssel-Index (sehr schnell)
   *
   * @param id - Type-Safe EinsatzId
   * @returns Result<boolean> - Success mit true/false oder Failure bei DB-Fehler
   */
  async exists(id: EinsatzId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.einsatz.count({
        where: { id: id.value },
      });
      return Result.ok(count > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to check Einsatz existence: ${message}`, { einsatzId: id.value });
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Speichert ein Einsatz Aggregate (Create oder Update).
   *
   * WICHTIG - Transactional Outbox Pattern Support:
   * - Nutzt optionalen `tx` Parameter für atomare Operationen mit Outbox
   * - Wenn tx vorhanden: Nutze Transaction Client (vom Application Layer koordiniert)
   * - Wenn tx nicht vorhanden: Nutze Standard Prisma Client (Auto-Commit)
   *
   * WICHTIG - Repository Responsibility:
   * - Repository persistiert NUR das Aggregate (Einsatz → DB Row)
   * - KEINE Event-Serialisierung oder Outbox-Persistierung!
   * - Event Handling ist Application Layer Responsibility (Command Handler)
   *
   * Warum upsert() statt separate create()/update()?
   * - Aggregate ID entscheidet ob neu oder update (Domain Layer Verantwortung)
   * - Infrastructure Layer muss nicht zwischen create/update unterscheiden
   * - Verhindert Race Conditions bei parallelen Saves
   * - Vereinfacht Repository API
   *
   * Mapping Strategy:
   * - Domain Einsatz Aggregate → Prisma Einsatz Model
   * - EinsatzStatus Value Object → Prisma EinsatzStatus Enum
   * - Address Value Object → String (serialisiert als einsatzort)
   * - UserId Value Object → String (createdBy, updatedBy, archivedBy)
   * - Domain Events NICHT persistiert (Application Layer Verantwortung)
   *
   * @param aggregate - Einsatz Aggregate zum Persistieren
   * @param tx - Optional: Prisma Transaction für Transactional Outbox Pattern
   * @returns Result<void> - Success oder Failure mit DB-Fehler
   */
  async save(aggregate: Einsatz, tx?: PrismaTransaction): Promise<Result<void>> {
    try {
      // Use transaction client if provided, otherwise use standard Prisma client
      const client = tx ?? this.prisma;

      // Map Domain Aggregate → Prisma Model
      // NOTE: aggregate.nummer wird aktuell NICHT persistiert, da Prisma Schema kein `nummer` Field hat
      // TODO: Epic 4 - Add `nummer` column to einsaetze table and persist it here
      await client.einsatz.upsert({
        where: { id: aggregate.id.value },
        create: {
          id: aggregate.id.value,
          alarmstichwort: aggregate.alarmstichwort,
          einsatzort: this.serializeAddress(aggregate.einsatzort),
          beschreibung: aggregate.bemerkung ?? null,
          status: this.mapStatusToPrisma(aggregate.status.value),
          createdBy: aggregate.createdBy.value,
          updatedBy: aggregate.createdBy.value, // Initial: createdBy = updatedBy
          createdAt: aggregate.createdAt,
          updatedAt: aggregate.updatedAt,
          archivedAt: aggregate.archivedAt ?? null,
          archivedBy: aggregate.archivedAt ? aggregate.createdBy.value : null, // If archived, use createdBy
        },
        update: {
          alarmstichwort: aggregate.alarmstichwort,
          einsatzort: this.serializeAddress(aggregate.einsatzort),
          beschreibung: aggregate.bemerkung ?? null,
          status: this.mapStatusToPrisma(aggregate.status.value),
          updatedBy: aggregate.createdBy.value, // Always update updatedBy
          updatedAt: aggregate.updatedAt,
          archivedAt: aggregate.archivedAt ?? null,
          archivedBy: aggregate.archivedAt ? aggregate.createdBy.value : null,
        },
      });

      this.logger.debug(`Saved Einsatz ${aggregate.id.value}`, {
        status: aggregate.status.value,
        usingTransaction: !!tx,
      });

      return Result.ok<void>(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save Einsatz: ${message}`, {
        einsatzId: aggregate.id.value,
        error,
      });
      return Result.fail(`Database error: ${message}`);
    }
  }

  /**
   * Mappt Domain EinsatzStatus Value zu Prisma Enum.
   *
   * Warum separate Mapper-Methode:
   * - Entkoppelt Domain Layer von Prisma Types
   * - Zentralisiert Status-Mapping Logik
   * - Type-Safe Mapping (exhaustive switch)
   *
   * @param status - Domain Status String ('ANGELEGT', 'IN_BEARBEITUNG', 'ABGESCHLOSSEN', 'ARCHIVIERT')
   * @returns Prisma EinsatzStatus Enum Value
   */
  private mapStatusToPrisma(status: string): PrismaEinsatzStatus {
    switch (status) {
      case 'ANGELEGT':
        return PrismaEinsatzStatus.ANGELEGT;
      case 'IN_BEARBEITUNG':
        return PrismaEinsatzStatus.IN_BEARBEITUNG;
      case 'ABGESCHLOSSEN':
        return PrismaEinsatzStatus.ABGESCHLOSSEN;
      case 'ARCHIVIERT':
        return PrismaEinsatzStatus.ARCHIVIERT;
      default:
        throw new Error(`Unknown EinsatzStatus: ${status}`);
    }
  }

  /**
   * Serialisiert Address Value Object zu String.
   *
   * Warum String statt JSON:
   * - Einfachere Volltextsuche (PostgreSQL Text Search)
   * - Bessere Lesbarkeit in DB-Tools
   * - Kein Type-Casting notwendig
   *
   * Format: "Strasse Hausnummer, PLZ Ort" (z.B. "Musterstr. 42, 80331 München")
   * Falls Address undefined: null
   *
   * @param address - Optional Address Value Object
   * @returns Serialisierter String oder null
   */
  private serializeAddress(address: { strasse?: string; hausnummer?: string; plz?: string; ort?: string } | undefined): string | null {
    if (!address) return null;

    const parts: string[] = [];

    // Strasse + Hausnummer
    if (address.strasse) {
      parts.push(address.hausnummer ? `${address.strasse} ${address.hausnummer}` : address.strasse);
    }

    // PLZ + Ort
    if (address.plz || address.ort) {
      const ortPart = [address.plz, address.ort].filter(Boolean).join(' ');
      parts.push(ortPart);
    }

    return parts.join(', ') || null;
  }

  /**
   * Findet ein Einsatz Aggregate by ID.
   *
   * @throws NotImplementedError - Implementierung in Epic 4 (Einsatz Domain Migration)
   */
  async findById(_id: EinsatzId): Promise<Result<Einsatz | null>> {
    this.logger.warn('findById() called but not yet implemented - awaiting Epic 4 (Einsatz Domain Migration)');
    return Result.fail('PrismaEinsatzRepositoryAdapter.findById() not implemented yet - awaiting Epic 4');
  }

  /**
   * Findet alle aktiven Einsätze.
   *
   * @throws NotImplementedError - Implementierung in Epic 4 (Einsatz Domain Migration)
   */
  async findActive(): Promise<Result<Einsatz[]>> {
    this.logger.warn('findActive() called but not yet implemented - awaiting Epic 4 (Einsatz Domain Migration)');
    return Result.fail('PrismaEinsatzRepositoryAdapter.findActive() not implemented yet - awaiting Epic 4');
  }

  /**
   * Findet ein Einsatz Aggregate by Einsatznummer.
   *
   * @throws NotImplementedError - Implementierung in Epic 4 (Einsatz Domain Migration)
   */
  async findByNummer(_nummer: string): Promise<Result<Einsatz | null>> {
    this.logger.warn('findByNummer() called but not yet implemented - awaiting Epic 4 (Einsatz Domain Migration)');
    return Result.fail('PrismaEinsatzRepositoryAdapter.findByNummer() not implemented yet - awaiting Epic 4');
  }

  /**
   * Zaehlt Einsaetze gruppiert nach Status.
   *
   * @throws NotImplementedError - Implementierung in Epic 4 (Einsatz Domain Migration)
   */
  async countByStatus(_includeArchived: boolean): Promise<
    Result<{
      angelegt: number;
      inBearbeitung: number;
      abgeschlossen: number;
      archiviert: number;
    }>
  > {
    this.logger.warn('countByStatus() called but not yet implemented - awaiting Epic 4 (Einsatz Domain Migration)');
    return Result.fail('PrismaEinsatzRepositoryAdapter.countByStatus() not implemented yet - awaiting Epic 4');
  }
}
