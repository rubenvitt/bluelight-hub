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
import { ErinnerungAcknowledgedEvent } from '@domain/events/erinnerung-acknowledged.event';
import { ErinnerungSnoozedEvent } from '@domain/events/erinnerung-snoozed.event';
import { ErinnerungRetriggeredEvent } from '@domain/events/erinnerung-retriggered.event';
import { ErinnerungErledigtEvent } from '@domain/events/erinnerung-erledigt.event';
import { ErinnerungAssignedEvent } from '@domain/events/erinnerung-assigned.event';

/**
 * Props für die Erstellung einer neuen Erinnerung.
 */
export interface CreateErinnerungProps {
  einsatzId: EinsatzId;
  titel: string;
  beschreibung?: string;
  faelligAm: Date;
  erstelltVon: UserId;
  /** Story 2.6: Pflicht-Notiz bei Erledigung erforderlich (default: false) */
  requiresNote?: boolean;
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
  /** Zeitpunkt der Bestätigung (Story 1.6) */
  acknowledgedAm?: Date | null;
  /** User der bestätigt hat (Story 1.6) */
  acknowledgedBy?: UserId | null;
  /** Zeitpunkt der Snooze-Aktion (Story 2.1) */
  snoozedAt?: Date | null;
  /** User der gesnoozed hat (Story 2.1) */
  snoozedBy?: UserId | null;
  /** Neue Fälligkeit nach Snooze (Story 2.1) */
  snoozedUntil?: Date | null;
  /** Anzahl der Snoozes (Story 2.1) */
  snoozeCount?: number;
  /** Zeitpunkt der Erledigung (Story 2.5) */
  erledigtAm?: Date | null;
  /** User der erledigt hat (Story 2.5) */
  erledigtBy?: UserId | null;
  /** Optionale Notiz bei Erledigung (Story 2.5) */
  erledigungsNotiz?: string | null;
  /** Pflicht-Notiz bei Erledigung erforderlich (Story 2.6) */
  requiresNote?: boolean;
  /** Story 3.3: Zugewiesener User */
  assignedToId?: UserId | null;
  /** Story 3.3: User der zugewiesen hat */
  assignedBy?: UserId | null;
  /** Story 3.3: Zeitpunkt der Zuweisung */
  assignedAt?: Date | null;
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

  /**
   * Story 2.6: Default-Wert für Pflicht-Notiz Flag.
   * Zentrale Definition um Redundanz zu vermeiden (Issue 6).
   */
  public static readonly DEFAULT_REQUIRES_NOTE = false;

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

  // Bestätigung Felder (Story 1.6)
  private _acknowledgedAm: Date | null;
  private _acknowledgedBy: UserId | null;

  // Snooze Felder (Story 2.1)
  private _snoozedAt: Date | null;
  private _snoozedBy: UserId | null;
  private _snoozedUntil: Date | null;
  private _snoozeCount: number;

  // Erledigt Felder (Story 2.5)
  private _erledigtAm: Date | null;
  private _erledigtBy: UserId | null;
  private _erledigungsNotiz: string | null;

  // Pflicht-Notiz Flag (Story 2.6)
  private readonly _requiresNote: boolean;

  // Zuweisung Felder (Story 3.3)
  private _assignedToId: UserId | null;
  private _assignedBy: UserId | null;
  private _assignedAt: Date | null;

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

  // Bestätigung Getters (Story 1.6)

  /**
   * Gibt den Zeitpunkt der Bestätigung zurück.
   * Null wenn noch nicht bestätigt.
   */
  get acknowledgedAm(): Date | null {
    return this._acknowledgedAm ? new Date(this._acknowledgedAm.getTime()) : null;
  }

  /**
   * Gibt den User zurück der bestätigt hat.
   * Null wenn noch nicht bestätigt.
   */
  get acknowledgedBy(): UserId | null {
    return this._acknowledgedBy;
  }

  // Snooze Getters (Story 2.1)

  /**
   * Gibt den Zeitpunkt der Snooze-Aktion zurück.
   * Null wenn nicht gesnoozed.
   */
  get snoozedAt(): Date | null {
    return this._snoozedAt ? new Date(this._snoozedAt.getTime()) : null;
  }

  /**
   * Gibt den User zurück der gesnoozed hat.
   * Null wenn nicht gesnoozed.
   */
  get snoozedBy(): UserId | null {
    return this._snoozedBy;
  }

