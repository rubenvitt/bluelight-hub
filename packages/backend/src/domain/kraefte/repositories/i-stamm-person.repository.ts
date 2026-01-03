import type { Result } from '@domain/common/result';
import type { StammPerson } from '../aggregates/stamm-person.aggregate';
import type { StammPersonId } from '../value-objects/stamm-person-id';

/**
 * Opaque Transaction Context für Infrastructure Layer.
 * Ermöglicht atomare Operationen ohne Framework-Abhängigkeit im Domain Layer.
 */
export type TransactionContext = unknown;

/**
 * Repository Port für StammPerson Aggregate (Hexagonal Architecture).
 *
 * Definiert die Schnittstelle für StammPerson-Persistierung ohne
 * Abhängigkeit von konkreter Implementierung (Prisma, etc.).
 *
 * **Implementiert von:** PrismaStammPersonRepository in Infrastructure Layer.
 *
 * **Result Pattern:** Alle Methoden geben Result<T> zurück für explizite
 * Fehlerbehandlung ohne Exceptions.
 *
 * **Transaction Support:** Optionaler `tx` Parameter für atomare Operationen
 * mit Outbox Events.
 *
 * **Filter Options:**
 * - includeArchived: Steuert ob archivierte Personen inkludiert werden (default: false)
 */
export interface IStammPersonRepository {
  /**
   * Speichert eine StammPerson Aggregate (Create oder Update).
   *
   * Bei Update werden auch die M:N Qualifikationen synchronisiert:
   * - Alte Verknüpfungen werden gelöscht
   * - Neue Verknüpfungen werden erstellt
   *
   * @param aggregate - Die zu speichernde StammPerson Aggregate
   * @param tx - Optionaler Transaction Context für atomare Persistierung
   * @returns Result<void> - Success oder Failure mit Fehlermeldung
   */
  save(aggregate: StammPerson, tx?: TransactionContext): Promise<Result<void>>;

  /**
   * Findet eine Stamm-Person nach ID.
   *
   * Lädt auch alle zugehörigen Qualifikation-IDs (M:N Join).
   *
   * @param id - Die StammPersonId
   * @param tx - Optionaler Transaction Context
   * @returns Result<StammPerson | null> - null wenn nicht gefunden (kein Error)
   */
  findById(id: StammPersonId, tx?: TransactionContext): Promise<Result<StammPerson | null>>;

  /**
   * Findet eine Stamm-Person nach Personalnummer (für Uniqueness-Check).
   *
   * @param personalnummer - Die eindeutige Personalnummer
   * @param tx - Optionaler Transaction Context
   * @returns Result<StammPerson | null> - null wenn nicht gefunden
   */
  findByPersonalnummer(personalnummer: string, tx?: TransactionContext): Promise<Result<StammPerson | null>>;

  /**
   * Listet alle Stamm-Personen mit optionalem Filter.
   *
   * @param filter - Optional filter options
   * @param filter.includeArchived - Ob archivierte Personen inkludiert werden sollen (default: false)
   * @param tx - Optionaler Transaction Context
   * @returns Result<StammPerson[]> - Liste aller Stamm-Personen
   */
  findAll(filter?: { includeArchived?: boolean }, tx?: TransactionContext): Promise<Result<StammPerson[]>>;

  /**
   * Prüft ob eine Stamm-Person mit gegebener Personalnummer existiert.
   *
   * @param personalnummer - Die zu prüfende Personalnummer
   * @param tx - Optionaler Transaction Context
   * @returns Result<boolean> - true wenn vorhanden
   */
  exists(personalnummer: string, tx?: TransactionContext): Promise<Result<boolean>>;

  /**
   * Sucht Stamm-Personen nach Nachname (für Autocomplete).
   *
   * Verwendet LIKE-Search auf nachname (Case-Insensitive).
   * Limitiert Ergebnisse auf maximal `limit` Treffer.
   * Schließt archivierte Personen aus (archivedAt IS NULL).
   *
   * **Use Case Story 4-1:**
   * - Autocomplete-Suche beim Person-Hinzufügen
   * - User tippt Nachname → Backend liefert Vorschläge
   * - Sortierung: alphabetisch nach Nachname, Vorname
   *
   * @param searchTerm - Suchbegriff für Nachname (min. 1 Zeichen)
   * @param limit - Maximale Anzahl Ergebnisse (default: 10)
   * @param tx - Optionaler Transaction Context
   * @returns Result<StammPerson[]> - Gefundene Personen (max. limit Ergebnisse)
   */
  search(searchTerm: string, limit?: number, tx?: TransactionContext): Promise<Result<StammPerson[]>>;

  // ============ Story 7.2: Externe Integration Methoden ============

  /**
   * Findet eine Stamm-Person nach externer ID und Quelle.
   *
   * Verwendet den Unique-Index [externalSource, externalId] für effiziente Suche.
   *
   * **Use Case Story 7-2:**
   * - Import aus HiOrg-Server: Prüfung ob Person bereits existiert
   * - Upsert-Logik: Update wenn vorhanden, Insert wenn neu
   *
   * @param externalSource - Externe Quelle (z.B. "HIORG_SERVER")
   * @param externalId - Externe ID (z.B. HiOrg username)
   * @param tx - Optionaler Transaction Context
   * @returns Result<StammPerson | null> - null wenn nicht gefunden
   */
  findByExternalId(
    externalSource: string,
    externalId: string,
    tx?: TransactionContext,
  ): Promise<Result<StammPerson | null>>;
}
