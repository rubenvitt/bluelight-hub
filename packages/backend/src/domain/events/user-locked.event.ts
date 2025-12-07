import { DomainEvent } from '@domain/common/domain-event';
import type { UserId } from '../value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn ein User-Account gesperrt wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Locked", nicht "Lock").
 *
 * Dieses Event wird nach erfolgreicher User-Sperrung ausgelöst, um andere
 * Module (z.B. Session Termination, Audit Log, Notifications) zu benachrichtigen,
 * ohne direkte Abhängigkeiten zu schaffen.
 *
 * Warum lockedBy und reason im Event?
 * - Audit Trail: Wer hat den User gesperrt und warum?
 * - Security: Verhindert ungeklärte Account-Sperrungen
 * - Compliance: Logging-Anforderungen für Security-relevante Aktionen
 * - Transparency: Gesperrte User können Grund der Sperrung einsehen
 *
 * Use Case Beispiele:
 * - ADMIN sperrt USER wegen verdächtiger Aktivitäten
 * - SUPER_ADMIN sperrt ADMIN wegen Policy-Verstößen
 * - Automatische Sperrung nach mehrfachen Fehlversuchen (system-triggered)
 *
 * Wichtige Event Handler Actions:
 * - Session Termination: Alle aktiven Sessions des gesperrten Users beenden
 * - Audit Log: Permanentes Log der Sperrung mit Grund
 * - Notifications: Benachrichtigung an gesperrten User und Admins
 * - Security Monitoring: Tracking von Sperr-Mustern
 *
 * @example
 * ```typescript
 * const userId = UserId.create().value!;
 * const lockedBy = UserId.create().value!; // Admin der den User sperrt
 *
 * const event = new UserLockedEvent(userId, lockedBy, 'Verdächtige Login-Aktivitäten');
 * console.log(event.eventId); // "X1Y2Z3..." (auto-generated)
 * console.log(event.occurredAt); // 2024-11-17T10:30:00Z (auto-generated)
 * console.log(event.aggregateId); // userId.toString()
 * console.log(UserLockedEvent.eventName()); // "user.locked"
 * ```
 */
export class UserLockedEvent extends DomainEvent {
  /**
   * Constructor für UserLockedEvent mit lockedBy und optional reason.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param userId - Type-Safe ID des gesperrten Users (Aggregate Root ID)
   * @param lockedBy - UserId des Users der die Sperrung durchgeführt hat (Audit Trail)
   * @param reason - Optional: Grund der Sperrung (für Transparency und Audit)
   * @param aggregateId - Optional: ID der User Aggregate Root (für Event Store Context)
   */
  constructor(
    public readonly userId: UserId,
    public readonly lockedBy: UserId,
    public readonly reason?: string,
    aggregateId?: string,
  ) {
    super(aggregateId ?? userId.toString());
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated (z.B. 'user.locked').
   *
   * Warum "user.locked" statt "user.suspended"?
   * - Klarheit: "Locked" ist eindeutiger (Account Login blockiert)
   * - Konsistenz: Matcht Prisma Schema isLocked Field
   * - Reversibilität: "Locked" impliziert "Unlocked" ist möglich
   *
   * @returns Eindeutiger Event Name im Format "user.locked"
   */
  static eventName(): string {
    return EVENT_NAMES.USER.LOCKED;
  }
}
