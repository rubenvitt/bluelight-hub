import { AggregateRoot } from '@domain/common/aggregate-root';
import { Result } from '@domain/common/result';
import { EtbEintrag } from '@domain/entities/etb-eintrag.entity';
import { EintragAddedEvent } from '@domain/events/eintrag-added.event';
import { EintragDeletedEvent } from '@domain/events/eintrag-deleted.event';
import { EintragUpdatedEvent } from '@domain/events/eintrag-updated.event';
import { EtbLockedEvent } from '@domain/events/etb-locked.event';
import type { EinsatzId } from '@domain/value-objects/einsatz-id';
import { EintragId } from '@domain/value-objects/eintrag-id';
import { EtbId } from '@domain/value-objects/etb-id';
import { EtbSequenceNumber } from '@domain/value-objects/etb-sequence-number';
import { EtbStatus } from '@domain/value-objects/etb-status';
import { EtbVersion } from '@domain/value-objects/etb-version';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Einsatztagebuch (ETB) Aggregate Root mit Business Logic für Entry Management.
 *
 * Dieses Aggregate modelliert das Einsatztagebuch als zentrale Datenstruktur
 * für die chronologische Dokumentation von Einsatzabläufen. Es erzwingt
 * DRK-konforme Workflows und garantiert Revisionssicherheit durch Soft-Deletes,
 * Versionierung und irreversible Sperrung nach Abschluss.
 *
 * **Aggregate Boundaries:**
 * - Aggregate Root: EinsatztagebuchAggregate (dieses Entity)
 * - Child Entities: EtbEintrag[] (verwaltet durch dieses Aggregate)
 * - Foreign Aggregate Reference: EinsatzId (1:1 Beziehung)
 * - Transactional Boundary: Ein ETB = eine Transaktion (konsistente State Changes)
 *
 * **Versionierungs-Strategie:**
 * - Jede Änderung (add/update/delete) inkrementiert die Version
 * - Version enthält monoton steigende Nummer + Timestamp
 * - Snapshots werden automatisch vom Repository erstellt (Epic 4)
 * - Optimistic Locking verhindert Concurrent Modification Conflicts
 *
 * **State Machine (Status):**
 * - DRAFT → ACTIVE → LOCKED (nur Vorwärts-Transitions)
 * - LOCKED ist final: Keine weiteren Änderungen möglich (DRK-Compliance)
 * - Business Methods validieren LOCKED-Status vor Änderungen
 *
 * **Soft-Delete Pattern:**
 * - Einträge werden NICHT physisch gelöscht (bleiben in eintraege[])
 * - Stattdessen: isDeleted=true Flag für Audit-Trail
 * - Garantiert lückenlose Historie für DRK-Compliance
 * - Sequenznummern bleiben stabil (keine Gaps nach Deletes)
 *
 * **Business Rules:**
 * 1. Sequence Numbers sind unveränderlich und monoton steigend (ab 1)
 * 2. Versionierung bei JEDER Änderung (add/update/delete)
 * 3. Locked = Immutable (alle Modification Methods returnen Result.fail())
 * 4. Soft-Delete für Compliance (gelöschte Einträge bleiben in Historie)
 * 5. Forward-Only Status Transitions (DRAFT → ACTIVE → LOCKED)
 *
 * **Design Patterns:**
 * - DDD Aggregate Pattern: Transactional Consistency Boundary
 * - Event Sourcing: Domain Events für alle State Changes
 * - Result<T> Pattern: Explizite Fehlerbehandlung ohne Exceptions
 * - Factory Method: Static create() erzwingt Validation
 *
 * @example
 * ```typescript
 * // Create new ETB (Factory Method)
 * const einsatzId = EinsatzId.create('existing-einsatz-id').value;
 * const result = EinsatztagebuchAggregate.create(einsatzId);
 * if (result.isSuccess) {
 *   const etb = result.value;
 *
 *   // Add entry
 *   const addResult = etb.addEintrag('Fahrzeug W1 eingetroffen', userId);
 *   console.log(etb.version.versionNumber); // 2 (incremented)
 *
 *   // Update entry
 *   etb.updateEintrag(eintragId, 'Fahrzeug W1 um 14:30 Uhr eingetroffen', userId);
 *   console.log(etb.version.versionNumber); // 3
 *
 *   // Lock ETB (irreversible)
 *   etb.lock(userId);
 *   const failResult = etb.addEintrag('Text', userId); // Fail: ETB locked
 * }
 * ```
 */
