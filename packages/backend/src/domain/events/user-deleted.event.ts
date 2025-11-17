import { DomainEvent } from '@domain/common/domain-event';
import type { UserId } from '../value-objects/user-id';

/**
 * Domain Event das auftritt wenn ein User gelöscht wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Deleted", nicht "Delete").
 *
 * Dieses Event wird nach erfolgreicher User-Löschung ausgelöst, um andere
 * Module (z.B. Audit Log, Session Termination, Data Cleanup, Cascade Deletes)
 * zu benachrichtigen, ohne direkte Abhängigkeiten zu schaffen.
 *
 * Warum deletedBy im Event?
 * - Audit Trail: Wer hat den User gelöscht?
 * - Security: Verhindert ungeklärte User-Löschungen
 * - Compliance: DSGVO/Logging-Anforderungen für Account-Löschungen
 * - Rollback: Bei fehlerhaften Löschungen kann die löschende Person ermittelt werden
 *
 * Use Case Beispiele:
 * - ADMIN löscht inaktiven USER Account
 * - SUPER_ADMIN löscht ADMIN nach Organisations-Austritt
 * - USER löscht eigenen Account (Self-Service Delete)
 *
 * Security Note:
 * Dieses Event enthält KEINE sensitiven Daten (Passwort-Hash, Personal Data).
 * Nur die User ID und deletedBy für Audit-Zwecke.
 *
 * Wichtige Event Handler Actions:
 * - Session Termination: Alle Sessions des gelöschten Users beenden
 * - Data Cleanup: Anonymisierung oder Cascade Delete von zugehörigen Daten
 * - Audit Log: Permanentes Log der Löschung (auch nach User-Löschung!)
 * - Notifications: Benachrichtigung an Admins über Account-Löschung
 *
 * @example
 * ```typescript
 * const userId = UserId.create().value!;
 * const deletedBy = UserId.create().value!; // Admin der den User löscht
 *
 * const event = new UserDeletedEvent(userId, deletedBy);
 * console.log(event.eventId); // "X1Y2Z3..." (auto-generated)
 * console.log(event.occurredAt); // 2024-11-17T10:30:00Z (auto-generated)
 * console.log(event.aggregateId); // userId.toString()
 * console.log(UserDeletedEvent.eventName()); // "user.deleted"
 * ```
 */
export class UserDeletedEvent extends DomainEvent {
  /**
   * Constructor für UserDeletedEvent mit deletedBy.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param userId - Type-Safe ID des gelöschten Users (Aggregate Root ID)
   * @param deletedBy - UserId des Users der die Löschung durchgeführt hat (Audit Trail)
   * @param aggregateId - Optional: ID der User Aggregate Root (für Event Store Context)
   */
  constructor(
    public readonly userId: UserId,
    public readonly deletedBy: UserId,
    aggregateId?: string,
  ) {
    super(aggregateId ?? userId.toString());
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated (z.B. 'user.deleted').
   *
   * Warum "user.deleted" statt "user.removed"?
   * - Convention: CRUD-basierte Event-Namen (Created, Updated, Deleted)
   * - Klarheit: "Deleted" ist eindeutiger als "Removed" (Soft Delete vs Hard Delete?)
   * - Konsistenz: Matcht "user.created" Event Naming
   *
   * @returns Eindeutiger Event Name im Format "user.deleted"
   */
  static eventName(): string {
    return 'user.deleted';
  }
}
