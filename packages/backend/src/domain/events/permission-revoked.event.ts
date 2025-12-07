import { DomainEvent } from '@domain/common/domain-event';
import type { Permission } from '../value-objects/permission';
import type { UserId } from '../value-objects/user-id';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn einem User eine Permission entzogen wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Revoked", nicht "Revoke").
 *
 * Dieses Event wird nach erfolgreicher Permission-Entziehung ausgelöst, um andere
 * Module (z.B. Permission Cache Invalidation, Audit Log, Session Termination)
 * zu benachrichtigen, ohne direkte Abhängigkeiten zu schaffen.
 *
 * Warum revokedBy im Event?
 * - Audit Trail: Wer hat die Permission entzogen?
 * - Security: Verhindert ungeklärte Permission-Entziehungen
 * - Compliance: DSGVO/Logging-Anforderungen für Berechtigungsänderungen
 * - Rollback: Bei fehlerhaften Revokes kann die entziehende Person ermittelt werden
 *
 * Use Case Beispiele:
 * - ADMIN entzieht USER die Permission "einsatz:delete" nach Missbrauch
 * - SUPER_ADMIN entzieht ADMIN die Permission "system:backup" nach Projekt-Ende
 * - Automatische Revoke nach Ablauf temporärer Berechtigungen
 *
 * Wichtig: Permission Cache Invalidation!
 * Event Handler MÜSSEN Permission Caches invalidieren, um zu verhindern, dass
 * der User trotz Revoke noch die Permission nutzen kann (Security-Critical!).
 *
 * @example
 * ```typescript
 * const userId = UserId.create().value!;
 * const permission = Permission.DELETE_EINSATZ();
 * const revokedBy = UserId.create().value!; // Admin der die Permission entzieht
 *
 * const event = new PermissionRevokedEvent(userId, permission, revokedBy);
 * console.log(event.eventId); // "X1Y2Z3..." (auto-generated)
 * console.log(event.occurredAt); // 2024-11-17T10:30:00Z (auto-generated)
 * console.log(event.aggregateId); // userId.toString()
 * console.log(PermissionRevokedEvent.eventName()); // "user.permission_revoked"
 * ```
 */
export class PermissionRevokedEvent extends DomainEvent {
  /**
   * Constructor für PermissionRevokedEvent mit permission und revokedBy.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param userId - Type-Safe ID des Users dem die Permission entzogen wurde (Aggregate Root ID)
   * @param permission - Permission Value Object das entzogen wurde (z.B. "einsatz:delete")
   * @param revokedBy - UserId des Users der die Permission entzogen hat (Audit Trail)
   * @param aggregateId - Optional: ID der User Aggregate Root (für Event Store Context)
   */
  constructor(
    public readonly userId: UserId,
    public readonly permission: Permission,
    public readonly revokedBy: UserId,
    aggregateId?: string,
  ) {
    super(aggregateId ?? userId.toString());
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated mit underscore für multi-word (z.B. 'user.permission_revoked').
   *
   * Warum "permission_revoked" statt "permission.revoked"?
   * - Convention: Dot-separator für Event-Hierarchie (user.*), underscore für multi-word
   * - Event Bus Routing: "user.*" matcht alle User-Events, inkl. permission_revoked
   * - Konsistenz: Gleiche Naming wie "user.permission_granted" und "user.role_changed"
   *
   * @returns Eindeutiger Event Name im Format "user.permission_revoked"
   */
  static eventName(): string {
    return EVENT_NAMES.USER.PERMISSION_REVOKED;
  }
}