  /**
   * Gibt die neue Fälligkeit nach Snooze zurück.
   * Null wenn nicht gesnoozed.
   */
  get snoozedUntil(): Date | null {
    return this._snoozedUntil ? new Date(this._snoozedUntil.getTime()) : null;
  }

  /**
   * Gibt die Anzahl der Snoozes zurück.
   */
  get snoozeCount(): number {
    return this._snoozeCount;
  }

  // Erledigt Getters (Story 2.5)

  /**
   * Gibt den Zeitpunkt der Erledigung zurück.
   * Null wenn noch nicht erledigt.
   */
  get erledigtAm(): Date | null {
    return this._erledigtAm ? new Date(this._erledigtAm.getTime()) : null;
  }

  /**
   * Gibt den User zurück der erledigt hat.
   * Null wenn noch nicht erledigt.
   */
  get erledigtBy(): UserId | null {
    return this._erledigtBy;
  }

  /**
   * Gibt die optionale Erledigungs-Notiz zurück.
   * Null wenn keine Notiz oder nicht erledigt.
   */
  get erledigungsNotiz(): string | null {
    return this._erledigungsNotiz;
  }

  // Pflicht-Notiz Getter (Story 2.6)

  /**
   * Gibt zurück ob bei Erledigung eine Pflicht-Notiz erforderlich ist.
   */
  get requiresNote(): boolean {
    return this._requiresNote;
  }

  // Zuweisung Getters (Story 3.3)

  /**
   * Gibt die ID des zugewiesenen Users zurück.
   * Null wenn nicht zugewiesen.
   */
  get assignedToId(): UserId | null {
    return this._assignedToId;
  }

  /**
   * Gibt den User zurück der die Zuweisung vorgenommen hat.
   * Null wenn nicht zugewiesen.
   */
  get assignedBy(): UserId | null {
    return this._assignedBy;
  }

  /**
   * Gibt den Zeitpunkt der Zuweisung zurück.
   * Null wenn nicht zugewiesen.
   */
  get assignedAt(): Date | null {
    return this._assignedAt ? new Date(this._assignedAt.getTime()) : null;
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
    acknowledgedAm: Date | null = null,
    acknowledgedBy: UserId | null = null,
    snoozedAt: Date | null = null,
    snoozedBy: UserId | null = null,
    snoozedUntil: Date | null = null,
    snoozeCount = 0,
    erledigtAm: Date | null = null,
    erledigtBy: UserId | null = null,
    erledigungsNotiz: string | null = null,
    requiresNote = Erinnerung.DEFAULT_REQUIRES_NOTE,
    assignedToId: UserId | null = null,
    assignedBy: UserId | null = null,
    assignedAt: Date | null = null,
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
    this._acknowledgedAm = acknowledgedAm;
    this._acknowledgedBy = acknowledgedBy;
    this._snoozedAt = snoozedAt;
    this._snoozedBy = snoozedBy;
    this._snoozedUntil = snoozedUntil;
    this._snoozeCount = snoozeCount;
    this._erledigtAm = erledigtAm;
    this._erledigtBy = erledigtBy;
    this._erledigungsNotiz = erledigungsNotiz;
    this._requiresNote = requiresNote;
    this._assignedToId = assignedToId;
    this._assignedBy = assignedBy;
    this._assignedAt = assignedAt;
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
      undefined, // createdAt
      undefined, // updatedAt
      false, // isDeleted
      null, // deletedAt
      null, // deletedBy
      null, // ausgeloestAm
      null, // acknowledgedAm
      null, // acknowledgedBy
      null, // snoozedAt
      null, // snoozedBy
      null, // snoozedUntil
      0, // snoozeCount
      null, // erledigtAm
      null, // erledigtBy
      null, // erledigungsNotiz
      props.requiresNote ?? Erinnerung.DEFAULT_REQUIRES_NOTE, // Story 2.6
      null, // assignedToId (Story 3.3)
      null, // assignedBy (Story 3.3)
      null, // assignedAt (Story 3.3)
    );

