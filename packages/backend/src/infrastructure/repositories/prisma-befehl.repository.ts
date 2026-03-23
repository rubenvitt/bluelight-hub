import type { IBefehlRepository, BefehlFilterParams } from '@domain/repositories/i-befehl.repository';
import type { TransactionContext } from '@domain/common/transaction';
import type { Befehl } from '@domain/aggregates/befehl.aggregate';
import type { BefehlId } from '@domain/value-objects/befehl-id';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import { PrismaBefehlMapper } from './mappers/prisma-befehl.mapper';
import { Result } from '@domain/common/result';
import type { PrismaClient } from '@/generated/prisma/client';

/**
 * Prisma Implementation des IBefehlRepository.
 *
 * **Persistence Strategy:**
 * - save(): Upsert mit nested Child-Entity writes
 * - findById()/findByEinsatzId(): Eager Loading von empfaenger + kommentare
 * - KEIN delete() (Append-Only Policy, GoBD-Compliance)
 */
@Injectable()
export class PrismaBefehlRepository implements IBefehlRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(befehl: Befehl, tx?: TransactionContext): Promise<Result<void>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;
      const data = PrismaBefehlMapper.toPersistence(befehl);

      const { empfaenger, kommentare, ...befehlData } = data;

      await client.befehl.upsert({
        where: { id: data.id },
        create: {
          ...befehlData,
          empfaenger: {
            create: empfaenger,
          },
          kommentare: {
            create: kommentare,
          },
        },
        update: {
          ...befehlData,
          empfaenger: {
            deleteMany: {},
            create: empfaenger,
          },
          kommentare: {
            deleteMany: {},
            create: kommentare,
          },
        },
      });

      return Result.ok<void>(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<void>(`Fehler beim Speichern des Befehls: ${message}`);
    }
  }

  async findById(id: BefehlId, tx?: TransactionContext): Promise<Result<Befehl | null>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;

      const prismaBefehl = await client.befehl.findUnique({
        where: { id: id.value, isDeleted: false },
        include: {
          empfaenger: true,
          kommentare: true,
        },
      });

      if (!prismaBefehl) {
        return Result.ok<Befehl | null>(null);
      }

      return Result.ok<Befehl | null>(PrismaBefehlMapper.toDomain(prismaBefehl));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<Befehl | null>(`Fehler beim Laden des Befehls: ${message}`);
    }
  }

  async findByEinsatzId(einsatzId: EinsatzId, tx?: TransactionContext): Promise<Result<Befehl[]>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;

      const prismaBefehle = await client.befehl.findMany({
        where: { einsatzId: einsatzId.value, isDeleted: false },
        include: {
          empfaenger: true,
          kommentare: true,
        },
        orderBy: { erteiltAm: 'desc' },
      });

      const befehle = prismaBefehle.map((pb) => PrismaBefehlMapper.toDomain(pb));
      return Result.ok<Befehl[]>(befehle);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<Befehl[]>(`Fehler beim Laden der Befehle: ${message}`);
    }
  }

  async findByEmpfaengerId(einsatzId: EinsatzId, empfaengerId: string, tx?: TransactionContext): Promise<Result<Befehl[]>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;

      const prismaBefehle = await client.befehl.findMany({
        where: {
          einsatzId: einsatzId.value,
          isDeleted: false,
          empfaenger: { some: { empfaengerId } },
        },
        include: {
          empfaenger: true,
          kommentare: true,
        },
        orderBy: { erteiltAm: 'desc' },
      });

      const befehle = prismaBefehle.map((pb) => PrismaBefehlMapper.toDomain(pb));
      return Result.ok<Befehl[]>(befehle);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<Befehl[]>(`Fehler beim Laden der Befehle: ${message}`);
    }
  }

  async findFiltered(einsatzId: EinsatzId, filters: BefehlFilterParams, tx?: TransactionContext): Promise<Result<Befehl[]>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;

      // biome-ignore lint/suspicious/noExplicitAny: Dynamische Prisma WHERE-Clause Konstruktion
      const where: any = { einsatzId: einsatzId.value, isDeleted: false };

      if (filters.status && filters.status.length > 0) {
        where.status = { in: filters.status };
      }

      if (filters.q) {
        where.auftrag = { contains: filters.q, mode: 'insensitive' };
      }

      if (filters.befehlsgeberName) {
        where.befehlsgeberName = { contains: filters.befehlsgeberName, mode: 'insensitive' };
      }

      if (filters.empfaengerUserId) {
        where.empfaenger = { some: { empfaengerId: filters.empfaengerUserId } };
      }

      if (filters.empfaengerName) {
        where.empfaenger = {
          ...where.empfaenger,
          some: { ...where.empfaenger?.some, name: { contains: filters.empfaengerName, mode: 'insensitive' } },
        };
      }

      if (filters.von || filters.bis) {
        where.erteiltAm = {};
        if (filters.von) {
          where.erteiltAm.gte = filters.von;
        }
        if (filters.bis) {
          where.erteiltAm.lte = filters.bis;
        }
      }

      const prismaBefehle = await client.befehl.findMany({
        where,
        include: {
          empfaenger: true,
          kommentare: true,
        },
        orderBy: { erteiltAm: 'desc' },
      });

      const befehle = prismaBefehle.map((pb) => PrismaBefehlMapper.toDomain(pb));
      return Result.ok<Befehl[]>(befehle);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<Befehl[]>(`Fehler beim Laden der gefilterten Befehle: ${message}`);
    }
  }

  async findWithOpenRueckfragen(einsatzId: EinsatzId, tx?: TransactionContext): Promise<Result<Befehl[]>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;
      const prismaBefehle = await client.befehl.findMany({
        where: {
          einsatzId: einsatzId.value,
          isDeleted: false,
          kommentare: { some: { isRueckfrage: true, children: { none: {} } } },
        },
        include: {
          empfaenger: true,
          kommentare: true,
        },
        orderBy: { erteiltAm: 'desc' },
      });
      const befehle = prismaBefehle.map((pb) => PrismaBefehlMapper.toDomain(pb));
      return Result.ok<Befehl[]>(befehle);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<Befehl[]>(`Fehler beim Laden der Befehle mit offenen Rückfragen: ${message}`);
    }
  }

  /**
   * Ermittelt die nächste Sequenznummer für Befehle eines Einsatzes.
   *
   * Zählt alle existierenden Befehle des Einsatzes und gibt count + 1 zurück.
   * Wird vom CreateBefehlCommandHandler für sequentielle Befehlsnummern verwendet.
   *
   * @param einsatzId - Die EinsatzId für die Sequenz
   * @param tx - Optionale externe Transaktion
   * @returns Promise<Result<number>> - Nächste Sequenznummer (1-basiert)
   */
  async getNextSequenceNumber(einsatzId: EinsatzId, tx?: TransactionContext): Promise<Result<number>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;
      const count = await client.befehl.count({
        where: { einsatzId: einsatzId.value },
      });
      return Result.ok(count + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(`Fehler beim Ermitteln der nächsten Sequenznummer: ${message}`);
    }
  }

  // ===== DSGVO-Löschkonzept (Story 5.5) =====

  async findAbgelaufene(cutoffDate: Date, tx?: TransactionContext): Promise<Result<Befehl[]>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;

      const prismaBefehle = await client.befehl.findMany({
        where: {
          isDeleted: false,
          anonymisiertAm: null,
          einsatz: {
            archivedAt: { not: null, lt: cutoffDate },
          },
        },
        include: {
          empfaenger: true,
          kommentare: true,
        },
        orderBy: { erteiltAm: 'asc' },
      });

      const befehle = prismaBefehle.map((pb) => PrismaBefehlMapper.toDomain(pb));
      return Result.ok<Befehl[]>(befehle);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<Befehl[]>(`Fehler beim Laden abgelaufener Befehle: ${message}`);
    }
  }

  async bulkAnonymisiere(_einsatzId: EinsatzId, befehle: Befehl[], tx?: TransactionContext): Promise<Result<void>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;
      const now = new Date();

      for (const befehl of befehle) {
        const data = PrismaBefehlMapper.toPersistence(befehl);
        const { empfaenger, kommentare, ...befehlData } = data;

        await client.befehl.update({
          where: { id: befehl.id.value },
          data: {
            ...befehlData,
            anonymisiertAm: now,
            empfaenger: {
              deleteMany: {},
              create: empfaenger,
            },
            kommentare: {
              deleteMany: {},
              create: kommentare,
            },
          },
        });
      }

      return Result.ok<void>(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<void>(`Fehler bei der Bulk-Anonymisierung: ${message}`);
    }
  }

  async bulkSoftDelete(einsatzId: EinsatzId, deletedBy: string, tx?: TransactionContext): Promise<Result<void>> {
    try {
      const client = (tx as PrismaClient | undefined) ?? this.prisma;
      const now = new Date();

      // Soft-Delete aller Befehle des Einsatzes
      await client.befehl.updateMany({
        where: {
          einsatzId: einsatzId.value,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: now,
          deletedBy,
        },
      });

      // Soft-Delete aller zugehörigen Empfänger
      await client.befehlEmpfaenger.updateMany({
        where: {
          befehl: { einsatzId: einsatzId.value },
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: now,
          deletedBy,
        },
      });

      // Soft-Delete aller zugehörigen Kommentare
      await client.befehlKommentar.updateMany({
        where: {
          befehl: { einsatzId: einsatzId.value },
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: now,
          deletedBy,
        },
      });

      return Result.ok<void>(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail<void>(`Fehler beim Bulk-Soft-Delete: ${message}`);
    }
  }
}
