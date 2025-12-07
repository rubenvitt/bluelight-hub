import { DomainEvent } from '@domain/common/domain-event';
import type { UserId } from '../value-objects/user-id';
import type { UserRole } from '../value-objects/user-role';
import type { Username } from '../value-objects/username';
import { EVENT_NAMES } from './event-names';

/**
 * Domain Event das auftritt wenn ein neuer User erstellt wurde.
 * Repräsentiert historische Tatsache (Past Tense: "Created", nicht "Create").
 *
 * Dieses Event wird nach erfolgreicher User-Erstellung ausgelöst, um andere
 * Module (z.B. Notifications, Audit Log, Welcome Email) zu benachrichtigen,
 * ohne direkte Abhängigkeiten zwischen Modulen zu schaffen.
 *
 * Warum alle User-Daten im Event?
 * - Event-Carried State Transfer Pattern: Event Handler benötigen KEINE DB-Query
 * - Alle relevanten Informationen (username, role) sind im Event enthalten
 * - Ermöglicht Event Replay ohne Zugriff auf aktuellen DB State
 *
 * Security Note:
 * Dieses Event enthält KEINE sensitiven Daten (Passwort-Hash, etc.).
 * Nur öffentliche User-Informationen für Notification/Audit-Zwecke.
 *
 * @example
 * ```typescript
 * const userId = UserId.create().value!;
 * const username = Username.create('ruben_admin').value!;
 * const role = UserRole.ADMIN();
 *
 * const event = new UserCreatedEvent(userId, username, role);
 * console.log(event.eventId); // "X1Y2Z3..." (auto-generated)
 * console.log(event.occurredAt); // 2024-11-17T10:30:00Z (auto-generated)
 * console.log(event.aggregateId); // userId.toString() (User Aggregate Root ID)
 * console.log(UserCreatedEvent.eventName()); // "user.created"
 * ```
 */
export class UserCreatedEvent extends DomainEvent {
  /**
   * Constructor für UserCreatedEvent mit allen relevanten User-Daten.
   * Base Class auto-generiert eventId und occurredAt.
   *
   * @param userId - Type-Safe ID des erstellten Users (Aggregate Root ID)
   * @param username - Username Value Object (normalisiert zu lowercase)
   * @param role - UserRole Value Object (initiale Role des Users)
   * @param aggregateId - Optional: ID der User Aggregate Root (für Event Store Context)
   */
  constructor(
    public readonly userId: UserId,
    public readonly username: Username,
    public readonly role: UserRole,
    aggregateId?: string,
  ) {
    super(aggregateId ?? userId.toString());
  }

  /**
   * Static Event Name für type-safe Event Routing.
   * Format: Lowercase, dot-separated (z.B. 'user.created').
   *
   * Warum lowercase dot-separated?
   * - Convention: Konsistente Event-Namen für Event Bus Routing
   * - Case-Sensitivity: Verhindert Routing-Fehler durch Groß-/Kleinschreibung
   * - Hierarchisch: Ermöglicht Topic-basiertes Routing (z.B. "user.*" für alle User Events)
   *
   * @returns Eindeutiger Event Name im Format "user.created"
   */
  static eventName(): string {
    return EVENT_NAMES.USER.CREATED;
  }
}
