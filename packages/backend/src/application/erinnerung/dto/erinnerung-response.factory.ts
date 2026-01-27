import { Inject, Injectable } from '@nestjs/common';
import type { IUserRepository } from '@domain/repositories/i-user.repository';
import type { Erinnerung } from '@domain/entities/erinnerung.entity';
import type { ErinnerungResponseDto } from './erinnerung-response.dto';
import { USER_REPOSITORY } from '@infrastructure/di-tokens';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Factory zur Erstellung von ErinnerungResponseDtos.
 *
 * Kapselt die Logik zum Laden von verknüpften Namen (Ersteller, AssignedTo, Eskalation),
 * um Code-Duplizierung in Command Handlers zu vermeiden.
 */
@Injectable()
export class ErinnerungResponseFactory {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository) {}

  /**
   * Erstellt ein DTO für eine einzelne Erinnerung inkl. Namens-Auflösung.
   *
   * @param erinnerung - Die Domain Entity
   * @returns ErinnerungResponseDto mit aufgelösten Namen
   */
  async create(erinnerung: Erinnerung): Promise<ErinnerungResponseDto> {
    // 1. Namen laden (Parallel für Performance)
    const [erstellerName, assignedToName, eskalationsPersonName] = await Promise.all([
      this.resolveUserName(erinnerung.erstelltVon),
      erinnerung.assignedToId ? this.resolveUserName(erinnerung.assignedToId) : Promise.resolve(null),
      erinnerung.eskalationsPersonId ? this.resolveUserName(erinnerung.eskalationsPersonId) : Promise.resolve(null),
    ]);

    // 2. DTO bauen
    return {
      id: erinnerung.id.toString(),
      einsatzId: erinnerung.einsatzId.toString(),
      titel: erinnerung.titel.value,
      beschreibung: erinnerung.beschreibung ?? null,
      faelligAm: erinnerung.faelligAm.toISOString(),
      status: erinnerung.status.value,
      ausgeloestAm: erinnerung.ausgeloestAm?.toISOString() ?? null,
      erstelltVon: erinnerung.erstelltVon.toString(),
      erstellerName,
      createdAt: erinnerung.createdAt.toISOString(),
      updatedAt: erinnerung.updatedAt.toISOString(),
      snoozeCount: erinnerung.snoozeCount,
      requiresNote: erinnerung.requiresNote,
      assignedToId: erinnerung.assignedToId?.toString() ?? null,
      assignedToName,
      eskalationsPersonId: erinnerung.eskalationsPersonId?.toString() ?? null,
      eskalationsPersonName,

      // Weitere Felder
      erledigtBy: erinnerung.erledigtBy?.toString() ?? null,
      erledigungsNotiz: erinnerung.erledigungsNotiz ?? null,

      // Story 4.5
      escalatedAt: erinnerung.escalatedAt?.toISOString() ?? null,
      previousAssigneeId: erinnerung.previousAssigneeId?.toString() ?? null,
      previousAssigneeName: erinnerung.previousAssigneeId ? await this.resolveUserName(erinnerung.previousAssigneeId) : null,
    };
  }

  /**
   * Hilfsmethode zum Auflösen eines Usernamens via ID.
   */
  private async resolveUserName(userId: UserId): Promise<string | null> {
    const result = await this.userRepository.findById(userId);
    if (result.isSuccess && result.value) {
      return result.value.username.value;
    }
    return null;
  }
}
