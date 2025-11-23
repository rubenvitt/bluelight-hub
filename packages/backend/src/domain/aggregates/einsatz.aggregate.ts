import { createId } from '@paralleldrive/cuid2';
import { AggregateRoot } from '@domain/common/aggregate-root';
import { Result } from '@domain/common/result';
import type { Address } from '@domain/value-objects/address';
import { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EinsatzStatus } from '@domain/value-objects/einsatz-status';
import type { UserId } from '@domain/value-objects/user-id';
import { EinsatzArchivedEvent } from '@domain/events/einsatz-archived.event';
import { EinsatzCompletedEvent } from '@domain/events/einsatz-completed.event';
import { EinsatzCreatedEvent } from '@domain/events/einsatz-created.event';
import { EinsatzStatusChangedEvent } from '@domain/events/einsatz-status-changed.event';

/**
 * Properties für die Einsatz Erstellung.
 * Kapselt alle erforderlichen und optionalen Felder für create() Factory.
 */
interface CreateEinsatzProps {
  alarmstichwort: string;
  createdBy: UserId;
  einsatzort?: Address;
  bemerkung?: string;
}

/**
 * Einsatz Aggregate Root für DRK Emergency Response Management.
 * Repräsentiert die transactionale Grenze für alle Einsatz-bezogenen Operations.
 *
 * Diese Klasse implementiert vollständige DDD Aggregate Patterns:
 * - State Machine für Status-Transitions (ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT)
 * - NO-DELETE Policy für DRK-Compliance (10-Jahres-Aufbewahrungspflicht)
 * - Rich Business Logic mit Invarianten-Schutz
 * - Domain Events für Event Sourcing und Integration
 * - Immutability nach Archivierung (finale Transition)
 *
 * **Business Rules (Invarianten):**
 * 1. Status-Transition nur vorwärts: ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT
 * 2. Rückwärts-Transitions sind verboten (z.B. ABGESCHLOSSEN → IN_BEARBEITUNG)
 * 3. `complete()` setzt `abgeschlossenAt` Timestamp für Audit Trail
 * 4. `archive()` macht Einsatz immutable (keine Änderungen mehr erlaubt)
 * 5. Archivierter Einsatz kann NICHT reaktiviert werden (finale Transition)
 * 6. Einsätze können NIEMALS gelöscht werden (NO-DELETE Policy für DRK-Compliance)
 *
 * **Warum NO-DELETE Policy:**
 * - Gesetzliche Aufbewahrungspflicht: DRK muss Einsätze 10 Jahre archivieren
 * - Forensische Analyse: Gelöschte Einsätze können nicht mehr untersucht werden
 * - Audit Trail: Compliance-Anforderungen verlangen lückenlose Historie
 * - Statistische Auswertungen: Gelöschte Daten verfälschen Langzeit-Statistiken
 *
 * **Event Flow:**
 * - create() → EinsatzCreatedEvent
 * - complete() → EinsatzCompletedEvent + EinsatzStatusChangedEvent
 * - archive() → EinsatzArchivedEvent + EinsatzStatusChangedEvent
 * - updateStatus() → EinsatzStatusChangedEvent
 *
 * @example
 * ```typescript
 * // Einsatz erstellen (Factory Method mit Validation)
 * const createdBy = UserId.create().value!;
 * const einsatzort = Address.create({ strasse: 'Musterstr.', hausnummer: '42', plz: '80331', ort: 'München' }).value!;
 * const result = Einsatz.create({
 *   alarmstichwort: 'Wohnungsbrand',
 *   createdBy,
 *   einsatzort,
 *   bemerkung: 'Dachstuhl brennt'
 * });
 *
 * if (result.isSuccess) {
 *   const einsatz = result.value!;
 *   console.log(einsatz.nummer); // "E2024-A1B2C3" (auto-generated)
 *   console.log(einsatz.status.value); // "ANGELEGT"
 *   console.log(einsatz.getDomainEvents().length); // 1 (EinsatzCreatedEvent)
 *
 *   // Status-Transition zu IN_BEARBEITUNG
 *   const newStatus = EinsatzStatus.IN_BEARBEITUNG();
 *   const updateResult = einsatz.updateStatus(newStatus);
 *   if (updateResult.isSuccess) {
 *     console.log(einsatz.status.value); // "IN_BEARBEITUNG"
 *   }
 *
 *   // Einsatz abschließen
 *   const completeResult = einsatz.complete(createdBy);
 *   if (completeResult.isSuccess) {
 *     console.log(einsatz.status.value); // "ABGESCHLOSSEN"
 *     console.log(einsatz.abgeschlossenAt); // Date
 *   }
 *
 *   // Einsatz archivieren (finale Transition)
 *   const archiveResult = einsatz.archive(createdBy);
 *   if (archiveResult.isSuccess) {
 *     console.log(einsatz.status.value); // "ARCHIVIERT"
 *     console.log(einsatz.archivedAt); // Date
 *   }
 *
 *   // Versuche archivierter Einsatz zu ändern (scheitert)
 *   const failResult = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
 *   console.log(failResult.isFailure); // true
 *   console.log(failResult.error); // "Archivierte Einsätze können nicht geändert werden"
 *
 *   // NO-DELETE Policy (IMMER false)
 *   console.log(einsatz.canBeDeleted()); // false (10-Jahres-Aufbewahrungspflicht)
 * }
 *
 * // Validation Fehler
 * const failResult = Einsatz.create({ alarmstichwort: '', createdBy });
 * console.log(failResult.isFailure); // true
 * console.log(failResult.error); // "Alarmstichwort ist erforderlich"
 * ```
 */
