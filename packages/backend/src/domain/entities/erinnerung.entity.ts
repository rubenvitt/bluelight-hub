import { AggregateRoot } from '@domain/common/aggregate-root';
import { Result } from '@domain/common/result';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import { ErinnerungId } from '@domain/value-objects/erinnerung-id';
import { ErinnerungStatus } from '@domain/value-objects/erinnerung-status';
import { ErinnerungTitel } from '@domain/value-objects/erinnerung-titel';
import type { UserId } from '@domain/value-objects/user-id';
import { ErinnerungErstelltEvent } from '@domain/events/erinnerung-erstellt.event';
import { ErinnerungAktualisiertEvent } from '@domain/events/erinnerung-aktualisiert.event';
import type { ErinnerungAenderungen } from '@domain/events/erinnerung-aktualisiert.event';
import { ErinnerungGeloeschtEvent } from '@domain/events/erinnerung-geloescht.event';
import { ErinnerungAusgeloestEvent } from '@domain/events/erinnerung-ausgeloest.event';

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
 * Props für das Aktualisieren einer Erinnerung.
 * Alle Felder sind optional - nur gesetzte Felder werden aktualisiert.
 * `aktualisierVon` ist erforderlich für Audit-Trail und ETB-Integration.
 */
export interface UpdateErinnerungProps {
  titel?: string;
  beschreibung?: string | null;
  faelligAm?: Date;
  aktualisierVon: UserId;
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
  /** Soft-Delete Flag (Story 1.4) */
  isDeleted?: boolean;
  /** Zeitpunkt der Löschung (Story 1.4) */
  deletedAt?: Date | null;
  /** User der gelöscht hat (Story 1.4) */
  deletedBy?: UserId | null;
  /** Zeitpunkt der Auslösung (Story 1.5) */
  ausgeloestAm?: Date | null;
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
  private _titel: ErinnerungTitel;
  private _beschreibung: string | null;
  private _faelligAm: Date;
  private _status: ErinnerungStatus;
  private readonly _erstelltVon: UserId;

  // Soft-Delete Felder (Story 1.4)
  private _isDeleted: boolean;
  private _deletedAt: Date | null;
  private _deletedBy: UserId | null;

  // Auslösung Feld (Story 1.5)
  private _ausgeloestAm: Date | null;

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

  // Soft-Delete Getters (Story 1.4)

  /**
   * Gibt zurück ob die Erinnerung gelöscht wurde (Soft-Delete).
   */
  get isDeleted(): boolean {
    return this._isDeleted;
  }

  /**
   * Gibt den Zeitpunkt der Löschung zurück.
   * Null wenn nicht gelöscht.
   */
  get deletedAt(): Date | null {
    return this._deletedAt ? new Date(this._deletedAt.getTime()) : null;
  }

  /**
   * Gibt den User zurück der gelöscht hat.
   * Null wenn nicht gelöscht.
   */
  get deletedBy(): UserId | null {
    return this._deletedBy;
  }

  // Auslösung Getter (Story 1.5)

