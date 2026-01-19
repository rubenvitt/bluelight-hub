import { AggregateRoot } from '@domain/common/aggregate-root';
import { Result } from '@domain/common/result';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { ErinnerungStatus } from '@domain/value-objects/erinnerung-status';
import { ErinnerungTitel } from '@domain/value-objects/erinnerung-titel';
import type { UserId } from '@domain/value-objects/user-id';
import { ErinnerungErstelltEvent } from '@domain/events/erinnerung-erstellt.event';

/**
 * Props für die Erstellung einer neuen Erinnerung.
 */
export interface CreateErinnerungProps {
  einsatzId: EinsatzId;
  titel: string;
  beschreibung?: string;
  faelligAm: Date;
  erstelltVon: UserId;
}

/**
 * Props für die Rekonstruktion einer Erinnerung aus der Datenbank.
 */
export interface ReconstructErinnerungProps {
  id: ErinnerungId;
  einsatzId: EinsatzId;
  titel: ErinnerungTitel;
  beschreibung: string | null;
  faelligAm: Date;
  status: ErinnerungStatus;
  erstelltVon: UserId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Erinnerung Aggregate Root für zeitgesteuerte Benachrichtigungen.
 *
 * Repräsentiert eine Erinnerung innerhalb eines Einsatzes für FüKw-Personal.
 * Ermöglicht Quick-Create mit Titel und Zeitpunkt sowie Status-Tracking.
 *
 * **Business Rules (Invarianten):**
 * 1. Titel ist erforderlich und maximal 100 Zeichen
 * 2. Fälligkeitszeitpunkt muss bei Erstellung in der Zukunft liegen
 * 3. Initialer Status ist immer GEPLANT
 * 4. Status-Transitions folgen der State Machine in ErinnerungStatus
 * 5. Beschreibung ist optional (max 500 Zeichen)
 *
 * **Event Flow:**
 * - create() → ErinnerungErstelltEvent
 *
 * @example
 * ```typescript
 * const result = Erinnerung.create({
 *   einsatzId: einsatzId,
 *   titel: 'Lagebesprechung',
 *   faelligAm: addMinutes(new Date(), 30),
 *   erstelltVon: userId,
 * });
 *
 * if (result.isSuccess) {
 *   const erinnerung = result.value!;
 *   console.log(erinnerung.status.isGeplant()); // true
 *   console.log(erinnerung.titel.value); // "Lagebesprechung"
 * }
 * ```
 */
export class Erinnerung extends AggregateRoot<ErinnerungId> {
  /**
   * Maximale Länge der Beschreibung.
   * Konsistent mit Prisma Schema: @db.VarChar(500)
   */
  public static readonly MAX_BESCHREIBUNG_LENGTH = 500;

  private readonly _einsatzId: EinsatzId;
  private readonly _titel: ErinnerungTitel;
  private readonly _beschreibung: string | null;
  private readonly _faelligAm: Date;
  private _status: ErinnerungStatus;
  private readonly _erstelltVon: UserId;

  // ============================================================
  // Readonly Getters
  // ============================================================

  get einsatzId(): EinsatzId {
    return this._einsatzId;
  }

  get titel(): ErinnerungTitel {
    return this._titel;
  }

  get beschreibung(): string | null {
    return this._beschreibung;
  }

  /**
   * Gibt den Fälligkeitszeitpunkt zurück.
   *
   * Gibt eine Kopie zurück um Immutabilität zu garantieren,
   * da Date in JavaScript mutable ist.
   */
  get faelligAm(): Date {
    return new Date(this._faelligAm.getTime());
  }

  get status(): ErinnerungStatus {
    return this._status;
  }

  get erstelltVon(): UserId {
    return this._erstelltVon;
  }

  // ============================================================
  // Private Constructor (erzwingt Factory Methods)
  // ============================================================

  private constructor(
    id: ErinnerungId,
    einsatzId: EinsatzId,
    titel: ErinnerungTitel,
    beschreibung: string | null,
    faelligAm: Date,
    status: ErinnerungStatus,
    erstelltVon: UserId,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
    this._einsatzId = einsatzId;
    this._titel = titel;
    this._beschreibung = beschreibung;
    this._faelligAm = faelligAm;
    this._status = status;
    this._erstelltVon = erstelltVon;
  }