export class Einsatz extends AggregateRoot<EinsatzId> {
  /**
   * Auto-generierte Einsatznummer im Format "E{YEAR}-{CUID-8}".
   * Beispiel: "E2024-clw3h8x9"
   */
  private _nummer: string;

  /**
   * Alarmstichwort des Einsatzes (z.B. "Wohnungsbrand", "Verkehrsunfall").
   * Pflichtfeld, darf nicht leer sein.
   */
  private _alarmstichwort: string;

  /**
   * Status des Einsatzes als Value Object mit State Machine Logic.
   * Erlaubt nur validierte Transitions (ANGELEGT → IN_BEARBEITUNG → ABGESCHLOSSEN → ARCHIVIERT).
   */
  private _status: EinsatzStatus;

  /**
   * Optional: Einsatzort als Address Value Object.
   * Enthält Strasse, Hausnummer, PLZ, Ort.
   */
  private _einsatzort?: Address;

  /**
   * Optional: Freitext-Bemerkung zum Einsatz.
   */
  private _bemerkung?: string;

  /**
   * User-ID des Erstellers.
   * Wichtig für Audit Trail und Verantwortlichkeits-Tracking.
   */
  private _createdBy: UserId;

  /**
   * Optional: Timestamp wann der Einsatz abgeschlossen wurde.
   * Wird gesetzt durch complete() Business Method.
   */
  private _abgeschlossenAt?: Date;

  /**
   * Optional: Timestamp wann der Einsatz archiviert wurde.
   * Wird gesetzt durch archive() Business Method.
   * Markiert Einsatz als immutable (keine weiteren Änderungen erlaubt).
   */
  private _archivedAt?: Date;