    // Emit Domain Event (Story 3.3: null für assignedToId bei Erstellung ohne Zuweisung)
    erinnerung.addDomainEvent(new ErinnerungErstelltEvent(idResult.value, props.einsatzId, titelResult.value.value, props.faelligAm, props.erstelltVon, null, idResult.value.toString()));

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
      props.acknowledgedAm ?? null,
      props.acknowledgedBy ?? null,
      props.snoozedAt ?? null,
      props.snoozedBy ?? null,
      props.snoozedUntil ?? null,
      props.snoozeCount ?? 0,
      props.erledigtAm ?? null,
      props.erledigtBy ?? null,
      props.erledigungsNotiz ?? null,
      props.requiresNote ?? Erinnerung.DEFAULT_REQUIRES_NOTE,
      props.assignedToId ?? null,
      props.assignedBy ?? null,
      props.assignedAt ?? null,
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
   * Löst eine geplante oder gesnoozede Erinnerung bei Fälligkeit aus.
   *
   * **Business Rules (Story 1.5 + Story 2.2):**
   * - Nur Erinnerungen mit Status GEPLANT oder SNOOZED können ausgelöst werden
   * - Bei anderen Status wird ein Fehler zurückgegeben
   * - Setzt Status auf AUSGELOEST und speichert/aktualisiert Auslösezeitpunkt
   * - Bei GEPLANT → Emittiert ErinnerungAusgeloestEvent (erster Trigger)
   * - Bei SNOOZED → Emittiert ErinnerungRetriggeredEvent (Re-Trigger nach Snooze)
   * - snoozeCount bleibt unverändert (wurde bereits bei Snooze erhöht)
   *
   * @returns Result<void> - Success oder Failure mit Error Code
   *
   * @example
   * ```typescript
   * // Erster Trigger (GEPLANT → AUSGELOEST)
   * const triggerResult = erinnerung.ausloesen();
   * if (triggerResult.isFailure) {
   *   console.log(triggerResult.error); // "ERINNERUNG_NOT_TRIGGERABLE"
   * }
   *
   * // Re-Trigger nach Snooze (SNOOZED → AUSGELOEST)
   * // Emittiert ErinnerungRetriggeredEvent mit snoozeCount
   * ```
   */
  public ausloesen(): Result<void> {
    // Business Rule: Nur GEPLANT oder SNOOZED Status kann ausgelöst werden (AC1 + Story 2.2)
    const isGeplant = this._status.isGeplant();
    const isSnoozed = this._status.isSnoozed();

    if (!isGeplant && !isSnoozed) {
      return Result.fail<void>('ERINNERUNG_NOT_TRIGGERABLE');
    }

    // Story 2.2: Detect Re-Trigger für unterschiedliches Event
    const isRetrigger = isSnoozed;
    const previousSnoozedAt = this._snoozedAt;

    // Status-Wechsel durchführen
    this._status = ErinnerungStatus.AUSGELOEST();
    this._ausgeloestAm = new Date();

    // Domain Event emittieren - unterschiedliches Event für Re-Trigger
    if (isRetrigger) {
      // Story 2.2: Re-Trigger nach Snooze - enthält Snooze-Historie für ETB
      this.addDomainEvent(new ErinnerungRetriggeredEvent(this.id, this._einsatzId, this._ausgeloestAm, this._titel.value, this._erstelltVon, this._snoozeCount, previousSnoozedAt, this.id.toString()));
    } else {
      // Story 1.5: Erster Trigger
      this.addDomainEvent(new ErinnerungAusgeloestEvent(this.id, this._einsatzId, this._ausgeloestAm, this._titel.value, this._erstelltVon, this.id.toString()));
    }

    return Result.ok<void>(undefined);
  }

  /**
   * Bestätigt eine ausgelöste Erinnerung (1-Tap Acknowledge).
   *
   * **Business Rules (Story 1.6):**
   * - Nur Erinnerungen mit Status AUSGELOEST können bestätigt werden
   * - Bei anderen Status wird ein Fehler zurückgegeben
   * - Setzt Status auf ACKNOWLEDGED und speichert Bestätigungszeitpunkt + User
   * - Emittiert ErinnerungAcknowledgedEvent für ETB-Integration und WebSocket
   *
   * @param acknowledgedBy - User der die Erinnerung bestätigt (für Audit-Trail)
   * @returns Result<void> - Success oder Failure mit Error Code
   *
   * @example
   * ```typescript
   * const acknowledgeResult = erinnerung.acknowledge(userId);
   * if (acknowledgeResult.isFailure) {
   *   // Nur AUSGELOEST kann acknowledged werden
   *   console.log(acknowledgeResult.error); // "ERINNERUNG_NOT_ACKNOWLEDGEABLE"
   * }
   * ```
   */
  public acknowledge(acknowledgedBy: UserId): Result<void> {
    // Business Rule: Nur AUSGELOEST oder ESKALIERT Status kann acknowledged werden
    if (!this._status.isAusgeloest() && !this._status.isEskaliert()) {
      return Result.fail<void>('ERINNERUNG_NOT_ACKNOWLEDGEABLE');
    }

    // Status-Wechsel durchführen
    this._status = ErinnerungStatus.ACKNOWLEDGED();
    this._acknowledgedAm = new Date();
    this._acknowledgedBy = acknowledgedBy;

    // Domain Event emittieren für ETB-Integration und WebSocket
    this.addDomainEvent(new ErinnerungAcknowledgedEvent(this.id, this._einsatzId, this._acknowledgedAm, this._acknowledgedBy, this._titel.value, this.id.toString()));

    return Result.ok<void>(undefined);
  }

