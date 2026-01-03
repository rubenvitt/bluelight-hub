import { AggregateRoot } from '@domain/common/aggregate-root';
import { Result } from '@domain/common/result';
import { isCuid } from '@paralleldrive/cuid2';
import { StammPersonCreatedEvent } from '../events/stamm-person-created.event';
import { StammPersonUpdatedEvent } from '../events/stamm-person-updated.event';
import { StammPersonId } from '../value-objects/stamm-person-id';
import {
  STAMM_PERSON_VORNAME_MIN_LENGTH,
  STAMM_PERSON_VORNAME_MAX_LENGTH,
  STAMM_PERSON_NACHNAME_MIN_LENGTH,
  STAMM_PERSON_NACHNAME_MAX_LENGTH,
  STAMM_PERSON_PERSONALNUMMER_MIN_LENGTH,
  STAMM_PERSON_PERSONALNUMMER_MAX_LENGTH,
  STAMM_PERSON_FUNKKENNUNG_BOS_MAX_LENGTH,
  STAMM_PERSON_VALIDATION_ERRORS,
} from '../constants/stamm-person-validation.constants';
import { STAMM_PERSON_ERROR_CODES, StammPersonError } from '../common/stamm-person-error-codes';

/**
 * Props für StammPerson.create() Factory Method.
 */
export interface CreateStammPersonProps {
  vorname: string;
  nachname: string;
  personalnummer: string;
  funkkenungBOS?: string;
  qualifikationIds?: string[]; // Array von Qualifikation IDs (CUID2)
  createdBy: string;
}

/**
 * Props für StammPerson.reconstitute() (Hydration aus DB).
 */
export interface ReconstituteStammPersonProps {
  id: string;
  vorname: string;
  nachname: string;
  personalnummer: string;
  funkkenungBOS?: string;
  qualifikationIds: string[]; // Array von Qualifikation IDs (aus M:N Join)
  archivedAt?: Date;
  archivedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
  // Story 7.2: Externe Integration Felder
  externalSource?: string;
  externalId?: string;
  lastSyncAt?: Date;
}

/**
 * Props für StammPerson.update() Method.
 */
export interface UpdateStammPersonProps {
  vorname?: string;
  nachname?: string;
  funkkenungBOS?: string;
  qualifikationIds?: string[]; // Vollständiger Ersatz (kein Delta!)
  updatedBy: string;
}

/**
 * StammPerson Aggregate Root.
 *
 * Repräsentiert eine Person im Stamm der Organisation (z.B. Mitarbeiter, Freiwillige).
 * Stamm-Personen können Qualifikationen besitzen und in Einsätzen eingesetzt werden.
 *
 * **Invarianten:**
 * - Vorname ist Pflichtfeld (min. 2 Zeichen)
 * - Nachname ist Pflichtfeld (min. 2 Zeichen)
 * - Personalnummer ist Pflichtfeld und muss UNIQUE sein (DB-Constraint)
 * - createdBy ist Pflichtfeld für Audit-Trail
 * - qualifikationIds sind CUIDs (validiert bei create/update)
 *
 * **Personalnummer Uniqueness:**
 * - Die Personalnummer MUSS unique sein (Datenbank-Constraint)
 * - WARUM wird Uniqueness NICHT im Aggregate enforced?
 *   1. **Aggregate Boundary:** Ein Aggregate kennt nur seinen eigenen State, nicht andere Aggregates
 *   2. **Performance:** Uniqueness-Check würde DB-Query in jedem create()/update() erfordern
 *   3. **Separation of Concerns:** Repository Layer ist verantwortlich für Persistence Constraints
 *   4. **Transaction Safety:** Uniqueness-Check + Insert MUSS atomar sein (Race Condition)
 * - LÖSUNG: Repository wirft bei Unique Constraint Violation einen Fehler
 * - Application Layer fängt diesen Fehler und returned Result.fail() mit User-Friendly Message
 *
 * **Qualifikationen (M:N Beziehung):**
 * - qualifikationIds ist ein Array von CUID2 Strings (nicht Value Objects)
 * - WARUM Array<string> statt Array<QualifikationId>?
 *   1. **Serialisierbarkeit:** Domain Events müssen JSON-serialisierbar sein
 *   2. **Simplicity:** Keine Konvertierung zwischen Value Objects und Primitives
 *   3. **Repository Pattern:** Prisma gibt IDs als Strings zurück
 * - IMMUTABILITY: qualifikationIds wird bei update() komplett ersetzt (kein Delta)
 * - VALIDATION: Prüft nur CUID2 Format, nicht Existenz (Repository/Handler verantwortlich)
 *
 * **Archive Pattern (Soft-Delete):**
 * - archivedAt/archivedBy statt isDeleted boolean
 * - WARUM? Timestamp + User-ID bieten mehr Kontext für Audit-Trail
 * - Archivierte Personen sind nicht mehr in Dropdown-Selects verfügbar
 * - Bestehende Zuweisungen (Einsätze) bleiben bei Archivierung erhalten
 *
 * **Optional Fields:**
 * - funkkenungBOS ist optional
 * - undefined = "nicht gesetzt" (semantisch unterschiedlich zu empty string)
 * - Validierung erfolgt nur wenn Feld gesetzt ist
 *
 * **Business Rules:**
 * - Archivierte Personen können reaktiviert werden (z.B. nach Wiedereinstellung)
 * - Qualifikationen können jederzeit geändert werden (vollständiger Ersatz)
 */
