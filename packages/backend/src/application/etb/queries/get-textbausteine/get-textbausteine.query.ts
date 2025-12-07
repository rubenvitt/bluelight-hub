import type { EtbKategorieValue } from '@domain/value-objects/etb-kategorie';

/**
 * Query zum Abrufen aller Textbausteine.
 *
 * Textbausteine sind vordefinierte Text-Templates fuer die schnelle
 * Erstellung von ETB-Eintraegen. Sie sind Stammdaten und werden
 * unabhaengig vom ETB-Aggregate verwaltet.
 *
 * **Warum separater Query statt Repository-Erweiterung:**
 * - Textbausteine sind KEINE Teil des ETB-Aggregates
 * - Sie sind Referenzdaten/Stammdaten (Read-Heavy, Write-Rarely)
 * - Keine Aggregate-Grenzen zu respektieren
 *
 * **Filter-Optionen:**
 * - kategorie: Nur Textbausteine einer bestimmten Kategorie
 * - onlyActive: Nur aktive Textbausteine (Standard: true)
 */
export class GetTextbausteineQuery {
  /**
   * Erstellt eine Query zum Abrufen von Textbausteinen.
   *
   * @param kategorie - Optional: Filtert nach Kategorie (z.B. ALARMIERUNG, LAGE)
   * @param onlyActive - Nur aktive Textbausteine laden (Standard: true)
   */
  constructor(
    public readonly kategorie?: EtbKategorieValue,
    public readonly onlyActive: boolean = true,
  ) {}
}
