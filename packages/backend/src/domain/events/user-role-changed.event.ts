import { DomainEvent } from '@domain/common/domain-event';
import type { UserId } from '../value-objects/user-id';
import type { UserRole } from '../value-objects/user-role';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn die Role eines Users geändert wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Changed", nicht "Change").
 *
 * Dieses Event wird nach erfolgreicher Role-Änderung ausgelöst, um andere
 * Module (z.B. Audit Log, Permission Cache Invalidation, Notifications)
 * zu benachrichtigen, ohne direkte Abhängigkeiten zu schaffen.
 *
 * Warum oldRole + newRole im Event (Event-Carried State Transfer)?
 * - Event Handler können Änderungen OHNE DB-Query verstehen
 * - Audit Log kann Delta (von ADMIN → USER) persistieren
 * - Permission Cache kann gezielt nur betroffene Permissions invalidieren
 * - Event Replay: Historischer Zustand ist im Event enthalten
 *
 * Warum changedBy im Event?
 * - Audit Trail: Wer hat die Role-Änderung durchgeführt?
 * - Security: Verhindert ungeklärte Permission-Änderungen
 * - Compliance: DSGVO/Logging-Anforderungen für Berechtigungsänderungen
 *
 * @example
 * ```typescript
 * const userId = UserId.create().value!;
 * const oldRole = UserRole.USER();
 * const newRole = UserRole.ADMIN();
 * const changedBy = UserId.create().value!; // Admin der die Änderung durchführt
 *
 * const event = new UserRoleChangedEvent(userId, oldRole, newRole, changedBy);
 * console.log(event.eventId); // "X1Y2Z3..." (auto-generated)
 * console.log(event.occurredAt); // 2024-11-17T10:30:00Z (auto-generated)
 * console.log(event.aggregateId); // userId.toString()
 * console.log(UserRoleChangedEvent.eventName()); // "user.role_changed"
 * ```
 */
export class UserRoleChangedEvent extends DomainEvent {
  /**
   * Constructor für UserRoleChangedEvent mit oldRole, newRole und changedBy.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param userId - Type-Safe ID des Users dessen Role geändert wurde (Aggregate Root ID)
   * @param oldRole - Vorherige UserRole (für Event-Carried State Transfer)
   * @param newRole - Neue UserRole (für Event-Carried State Transfer)
   * @param changedBy - UserId des Users der die Role-Änderung durchgeführt hat (Audit Trail)
   * @param aggregateId - Optional: ID der User Aggregate Root (für Event Store Context)
   */
  constructor(
    public readonly userId: UserId,
    public readonly oldRole: UserRole,
    public readonly newRole: UserRole,
    public readonly changedBy: UserId,
    aggregateId?: string,
  ) {
    super(aggregateId ?? userId.toString());
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated mit underscore für multi-word (z.B. 'user.role_changed').
   *
   * Warum underscore statt dash?
   * - Convention: Konsistente Naming Strategy (lowercase + underscore für multi-word)
   * - TypeScript Compatibility: Underscore ist valid in Property Names
   * - Event Bus Routing: Verhindert Konflikte mit dot-separator (hierarchisch)
   *
   * @returns Eindeutiger Event Name im Format "user.role_changed"
   */
  static eventName(): string {
    return EVENT_NAMES.USER.ROLE_CHANGED;
  }
}