export class StammPerson extends AggregateRoot<StammPersonId> {
  private _vorname: string;
  private _nachname: string;
  private readonly _personalnummer: string; // IMMUTABLE nach Erstellung (wie Employee ID)
  private _funkkenungBOS?: string;
  private _qualifikationIds: string[]; // M:N Beziehung zu Qualifikationen
  private _archivedAt?: Date;
  private _archivedBy?: string;
  private _createdBy: string;
  private _updatedBy?: string;
  // Story 7.2: Externe Integration Felder
  private _externalSource?: string;
  private _externalId?: string;
  private _lastSyncAt?: Date;

  private constructor(
    id: StammPersonId,
    vorname: string,
    nachname: string,
    personalnummer: string,
    qualifikationIds: string[],
    createdBy: string,
    funkkenungBOS?: string,
    archivedAt?: Date,
    archivedBy?: string,
    createdAt?: Date,
    updatedAt?: Date,
    updatedBy?: string,
    externalSource?: string,
    externalId?: string,
    lastSyncAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
    this._vorname = vorname;
    this._nachname = nachname;
    this._personalnummer = personalnummer;
    this._funkkenungBOS = funkkenungBOS;
    this._qualifikationIds = qualifikationIds;
    this._archivedAt = archivedAt;
    this._archivedBy = archivedBy;
    this._createdBy = createdBy;
    this._updatedBy = updatedBy;
    this._externalSource = externalSource;
    this._externalId = externalId;
    this._lastSyncAt = lastSyncAt;
  }

  // ============ Getters ============

  /**
   * Gibt den Vornamen der Person zurück.
   *
   * **WARUM als public getter exponiert?**
   * - **Display Name:** Teil des vollständigen Namens in UI
   * - **Read-Only Access:** DTOs serialisieren Vorname für API-Responses
   * - **Encapsulation:** Direkter Zugriff auf `_vorname` würde Invarianten-Verletzung ermöglichen
   */
  get vorname(): string {
    return this._vorname;
  }

  /**
   * Gibt den Nachnamen der Person zurück.
   *
   * **WARUM als public getter exponiert?**
   * - **Display Name:** Teil des vollständigen Namens in UI
   * - **Read-Only Access:** DTOs serialisieren Nachname für API-Responses
   * - **Encapsulation:** Direkter Zugriff auf `_nachname` würde Invarianten-Verletzung ermöglichen
   */
  get nachname(): string {
    return this._nachname;
  }

  /**
   * Gibt die Personalnummer zurück (IMMUTABLE).
   *
   * **WARUM IMMUTABLE?**
   * - Personalnummer ist wie Employee ID - fundamentale Eigenschaft
   * - Externe Systeme (HR, Zeiterfassung) referenzieren diese ID
   * - Bei Personalnummer-Änderung muss neue StammPerson erstellt werden
   * - Business Rule: update() Method MUSS Änderung ablehnen (Result.fail)
   */
  get personalnummer(): string {
    return this._personalnummer;
  }

  /**
   * Gibt die optionale BOS-Funkkennung zurück.
   */
  get funkkenungBOS(): string | undefined {
    return this._funkkenungBOS;
  }

