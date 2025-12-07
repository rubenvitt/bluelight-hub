/**
 * Query für das Abrufen aller User.
 *
 * Diese Query repräsentiert eine Read-Only Operation (CQRS Query Side)
 * die eine Liste aller User ohne Filterung zurückgibt.
 *
 * **CQRS Pattern:**
 * - Query Side: Keine Domain-Änderungen, keine Events
 * - Read-Only: Direkte Repository-Abfrage
 * - DTO-Transformation: Domain → API Response DTOs
 *
 * **Use Cases:**
 * - Admin Dashboard: User Overview
 * - User Management Interface: Alle Benutzer auflisten
 * - Reporting: User-Liste für Statistiken
 *
 * **Warum keine Parameter:**
 * - Simple Query ohne Filter/Pagination
 * - Lädt alle aktiven User (nicht gelöscht, nicht gesperrt)
 * - Pagination wird in späteren Stories ergänzt (MVP-fokussiert)
 *
 * **Warum Constructor Pattern:**
 * - Konsistenz mit anderen Queries (GetAllEinsaetzeQuery, etc.)
 * - NestJS CQRS Bus erwartet Class-basierte Queries
 * - Ermöglicht spätere Erweiterung mit optionalen Parametern
 * - Explizite Dokumentation der Query-Struktur
 *
 * @example
 * ```typescript
 * // Query ausführen
 * const query = new GetAllUsersQuery();
 * const result = await queryBus.execute(query);
 *
 * if (result.isSuccess) {
 *   const users = result.value!;
 *   console.log(`${users.length} Benutzer gefunden`);
 *   users.forEach(user => console.log(user.username));
 * }
 * ```
 */
export class GetAllUsersQuery {}
