// TODO (Epic 6): Migrate to Domain EinsatzStatus enum - currently uses Prisma enum for backward compatibility
// biome-ignore lint/style/noRestrictedImports: Legacy dependency - tracked for migration in Epic 6
import type { EinsatzStatus } from '@prisma/client';

/**
 * Query Parameter Interface für paginierte Einsatz-Abfrage.
 *
 * Diese Interface definiert alle optionalen Filter- und Sortier-Parameter
 * die beim Abrufen einer paginierten Einsatz-Liste unterstützt werden.
 *
 * **Supported Features:**
 * - Status-Filter: Filtere nach spezifischem Status (ANGELEGT, IN_BEARBEITUNG, etc.)
 * - Volltextsuche: Durchsuche Alarmstichwort und ID
 * - Archiv-Filter: Inkludiere oder exkludiere archivierte Einsätze
 * - Vollständigkeits-Info: Optionale Berechnung der Datenqualität
 * - Pagination: Seitennummer und Anzahl pro Seite
 * - Sortierung: Flexibles orderBy mit Richtung (ASC/DESC)
 */
export interface GetAllEinsaetzeQueryParams {
  /**
   * Filter nach Einsatz-Status.
   *
   * **Warum optional:**
   * - Wenn undefined: Zeige alle Status (außer ARCHIVIERT wenn includeArchived=false)
   * - Wenn gesetzt: Filtere nur diesen einen Status
   * - Ermöglicht Status-spezifische Dashboards (z.B. nur IN_BEARBEITUNG)
   *
   * @example 'IN_BEARBEITUNG'
   */
  status?: EinsatzStatus;

  /**
   * Volltext-Suchbegriff für Alarmstichwort und ID.
   *
   * **Search Strategy:**
   * - Case-Insensitive LIKE Query
   * - Durchsucht: alarmstichwort, id (und in Zukunft generierte name)
   * - Leer/Whitespace wird ignoriert
   *
   * @example 'Wohnungsbrand'
   */
  search?: string;

  /**
   * Archivierte Einsätze in Ergebnis inkludieren.
   *
   * **No-Delete Policy Context:**
   * - false (default): Nur aktive Einsätze (operativ relevant)
   * - true: Auch archivierte Einsätze (10-Jahre Aufbewahrung)
   * - DRK-Compliance: Archivierte Einsätze legal relevant aber UI-versteckt
   *
   * @default false
   */
  includeArchived?: boolean;

  /**
   * Vollständigkeits-Informationen berechnen und inkludieren.
   *
   * **Performance Trade-off:**
   * - true: Berechne Score + Missing Fields für jeden Einsatz (rechenintensiv)
   * - false: Schnellere Response ohne Completeness Metadata
   * - Use Case: Dashboard braucht Completeness, einfache Listen nicht
   *
   * @default false
   */
  includeCompleteness?: boolean;

  /**
   * Seitennummer für Pagination (1-basiert).
   *
   * **Pagination Logic:**
   * - page=1: Erste Seite (Items 1-limit)
   * - page=2: Zweite Seite (Items (limit+1)-(2*limit))
   * - Wenn undefined: Default = 1
   *
   * @minimum 1
   * @default 1
   */
  page?: number;

  /**
   * Anzahl Einträge pro Seite.
   *
   * **Performance Constraints:**
   * - Minimum: 1 (mindestens ein Item)
   * - Maximum: 100 (verhindert übermäßige DB-Last)
   * - Wenn undefined: Default = 10
   *
   * @minimum 1
   * @maximum 100
   * @default 10
   */
  limit?: number;

  /**
   * Sortier-Feld für Ergebnisse.
   *
   * **Supported Fields:**
   * - createdAt: Erstellungsdatum (häufigster Use Case)
   * - updatedAt: Letzte Änderung
   * - alarmstichwort: Alphabetisch nach Stichwort
   * - status: Sortiere nach Status-Enum Reihenfolge
   *
   * @default 'createdAt'
   */
  orderBy?: string;

  /**
   * Sortier-Richtung (aufsteigend oder absteigend).
   *
   * **Direction Semantik:**
   * - 'desc': Neueste/Höchste zuerst (default für Zeitfelder)
   * - 'asc': Älteste/Niedrigste zuerst
   *
   * @default 'desc'
   */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Query für paginierte Einsatz-Liste mit optionalen Filtern.
 *
 * Diese Query repräsentiert eine Read-Only Operation (CQRS Query Side)
 * die eine paginierte Liste von Einsätzen mit optionalen Filter-,
 * Such- und Sortierkriterien zurückgibt.
 *
 * **CQRS Pattern:**
 * - Query Side: Keine Domain-Änderungen, keine Events
 * - Read-Only: Direkte Repository-Abfrage
 * - DTO-Transformation: Domain → API Response DTOs
 *
 * **Use Cases:**
 * - Dashboard: Aktive Einsätze mit Pagination
 * - Archiv-View: Archivierte Einsätze durchsuchen
 * - Admin-Panel: Filtern nach Status für Statistiken
 * - Suchfunktion: Volltextsuche über Alarmstichwort
 *
 * **Warum Constructor Pattern:**
 * - Immutable Query Object (keine Setters)
 * - Type-Safe Parameter Übergabe
 * - Explizite Dokumentation der Query-Struktur
 * - NestJS CQRS Bus erwartet Class-basierte Queries
 *
 * @example
 * ```typescript
 * // Aktive Einsätze, Seite 1, 20 pro Seite
 * const query = new GetAllEinsaetzeQuery({
 *   includeArchived: false,
 *   page: 1,
 *   limit: 20,
 *   orderBy: 'createdAt',
 *   orderDirection: 'desc'
 * });
 *
 * // Mit Status-Filter und Suche
 * const query = new GetAllEinsaetzeQuery({
 *   status: 'IN_BEARBEITUNG',
 *   search: 'Brand',
 *   includeCompleteness: true
 * });
 * ```
 */
export class GetAllEinsaetzeQuery {
  /**
   * Erstellt eine neue GetAllEinsaetzeQuery mit optionalen Parametern.
   *
   * @param params - Query-Parameter (alle optional, siehe GetAllEinsaetzeQueryParams)
   */
  constructor(public readonly params: GetAllEinsaetzeQueryParams = {}) {}
}