  /**
   * Gibt die Qualifikation-IDs zurück (M:N Beziehung).
   *
   * **WARUM Array Copy?**
   * - Verhindert externe Mutation des internen Arrays
   * - Aggregate Encapsulation: Änderungen nur via update() erlaubt
   * - Performance: Shallow Copy ist O(n) aber Array ist klein (< 20 Qualifikationen)
   */
  get qualifikationIds(): string[] {
    return [...this._qualifikationIds];
  }

  /**
   * Gibt zurück, ob die Person archiviert ist.
   *
   * **WARUM Soft-Delete statt Hard-Delete?**
   * - **Data Integrity:** Bestehende Zuweisungen (Einsätze) bleiben gültig
   * - **Audit-Trail:** Historische Daten referenzieren archivierte Personen
   * - **Reversibility:** Reaktivierung ist möglich (z.B. nach Wiedereinstellung)
   * - **UI Filtering:** Frontend kann aktive/archivierte Personen unterschiedlich darstellen
   */
  get isArchived(): boolean {
    return this._archivedAt !== undefined;
  }

  /**
   * Gibt den Zeitpunkt der Archivierung zurück.
   */
  get archivedAt(): Date | undefined {
    return this._archivedAt;
  }

  /**
   * Gibt die User-ID des Archivierenden zurück.
   */
  get archivedBy(): string | undefined {
    return this._archivedBy;
  }

  /**
   * Gibt die User-ID des Erstellers zurück (für Audit-Trail).
   */
  get createdBy(): string {
    return this._createdBy;
  }

  /**
   * Gibt die User-ID des letzten Bearbeiters zurück (für Audit-Trail).
   */
  get updatedBy(): string | undefined {
    return this._updatedBy;
  }

  // ============ External Integration Getters (Story 7.2) ============

  /**
   * Gibt die externe Quelle zurück (z.B. "HIORG_SERVER").
   *
   * **Use Case:** Import aus externem System erfordert Tracking der Herkunft.
   */
  get externalSource(): string | undefined {
    return this._externalSource;
  }

  /**
   * Gibt die externe ID zurück (z.B. HiOrg Username).
   *
   * **Use Case:** Für Re-Sync / Update von externen Datenquellen.
   */
  get externalId(): string | undefined {
    return this._externalId;
  }

  /**
   * Gibt den letzten Sync-Zeitpunkt zurück.
   *
   * **Use Case:** Erkennung ob Daten veraltet sind.
   */
  get lastSyncAt(): Date | undefined {
    return this._lastSyncAt;
  }

  /**
   * Prüft ob die Person aus einer externen Quelle importiert wurde.
   */
  get isExternallyManaged(): boolean {
    return this._externalSource !== undefined && this._externalId !== undefined;
  }

  // ============ Private Helper Methods ============

  /**
   * Validiert ein Array von Qualifikation-IDs.
   *
   * **Validierungsregeln:**
   * - Alle IDs müssen gültige CUID2 Strings sein
   * - Array darf keine Duplikate enthalten
   * - Array kann leer sein (Person ohne Qualifikationen)
   *
   * **WARUM wird Existenz der Qualifikationen NICHT geprüft?**
   * - Aggregate Boundary: StammPerson kennt keine Qualifikationen
   * - Repository/Handler Verantwortung: Muss Referential Integrity prüfen
   * - Performance: DB-Query pro Qualifikation wäre zu teuer
   *
   * @param qualifikationIds - Das zu validierende Array
   * @returns Result<void> - Success oder Failure mit Fehlermeldung
   */
  private static validateQualifikationIds(qualifikationIds: string[]): Result<void> {
    // Validiere alle IDs (CUID2 Format)
    for (const id of qualifikationIds) {
      if (!isCuid(id)) {
        return Result.fail<void>(`Ungültige Qualifikation-ID: ${id} (kein gültiger CUID2)`);
      }
    }

    // Prüfe auf Duplikate
    const uniqueIds = new Set(qualifikationIds);
    if (uniqueIds.size !== qualifikationIds.length) {
      return Result.fail<void>('Qualifikation-IDs enthalten Duplikate');
    }

    return Result.ok<void>(undefined);
  }

  // ============ Factory Methods ============

