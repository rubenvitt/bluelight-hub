import type { Erinnerung as PrismaErinnerung, ErinnerungStatus as PrismaErinnerungStatus } from '@/generated/prisma/client';
import { Erinnerung } from '@domain/entities/erinnerung.entity';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { ErinnerungStatus } from '@domain/value-objects/erinnerung-status';
import { ErinnerungTitel } from '@domain/value-objects/erinnerung-titel';
import { UserId } from '@domain/value-objects/user-id';

/**
 * Mapper für Erinnerung Entity <-> Prisma Model Konvertierung.
 *
 * **Verantwortlichkeiten:**
 * - Domain Entity zu Prisma-kompatiblem Format konvertieren (save)
 * - Prisma-Daten zu Domain Entity rekonstruieren (load)
 * - Value Object Validierung bei Rekonstruktion
 *
 * **Pattern:**
 * - Static Methods (keine Instanz nötig)
 * - Wirft bei Mapping-Fehlern (ungültige DB-Daten sind Programmierfehler)
 */
export class PrismaErinnerungMapper {
  /**
   * Konvertiert Prisma Erinnerung zu Domain Entity.
   *
   * @throws Error wenn DB-Daten ungültige Value Objects produzieren
   */
  static toDomain(prisma: PrismaErinnerung): Erinnerung {
    // 1. ErinnerungId rekonstruieren
    const idResult = ErinnerungId.create(prisma.id);
    if (idResult.isFailure || !idResult.value) {
      throw new Error(`Invalid ErinnerungId from DB: ${prisma.id}`);
    }

    // 2. EinsatzId rekonstruieren
    const einsatzIdResult = EinsatzId.create(prisma.einsatzId);
    if (einsatzIdResult.isFailure || !einsatzIdResult.value) {
      throw new Error(`Invalid EinsatzId from DB: ${prisma.einsatzId}`);
    }

    // 3. ErinnerungTitel rekonstruieren
    const titelResult = ErinnerungTitel.create(prisma.titel);
    if (titelResult.isFailure || !titelResult.value) {
      throw new Error(`Invalid ErinnerungTitel from DB: ${prisma.titel}`);
    }

    // 4. ErinnerungStatus rekonstruieren
    const status = PrismaErinnerungMapper.mapPrismaStatusToDomain(prisma.status);

    // 5. UserId (erstelltVon) rekonstruieren
    const userIdResult = UserId.create(prisma.erstelltVon);
    if (userIdResult.isFailure || !userIdResult.value) {
      throw new Error(`Invalid UserId from DB: ${prisma.erstelltVon}`);
    }

    // 6. Soft-Delete: deletedBy rekonstruieren (optional) (Story 1.4)
    let deletedBy: UserId | null = null;
    if (prisma.deletedBy) {
      const deletedByResult = UserId.create(prisma.deletedBy);
      if (deletedByResult.isFailure || !deletedByResult.value) {
        throw new Error(`Invalid deletedBy UserId from DB: ${prisma.deletedBy}`);
      }
      deletedBy = deletedByResult.value;
    }

    // 7. Acknowledge: acknowledgedBy rekonstruieren (optional) (Story 1.6)
    let acknowledgedBy: UserId | null = null;
    if (prisma.acknowledgedBy) {
      const acknowledgedByResult = UserId.create(prisma.acknowledgedBy);
      if (acknowledgedByResult.isFailure || !acknowledgedByResult.value) {
        throw new Error(`Invalid acknowledgedBy UserId from DB: ${prisma.acknowledgedBy}`);
      }
      acknowledgedBy = acknowledgedByResult.value;
    }

    // 8. Snooze: snoozedBy rekonstruieren (optional) (Story 2.1)
    let snoozedBy: UserId | null = null;
    if (prisma.snoozedBy) {
      const snoozedByResult = UserId.create(prisma.snoozedBy);
      if (snoozedByResult.isFailure || !snoozedByResult.value) {
        throw new Error(`Invalid snoozedBy UserId from DB: ${prisma.snoozedBy}`);
      }
      snoozedBy = snoozedByResult.value;
    }

    // 9. Entity via reconstruct() rekonstruieren (keine Events, keine Validierung)
    return Erinnerung.reconstruct({
      id: idResult.value,
      einsatzId: einsatzIdResult.value,
      titel: titelResult.value,
      beschreibung: prisma.beschreibung,
      faelligAm: prisma.faelligAm,
      status,
      erstelltVon: userIdResult.value,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      // Soft-Delete Felder (Story 1.4) - isDeleted direkt aus DB (nicht abgeleitet)
      isDeleted: prisma.isDeleted,
      deletedAt: prisma.deletedAt,
      deletedBy,
      // Auslösung Feld (Story 1.5)
      ausgeloestAm: prisma.ausgeloestAm,
      // Acknowledge Felder (Story 1.6)
      acknowledgedAm: prisma.acknowledgedAm,
      acknowledgedBy,
      // Snooze Felder (Story 2.1)
      snoozedAt: prisma.snoozedAt,
      snoozedBy,
      snoozedUntil: prisma.snoozedUntil,
      snoozeCount: prisma.snoozeCount,
    });
  }

