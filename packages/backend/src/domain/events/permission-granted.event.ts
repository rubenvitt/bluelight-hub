import { DomainEvent } from '@domain/common/domain-event';
import type { Permission } from '../value-objects/permission';
import type { UserId } from '../value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn einem User eine Permission gewährt wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Granted", nicht "Grant").
 *
 * Dieses Event wird nach erfolgreicher Permission-Zuweisung ausgelöst, um andere
 * Module (z.B. Permission Cache Invalidation, Audit Log, Notifications)
 * zu benachrichtigen, ohne direkte Abhängigkeiten zu schaffen.
 *
 * Warum grantedBy im Event?
 * - Audit Trail: Wer hat die Permission gewährt?
 * - Security: Verhindert ungeklärte Permission-Änderungen
 * - Compliance: DSGVO/Logging-Anforderungen für Berechtigungsänderungen
 * - Rollback: Bei unauthorisierten Grants kann die vergebende Person ermittelt werden
 *
 * Use Case Beispiele:
 * - ADMIN gewährt USER die Permission "einsatz:create" für spezielle Aufgaben
 * - SUPER_ADMIN gewährt ADMIN die Permission "system:backup" temporär
 * - Granulare Berechtigungsvergabe über Standard-Rollen hinaus
 *
 * @example
 * ```typescript
 * const userId = UserId.create().value!;
 * const permission = Permission.CREATE_EINSATZ();
 * const grantedBy = UserId.create().value!; // Admin der die Permission gewährt
 *
 * const event = new PermissionGrantedEvent(userId, permission, grantedBy);
 * console.log(event.eventId); // "X1Y2Z3..." (auto-generated)
 * console.log(event.occurredAt); // 2024-11-17T10:30:00Z (auto-generated)
 * console.log(event.aggregateId); // userId.toString()
 * console.log(PermissionGrantedEvent.eventName()); // "user.permission_granted"
 * ```
 */
export class PermissionGrantedEvent extends DomainEvent {
  /**
   * Constructor für PermissionGrantedEvent mit permission und grantedBy.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param userId - Type-Safe ID des Users dem die Permission gewährt wurde (Aggregate Root ID)
   * @param permission - Permission Value Object das gewährt wurde (z.B. "einsatz:create")
   * @param grantedBy - UserId des Users der die Permission gewährt hat (Audit Trail)
   * @param aggregateId - Optional: ID der User Aggregate Root (für Event Store Context)
   */
  constructor(
    public readonly userId: UserId,
    public readonly permission: Permission,
    public readonly grantedBy: UserId,
    aggregateId?: string,
  ) {
    super(aggregateId ?? userId.toString());
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated mit underscore für multi-word (z.B. 'user.permission_granted').
   *
   * Warum "permission_granted" statt "permission.granted"?
   * - Convention: Dot-separator für Event-Hierarchie (user.*), underscore für multi-word
   * - Event Bus Routing: "user.*" matcht alle User-Events, inkl. permission_granted
   * - Konsistenz: Gleiche Naming wie "user.role_changed"
   *
   * @returns Eindeutiger Event Name im Format "user.permission_granted"
   */
  static eventName(): string {
    return EVENT_NAMES.USER.PERMISSION_GRANTED;
  }
}