  /**
   * Gibt den Zeitpunkt der Auslösung zurück.
   * Null wenn noch nicht ausgelöst.
   */
  get ausgeloestAm(): Date | null {
    return this._ausgeloestAm ? new Date(this._ausgeloestAm.getTime()) : null;
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
    isDeleted = false,
    deletedAt: Date | null = null,
    deletedBy: UserId | null = null,
    ausgeloestAm: Date | null = null,
  ) {
    super(id, createdAt, updatedAt);
    this._einsatzId = einsatzId;
    this._titel = titel;
    this._beschreibung = beschreibung;
    this._faelligAm = faelligAm;
    this._status = status;
    this._erstelltVon = erstelltVon;
    this._isDeleted = isDeleted;
    this._deletedAt = deletedAt;
    this._deletedBy = deletedBy;
    this._ausgeloestAm = ausgeloestAm;
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
    return new Erinnerung(
      props.id,
      props.einsatzId,
      props.titel,
      props.beschreibung,
      props.faelligAm,
      props.status,
      props.erstelltVon,
      props.createdAt,
      props.updatedAt,
      props.isDeleted ?? false,
      props.deletedAt ?? null,
      props.deletedBy ?? null,
      props.ausgeloestAm ?? null,
    );
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

  // ============================================================
  // Mutation Methods
  // ============================================================

  /**
   * Aktualisiert eine Erinnerung mit partiellen Änderungen.
   *
   * **Business Rules:**
   * - Nur Erinnerungen mit Status GEPLANT können bearbeitet werden
   * - Titel muss gültig sein (nicht leer, max 100 Zeichen)
   * - faelligAm muss in der Zukunft liegen
   * - Beschreibung ist optional, maximal 500 Zeichen
   * - Emittiert ErinnerungAktualisiertEvent mit den Änderungen
   *
   * @param props - UpdateErinnerungProps mit den zu ändernden Feldern
   * @returns Result<void> - Success oder Failure mit Error Code
   */
  public update(props: UpdateErinnerungProps): Result<void> {
    // Business Rule: Nur GEPLANT Status erlaubt Update (AC3)
    if (!this._status.isGeplant()) {
      return Result.fail<void>('ERINNERUNG_NOT_EDITABLE');
    }

    // Mindestens ein Feld muss geändert werden
    if (props.titel === undefined && props.beschreibung === undefined && props.faelligAm === undefined) {
      return Result.fail<void>('ERINNERUNG_NO_CHANGES');
    }

    const aenderungen: ErinnerungAenderungen = {};

    // Validiere und update Titel
    if (props.titel !== undefined) {
      const titelResult = ErinnerungTitel.create(props.titel);
      if (titelResult.isFailure || !titelResult.value) {
        return Result.fail<void>(titelResult.error ?? 'ERINNERUNG_TITEL_INVALID');
      }
      this._titel = titelResult.value;
      aenderungen.titel = props.titel;
    }

    // Validiere und update Beschreibung
    if (props.beschreibung !== undefined) {
      if (props.beschreibung !== null) {
        const trimmedBeschreibung = props.beschreibung.trim();
        if (trimmedBeschreibung.length > Erinnerung.MAX_BESCHREIBUNG_LENGTH) {
          return Result.fail<void>(`ERINNERUNG_BESCHREIBUNG_TOO_LONG: Beschreibung darf maximal ${Erinnerung.MAX_BESCHREIBUNG_LENGTH} Zeichen haben`);
        }
        this._beschreibung = trimmedBeschreibung.length > 0 ? trimmedBeschreibung : null;
      } else {
        this._beschreibung = null;
      }
      aenderungen.beschreibung = this._beschreibung;
    }

    // Validiere und update faelligAm
    if (props.faelligAm !== undefined) {
      const now = new Date();
      if (props.faelligAm <= now) {
        return Result.fail<void>('ERINNERUNG_FAELLIG_AM_IN_PAST');
      }
      this._faelligAm = props.faelligAm;
      aenderungen.faelligAm = props.faelligAm;
    }

    // Emit Domain Event mit allen Änderungen
    this.addDomainEvent(new ErinnerungAktualisiertEvent(this.id, this._einsatzId, aenderungen, props.aktualisierVon, this._titel.value, this.id.toString()));

    return Result.ok<void>(undefined);
  }

  /**
   * Löscht eine Erinnerung (Soft-Delete).
   *
   * **Business Rules (Story 1.4):**
   * - Nur Erinnerungen mit Status GEPLANT oder AUSGELOEST können gelöscht werden
   * - Bei anderen Status (ACKNOWLEDGED, ERLEDIGT, etc.) wird ein Fehler zurückgegeben
   * - Emittiert ErinnerungGeloeschtEvent für ETB-Integration und Audit-Trail
   *
   * @param geloeschtVon - User der die Erinnerung löscht (für Audit-Trail)
   * @returns Result<void> - Success oder Failure mit Error Code
   *
   * @example
   * ```typescript
   * const deleteResult = erinnerung.delete(userId);
   * if (deleteResult.isFailure) {
   *   // Nur GEPLANT oder AUSGELOEST können gelöscht werden
   *   console.log(deleteResult.error); // "ERINNERUNG_NOT_DELETABLE"
   * }
   * ```
   */
  public delete(geloeschtVon: UserId): Result<void> {
    // Business Rule: Nur GEPLANT oder AUSGELOEST Status erlaubt (AC1)
    const deletableStatuses = [ErinnerungStatus.GEPLANT(), ErinnerungStatus.AUSGELOEST()];
    const isDeletable = deletableStatuses.some((s) => s.equals(this._status));

    if (!isDeletable) {
      return Result.fail<void>('ERINNERUNG_NOT_DELETABLE');
    }

    // Bereits gelöscht? (Idempotenz)
    if (this._isDeleted) {
      return Result.fail<void>('ERINNERUNG_ALREADY_DELETED');
    }

    // Soft-Delete durchführen
    this._isDeleted = true;
    this._deletedAt = new Date();
    this._deletedBy = geloeschtVon;

    // Domain Event emittieren für ETB-Integration
    this.addDomainEvent(new ErinnerungGeloeschtEvent(this.id, this._einsatzId, this._titel.value, geloeschtVon, this.id.toString()));

    return Result.ok<void>(undefined);
  }

  /**
   * Löst eine Erinnerung bei Fälligkeit aus.
   *
   * **Business Rules (Story 1.5):**
   * - Nur Erinnerungen mit Status GEPLANT können ausgelöst werden
   * - Bei anderen Status wird ein Fehler zurückgegeben
   * - Setzt Status auf AUSGELOEST und speichert Auslösezeitpunkt
   * - Emittiert ErinnerungAusgeloestEvent für ETB-Integration und WebSocket
   *
   * @returns Result<void> - Success oder Failure mit Error Code
   *
   * @example
   * ```typescript
   * const triggerResult = erinnerung.ausloesen();
   * if (triggerResult.isFailure) {
   *   // Nur GEPLANT kann ausgelöst werden
   *   console.log(triggerResult.error); // "ERINNERUNG_NOT_TRIGGERABLE"
   * }
   * ```
   */
  public ausloesen(): Result<void> {
    // Business Rule: Nur GEPLANT Status kann ausgelöst werden (AC1)
    if (!this._status.isGeplant()) {
      return Result.fail<void>('ERINNERUNG_NOT_TRIGGERABLE');
    }

    // Status-Wechsel durchführen
    this._status = ErinnerungStatus.AUSGELOEST();
    this._ausgeloestAm = new Date();

    // Domain Event emittieren für ETB-Integration und WebSocket
    this.addDomainEvent(new ErinnerungAusgeloestEvent(this.id, this._einsatzId, this._ausgeloestAm, this._titel.value, this._erstelltVon, this.id.toString()));

    return Result.ok<void>(undefined);
  }
}