  /**
   * Konvertiert Domain Entity zu Prisma-kompatiblem Format.
   *
   * **Hinweis:** Gibt ein Object zurück, das sowohl für `create` als auch `update` genutzt werden kann.
   */
  static toPersistence(entity: Erinnerung): {
    id: string;
    einsatzId: string;
    titel: string;
    beschreibung: string | null;
    faelligAm: Date;
    status: PrismaErinnerungStatus;
    erstelltVon: string;
    // Soft-Delete Felder (Story 1.4)
    isDeleted: boolean;
    deletedAt: Date | null;
    deletedBy: string | null;
    // Auslösung Feld (Story 1.5)
    ausgeloestAm: Date | null;
    // Acknowledge Felder (Story 1.6)
    acknowledgedAm: Date | null;
    acknowledgedBy: string | null;
    // Snooze Felder (Story 2.1)
    snoozedAt: Date | null;
    snoozedBy: string | null;
    snoozedUntil: Date | null;
    snoozeCount: number;
  } {
    return {
      id: entity.id.toString(),
      einsatzId: entity.einsatzId.toString(),
      titel: entity.titel.value,
      beschreibung: entity.beschreibung,
      faelligAm: entity.faelligAm,
      status: PrismaErinnerungMapper.mapDomainStatusToPrisma(entity.status),
      erstelltVon: entity.erstelltVon.toString(),
      // Soft-Delete Felder (Story 1.4)
      isDeleted: entity.isDeleted,
      deletedAt: entity.deletedAt,
      deletedBy: entity.deletedBy?.toString() ?? null,
      // Auslösung Feld (Story 1.5)
      ausgeloestAm: entity.ausgeloestAm,
      // Acknowledge Felder (Story 1.6)
      acknowledgedAm: entity.acknowledgedAm,
      acknowledgedBy: entity.acknowledgedBy?.toString() ?? null,
      // Snooze Felder (Story 2.1)
      snoozedAt: entity.snoozedAt,
      snoozedBy: entity.snoozedBy?.toString() ?? null,
      snoozedUntil: entity.snoozedUntil,
      snoozeCount: entity.snoozeCount,
    };
  }

  /**
   * Mappt Prisma ErinnerungStatus Enum zu Domain ErinnerungStatus Value Object.
   *
   * **TypeScript Exhaustiveness Check:**
   * Der `never` Type im default-Branch stellt sicher, dass bei einem neuen
   * Status in Prisma ein Compile-Time Error entsteht, wenn das Mapping fehlt.
   */
  private static mapPrismaStatusToDomain(prismaStatus: PrismaErinnerungStatus): ErinnerungStatus {
    switch (prismaStatus) {
      case 'GEPLANT':
        return ErinnerungStatus.GEPLANT();
      case 'AUSGELOEST':
        return ErinnerungStatus.AUSGELOEST();
      case 'ACKNOWLEDGED':
        return ErinnerungStatus.ACKNOWLEDGED();
      case 'SNOOZED':
        return ErinnerungStatus.SNOOZED();
      case 'ESKALIERT':
        return ErinnerungStatus.ESKALIERT();
      case 'ERLEDIGT':
        return ErinnerungStatus.ERLEDIGT();
      default: {
        // TypeScript Exhaustiveness Check - Compile-Time Error bei neuem Status
        const _exhaustiveCheck: never = prismaStatus;
        throw new Error(`Unknown Prisma ErinnerungStatus: ${_exhaustiveCheck}`);
      }
    }
  }

  /**
   * Mappt Domain ErinnerungStatus Value Object zu Prisma ErinnerungStatus Enum.
   */
  private static mapDomainStatusToPrisma(domainStatus: ErinnerungStatus): PrismaErinnerungStatus {
    const statusValue = domainStatus.value;
    // Prisma Enum und Domain Status haben die gleichen Werte
    return statusValue as PrismaErinnerungStatus;
  }
}