  /**
   * Private Constructor erzwingt Factory Method Nutzung.
   * Verhindert direkte Instanziierung ohne Validation.
   *
   * @param id - Type-Safe EinsatzId
   * @param nummer - Auto-generierte Einsatznummer (z.B. "E2024-A1B2C3")
   * @param alarmstichwort - Alarmstichwort (z.B. "Wohnungsbrand")
   * @param status - Einsatz Status als Value Object
   * @param createdBy - User-ID des Erstellers
   * @param einsatzort - Optional: Einsatzort als Address Value Object
   * @param bemerkung - Optional: Freitext-Bemerkung
   * @param createdAt - Optional: Creation timestamp (für Rekonstruktion aus DB)
   * @param updatedAt - Optional: Update timestamp (für Rekonstruktion aus DB)
   */
  private constructor(id: EinsatzId, nummer: string, alarmstichwort: string, status: EinsatzStatus, createdBy: UserId, einsatzort?: Address, bemerkung?: string, createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt);
    this._nummer = nummer;
    this._alarmstichwort = alarmstichwort;
    this._status = status;
    this._createdBy = createdBy;
    this._einsatzort = einsatzort;
    this._bemerkung = bemerkung;
  }

  /**
   * Readonly getter für Einsatznummer.
   * @returns Auto-generierte Einsatznummer (z.B. "E2024-A1B2C3")
   */
  get nummer(): string {
    return this._nummer;
  }

  /**
   * Readonly getter für Alarmstichwort.
   * @returns Alarmstichwort (z.B. "Wohnungsbrand")
   */
  get alarmstichwort(): string {
    return this._alarmstichwort;
  }

  /**
   * Readonly getter für Einsatz Status.
   * @returns EinsatzStatus Value Object
   */
  get status(): EinsatzStatus {
    return this._status;
  }

  /**
   * Readonly getter für Einsatzort.
   * @returns Optional: Address Value Object
   */
  get einsatzort(): Address | undefined {
    return this._einsatzort;
  }

  /**
   * Readonly getter für Bemerkung.
   * @returns Optional: Freitext-Bemerkung
   */
  get bemerkung(): string | undefined {
    return this._bemerkung;
  }

  /**
   * Readonly getter für Ersteller User-ID.
   * @returns UserId des Erstellers
   */
  get createdBy(): UserId {
    return this._createdBy;
  }

  /**
   * Readonly getter für Abschluss-Timestamp.
   * @returns Optional: Date wann Einsatz abgeschlossen wurde
   */
  get abgeschlossenAt(): Date | undefined {
    return this._abgeschlossenAt;
  }

  /**
   * Readonly getter für Archivierungs-Timestamp.
   * @returns Optional: Date wann Einsatz archiviert wurde
   */
  get archivedAt(): Date | undefined {
    return this._archivedAt;
  }

  /**
   * Helper Method: Prüft ob Einsatz archiviert ist.
   * Archivierte Einsätze sind immutable (keine Änderungen erlaubt).
   *
   * @returns true wenn Einsatz archiviert ist (archivedAt gesetzt)
   */
  private isArchived(): boolean {
    return this._archivedAt !== undefined;
  }

  /**
   * Auto-generiert Einsatznummer im Format "E{YEAR}-{CUID-8}".
   *
   * Warum dieses Format:
   * - "E" Prefix: Kennzeichnung als Einsatz (Emergency)
   * - Jahr: Ermöglicht jahresbasierte Sortierung und Archivierung
   * - CUID-8: Kurz genug für menschliche Lesbarkeit, dennoch ausreichend unique
   * - Keine Sequenznummern: Vermeidet Race Conditions bei paralleler Erstellung
   * - Konsistent mit anderen CUIDs im System
   *
   * @returns Einsatznummer im Format "E{YEAR}-{CUID-8}" (z.B. "E2024-clw3h8x9")
   */
  private static generateNummer(): string {
    const year = new Date().getFullYear();
    // Nutze die ersten 8 Zeichen des CUID für Lesbarkeit
    const randomPart = createId().substring(0, 8);
    return `E${year}-${randomPart}`;
  }

  /**
   * Factory Method zur Erstellung eines Einsatzes mit Business Validation.
   * Verwendet Result<T> Pattern zur expliziten Fehlerbehandlung.
   *
   * **Business Rules:**
   * - Alarmstichwort ist required und darf nicht leer sein (trim check)
   * - Einsatzort ist optional (Address Value Object)
   * - Bemerkung ist optional
   * - Initialer Status ist IMMER ANGELEGT (State Machine Start)
   * - Einsatznummer wird auto-generiert (Format: "E{YEAR}-{NANOID-6}")
   * - Bei Erfolg wird EinsatzCreatedEvent emittiert
   *
   * **Warum alarmstichwort required:**
   * - Fachlich essentiell: Ohne Alarmstichwort kann kein Einsatz disponiert werden
   * - Kommunikation: Alarmstichwort wird in Alarmierungen verwendet
   * - Compliance: Einsatzdokumentation muss Einsatztyp enthalten
   *
   * @param props - CreateEinsatzProps mit alarmstichwort (required), createdBy (required), einsatzort (optional), bemerkung (optional)
   * @returns Result<Einsatz> - Success mit Einsatz oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * // Success: Vollständiger Einsatz
   * const createdBy = UserId.create().value!;
   * const einsatzort = Address.create({ strasse: 'Musterstr.', hausnummer: '42', plz: '80331', ort: 'München' }).value!;
   * const result = Einsatz.create({
   *   alarmstichwort: 'Wohnungsbrand',
   *   createdBy,
   *   einsatzort,
   *   bemerkung: 'Dachstuhl brennt'
   * });
   * if (result.isSuccess) {
   *   const einsatz = result.value!;
   *   einsatz.getDomainEvents(); // [EinsatzCreatedEvent]
   * }
   *
   * // Failure: Leeres Alarmstichwort
   * const failResult = Einsatz.create({ alarmstichwort: '', createdBy });
   * console.log(failResult.error); // "Alarmstichwort ist erforderlich"
   * ```
   */
  static create(props: CreateEinsatzProps): Result<Einsatz> {
    // Business Rule: Alarmstichwort required
    if (!props.alarmstichwort || props.alarmstichwort.trim().length === 0) {
      return Result.fail<Einsatz>('Alarmstichwort ist erforderlich');
    }

    // Generate type-safe EinsatzId
    const idResult = EinsatzId.create();
    if (idResult.isFailure) {
      return Result.fail<Einsatz>(idResult.error ?? 'Failed to create EinsatzId');
    }
    const id = idResult.value as EinsatzId;

    // Auto-generate Einsatznummer
    const nummer = Einsatz.generateNummer();

    // Initial status: ANGELEGT (State Machine Start)
    const initialStatus = EinsatzStatus.ANGELEGT();

    // Create aggregate
    const einsatz = new Einsatz(id, nummer, props.alarmstichwort.trim(), initialStatus, props.createdBy, props.einsatzort, props.bemerkung?.trim());

    // Emit EinsatzCreatedEvent
    einsatz.addDomainEvent(new EinsatzCreatedEvent(id, props.createdBy, props.alarmstichwort.trim(), id.value));

    return Result.ok<Einsatz>(einsatz);
  }

  /**
   * Business Method: Schließt den Einsatz ab (Transition zu ABGESCHLOSSEN).
   * Setzt `abgeschlossenAt` Timestamp für Audit Trail.
   *
   * **Business Rules:**
   * - Archivierte Einsätze können nicht abgeschlossen werden (immutable)
   * - Status-Transition muss gültig sein (canTransitionTo())
   * - Setzt `abgeschlossenAt` Timestamp
   * - Emittiert EinsatzCompletedEvent und EinsatzStatusChangedEvent
   *
   * **Warum separate complete() Method statt nur updateStatus():**
   * - Domain-spezifische Semantik: "Abschließen" hat fachliche Bedeutung (≠ generischer Status-Wechsel)
   * - Setzt automatisch abgeschlossenAt Timestamp (Invariante)
   * - Emittiert spezielles EinsatzCompletedEvent (wichtig für Notifications/Reporting)
   * - Explizite Business Operation im Ubiquitous Language
   *
   * @param userId - User-ID des Users der den Einsatz abschließt (für Audit Trail)
   * @returns Result<void> - Success oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * const einsatz = Einsatz.create({ alarmstichwort: 'Wohnungsbrand', createdBy }).value!;
   * const userId = UserId.create().value!;
   *
   * // Success: Einsatz abschließen
   * const result = einsatz.complete(userId);
   * if (result.isSuccess) {
   *   console.log(einsatz.status.value); // "ABGESCHLOSSEN"
   *   console.log(einsatz.abgeschlossenAt); // Date
   *   einsatz.getDomainEvents(); // [EinsatzCreatedEvent, EinsatzCompletedEvent, EinsatzStatusChangedEvent]
   * }
   *
   * // Failure: Archivierter Einsatz
   * einsatz.archive(userId);
   * const failResult = einsatz.complete(userId);
   * console.log(failResult.error); // "Archivierte Einsätze können nicht abgeschlossen werden"
   * ```
   */
  public complete(userId: UserId): Result<void> {
    // Check if archived (immutable)
    if (this.isArchived()) {
      return Result.fail<void>('Archivierte Einsätze können nicht abgeschlossen werden');
    }

    // Check if can transition to ABGESCHLOSSEN
    const targetStatus = EinsatzStatus.ABGESCHLOSSEN();
    if (!this._status.canTransitionTo(targetStatus)) {
      return Result.fail(`Ungültige Status-Transition: ${this._status.value} → ABGESCHLOSSEN`);
    }

    // Update status and timestamp
    const oldStatus = this._status;
    this._status = targetStatus;
    this._abgeschlossenAt = new Date();

    // Emit events
    this.addDomainEvent(new EinsatzCompletedEvent(this.id, userId, this._abgeschlossenAt, this.id.value));
    this.addDomainEvent(new EinsatzStatusChangedEvent(this.id, oldStatus, this._status, this.id.value));

    return Result.ok<void>(undefined);
  }

  /**
   * Business Method: Archiviert den Einsatz (finale Transition zu ARCHIVIERT).
   * Macht Einsatz immutable - keine weiteren Änderungen erlaubt.
   *
   * **Business Rules:**
   * - Bereits archivierte Einsätze können nicht erneut archiviert werden
   * - Status-Transition muss gültig sein (canTransitionTo())
   * - Setzt `archivedAt` Timestamp (markiert als immutable)
   * - Nach Archivierung sind KEINE Änderungen mehr erlaubt
   * - Emittiert EinsatzArchivedEvent und EinsatzStatusChangedEvent
   *
   * **Warum Archivierung finale Transition ist:**
   * - Compliance: Archivierte Daten dürfen nicht mehr verändert werden (Audit-Sicherheit)
   * - Data Retention: Nach Archivierung erfolgt ggf. Backup auf Cold Storage
   * - Forensik: Garantiert, dass archivierte Einsätze unverändert bleiben
   * - State Machine: ARCHIVIERT ist Endzustand (keine weiteren Transitions)
   *
   * @param userId - User-ID des Users der den Einsatz archiviert (für Audit Trail)
   * @returns Result<void> - Success oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * const einsatz = Einsatz.create({ alarmstichwort: 'Wohnungsbrand', createdBy }).value!;
   * const userId = UserId.create().value!;
   *
   * // Success: Einsatz archivieren
   * const result = einsatz.archive(userId);
   * if (result.isSuccess) {
   *   console.log(einsatz.status.value); // "ARCHIVIERT"
   *   console.log(einsatz.archivedAt); // Date
   *   einsatz.getDomainEvents(); // [EinsatzCreatedEvent, EinsatzArchivedEvent, EinsatzStatusChangedEvent]
   * }
   *
   * // Failure: Bereits archiviert
   * const failResult = einsatz.archive(userId);
   * console.log(failResult.error); // "Einsatz ist bereits archiviert"
   *
   * // Failure: Versuche archivierten Einsatz zu ändern
   * const updateResult = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
   * console.log(updateResult.error); // "Archivierte Einsätze können nicht geändert werden"
   * ```
   */
  public archive(userId: UserId): Result<void> {
    // Check if already archived
    if (this.isArchived()) {
      return Result.fail<void>('Einsatz ist bereits archiviert');
    }

    // Check if can transition to ARCHIVIERT
    const targetStatus = EinsatzStatus.ARCHIVIERT();
    if (!this._status.canTransitionTo(targetStatus)) {
      return Result.fail(`Ungültige Status-Transition: ${this._status.value} → ARCHIVIERT`);
    }

    // Update status and timestamp
    const oldStatus = this._status;
    this._status = targetStatus;
    this._archivedAt = new Date();

    // Emit events
    this.addDomainEvent(new EinsatzArchivedEvent(this.id, userId, this.id.value));
    this.addDomainEvent(new EinsatzStatusChangedEvent(this.id, oldStatus, this._status, this.id.value));

    return Result.ok<void>(undefined);
  }

  /**
   * Business Method: Ändert den Einsatz Status mit State Machine Validierung.
   *
   * **Business Rules:**
   * - Archivierte Einsätze können nicht geändert werden (immutable)
   * - Status-Transition muss gültig sein (canTransitionTo())
   * - Gleicher Status ist No-Op (keine Änderung, kein Event)
   * - Emittiert EinsatzStatusChangedEvent bei erfolgreicher Transition
   *
   * **Warum canTransitionTo() Check wichtig ist:**
   * - Verhindert ungültige Rückwärts-Transitions (z.B. ABGESCHLOSSEN → IN_BEARBEITUNG)
   * - Kapselt State Machine Logic in einem Ort (EinsatzStatus Value Object)
   * - Explizite Business Rule Enforcement (Fail Fast bei Invarianten-Verletzung)
   * - Ermöglicht spätere State Machine Erweiterungen ohne Application Layer zu ändern
   *
   * @param newStatus - Neuer EinsatzStatus (muss gültige Transition sein)
   * @returns Result<void> - Success oder Failure mit Error Message
   *
   * @example
   * ```typescript
   * const einsatz = Einsatz.create({ alarmstichwort: 'Wohnungsbrand', createdBy }).value!;
   *
   * // Success: Gültige Transition ANGELEGT → IN_BEARBEITUNG
   * const result = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
   * if (result.isSuccess) {
   *   console.log(einsatz.status.value); // "IN_BEARBEITUNG"
   *   einsatz.getDomainEvents(); // [EinsatzCreatedEvent, EinsatzStatusChangedEvent]
   * }
   *
   * // No-Op: Gleicher Status (keine Änderung)
   * const noOpResult = einsatz.updateStatus(EinsatzStatus.IN_BEARBEITUNG());
   * console.log(noOpResult.isSuccess); // true (No-Op, kein Event)
   *
   * // Failure: Ungültige Rückwärts-Transition
   * einsatz.updateStatus(EinsatzStatus.ABGESCHLOSSEN());
   * const failResult = einsatz.updateStatus(EinsatzStatus.ANGELEGT());
   * console.log(failResult.error); // "Ungültige Status-Transition: ABGESCHLOSSEN → ANGELEGT"
   * ```
   */
  public updateStatus(newStatus: EinsatzStatus): Result<void> {
    // Check if archived (immutable)
    if (this.isArchived()) {
      return Result.fail('Archivierte Einsätze können nicht geändert werden');
    }

    // Check if same status (no-op)
    if (this._status.equals(newStatus)) {
      return Result.ok<void>(undefined); // No change
    }

    // Check if can transition
    if (!this._status.canTransitionTo(newStatus)) {
      return Result.fail(`Ungültige Status-Transition: ${this._status.value} → ${newStatus.value}`);
    }

    // Update status
    const oldStatus = this._status;
    this._status = newStatus;

    // Emit event
    this.addDomainEvent(new EinsatzStatusChangedEvent(this.id, oldStatus, newStatus, this.id.value));

    return Result.ok<void>(undefined);
  }

  /**
   * NO-DELETE Policy für DRK-Compliance.
   * Einsätze dürfen NIEMALS gelöscht werden - nur archiviert.
   *
   * **Warum IMMER false:**
   * - Gesetzliche Aufbewahrungspflicht: DRK muss Einsätze 10 Jahre archivieren
   * - Forensische Analyse: Gelöschte Einsätze können nicht mehr untersucht werden
   * - Audit Trail: Compliance-Anforderungen verlangen lückenlose Historie
   * - Statistische Auswertungen: Gelöschte Daten verfälschen Langzeit-Statistiken
   * - Rechtliche Absicherung: Bei Klagen/Untersuchungen müssen Einsätze nachweisbar sein
   *
   * **Alternative zu Deletion:**
   * - Nutze `archive()` um Einsätze aus aktiver Liste zu entfernen
   * - Archivierte Einsätze bleiben in DB aber sind immutable
   * - Nach 10 Jahren: Manuelle Löschung durch Admin (nicht über Aggregate)
   *
   * @returns IMMER false (NO-DELETE Policy)
   *
   * @example
   * ```typescript
   * const einsatz = Einsatz.create({ alarmstichwort: 'Wohnungsbrand', createdBy }).value!;
   *
   * // IMMER false - unabhängig von Status
   * console.log(einsatz.canBeDeleted()); // false (ANGELEGT)
   * einsatz.complete(userId);
   * console.log(einsatz.canBeDeleted()); // false (ABGESCHLOSSEN)
   * einsatz.archive(userId);
   * console.log(einsatz.canBeDeleted()); // false (ARCHIVIERT)
   * ```
   */
  public canBeDeleted(): boolean {
    return false; // 10-year retention requirement - NIEMALS löschen
  }
}