  /**
   * Factory Method für neue Stamm-Person mit Validation.
   *
   * Emittiert StammPersonCreatedEvent bei erfolgreicher Erstellung.
   *
   * @param props - CreateStammPersonProps mit Pflichtfeldern
   * @returns Result<StammPerson> - Success oder Failure mit Fehlermeldung
   */
  static create(props: CreateStammPersonProps): Result<StammPerson> {
    // Validation: Vorname
    const trimmedVorname = props.vorname?.trim() ?? '';
    if (trimmedVorname.length < STAMM_PERSON_VORNAME_MIN_LENGTH) {
      return Result.fail<StammPerson>(STAMM_PERSON_VALIDATION_ERRORS.VORNAME_TOO_SHORT);
    }
    if (trimmedVorname.length > STAMM_PERSON_VORNAME_MAX_LENGTH) {
      return Result.fail<StammPerson>(STAMM_PERSON_VALIDATION_ERRORS.VORNAME_TOO_LONG);
    }

    // Validation: Nachname
    const trimmedNachname = props.nachname?.trim() ?? '';
    if (trimmedNachname.length < STAMM_PERSON_NACHNAME_MIN_LENGTH) {
      return Result.fail<StammPerson>(STAMM_PERSON_VALIDATION_ERRORS.NACHNAME_TOO_SHORT);
    }
    if (trimmedNachname.length > STAMM_PERSON_NACHNAME_MAX_LENGTH) {
      return Result.fail<StammPerson>(STAMM_PERSON_VALIDATION_ERRORS.NACHNAME_TOO_LONG);
    }

    // Validation: Personalnummer (Required)
    const trimmedPersonalnummer = props.personalnummer?.trim() ?? '';
    if (trimmedPersonalnummer.length < STAMM_PERSON_PERSONALNUMMER_MIN_LENGTH) {
      return Result.fail<StammPerson>(STAMM_PERSON_VALIDATION_ERRORS.PERSONALNUMMER_TOO_SHORT);
    }
    if (trimmedPersonalnummer.length > STAMM_PERSON_PERSONALNUMMER_MAX_LENGTH) {
      return Result.fail<StammPerson>(STAMM_PERSON_VALIDATION_ERRORS.PERSONALNUMMER_TOO_LONG);
    }

    // Validation: FunkkenungBOS (optional, aber wenn gesetzt dann max length)
    let trimmedFunkkenungBOS: string | undefined = props.funkkenungBOS?.trim();
    if (trimmedFunkkenungBOS && trimmedFunkkenungBOS.length > STAMM_PERSON_FUNKKENNUNG_BOS_MAX_LENGTH) {
      return Result.fail<StammPerson>(STAMM_PERSON_VALIDATION_ERRORS.FUNKKENNUNG_BOS_TOO_LONG);
    }
    // Empty string nach trim() wird undefined
    if (trimmedFunkkenungBOS !== undefined && trimmedFunkkenungBOS.length === 0) {
      trimmedFunkkenungBOS = undefined;
    }

    // Validation: QualifikationIds (optional, aber wenn gesetzt dann validiert)
    const qualifikationIds = props.qualifikationIds ?? [];
    if (qualifikationIds.length > 0) {
      const qualifikationValidation = StammPerson.validateQualifikationIds(qualifikationIds);
      if (qualifikationValidation.isFailure) {
        return Result.fail<StammPerson>(qualifikationValidation.error ?? 'Ungültige Qualifikation-IDs');
      }
    }

    // Validation: createdBy (CUID2 Format)
    const trimmedCreatedBy = props.createdBy?.trim() ?? '';
    if (trimmedCreatedBy.length === 0) {
      return Result.fail<StammPerson>('createdBy ist erforderlich für Audit-Trail');
    }
    if (!isCuid(trimmedCreatedBy)) {
      return Result.fail<StammPerson>('createdBy muss ein gültiger CUID2-Identifier sein');
    }

    // Create ID
    const idResult = StammPersonId.create();
    if (idResult.isFailure) {
      return Result.fail<StammPerson>(idResult.error ?? 'Fehler bei ID-Generierung');
    }

    const id = idResult.value;
    if (!id) {
      return Result.fail<StammPerson>('Fehler bei ID-Generierung');
    }

    // Create Aggregate
    const stammPerson = new StammPerson(id, trimmedVorname, trimmedNachname, trimmedPersonalnummer, qualifikationIds, trimmedCreatedBy, trimmedFunkkenungBOS);

    // Emit Domain Event (mit primitiven Werten für Serialisierbarkeit)
    stammPerson.addDomainEvent(new StammPersonCreatedEvent(id.value, stammPerson.vorname, stammPerson.nachname, stammPerson.personalnummer, stammPerson.createdBy));

    return Result.ok<StammPerson>(stammPerson);
  }

