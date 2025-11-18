import type { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';

/**
 * Domain Policy für die 10-Jahres-Archivierung von Einsätzen (DRK-Standard).
 *
 * **Business Rules:**
 * - Ein Einsatz kann archiviert werden wenn:
 *   1. Status ist ABGESCHLOSSEN (bereits abgeschlossen, nicht mehr aktiv)
 *   2. `abgeschlossenAt` ist mindestens 10 Jahre alt (DRK-Aufbewahrungspflicht)
 * - Nach Archivierung (Status → ARCHIVIERT) ist Einsatz immutable (NO-DELETE Policy)
 *
 * **Warum 10-Jahres-Archivierung?**
 * - DRK Compliance: Einsatzdaten müssen 10 Jahre aufbewahrt werden
 * - DSGVO Art. 17: "Recht auf Vergessenwerden" gilt erst nach Archivierungsfrist
 * - Statistische Auswertung: Langfristige Einsatztrends analysieren
 * - Rechtssicherheit: Einsatzdokumentation für Versicherungsfälle
 *
 * **Warum Domain Policy statt Aggregate-Methode?**
 * - Archivierung ist eine zeitbasierte Regel, nicht eine Zustandsänderung
 * - Application Layer entscheidet WANN archiviert wird (Batch-Job, User-Trigger)
 * - Domain Layer definiert nur REGELN, nicht den Zeitpunkt
 * - Separation of Concerns: Timing (Application) ≠ Rules (Domain)
 *
 * **Workflow in Application Layer:**
 * ```typescript
 * // Batch-Job: Archiviere alle Einsätze älter als 10 Jahre
 * const allAbgeschlossen = await einsatzRepo.findByStatus(EinsatzStatus.ABGESCHLOSSEN());
 * const archivalPolicy = new EinsatzArchivalPolicy();
 * const now = new Date();
 *
 * for (const einsatz of allAbgeschlossen) {
 *   if (archivalPolicy.canBeArchived(einsatz, now)) {
 *     einsatz.archive(userId); // Transitions to ARCHIVIERT
 *     await einsatzRepo.save(einsatz);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * const policy = new EinsatzArchivalPolicy();
 * const now = new Date('2024-11-17');
 *
 * const canArchive = policy.canBeArchived(einsatz, now);
 * if (canArchive) {
 *   const archivalDate = policy.getArchivalDate(einsatz);
 *   console.log(`Einsatz kann archiviert werden (Frist seit ${archivalDate.toLocaleDateString('de-DE')} abgelaufen)`);
 * }
 * ```
 */
export class EinsatzArchivalPolicy {
  /**
   * DRK Standard: Aufbewahrungsfrist für Einsatzdaten in Jahren.
   *
   * **Warum Konstante?**
   * - Zentrale Definition verhindert Magic Numbers
   * - Einfache Anpassung bei Änderung der Richtlinie
   * - Dokumentiert den Ursprung der Zahl (DRK Standard)
   */
  private static readonly RETENTION_YEARS = 10;

  /**
   * Prüft, ob ein Einsatz archiviert werden darf (10-Jahres-Frist abgelaufen).
   *
   * **Validierungslogik:**
   * - Status muss ABGESCHLOSSEN sein (nicht ANGELEGT, IN_BEARBEITUNG, oder bereits ARCHIVIERT)
   * - `abgeschlossenAt` muss mindestens 10 Jahre vor currentDate liegen
   * - Präzise Datumsberechnung (berücksichtigt Schaltjahre)
   *
   * **Warum currentDate als Parameter?**
   * - Deterministische Tests (mockbare Zeit)
   * - Batch-Jobs können festes Datum übergeben (z.B. Monatsende)
   * - NO `new Date()` in Domain Layer (Side Effects vermeiden)
   *
   * **Fehlerfall:**
   * - Einsatz ohne `abgeschlossenAt` → gibt false zurück (NICHT archivierbar)
   * - Einsatz bereits ARCHIVIERT → gibt false zurück (bereits archiviert)
   *
   * @param einsatz - Der zu prüfende Einsatz
   * @param currentDate - Das aktuelle Datum (für deterministische Tests)
   * @returns true wenn archivierbar, false wenn nicht
   *
   * @example
   * ```typescript
   * const policy = new EinsatzArchivalPolicy();
   * const now = new Date('2024-11-17');
   * const einsatz = createEinsatzAbgeschlossenAt(new Date('2014-11-17')); // 10 Jahre alt
   *
   * const canArchive = policy.canBeArchived(einsatz, now);
   * console.log(canArchive); // true
   * ```
   */
  public canBeArchived(einsatz: Einsatz, currentDate: Date): boolean {
    // Check status: must be ABGESCHLOSSEN (not ANGELEGT, IN_BEARBEITUNG, or already ARCHIVIERT)
    if (!einsatz.status.equals(EinsatzStatus.ABGESCHLOSSEN())) {
      return false;
    }

    // Check abgeschlossenAt exists
    if (!einsatz.abgeschlossenAt) {
      return false;
    }

    // Calculate archival date (abgeschlossenAt + 10 years)
    const archivalDate = this.getArchivalDate(einsatz);

    // Compare: currentDate must be >= archivalDate
    return currentDate >= archivalDate;
  }

  /**
   * Berechnet das Datum, ab dem ein Einsatz archiviert werden darf (10 Jahre nach Abschluss).
   *
   * **Berechnung:**
   * - Nimmt `abgeschlossenAt` als Basis
   * - Addiert genau 10 Jahre (berücksichtigt Schaltjahre automatisch via setFullYear)
   * - Gibt neues Date-Objekt zurück (immutable, kein Side Effect)
   *
   * **Warum setFullYear() statt addYears()?**
   * - JavaScript Date.setFullYear() berücksichtigt Schaltjahre automatisch
   * - Beispiel: 2024-02-29 (Schaltjahr) + 10 Jahre = 2034-03-01 (kein Schaltjahr, rollover zu März)
   * - Kein externes Bibliothek-Dependency (framework-agnostic)
   *
   * **Fehlerfall:**
   * - Einsatz ohne `abgeschlossenAt` → wirft Error (ungültiger Zustand)
   * - Reason: Einsatz kann nur abgeschlossen werden, wenn abgeschlossenAt gesetzt ist
   *
   * @param einsatz - Der Einsatz, für den die Archivierungsfrist berechnet wird
   * @returns Datum, ab dem Einsatz archiviert werden darf (abgeschlossenAt + 10 Jahre)
   * @throws Error wenn Einsatz nicht abgeschlossen ist (abgeschlossenAt fehlt)
   *
   * @example
   * ```typescript
   * const policy = new EinsatzArchivalPolicy();
   * const einsatz = createEinsatzAbgeschlossenAt(new Date('2014-11-17'));
   *
   * const archivalDate = policy.getArchivalDate(einsatz);
   * console.log(archivalDate.toISOString()); // "2024-11-17T..."
   * ```
   */
  public getArchivalDate(einsatz: Einsatz): Date {
    // Check abgeschlossenAt exists
    if (!einsatz.abgeschlossenAt) {
      throw new Error('Einsatz ist nicht abgeschlossen - abgeschlossenAt fehlt');
    }

    // Create new Date (copy to avoid mutation)
    const archivalDate = new Date(einsatz.abgeschlossenAt);

    // Add RETENTION_YEARS (setFullYear handles leap years automatically)
    archivalDate.setFullYear(archivalDate.getFullYear() + EinsatzArchivalPolicy.RETENTION_YEARS);

    return archivalDate;
  }
}
