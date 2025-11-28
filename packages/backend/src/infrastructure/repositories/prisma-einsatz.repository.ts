import type { IEinsatzRepository } from '@domain/repositories/ieinsatz.repository';
import type { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Result } from '@domain/common/result';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * Prisma Implementation des IEinsatzRepository (Hexagonal Architecture).
 *
 * Diese Klasse implementiert das Domain Repository Port Interface
 * für Einsatz-bezogene Operationen. Sie ist Teil der Infrastructure Layer
 * und dient als Adapter zwischen Domain und Persistence.
 *
 * **WICHTIG: Begrenzte Implementierung (Minimal Viable)**
 *
 * Diese Implementierung ist absichtlich begrenzt auf die Methoden,
 * die aktuell von anderen Aggregates benötigt werden (z.B. Lagekarte).
 *
 * **Warum nicht alle IEinsatzRepository Methoden implementiert:**
 * - Epic 4 (Einsatz Migration) wird die vollständige Implementierung bringen
 * - Aktuell nur exists() wird von CreateLagekarteCommandHandler benötigt
 * - Andere Methoden werfen NotImplementedError bis Migration vollständig ist
 *
 * **Implementierungsstatus:**
 * - [x] exists(id) - Benötigt für Lagekarte-Erstellung
 * - [ ] save(aggregate) - Kommt in Epic 4
 * - [ ] findById(id) - Kommt in Epic 4
 * - [ ] findActive() - Kommt in Epic 4
 * - [ ] findByNummer(nummer) - Kommt in Epic 4
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
   * Speichert ein Einsatz Aggregate.
   *
   * @throws NotImplementedError - Implementierung in Epic 4 (Einsatz Domain Migration)
   */
  async save(_aggregate: Einsatz): Promise<Result<void>> {
    this.logger.warn('save() called but not yet implemented - awaiting Epic 4 (Einsatz Domain Migration)');
    return Result.fail('PrismaEinsatzRepositoryAdapter.save() not implemented yet - awaiting Epic 4');
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
