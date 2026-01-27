import { Injectable } from '@nestjs/common';
import { IErinnerungKonfigurationRepository } from '@domain/erinnerung-konfiguration/repositories/erinnerung-konfiguration.repository.interface';
import { ErinnerungKonfiguration } from '@domain/erinnerung-konfiguration/entities/erinnerung-konfiguration.entity';
import { PrismaService } from '@infrastructure/database/prisma.service';
import { EskalationsTimeout } from '@domain/erinnerung-konfiguration/value-objects/eskalations-timeout';
import { ErinnerungKonfigurationId } from '@domain/erinnerung-konfiguration/value-objects/erinnerung-konfiguration-id';

@Injectable()
export class PrismaErinnerungKonfigurationRepository implements IErinnerungKonfigurationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ErinnerungKonfiguration | null> {
    const configModel = await this.prisma.erinnerungKonfiguration.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!configModel) {
      return null;
    }

    const timeoutResult = EskalationsTimeout.create(configModel.eskalationsTimeoutSeconds / 60);
    const timeout = timeoutResult.isSuccess && timeoutResult.value ? timeoutResult.value : EskalationsTimeout.default();

    // Rehydrate ID
    const idResult = ErinnerungKonfigurationId.create(configModel.id);
    // Assuming DB content is always valid CUID
    const id = idResult.isSuccess && idResult.value ? idResult.value : (ErinnerungKonfigurationId.create().value as ErinnerungKonfigurationId);

    return ErinnerungKonfiguration.create(
      {
        eskalationsTimeout: timeout,
        updatedBy: undefined, // user rehydration omitted for now
      },
      id,
    ).value!;
  }

  async save(config: ErinnerungKonfiguration): Promise<void> {
    let updatedBy = config.updatedBy ? config.updatedBy.value : undefined;

    // Sanity check: Ensure valid foreign key for updatedBy
    if (updatedBy) {
      const userExists = await this.prisma.user.findUnique({ where: { id: updatedBy } });
      if (!userExists) {
        console.warn(`[PrismaErinnerungKonfigurationRepository] User ${updatedBy} not found. Fallback to system/admin.`);
        updatedBy = undefined;
      }
    }

    if (!updatedBy) {
      // Fallback: Find first admin or any user
      const fallbackUser = await this.prisma.user.findFirst({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      });
      updatedBy = fallbackUser?.id;
    }

    if (!updatedBy) {
      // Last resort: If DB is empty or no admins, maybe we can't save?
      // But we must satisfy the constraint.
      // If no users exist at all, we can't save this config as it requires a user relation.
      throw new Error('Cannot save ErinnerungKonfiguration: No valid user found for updatedBy relation.');
    }

    const data = {
      eskalationsTimeoutSeconds: config.eskalationsTimeout.seconds,
      updatedBy: updatedBy,
    };

    await this.prisma.erinnerungKonfiguration.upsert({
      where: { id: config.id.toString() },
      update: {
        eskalationsTimeoutSeconds: data.eskalationsTimeoutSeconds,
        updatedBy: data.updatedBy,
      },
      create: {
        id: config.id.toString(),
        eskalationsTimeoutSeconds: data.eskalationsTimeoutSeconds,
        updatedBy: data.updatedBy,
      },
    });
  }
}