  /**
   * Verschiebt eine ausgelöste Erinnerung (Snooze).
   *
   * **Business Rules (Story 2.1):**
   * - Nur Erinnerungen mit Status AUSGELOEST können gesnoozed werden
   * - Bei anderen Status wird ein Fehler zurückgegeben
   * - Setzt Status auf SNOOZED und aktualisiert faelligAm auf neue Zeit
   * - Speichert Snooze-Zeitpunkt, User und neue Fälligkeit für Audit-Trail
   * - Erhöht snoozeCount um 1
   * - Emittiert ErinnerungSnoozedEvent für ETB-Integration und WebSocket
   *
   * @param snoozedBy - User der die Erinnerung snoozed (für Audit-Trail)
   * @param snoozeMinutes - Snooze-Dauer in Minuten (1, 5, oder 10)
   * @returns Result<void> - Success oder Failure mit Error Code
   *
   * @example
   * ```typescript
   * const snoozeResult = erinnerung.snooze(userId, 5);
   * if (snoozeResult.isFailure) {
   *   // Nur AUSGELOEST kann gesnoozed werden
   *   console.log(snoozeResult.error); // "ERINNERUNG_NOT_SNOOZEABLE"
   * }
   * ```
   */
  public snooze(snoozedBy: UserId, snoozeMinutes: number): Result<void> {
    // Business Rule: Nur AUSGELOEST Status kann gesnoozed werden (AC2)
    if (!this._status.isAusgeloest()) {
      return Result.fail<void>('ERINNERUNG_NOT_SNOOZEABLE');
    }

    // Validiere snoozeMinutes (nur 1, 5, 10 erlaubt)
    const validMinutes = [1, 5, 10];
    if (!validMinutes.includes(snoozeMinutes)) {
      return Result.fail<void>('ERINNERUNG_SNOOZE_MINUTES_INVALID');
    }

    // Neue Fälligkeit berechnen
    const snoozedAt = new Date();
    const snoozedUntil = new Date(snoozedAt.getTime() + snoozeMinutes * 60 * 1000);

    // Status-Wechsel und Felder aktualisieren
    this._status = ErinnerungStatus.SNOOZED();
    this._snoozedAt = snoozedAt;
    this._snoozedBy = snoozedBy;
    this._snoozedUntil = snoozedUntil;
    this._snoozeCount = this._snoozeCount + 1;

    // faelligAm aktualisieren (für Re-Trigger in Story 2.2)
    this._faelligAm = snoozedUntil;

    // Domain Event emittieren für ETB-Integration und WebSocket
    this.addDomainEvent(new ErinnerungSnoozedEvent(this.id, this._einsatzId, snoozedAt, snoozedUntil, snoozedBy, snoozeMinutes, this._snoozeCount, this._titel.value, this.id.toString()));

    return Result.ok<void>(undefined);
  }