  /**
   * Reconstitute Method für Hydration aus Datenbank.
   *
   * Verwendet wenn Aggregate aus Prisma geladen wird.
   *
   * **WARUM wird hier KEINE Validation durchgeführt?**
   * - **Trusted Source:** Daten kommen aus der Datenbank und wurden bereits bei create()/update() validiert
   * - **Performance:** Validation bei jedem DB-Read würde die Ladezeit signifikant erhöhen
   * - **Datenintegrität:** DB-Constraints (NOT NULL, CHECK, max length) garantieren Konsistenz
   * - **Historische Daten:** Alte Datensätze könnten neue Validationsregeln verletzen (Breaking Change)
   *
   * **Konsequenz:** Bei korrupten DB-Daten (manueller DB-Eingriff) kann Aggregate inkonsistent sein.
   * **Mitigation:** Repository Layer sollte bei kritischen Operationen Sanity-Checks durchführen.
   *
   * **WARUM wird hier trim() angewendet?**
   * - **Konsistenz:** create() trimmt Eingaben, reconstitute() sollte gleiches Verhalten haben
   * - **Defense in Depth:** Falls DB-Migration oder manueller Eingriff Whitespace einfügt
   * - **Minimal Overhead:** trim() auf Strings ist performant und verhindert Edge-Cases
   *
   * Keine Domain Events (historische Daten, nicht neu erstellt).
   *
   * @param props - ReconstituteStammPersonProps mit allen DB-Feldern
   * @returns Result<StammPerson>
   */
  static reconstitute(props: ReconstituteStammPersonProps): Result<StammPerson> {
    const idResult = StammPersonId.create(props.id);
    if (idResult.isFailure) {
      return Result.fail<StammPerson>('Ungültige ID');
    }

    const id = idResult.value;
    if (!id) {
      return Result.fail<StammPerson>('Ungültige ID');
    }

    // Minimal validation für DB-Daten (Defense in Depth)
    if (props.qualifikationIds.length > 0) {
      const qualifikationValidation = StammPerson.validateQualifikationIds(props.qualifikationIds);
      if (qualifikationValidation.isFailure) {
        return Result.fail<StammPerson>(`Korrupte Qualifikation-IDs in DB-Daten: ${qualifikationValidation.error}`);
      }
    }

    // Trim für Konsistenz mit create()
    const trimmedFunkkenungBOS = props.funkkenungBOS?.trim();
    const funkkenungBOS = trimmedFunkkenungBOS && trimmedFunkkenungBOS.length > 0 ? trimmedFunkkenungBOS : undefined;

    return Result.ok<StammPerson>(
      new StammPerson(
        id,
        props.vorname.trim(),
        props.nachname.trim(),
        props.personalnummer.trim(),
        props.qualifikationIds, // Already validated
        props.createdBy.trim(),
        funkkenungBOS,
        props.archivedAt,
        props.archivedBy?.trim(),
        props.createdAt,
        props.updatedAt,
        props.updatedBy?.trim(),
        // Story 7.2: Externe Integration Felder
        props.externalSource?.trim(),
        props.externalId?.trim(),
        props.lastSyncAt,
      ),
    );
  }

  // ============ Business Methods ============

