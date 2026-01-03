/**
 * Prisma Repository für QualifikationMapping.
 *
 * Implementiert IQualifikationMappingRepository mit Prisma Client.
 *
 * Story 7.2: HiOrg-Server Import - Qualifikations-Mapping
 *
 * @module infrastructure/integrations/repositories
 */

import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { Result } from '@domain/common/result';
import { QualifikationMapping, INTEGRATION_ERROR_CODES, IntegrationError, type IntegrationType, type IQualifikationMappingRepository } from '@domain/integrations';
import type { TransactionContext } from '@domain/common/transaction';
import type { QualifikationMapping as PrismaQualifikationMapping } from '@prisma/client';
import { LOGGER } from '@/infrastructure/di-tokens';
import type { ILogger } from '@domain/ports/i-logger.port';

/**
 * Prisma Transaction Client Type für atomare Operationen.
 * Cast-Ziel für TransactionContext aus dem Domain Layer.
 */
type PrismaTransactionClient = Omit<PrismaService, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends' | 'onModuleInit' | 'onModuleDestroy'>;

/**
 * Prisma-basiertes Repository für QualifikationMapping.
 *
 * Nutzt Logger Port statt new Logger() (AC3: Framework-Agnostizität).
 */
@Injectable()
export class PrismaQualifikationMappingRepository implements IQualifikationMappingRepository {
  constructor(
    @Inject(LOGGER)
    private readonly logger: ILogger,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Gibt den Prisma Client oder Transaction Context zurück.
   */
  private getClient(tx?: TransactionContext): PrismaTransactionClient {
    return (tx as PrismaTransactionClient | undefined) ?? this.prisma;
  }

  /**
   * Findet alle Mappings für eine externe Quelle.
   */
  async findByExternalSource(source: IntegrationType, tx?: TransactionContext): Promise<Result<QualifikationMapping[]>> {
    try {
      const client = this.getClient(tx);
      const records = await client.qualifikationMapping.findMany({
        where: { externalSource: source },
        orderBy: [{ qualifikationId: 'asc' }, { externalName: 'asc' }], // Ungemappte zuerst
      });

      const mappings = records.map((r) => this.toDomain(r));
      return Result.ok(mappings);
    } catch (error) {
      this.logger.error(`Failed to find mappings for source ${source}`, String(error));
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.MAPPING_NOT_FOUND, 'Fehler beim Laden der Mappings'));
    }
  }

  /**
   * Findet ein Mapping nach externem Namen und Quelle.
   */
  async findByExternalName(name: string, source: IntegrationType, tx?: TransactionContext): Promise<Result<QualifikationMapping | null>> {
    try {
      const client = this.getClient(tx);
      const record = await client.qualifikationMapping.findUnique({
        where: {
          externalName_externalSource: {
            externalName: name,
            externalSource: source,
          },
        },
      });

      if (!record) {
        return Result.ok(null);
      }

      return Result.ok(this.toDomain(record));
    } catch (error) {
      this.logger.error(`Failed to find mapping for name ${name}`, String(error));
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.MAPPING_NOT_FOUND, 'Fehler beim Laden des Mappings'));
    }
  }

  /**
   * Findet ein Mapping nach ID.
   */
  async findById(id: string, tx?: TransactionContext): Promise<Result<QualifikationMapping | null>> {
    try {
      const client = this.getClient(tx);
      const record = await client.qualifikationMapping.findUnique({
        where: { id },
      });

      if (!record) {
        return Result.ok(null);
      }

      return Result.ok(this.toDomain(record));
    } catch (error) {
      this.logger.error(`Failed to find mapping by ID ${id}`, String(error));
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.MAPPING_NOT_FOUND, 'Fehler beim Laden des Mappings'));
    }
  }

  /**
   * Findet alle Mappings die auf eine bestimmte Qualifikation verweisen.
   */
  async findByQualifikationId(qualifikationId: string, tx?: TransactionContext): Promise<Result<QualifikationMapping[]>> {
    try {
      const client = this.getClient(tx);
      const records = await client.qualifikationMapping.findMany({
        where: { qualifikationId },
        orderBy: { externalName: 'asc' },
      });

      const mappings = records.map((r) => this.toDomain(r));
      return Result.ok(mappings);
    } catch (error) {
      this.logger.error(`Failed to find mappings for qualifikation ${qualifikationId}`, String(error));
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.MAPPING_NOT_FOUND, 'Fehler beim Laden der Mappings'));
    }
  }

  /**
   * Findet alle ungemappten Einträge für eine Quelle.
   */
  async findUnmapped(source: IntegrationType, tx?: TransactionContext): Promise<Result<QualifikationMapping[]>> {
    try {
      const client = this.getClient(tx);
      const records = await client.qualifikationMapping.findMany({
        where: {
          externalSource: source,
          qualifikationId: null,
        },
        orderBy: { externalName: 'asc' },
      });

      const mappings = records.map((r) => this.toDomain(r));
      return Result.ok(mappings);
    } catch (error) {
      this.logger.error(`Failed to find unmapped for source ${source}`, String(error));
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.MAPPING_NOT_FOUND, 'Fehler beim Laden der ungemappten Einträge'));
    }
  }

  /**
   * Speichert ein Mapping (Upsert).
   */
  async save(mapping: QualifikationMapping, tx?: TransactionContext): Promise<Result<void>> {
    try {
      const client = this.getClient(tx);
      const props = mapping.toPersistence();

      await client.qualifikationMapping.upsert({
        where: {
          externalName_externalSource: {
            externalName: props.externalName,
            externalSource: props.externalSource,
          },
        },
        update: {
          qualifikationId: props.qualifikationId,
          isAutoMatched: props.isAutoMatched,
          confidence: props.confidence,
          updatedBy: props.updatedBy,
        },
        create: {
          id: props.id,
          externalName: props.externalName,
          externalSource: props.externalSource,
          qualifikationId: props.qualifikationId,
          isAutoMatched: props.isAutoMatched,
          confidence: props.confidence,
          createdBy: props.createdBy,
        },
      });

      return Result.ok(undefined);
    } catch (error) {
      this.logger.error(`Failed to save mapping ${mapping.externalName}`, String(error));
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.IMPORT_FAILED, 'Fehler beim Speichern des Mappings'));
    }
  }

  /**
   * Speichert mehrere Mappings in einem Batch.
   */
  async saveMany(mappings: QualifikationMapping[], tx?: TransactionContext): Promise<Result<void>> {
    if (mappings.length === 0) {
      return Result.ok(undefined);
    }

    try {
      const client = this.getClient(tx);

      // Batch-Upsert mit Prisma Transaction
      const operations = mappings.map((mapping) => {
        const props = mapping.toPersistence();
        return client.qualifikationMapping.upsert({
          where: {
            externalName_externalSource: {
              externalName: props.externalName,
              externalSource: props.externalSource,
            },
          },
          update: {
            qualifikationId: props.qualifikationId,
            isAutoMatched: props.isAutoMatched,
            confidence: props.confidence,
            updatedBy: props.updatedBy,
          },
          create: {
            id: props.id,
            externalName: props.externalName,
            externalSource: props.externalSource,
            qualifikationId: props.qualifikationId,
            isAutoMatched: props.isAutoMatched,
            confidence: props.confidence,
            createdBy: props.createdBy,
          },
        });
      });

      // Falls bereits in TX, führe einzeln aus; sonst nutze $transaction
      if (tx) {
        for (const op of operations) {
          await op;
        }
      } else {
        await this.prisma.$transaction(operations);
      }

      this.logger.log(`Saved ${mappings.length} mappings in batch`);
      return Result.ok(undefined);
    } catch (error) {
      this.logger.error(`Failed to save ${mappings.length} mappings`, String(error));
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.IMPORT_FAILED, 'Fehler beim Batch-Speichern der Mappings'));
    }
  }

  /**
   * Löscht ein Mapping nach ID.
   */
  async delete(id: string, tx?: TransactionContext): Promise<Result<void>> {
    try {
      const client = this.getClient(tx);
      await client.qualifikationMapping.delete({
        where: { id },
      });

      return Result.ok(undefined);
    } catch (error) {
      this.logger.error(`Failed to delete mapping ${id}`, String(error));
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.MAPPING_NOT_FOUND, 'Fehler beim Löschen des Mappings'));
    }
  }

  /**
   * Löscht alle Mappings für eine externe Quelle.
   */
  async deleteBySource(source: IntegrationType, tx?: TransactionContext): Promise<Result<number>> {
    try {
      const client = this.getClient(tx);
      const result = await client.qualifikationMapping.deleteMany({
        where: { externalSource: source },
      });

      this.logger.log(`Deleted ${result.count} mappings for source ${source}`);
      return Result.ok(result.count);
    } catch (error) {
      this.logger.error(`Failed to delete mappings for source ${source}`, String(error));
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.MAPPING_NOT_FOUND, 'Fehler beim Löschen der Mappings'));
    }
  }

  /**
   * Zählt die Mappings für eine Quelle.
   */
  async count(source: IntegrationType, _onlyMapped?: boolean, tx?: TransactionContext): Promise<Result<{ total: number; mapped: number; unmapped: number }>> {
    try {
      const client = this.getClient(tx);

      const [total, unmapped] = await Promise.all([
        client.qualifikationMapping.count({
          where: { externalSource: source },
        }),
        client.qualifikationMapping.count({
          where: {
            externalSource: source,
            qualifikationId: null,
          },
        }),
      ]);

      return Result.ok({
        total,
        mapped: total - unmapped,
        unmapped,
      });
    } catch (error) {
      this.logger.error(`Failed to count mappings for source ${source}`, String(error));
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.MAPPING_NOT_FOUND, 'Fehler beim Zählen der Mappings'));
    }
  }

  /**
   * Mappt Prisma Record zu Domain Entity.
   */
  private toDomain(record: PrismaQualifikationMapping): QualifikationMapping {
    const result = QualifikationMapping.reconstitute({
      id: record.id,
      externalName: record.externalName,
      externalSource: record.externalSource as IntegrationType,
      qualifikationId: record.qualifikationId,
      isAutoMatched: record.isAutoMatched,
      confidence: record.confidence,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
    });

    // Reconstitute sollte nie fehlschlagen bei gültigen DB-Daten
    if (result.isFailure) {
      throw new Error(`Failed to reconstitute QualifikationMapping: ${result.error}`);
    }

    return result.value!;
  }
}
