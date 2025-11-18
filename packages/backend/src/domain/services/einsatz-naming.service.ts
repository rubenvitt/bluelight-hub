/**
 * Service für die Generierung eindeutiger Einsatznummern nach DRK-Standard.
 *
 * **Business Rules:**
 * - Format: E{JAHR}-{LAUFNUMMER} (Beispiel: E2024-001)
 * - Laufnummer wird jährlich zurückgesetzt (000-999 pro Jahr)
 * - Zero-Padding auf 3 Stellen für einheitliche Sortierung
 *
 * **Warum dieser Service?**
 * Die Einsatznummerngenerierung ist eine zentrale Domain-Logik, die:
 * - Über mehrere Aggregates hinweg konsistent sein muss
 * - In verschiedenen Kontexten wiederverwendet wird (Einsatz-Erstellung, ETB, Berichte)
 * - Framework-unabhängig bleiben soll für Testbarkeit
 *
 * **WICHTIG:** Dieser Service generiert NUR das Format, NICHT die Laufnummer selbst.
 * Die Application-Schicht holt die nächste Sequenznummer vom Repository:
 * `const sequence = await einsatzRepo.getNextSequenceNumber(year)`
 *
 * @example
 * ```typescript
 * const service = new EinsatzNamingService()
 * const nummer = service.generateEinsatzNummer(2024, 1)
 * console.log(nummer) // "E2024-001"
 * ```
 */
export class EinsatzNamingService {
  /**
   * Generiert eine formatierte Einsatznummer nach DRK-Standard.
   *
   * @param year - Das Jahr des Einsatzes (4-stellig, z.B. 2024)
   * @param sequenceNumber - Die Laufnummer innerhalb des Jahres (0-999)
   * @returns Formatierte Einsatznummer (z.B. "E2024-001")
   *
   * @example
   * ```typescript
   * service.generateEinsatzNummer(2024, 1)   // "E2024-001"
   * service.generateEinsatzNummer(2024, 42)  // "E2024-042"
   * service.generateEinsatzNummer(2024, 999) // "E2024-999"
   * ```
   */
  public generateEinsatzNummer(year: number, sequenceNumber: number): string {
    const paddedSequence = String(sequenceNumber).padStart(3, '0');
    return `E${year}-${paddedSequence}`;
  }
}