  /**
   * Aktualisiert die Stamm-Person mit den angegebenen Feldern.
   *
   * **KRITISCH:** personalnummer kann NICHT geändert werden (IMMUTABLE).
   *
   * **WICHTIG:** qualifikationIds wird komplett ersetzt (kein Delta!).
   * Wenn qualifikationIds gesetzt ist, werden ALLE alten Qualifikationen überschrieben.
   *
   * Emittiert StammPersonUpdatedEvent mit den geänderten Feldern.
   *
   * @param props - UpdateStammPersonProps mit zu ändernden Feldern
   * @returns Result<void> - Success oder Failure
   */
  update(props: UpdateStammPersonProps): Result<void> {
    const changes: Partial<Omit<UpdateStammPersonProps, 'updatedBy'>> = {};

    // Validation und Update: Vorname
    if (props.vorname !== undefined) {
      const trimmedVorname = props.vorname.trim();
      if (trimmedVorname.length < STAMM_PERSON_VORNAME_MIN_LENGTH) {
        return Result.fail<void>(STAMM_PERSON_VALIDATION_ERRORS.VORNAME_TOO_SHORT);
      }
      if (trimmedVorname.length > STAMM_PERSON_VORNAME_MAX_LENGTH) {
        return Result.fail<void>(STAMM_PERSON_VALIDATION_ERRORS.VORNAME_TOO_LONG);
      }
      this._vorname = trimmedVorname;
      changes.vorname = this._vorname;
    }

    // Validation und Update: Nachname
    if (props.nachname !== undefined) {
      const trimmedNachname = props.nachname.trim();
      if (trimmedNachname.length < STAMM_PERSON_NACHNAME_MIN_LENGTH) {
        return Result.fail<void>(STAMM_PERSON_VALIDATION_ERRORS.NACHNAME_TOO_SHORT);
      }
      if (trimmedNachname.length > STAMM_PERSON_NACHNAME_MAX_LENGTH) {
        return Result.fail<void>(STAMM_PERSON_VALIDATION_ERRORS.NACHNAME_TOO_LONG);
      }
      this._nachname = trimmedNachname;
      changes.nachname = this._nachname;
    }

    // Validation und Update: FunkkenungBOS (optional)
    if (props.funkkenungBOS !== undefined) {
      const trimmedFunkkenungBOS = props.funkkenungBOS.trim();
      if (trimmedFunkkenungBOS.length > STAMM_PERSON_FUNKKENNUNG_BOS_MAX_LENGTH) {
        return Result.fail<void>(STAMM_PERSON_VALIDATION_ERRORS.FUNKKENNUNG_BOS_TOO_LONG);
      }
      this._funkkenungBOS = trimmedFunkkenungBOS.length > 0 ? trimmedFunkkenungBOS : undefined;
      changes.funkkenungBOS = this._funkkenungBOS;
    }

    // Validation und Update: QualifikationIds (vollständiger Ersatz!)
    if (props.qualifikationIds !== undefined) {
      if (props.qualifikationIds.length > 0) {
        const qualifikationValidation = StammPerson.validateQualifikationIds(props.qualifikationIds);
        if (qualifikationValidation.isFailure) {
          return Result.fail<void>(qualifikationValidation.error ?? 'Ungültige Qualifikation-IDs');
        }
      }
      this._qualifikationIds = [...props.qualifikationIds]; // Copy Array für Immutability
      changes.qualifikationIds = this._qualifikationIds;
    }

    // Validation: updatedBy (Pflichtfeld, CUID2 Format)
    const trimmedUpdatedBy = props.updatedBy?.trim() ?? '';
    if (trimmedUpdatedBy.length === 0) {
      return Result.fail<void>('updatedBy ist erforderlich für Audit-Trail');
    }
    if (!isCuid(trimmedUpdatedBy)) {
      return Result.fail<void>('updatedBy muss ein gültiger CUID2-Identifier sein');
    }
    this._updatedBy = trimmedUpdatedBy;

    // Update Timestamp (nur wenn Änderungen)
    if (Object.keys(changes).length > 0) {
      this.updateTimestamp();
      this.addDomainEvent(new StammPersonUpdatedEvent(this.id.value, changes, this._updatedBy));
    }

    return Result.ok<void>(undefined);
  }

  /**
   * Archiviert die Stamm-Person (Soft-Delete Pattern).
   *
   * Archivierte Personen sind nicht mehr in Dropdown-Selects verfügbar,
   * bestehende Zuweisungen (Einsätze) bleiben aber erhalten.
   *
   * @param archivedBy - User ID für Audit-Trail
   * @returns Result<void>
   */
  archive(archivedBy: string): Result<void> {
    if (this.isArchived) {
      return Result.fail<void>(StammPersonError.format(STAMM_PERSON_ERROR_CODES.ALREADY_ARCHIVED, 'Person ist bereits archiviert'));
    }

    // Validation: archivedBy (CUID2 Format)
    const trimmedArchivedBy = archivedBy?.trim() ?? '';
    if (trimmedArchivedBy.length === 0) {
      return Result.fail<void>('archivedBy ist erforderlich für Audit-Trail');
    }
    if (!isCuid(trimmedArchivedBy)) {
      return Result.fail<void>('archivedBy muss ein gültiger CUID2-Identifier sein');
    }

    this._archivedAt = new Date();
    this._archivedBy = trimmedArchivedBy;
    this._updatedBy = trimmedArchivedBy;
    this.updateTimestamp();

    // Emit Domain Event (archivieren ist eine bedeutende State-Änderung)
    this.addDomainEvent(
      new StammPersonUpdatedEvent(
        this.id.value,
        {
          archived: true, // Signalisiert Event-Handlern dass dies eine Archivierung ist
        },
        trimmedArchivedBy,
      ),
    );

    return Result.ok<void>(undefined);
  }

