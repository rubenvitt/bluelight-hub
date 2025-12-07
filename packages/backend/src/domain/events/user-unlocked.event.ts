import { DomainEvent } from '@domain/common/domain-event';
import type { UserId } from '../value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn ein User-Account entsperrt wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Unlocked", nicht "Unlock").
 *
 * Dieses Event wird nach erfolgreicher User-Entsperrung ausgelöst, um andere
 * Module (z.B. Audit Log, Notifications, Access Restoration) zu benachrichtigen,
 * ohne direkte Abhängigkeiten zu schaffen.
 *
 * Warum unlockedBy im Event?
 * - Audit Trail: Wer hat den User entsperrt?
 * - Security: Verhindert ungeklärte Account-Entsperrungen
 * - Compliance: Logging-Anforderungen für Security-relevante Aktionen
 * - Accountability: Verantwortlichkeit für Access-Restoration
 *
 * Use Case Beispiele:
 * - ADMIN entsperrt USER nach Klärung verdächtiger Aktivitäten
 * - SUPER_ADMIN entsperrt ADMIN nach beendeter Untersuchung
 * - Automatische Entsperrung nach Timeout (system-triggered, unlockedBy = system)
 *
 * Wichtige Event Handler Actions:
 * - Audit Log: Permanentes Log der Entsperrung
 * - Notifications: Benachrichtigung an entsperrten User (Account wieder aktiv)
 * - Security Monitoring: Tracking von Unlock-Mustern
 * - Failed Login Reset: Zurücksetzen von fehlgeschlagenen Login-Versuchen
 *
 * @example
 * ```typescript
 * const userId = UserId.create().value!;
 * const unlockedBy = UserId.create().value!; // Admin der den User entsperrt
 *
 * const event = new UserUnlockedEvent(userId, unlockedBy);
 * console.log(event.eventId); // "X1Y2Z3..." (auto-generated)
 * console.log(event.occurredAt); // 2024-11-17T10:30:00Z (auto-generated)
 * console.log(event.aggregateId); // userId.toString()
 * console.log(UserUnlockedEvent.eventName()); // "user.unlocked"
 * ```
 */
export class UserUnlockedEvent extends DomainEvent {
  /**
   * Constructor für UserUnlockedEvent mit unlockedBy.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param userId - Type-Safe ID des entsperrten Users (Aggregate Root ID)
   * @param unlockedBy - UserId des Users der die Entsperrung durchgeführt hat (Audit Trail)
   * @param aggregateId - Optional: ID der User Aggregate Root (für Event Store Context)
   */
  constructor(
    public readonly userId: UserId,
    public readonly unlockedBy: UserId,
    aggregateId?: string,
  ) {
    super(aggregateId ?? userId.toString());
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated (z.B. 'user.unlocked').
   *
   * Warum "user.unlocked" statt "user.reactivated"?
   * - Klarheit: "Unlocked" ist eindeutiger (reversiert Lock Operation)
   * - Konsistenz: Matcht Prisma Schema isLocked Field und UserLockedEvent
   * - Symmetrie: Lock/Unlock Pair ist semantisch klar
   *
   * @returns Eindeutiger Event Name im Format "user.unlocked"
   */
  static eventName(): string {
    return EVENT_NAMES.USER.UNLOCKED;
  }
}