export class EinsatztagebuchAggregate extends AggregateRoot<EtbId> {
  /**
   * Foreign Aggregate Reference: ID des zugehörigen Einsatzes.
   * 1:1 Beziehung: Ein Einsatz hat maximal ein ETB.
   */
  private _einsatzId: EinsatzId;

  /**
   * Status des ETB (State Machine: DRAFT → ACTIVE → LOCKED).
   */
  private _status: EtbStatus;

  /**
   * Liste aller Einträge (inkl. soft-deleted).
   * Ordered by sequenceNumber for chronological display.
   * WICHTIG: Gelöschte Einträge bleiben in Array (isDeleted=true).
   */
  private _eintraege: EtbEintrag[];

  /**
   * Version für Optimistic Locking und Audit-Trail.
   * Wird bei jeder Änderung inkrementiert.
   */
  private _version: EtbVersion;

  /**
   * Private Counter für auto-increment Sequenznummern.
   * Startet bei 1, inkrementiert bei jedem addEintrag().
   */
  private _nextSequenceNumber: number;

  /**
   * Protected Constructor verhindert direkte Instanziierung.
   * Erzwingt Verwendung von Factory Methods (create(), reconstitute()).
   *
   * @param id - ETB Aggregate ID
   * @param einsatzId - Foreign Aggregate Reference
   * @param status - ETB Status (State Machine)
   * @param eintraege - Liste aller Einträge (inkl. deleted)
   * @param version - Version für Optimistic Locking
   * @param nextSequenceNumber - Counter für neue Einträge
   * @param createdAt - Optional: Creation timestamp
   * @param updatedAt - Optional: Last update timestamp
   */
  protected constructor(id: EtbId, einsatzId: EinsatzId, status: EtbStatus, eintraege: EtbEintrag[], version: EtbVersion, nextSequenceNumber: number, createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt);
    this._einsatzId = einsatzId;
    this._status = status;
    this._eintraege = eintraege;
    this._version = version;
    this._nextSequenceNumber = nextSequenceNumber;
  }

  /**
   * Readonly getter für Einsatz ID (Foreign Aggregate Reference).
   */
  get einsatzId(): EinsatzId {
    return this._einsatzId;
  }

  /**
   * Readonly getter für ETB Status.
   */
  get status(): EtbStatus {
    return this._status;
  }

  /**
   * Readonly getter für Einträge.
   * CRITICAL: Returns shallow copy für Mutation-Safety!
   * Verhindert dass Caller die interne _eintraege Liste direkt mutiert.
   */
  get eintraege(): EtbEintrag[] {
    return [...this._eintraege];
  }

  /**
   * Readonly getter für Version.
   */
  get version(): EtbVersion {
    return this._version;
  }

  /**
   * Static Factory Method für neues ETB Aggregate.
   *
   * Diese Methode erstellt ein neues ETB mit initialen Defaults:
   * - Auto-generierte EtbId (nanoid)
   * - Status = DRAFT (erster Zustand der State Machine)
   * - Version = 1 (initiale Version)
   * - nextSequenceNumber = 1 (erste Sequenznummer)
   * - Leere eintraege Liste
   *
   * Warum Factory Method?
   * - Erzwingt Validation vor Construction (Result<T> Pattern)
   * - Encapsulates Creation Logic (DDD Pattern)
   * - Type-Safe: EinsatzId muss existieren (Foreign Aggregate Check)
   *
   * @param einsatzId - ID des zugehörigen Einsatzes (Foreign Aggregate Reference)
   * @returns Result<EinsatztagebuchAggregate> - Success mit Aggregate oder Failure mit Error
   */
  static create(einsatzId: EinsatzId): Result<EinsatztagebuchAggregate> {
    // Validate: EinsatzId must be provided
    if (!einsatzId) {
      return Result.fail<EinsatztagebuchAggregate>('EinsatzId is required to create ETB');
    }

    // Auto-generate ETB ID
    const idResult = EtbId.create();
    if (idResult.isFailure) {
      return Result.fail<EinsatztagebuchAggregate>(idResult.error!);
    }

    // Create initial version
    const versionResult = EtbVersion.create(1);
    if (versionResult.isFailure) {
      return Result.fail<EinsatztagebuchAggregate>(versionResult.error!);
    }

    // Create aggregate with initial state
    const aggregate = new EinsatztagebuchAggregate(
      idResult.value!,
      einsatzId,
      EtbStatus.DRAFT(), // Initial status
      [], // Empty entries list
      versionResult.value!, // Version 1
      1, // Next sequence number starts at 1
    );

    return Result.ok<EinsatztagebuchAggregate>(aggregate);
  }

  /**
   * Prüft ob das ETB gesperrt ist.
   *
   * Diese Helper-Methode wird von allen Business Methods verwendet um
   * Änderungen an gesperrten ETBs zu verhindern (Immutability nach Lock).
   *
   * @returns true wenn Status === LOCKED, false sonst
   */
  public isLocked(): boolean {
    return this._status.equals(EtbStatus.LOCKED());
  }

  /**
   * Fügt einen neuen Eintrag zum ETB hinzu.
   *
   * Diese Methode implementiert die komplette Business Logic für Entry Creation:
   * - Validiert dass ETB nicht gesperrt ist
   * - Validiert dass Text nicht leer ist
   * - Erstellt EtbEintrag mit auto-inkrementierter Sequenznummer
   * - Inkrementiert Version (Optimistic Locking)
   * - Emittiert EintragAddedEvent (Event Sourcing)
   *
   * Warum auto-increment Sequenznummern?
   * - Garantiert lückenlose chronologische Sortierung
   * - Unveränderlich nach Zuweisung (Immutability)
   * - Stabil auch bei Soft-Deletes (keine Gaps)
   *
   * @param text - Textinhalt des Eintrags (darf nicht leer sein)
   * @param userId - User ID des Erstellers (für Audit-Trail)
   * @returns Result<EtbEintrag> - Success mit erstelltem Eintrag oder Failure mit Error
   */
  public addEintrag(text: string, userId: UserId): Result<EtbEintrag> {
    // Validate: ETB must not be locked
    if (this.isLocked()) {
      return Result.fail<EtbEintrag>('ETB ist gesperrt und kann nicht mehr geändert werden');
    }

    // Validate: Text must not be empty
    if (!text?.trim()) {
      return Result.fail<EtbEintrag>('Text darf nicht leer sein');
    }

    // Create entry ID
    const idResult = EintragId.create();
    if (idResult.isFailure) {
      return Result.fail<EtbEintrag>(idResult.error!);
    }

    // Create sequence number (auto-incremented)
    const seqResult = EtbSequenceNumber.create(this._nextSequenceNumber);
    if (seqResult.isFailure) {
      return Result.fail<EtbEintrag>(seqResult.error!);
    }

    // Create EtbEintrag entity
    const eintrag = new EtbEintrag(idResult.value!, seqResult.value!, text, userId);

    // Add to entries list
    this._eintraege.push(eintrag);

    // Increment sequence number counter
    this._nextSequenceNumber++;

    // Increment version (creates new Version instance with new timestamp)
    this._version = this._version.increment();

    // Emit domain event
    this.addDomainEvent(new EintragAddedEvent(this.id, eintrag.id, eintrag.sequenceNumber.value, text, userId));

    return Result.ok<EtbEintrag>(eintrag);
  }

  /**
   * Aktualisiert den Text eines bestehenden Eintrags.
   *
   * Diese Methode implementiert die Business Logic für Entry Updates:
   * - Validiert dass ETB nicht gesperrt ist
   * - Validiert dass Text nicht leer ist
   * - Findet Eintrag anhand ID
   * - Validiert dass Eintrag existiert und nicht gelöscht ist
   * - Speichert alten Text für Event (Change Tracking)
   * - Aktualisiert Eintrag und inkrementiert Version
   * - Emittiert EintragUpdatedEvent mit old + new Text
   *
   * Warum old + new Text im Event?
   * - Audit-Trail: Vollständige Change-Log Generierung
   * - Diff-Generierung: UI kann Änderungen hervorheben
   * - Rollback-Support: Handler können vorherige Version wiederherstellen
   *
   * @param eintragId - ID des zu aktualisierenden Eintrags
   * @param newText - Neuer Textinhalt (darf nicht leer sein)
   * @param userId - User ID des Bearbeiters (für Audit-Trail)
   * @returns Result<void> - Success oder Failure mit Error
   */
  public updateEintrag(eintragId: EintragId, newText: string, userId: UserId): Result<void> {
    // Validate: ETB must not be locked
    if (this.isLocked()) {
      return Result.fail<void>('ETB ist gesperrt und kann nicht mehr geändert werden');
    }

    // Validate: Text must not be empty
    if (!newText?.trim()) {
      return Result.fail<void>('Text darf nicht leer sein');
    }

    // Find entry by ID
    const eintrag = this._eintraege.find((e) => e.id.equals(eintragId));

    // Validate: Entry must exist
    if (!eintrag) {
      return Result.fail<void>('Eintrag nicht gefunden');
    }

    // Validate: Entry must not be deleted (soft-delete check)
    if (eintrag.isDeleted) {
      return Result.fail<void>('Gelöschte Einträge können nicht bearbeitet werden');
    }

    // Save old text for event (change tracking)
    const oldText = eintrag.text;

    // Update entry (sets updatedAt timestamp)
    eintrag.update(newText);

    // Increment version
    this._version = this._version.increment();

    // Emit domain event with old + new text
    this.addDomainEvent(new EintragUpdatedEvent(this.id, eintragId, oldText, newText, userId));

    return Result.ok<void>(undefined);
  }

  /**
   * Löscht einen Eintrag (Soft-Delete).
   *
   * Diese Methode implementiert DRK-konformes Soft-Delete Pattern:
   * - Validiert dass ETB nicht gesperrt ist
   * - Findet Eintrag anhand ID
   * - Validiert dass Eintrag existiert
   * - Markiert Eintrag als gelöscht (isDeleted=true)
   * - Eintrag bleibt in _eintraege Array (Audit-Trail)
   * - Inkrementiert Version (Snapshot-Versionierung)
   * - Emittiert EintragDeletedEvent
   *
   * Warum Soft-Delete statt Hard-Delete?
   * - DRK-Compliance: Unveränderliche Historie gefordert
   * - Audit-Trail: Wer hat wann was gelöscht?
   * - Recovery: Versehentliches Löschen kann rückgängig gemacht werden
   * - Forensik: Gelöschte Einträge bleiben nachvollziehbar
   * - Sequenznummern: Keine Gaps in der Historie
   *
   * @param eintragId - ID des zu löschenden Eintrags
   * @param userId - User ID des Löschenden (für Audit-Trail)
   * @returns Result<void> - Success oder Failure mit Error
   */
  public deleteEintrag(eintragId: EintragId, userId: UserId): Result<void> {
    // Validate: ETB must not be locked
    if (this.isLocked()) {
      return Result.fail<void>('ETB ist gesperrt und kann nicht mehr geändert werden');
    }

    // Find entry by ID
    const eintrag = this._eintraege.find((e) => e.id.equals(eintragId));

    // Validate: Entry must exist
    if (!eintrag) {
      return Result.fail<void>('Eintrag nicht gefunden');
    }

    // Soft-delete: Mark as deleted (stays in array!)
    eintrag.markAsDeleted();

    // Increment version
    this._version = this._version.increment();

    // Emit domain event
    this.addDomainEvent(new EintragDeletedEvent(this.id, eintragId, userId));

    return Result.ok<void>(undefined);
  }

  /**
   * Sperrt das ETB (irreversible Transition zu LOCKED).
   *
   * Diese Methode implementiert die finale Abschluss-Logik für ETBs:
   * - Validiert dass Status NICHT bereits LOCKED ist
   * - Transitioniert Status zu LOCKED (irreversibel!)
   * - Emittiert EtbLockedEvent
   * - Ab jetzt: Alle Modification Methods returnen Result.fail()
   *
   * Warum irreversibel?
   * - DRK-Compliance: Finale Einsatzberichte sind rechtsgültige Dokumente
   * - Rechtssicherheit: Gesperrte ETBs dürfen nicht manipuliert werden
   * - Audit-Trail: Garantiert Unveränderlichkeit nach Abschluss
   * - State Machine: LOCKED ist finaler Zustand ohne Ausgangs-Transitions
   *
   * Business Kontext:
   * Nach Einsatzende wird das ETB vom Einsatzleiter finalisiert.
   * Ab diesem Zeitpunkt werden typischerweise PDF-Berichte generiert
   * und in langfristige Archivierung verschoben.
   *
   * @param userId - User ID des Sperrenden (typischerweise Einsatzleiter)
   * @returns Result<void> - Success oder Failure mit Error
   */
  public lock(userId: UserId): Result<void> {
    // Validate: Must not already be locked
    if (this.isLocked()) {
      return Result.fail<void>('ETB ist bereits gesperrt');
    }

    // Transition to LOCKED status (irreversible!)
    this._status = EtbStatus.LOCKED();

    // Emit domain event
    this.addDomainEvent(new EtbLockedEvent(this.id, userId, new Date()));

    return Result.ok<void>(undefined);
  }
}