  /**
   * Reaktiviert eine archivierte Stamm-Person.
   *
   * Entfernt archivedAt/archivedBy Felder und macht Person wieder verfügbar.
   *
   * @param restoredBy - User ID für Audit-Trail
   * @returns Result<void>
   */
  restore(restoredBy: string): Result<void> {
    if (!this.isArchived) {
      return Result.fail<void>(StammPersonError.format(STAMM_PERSON_ERROR_CODES.NOT_ARCHIVED, 'Person ist nicht archiviert und kann daher nicht reaktiviert werden'));
    }

    // Validation: restoredBy (CUID2 Format)
    const trimmedRestoredBy = restoredBy?.trim() ?? '';
    if (trimmedRestoredBy.length === 0) {
      return Result.fail<void>('restoredBy ist erforderlich für Audit-Trail');
    }
    if (!isCuid(trimmedRestoredBy)) {
      return Result.fail<void>('restoredBy muss ein gültiger CUID2-Identifier sein');
    }

    this._archivedAt = undefined;
    this._archivedBy = undefined;
    this._updatedBy = trimmedRestoredBy;
    this.updateTimestamp();

    // Emit Domain Event (reaktivieren ist eine bedeutende State-Änderung)
    this.addDomainEvent(
      new StammPersonUpdatedEvent(
        this.id.value,
        {
          archived: false, // Signalisiert Event-Handlern dass dies eine Reaktivierung ist
        },
        trimmedRestoredBy,
      ),
    );

    return Result.ok<void>(undefined);
  }

  // ============ External Integration Methods (Story 7.2) ============

  /**
   * Setzt die externe Synchronisations-Informationen.
   *
   * Wird aufgerufen wenn Person aus externer Quelle (z.B. HiOrg-Server) importiert wird.
   *
   * **Use Cases:**
   * - Initiales Import: externalSource + externalId werden gesetzt
   * - Re-Sync: lastSyncAt wird aktualisiert
   *
   * @param externalSource - Externe Quelle (z.B. "HIORG_SERVER")
   * @param externalId - Externe ID (z.B. HiOrg username)
   * @param syncedBy - User ID für Audit-Trail
   * @returns Result<void>
   */
  markAsSynced(externalSource: string, externalId: string, syncedBy: string): Result<void> {
    // Validation
    const trimmedSource = externalSource?.trim() ?? '';
    if (trimmedSource.length === 0) {
      return Result.fail<void>('externalSource ist erforderlich');
    }

    const trimmedExternalId = externalId?.trim() ?? '';
    if (trimmedExternalId.length === 0) {
      return Result.fail<void>('externalId ist erforderlich');
    }

    const trimmedSyncedBy = syncedBy?.trim() ?? '';
    if (!isCuid(trimmedSyncedBy)) {
      return Result.fail<void>('syncedBy muss ein gültiger CUID2-Identifier sein');
    }

    this._externalSource = trimmedSource;
    this._externalId = trimmedExternalId;
    this._lastSyncAt = new Date();
    this._updatedBy = trimmedSyncedBy;
    this.updateTimestamp();

    return Result.ok<void>(undefined);
  }

  /**
   * Aktualisiert nur den lastSyncAt Timestamp.
   *
   * Wird bei Re-Sync aufgerufen wenn keine Datenänderungen vorliegen.
   *
   * @param syncedBy - User ID für Audit-Trail
   * @returns Result<void>
   */
  updateLastSync(syncedBy: string): Result<void> {
    if (!this.isExternallyManaged) {
      return Result.fail<void>('Person ist nicht extern verwaltet');
    }

    const trimmedSyncedBy = syncedBy?.trim() ?? '';
    if (!isCuid(trimmedSyncedBy)) {
      return Result.fail<void>('syncedBy muss ein gültiger CUID2-Identifier sein');
    }

    this._lastSyncAt = new Date();
    this._updatedBy = trimmedSyncedBy;
    this.updateTimestamp();

    return Result.ok<void>(undefined);
  }
}
