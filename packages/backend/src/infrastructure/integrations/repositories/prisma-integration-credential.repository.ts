/**
 * Prisma Repository für IntegrationCredential.
 *
 * Implementiert IIntegrationCredentialRepository mit Prisma Client.
 *
 * @module infrastructure/integrations/repositories
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { Result } from '@domain/common/result';
import { IntegrationCredential, type IntegrationType, INTEGRATION_ERROR_CODES, IntegrationError } from '@domain/integrations';
import type { IIntegrationCredentialRepository } from '@domain/integrations/repositories/i-integration-credential.repository';
import type { IntegrationCredential as PrismaIntegrationCredential } from '@prisma/client';

/**
 * Prisma-basiertes Repository für IntegrationCredential.
 */
@Injectable()
export class PrismaIntegrationCredentialRepository implements IIntegrationCredentialRepository {
  private readonly logger = new Logger(PrismaIntegrationCredentialRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Findet Credentials nach Integration-Typ.
   */
  async findByType(type: IntegrationType): Promise<Result<IntegrationCredential | undefined>> {
    try {
      const record = await this.prisma.integrationCredential.findUnique({
        where: { type },
      });

      if (!record) {
        return Result.ok(undefined);
      }

      return Result.ok(this.toDomain(record));
    } catch (error) {
      this.logger.error(`Failed to find credential by type ${type}`, error);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.CREDENTIALS_NOT_FOUND, 'Fehler beim Laden der Credentials'));
    }
  }

  /**
   * Speichert eine IntegrationCredential (Upsert).
   */
  async save(credential: IntegrationCredential): Promise<Result<IntegrationCredential>> {
    try {
      const data = {
        type: credential.type,
        isActive: credential.isActive,
        lastTestedAt: credential.lastTestedAt,
        lastSyncAt: credential.lastSyncAt,
        createdBy: credential.createdBy,
        updatedBy: credential.updatedBy,
        // OAuth2 Felder
        encryptedAccessToken: credential.encryptedAccessToken,
        encryptedRefreshToken: credential.encryptedRefreshToken,
        accessTokenExpiresAt: credential.accessTokenExpiresAt,
      };

      const record = await this.prisma.integrationCredential.upsert({
        where: { type: credential.type },
        update: {
          isActive: data.isActive,
          lastTestedAt: data.lastTestedAt,
          lastSyncAt: data.lastSyncAt,
          updatedBy: data.updatedBy,
          // OAuth2 Felder
          encryptedAccessToken: data.encryptedAccessToken,
          encryptedRefreshToken: data.encryptedRefreshToken,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
        },
        create: data,
      });

      this.logger.log(`Saved credential for type ${credential.type}`);
      return Result.ok(this.toDomain(record));
    } catch (error) {
      this.logger.error(`Failed to save credential for type ${credential.type}`, error);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.ENCRYPTION_FAILED, 'Fehler beim Speichern der Credentials'));
    }
  }

  /**
   * Löscht Credentials nach Integration-Typ.
   */
  async deleteByType(type: IntegrationType): Promise<Result<void>> {
    try {
      await this.prisma.integrationCredential.delete({
        where: { type },
      });

      this.logger.log(`Deleted credential for type ${type}`);
      return Result.ok(undefined);
    } catch (error) {
      this.logger.error(`Failed to delete credential for type ${type}`, error);
      return Result.fail(IntegrationError.format(INTEGRATION_ERROR_CODES.CREDENTIALS_NOT_FOUND, 'Fehler beim Löschen der Credentials'));
    }
  }

  /**
   * Mappt Prisma Record auf Domain Entity.
   */
  private toDomain(record: PrismaIntegrationCredential): IntegrationCredential {
    return IntegrationCredential.fromPersistence({
      id: record.id,
      type: record.type as IntegrationType,
      isActive: record.isActive,
      lastTestedAt: record.lastTestedAt ?? undefined,
      lastSyncAt: record.lastSyncAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy ?? undefined,
      updatedBy: record.updatedBy ?? undefined,
      // OAuth2 Felder
      encryptedAccessToken: record.encryptedAccessToken ?? undefined,
      encryptedRefreshToken: record.encryptedRefreshToken ?? undefined,
      accessTokenExpiresAt: record.accessTokenExpiresAt ?? undefined,
    });
  }
}