  // ============================================================
  // Factory Methods
  // ============================================================

  /**
   * Factory Method zur Erstellung einer neuen Erinnerung.
   *
   * **Business Rules:**
   * - Titel darf nicht leer sein und maximal 100 Zeichen haben
   * - Fälligkeitszeitpunkt muss in der Zukunft liegen
   * - Beschreibung ist optional, maximal 500 Zeichen
   * - Emittiert ErinnerungErstelltEvent
   *
   * @param props - CreateErinnerungProps mit allen erforderlichen Feldern
   * @returns Result<Erinnerung> - Success mit Aggregate oder Failure mit Error
   */
  static create(props: CreateErinnerungProps): Result<Erinnerung> {
    // Validiere Titel
    const titelResult = ErinnerungTitel.create(props.titel);
    if (titelResult.isFailure || !titelResult.value) {
      return Result.fail<Erinnerung>(titelResult.error ?? 'ERINNERUNG_TITEL_INVALID');
    }

    // Validiere faelligAm (muss in Zukunft liegen)
    const now = new Date();
    if (props.faelligAm <= now) {
      return Result.fail<Erinnerung>('ERINNERUNG_FAELLIG_AM_IN_PAST');
    }

    // Validiere Beschreibung (optional, aber wenn vorhanden maximal 500 Zeichen)
    let beschreibung: string | null = null;
    if (props.beschreibung != null && props.beschreibung.trim().length > 0) {
      const trimmedBeschreibung = props.beschreibung.trim();
      if (trimmedBeschreibung.length > Erinnerung.MAX_BESCHREIBUNG_LENGTH) {
        return Result.fail<Erinnerung>(`ERINNERUNG_BESCHREIBUNG_TOO_LONG: Beschreibung darf maximal ${Erinnerung.MAX_BESCHREIBUNG_LENGTH} Zeichen haben`);
      }
      beschreibung = trimmedBeschreibung;
    }

    // Generiere ID
    const idResult = ErinnerungId.create();
    if (idResult.isFailure || !idResult.value) {
      return Result.fail<Erinnerung>(idResult.error ?? 'ERINNERUNG_ID_INVALID');
    }

    const erinnerung = new Erinnerung(
      idResult.value,
      props.einsatzId,
      titelResult.value,
      beschreibung,
      props.faelligAm,
      ErinnerungStatus.GEPLANT(), // Initialer Status
      props.erstelltVon,
    );

    // Emit Domain Event
    erinnerung.addDomainEvent(new ErinnerungErstelltEvent(idResult.value, props.einsatzId, titelResult.value.value, props.faelligAm, props.erstelltVon, idResult.value.toString()));

    return Result.ok<Erinnerung>(erinnerung);
  }

  /**
   * Factory Method zur Rekonstruktion aus der Datenbank.
   * Überspringt Validierung da Daten bereits validiert wurden.
   */
  static reconstruct(props: ReconstructErinnerungProps): Erinnerung {
    return new Erinnerung(props.id, props.einsatzId, props.titel, props.beschreibung, props.faelligAm, props.status, props.erstelltVon, props.createdAt, props.updatedAt);
  }

  // ============================================================
  // Business Methods
  // ============================================================

  /**
   * Prüft ob die Erinnerung fällig ist (faelligAm <= jetzt).
   */
  public istFaellig(): boolean {
    return new Date() >= this._faelligAm;
  }

  /**
   * Prüft ob die Erinnerung noch aktiv ist (nicht erledigt).
   */
  public istAktiv(): boolean {
    return this._status.isActive();
  }

  /**
   * Berechnet die verbleibende Zeit bis zur Fälligkeit in Millisekunden.
   * Gibt 0 zurück wenn bereits fällig.
   */
  public verbleibendeZeitMs(): number {
    const diff = this._faelligAm.getTime() - Date.now();
    return Math.max(0, diff);
  }
}