  /**
   * Markiert eine acknowledged oder eskalierte Erinnerung als erledigt.
   *
   * **Business Rules (Story 2.5):**
   * - Nur Erinnerungen mit Status ACKNOWLEDGED oder ESKALIERT können erledigt werden
   * - Bei anderen Status wird ein Fehler zurückgegeben
   * - Setzt Status auf ERLEDIGT und speichert Erledigungszeitpunkt + User
   * - Optional: Erledigungs-Notiz (max 500 Zeichen)
   * - Emittiert ErinnerungErledigtEvent für ETB-Integration
   *
   * @param erledigtBy - User der die Erinnerung erledigt (für Audit-Trail)
   * @param erledigungsNotiz - Optionale Notiz zur Erledigung (max 500 Zeichen)
   * @returns Result<void> - Success oder Failure mit Error Code
   *
   * @example
   * ```typescript
   * const erledigtResult = erinnerung.markErledigt(userId, 'Aufgabe abgeschlossen');
   * if (erledigtResult.isFailure) {
   *   // Nur ACKNOWLEDGED oder ESKALIERT kann erledigt werden
   *   console.log(erledigtResult.error); // "ERINNERUNG_NOT_COMPLETEABLE"
   * }
   * ```
   */
  public markErledigt(erledigtBy: UserId, erledigungsNotiz?: string): Result<void> {
    // Business Rule: Nur ACKNOWLEDGED oder ESKALIERT Status kann erledigt werden (AC3)
    const isAcknowledged = this._status.isAcknowledged();
    const isEskaliert = this._status.isEskaliert();

    if (!isAcknowledged && !isEskaliert) {
      return Result.fail<void>('ERINNERUNG_NOT_COMPLETEABLE');
    }

    // Story 2.6 (AC1, AC5): Pflicht-Notiz Validation bei aktiviertem Flag
    if (this._requiresNote) {
      if (!erledigungsNotiz || erledigungsNotiz.trim().length === 0) {
        return Result.fail<void>('ERINNERUNG_ERLEDIGUNGS_NOTIZ_REQUIRED');
      }
    }

    // Validiere Notiz (optional, max 500 Zeichen)
    let trimmedNotiz: string | null = null;
    if (erledigungsNotiz != null && erledigungsNotiz.trim().length > 0) {
      trimmedNotiz = erledigungsNotiz.trim();
      if (trimmedNotiz.length > Erinnerung.MAX_BESCHREIBUNG_LENGTH) {
        return Result.fail<void>('ERINNERUNG_NOTIZ_TOO_LONG');
      }
    }

    // Status-Wechsel durchführen
    this._status = ErinnerungStatus.ERLEDIGT();
    this._erledigtAm = new Date();
    this._erledigtBy = erledigtBy;
    this._erledigungsNotiz = trimmedNotiz;

    // Domain Event emittieren für ETB-Integration
    this.addDomainEvent(new ErinnerungErledigtEvent(this.id, this._einsatzId, this._erledigtAm, this._erledigtBy, this._titel.value, trimmedNotiz, this.id.toString()));

    return Result.ok<void>(undefined);
  }

  /**
   * Story 3.3: Weist die Erinnerung einem User zu.
   *
   * **Business Rules (Story 3.3/3.4):**
   * - Nur Erinnerungen mit Status GEPLANT oder AUSGELOEST können zugewiesen werden
   * - Bei anderen Status (ACKNOWLEDGED, ERLEDIGT, etc.) wird ein Fehler zurückgegeben
   * - Überschreibt vorherige Zuweisung (Re-Assignment erlaubt)
   * - Speichert assignedToId, assignedBy und assignedAt für Audit-Trail
   *
   * @param assignedToId - User dem die Erinnerung zugewiesen wird
   * @param assignedById - User der die Zuweisung vornimmt
   * @returns Result<void> - Success oder Failure mit Error Code
   *
   * @example
   * ```typescript
   * const assignResult = erinnerung.assignToUser(targetUserId, currentUserId);
   * if (assignResult.isFailure) {
   *   // Nur GEPLANT oder AUSGELOEST können zugewiesen werden
   *   console.log(assignResult.error); // "ERINNERUNG_NOT_ASSIGNABLE"
   * }
   * ```
   */
  public assignToUser(assignedToId: UserId, assignedById: UserId): Result<void> {
    // Invariante: Nur GEPLANT oder AUSGELOEST Erinnerungen können zugewiesen werden
    if (!this._status.isGeplant() && !this._status.isAusgeloest()) {
      return Result.fail<void>('ERINNERUNG_NOT_ASSIGNABLE');
    }

    this._assignedToId = assignedToId;
    this._assignedBy = assignedById;
    this._assignedAt = new Date();

    // Domain Event emittieren für ETB-Integration und WebSocket
    this.addDomainEvent(new ErinnerungAssignedEvent(this.id, this._einsatzId, assignedToId, assignedById, this._titel.value, this._assignedAt, this.id.toString()));

    return Result.ok<void>(undefined);
  }
}
