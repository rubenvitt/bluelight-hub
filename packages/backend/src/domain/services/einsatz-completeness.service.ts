import type { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import { Result } from '@domain/common/result';

/**
 * Service für die Validierung der Vollständigkeit eines Einsatzes vor Abschluss.
 *
 * **Business Rules:**
 * - Ein Einsatz kann nur abgeschlossen werden wenn:
 *   1. `alarmstichwort` ist gesetzt (Pflichteingabe)
 *   2. `einsatzort` ist gesetzt (optional, konfigurierbar)
 *   3. Status ist IN_BEARBEITUNG (nicht ANGELEGT, ABGESCHLOSSEN, oder ARCHIVIERT)
 *
 * **Warum dieser Service?**
 * Die Vollständigkeitsprüfung ist eine zentrale Domain-Logik, die:
 * - Über mehrere Use Cases hinweg konsistent sein muss (UI, API, Batch-Jobs)
 * - Frühzeitig ungültige Zustandsübergänge verhindert (Fail-Fast-Prinzip)
 * - Framework-unabhängig bleiben soll für Wiederverwendbarkeit
 *
 * **WICHTIG:** Dieser Service prüft NUR die Vollständigkeit, NICHT die Berechtigung.
 * Die Application-Schicht muss zusätzlich prüfen, ob der User den Einsatz abschließen darf.
 *
 * @example
 * ```typescript
 * const service = new EinsatzCompletenessService();
 * const result = service.canBeCompleted(einsatz);
 *
 * if (result.isSuccess) {
 *   // Einsatz kann abgeschlossen werden
 *   einsatz.complete(userId);
 * } else {
 *   // Fehlende Felder anzeigen
 *   const missing = service.getMissingRequirements(einsatz);
 *   console.error(`Fehlende Felder: ${missing.join(', ')}`);
 * }
 * ```
 */
export class EinsatzCompletenessService {
  /**
   * Prüft, ob ein Einsatz alle Voraussetzungen für den Abschluss erfüllt.
   *
   * **Validierungslogik:**
   * - Alarmstichwort muss gesetzt sein (Pflichteingabe)
   * - Einsatzort kann optional erforderlich sein (Parameter: requireOrt)
   * - Status muss IN_BEARBEITUNG sein (Zustandsübergang-Validierung)
   *
   * **Warum Result<void>?**
   * - Type-safe Error Handling ohne Exceptions (functional programming)
   * - Ermöglicht explizite Fehlerbehandlung im Caller
   * - Erfüllt NFR-4: Keine Exceptions in Domain Layer
   *
   * @param einsatz - Der zu prüfende Einsatz
   * @param requireOrt - Optional: Ob Einsatzort Pflicht ist (default: true)
   * @returns Result.ok() wenn vollständig, Result.fail(reason) wenn unvollständig
   *
   * @example
   * ```typescript
   * const result = service.canBeCompleted(einsatz, true); // Ort erforderlich
   * if (result.isFailure) {
   *   console.error(result.error); // "Alarmstichwort fehlt"
   * }
   * ```
   */
  public canBeCompleted(einsatz: Einsatz, requireOrt = true): Result<void> {
    // Business Rule: Alarmstichwort ist Pflicht
    if (!this.isAlarmstichwortValid(einsatz)) {
      return Result.fail<void>('Alarmstichwort fehlt');
    }

    // Business Rule: Einsatzort ist Pflicht (wenn requireOrt = true)
    if (!this.isEinsatzortValid(einsatz, requireOrt)) {
      return Result.fail<void>('Einsatzort fehlt');
    }

    // Business Rule: Status muss IN_BEARBEITUNG sein
    if (!this.isStatusValid(einsatz)) {
      return Result.fail<void>('Status muss IN_BEARBEITUNG sein');
    }

    // Alle Validierungen erfolgreich
    return Result.ok<void>(undefined);
  }

  /**
   * Gibt eine Liste aller fehlenden Pflichtfelder zurück.
   *
   * **Verwendungszweck:**
   * - UI zeigt konkrete Fehlermeldungen ("Bitte füllen Sie: Alarmstichwort, Einsatzort")
   * - Logging/Monitoring für Datenqualitäts-Metriken
   * - Automatische Validierung in Workflows
   *
   * **Warum separate Methode?**
   * - `canBeCompleted()` gibt nur ein Boolean-Result zurück
   * - Diese Methode liefert Details für User-Feedback
   * - Trennung von Validation (canBeCompleted) und Reporting (getMissingRequirements)
   *
   * @param einsatz - Der zu prüfende Einsatz
   * @param requireOrt - Optional: Ob Einsatzort Pflicht ist (default: true)
   * @returns Array of missing field names (e.g., ["alarmstichwort", "einsatzort"])
   *
   * @example
   * ```typescript
   * const missing = service.getMissingRequirements(einsatz);
   * if (missing.length > 0) {
   *   alert(`Fehlende Felder: ${missing.join(', ')}`);
   * }
   * ```
   */
  public getMissingRequirements(einsatz: Einsatz, requireOrt = true): string[] {
    const missing: string[] = [];

    // Check Alarmstichwort
    if (!this.isAlarmstichwortValid(einsatz)) {
      missing.push('alarmstichwort');
    }

    // Check Einsatzort (wenn requireOrt = true)
    if (!this.isEinsatzortValid(einsatz, requireOrt)) {
      missing.push('einsatzort');
    }

    // Check Status
    if (!this.isStatusValid(einsatz)) {
      missing.push('status (muss IN_BEARBEITUNG sein)');
    }

    return missing;
  }

  /**
   * Prüft, ob das Alarmstichwort gesetzt und nicht leer ist.
   *
   * **Warum diese Validierung?**
   * - Das Alarmstichwort ist eine Pflichteingabe für die Einsatz-Dokumentation
   * - Verhindert unvollständige Datensätze, die später zu Problemen führen
   * - Extrahiert zentrale Validierungslogik zur Wiederverwendung (DRY-Prinzip)
   *
   * @param einsatz - Der zu prüfende Einsatz
   * @returns true wenn alarmstichwort gesetzt und nicht leer (nach trim), sonst false
   */
  private isAlarmstichwortValid(einsatz: Einsatz): boolean {
    return !!(einsatz.alarmstichwort && einsatz.alarmstichwort.trim().length > 0);
  }

  /**
   * Prüft, ob der Einsatzort gesetzt ist (wenn erforderlich).
   *
   * **Warum diese Validierung?**
   * - Der Einsatzort ist je nach Konfiguration optional oder Pflicht
   * - Ermöglicht flexible Business Rules je nach Organisationsanforderungen
   * - Extrahiert zentrale Validierungslogik zur Wiederverwendung (DRY-Prinzip)
   *
   * @param einsatz - Der zu prüfende Einsatz
   * @param requireEinsatzort - Ob der Einsatzort Pflicht ist
   * @returns true wenn einsatzort gesetzt ist ODER nicht erforderlich ist, sonst false
   */
  private isEinsatzortValid(einsatz: Einsatz, requireEinsatzort: boolean): boolean {
    return !requireEinsatzort || !!einsatz.einsatzort;
  }

  /**
   * Prüft, ob der Status IN_BEARBEITUNG ist.
   *
   * **Warum diese Validierung?**
   * - Nur Einsätze in Bearbeitung können abgeschlossen werden (Zustandsübergang-Validierung)
   * - Verhindert ungültige Statuswechsel (z.B. ANGELEGT → ABGESCHLOSSEN ohne Bearbeitung)
   * - Extrahiert zentrale Validierungslogik zur Wiederverwendung (DRY-Prinzip)
   *
   * @param einsatz - Der zu prüfende Einsatz
   * @returns true wenn status IN_BEARBEITUNG ist, sonst false
   */
  private isStatusValid(einsatz: Einsatz): boolean {
    return einsatz.status.equals(EinsatzStatus.IN_BEARBEITUNG());
  }
}
