import type { EintragId } from '@domain/value-objects/eintrag-id';
import { EtbKategorie } from '@domain/value-objects/etb-kategorie';
import type { EtbSequenceNumber } from '@domain/value-objects/etb-sequence-number';
import type { UserId } from '@domain/value-objects/user-id';

/**
 * Entity für ETB-Einträge, verwaltet durch EinsatztagebuchAggregate.
 *
 * Diese Klasse repräsentiert einen einzelnen Eintrag im Einsatztagebuch.
 * WICHTIG: EtbEintrag ist KEINE Aggregate Root, sondern eine Entity die
 * ausschließlich über das parent EinsatztagebuchAggregate manipuliert wird.
 * Es existiert KEIN dediziertes Repository für EtbEintrag - alle Persistierung
 * erfolgt über das Aggregate (transactional boundary).
 *
 * **Warum Entity und nicht Value Object?**
 * - Hat eigene Identity (EintragId): Einträge sind unterscheidbar auch mit gleichem Text
 * - Hat Lifecycle: Kann aktualisiert und gelöscht werden (mutable)
 * - Hat Audit-Informationen: createdBy, updatedAt, Soft-Delete Flag
 *
 * **Soft-Delete Pattern:**
 * Einträge werden NICHT physisch gelöscht sondern nur als gelöscht markiert (isDeleted=true).
 * Dies garantiert DRK-konforme Revisionssicherheit und lückenlose Audit-Trails.
 * Gelöschte Einträge bleiben im Aggregate und sind historisch nachvollziehbar.
 *
 * **Design Patterns:**
 * - Protected Constructor: Nur EinsatztagebuchAggregate kann Einträge erstellen
 * - ID-based Equality: Zwei Einträge sind gleich wenn ihre IDs gleich sind
 * - Immutable Sequence Number: Sequenznummer wird bei Creation gesetzt und nie geändert
 *
 * @example
 * ```typescript
 * // Nur innerhalb von EinsatztagebuchAggregate:
 * const eintrag = new EtbEintrag(
 *   eintragId,
 *   sequenceNumber,
 *   'Fahrzeug W1 am Einsatzort eingetroffen',
 *   userId
 * );
 *
 * // Update (setzt updatedAt automatisch)
 * eintrag.update('Fahrzeug W1 am Einsatzort eingetroffen um 14:30 Uhr');
 *
 * // Soft-Delete (isDeleted=true, bleibt in Historie)
 * eintrag.markAsDeleted();
 * console.log(eintrag.isDeleted); // true
 * ```
 */
export class EtbEintrag {
  /**
   * Eindeutige ID des Eintrags.
   * Readonly: Identity ist unveränderlich nach Creation.
   */
  private readonly _id: EintragId;

  /**
   * Immutable Sequenznummer für chronologische Sortierung.
   * Readonly: Sequenznummer wird bei Creation gesetzt und NIE geändert.
   * Garantiert stabile Sortierung auch bei Soft-Deletes.
   */
  private readonly _sequenceNumber: EtbSequenceNumber;

  /**
   * Textinhalt des Eintrags.
   * Mutable: Kann via update() geändert werden (setzt updatedAt).
   */
  private _text: string;

  /**
   * User ID des Erstellers.
   * Readonly: Ersteller kann nicht nachträglich geändert werden (Audit-Trail).
   */
  private readonly _createdBy: UserId;

  /**
   * Creation Timestamp.
   * Readonly: Erstellungszeitpunkt ist unveränderlich.
   */
  private readonly _createdAt: Date;

  /**
   * Optional: Last Update Timestamp.
   * Wird gesetzt wenn update() oder markAsDeleted() aufgerufen wird.
   */
  private _updatedAt?: Date;

  /**
   * Soft-Delete Flag für DRK-konforme Audit-Trails.
   * Gelöschte Einträge bleiben in der Historie (isDeleted=true).
   * Default: false (Eintrag ist aktiv).
   */
  private _isDeleted: boolean;

  /**
   * Kategorie des Eintrags (DRK-spezifisch).
   * Ermöglicht Filterung und Sortierung nach Eintragstyp.
   * Default: LAGE (Lagemeldungen sind der häufigste Eintragstyp).
   */
  private readonly _kategorie: EtbKategorie;

  /**
   * Optionale Metadaten (z.B. Screenshots, Anhänge).
   * Wird für Lagekarten-Screenshots und andere Medien verwendet.
   */
  private _metadata?: Record<string, unknown>;

  /**
   * Public Constructor für Verwendung durch EinsatztagebuchAggregate.
   * Nur EinsatztagebuchAggregate sollte Einträge erstellen (Aggregate Boundary).
   *
   * @param id - Eindeutige Eintrags-ID
   * @param sequenceNumber - Immutable Sequenznummer für Sortierung
   * @param text - Textinhalt des Eintrags
   * @param createdBy - User ID des Erstellers
   * @param createdAt - Optional: Creation timestamp (default: new Date())
   * @param kategorie - Optional: Kategorie des Eintrags (default: EtbKategorie.LAGE())
   * @param metadata - Optional: Metadaten (z.B. Screenshots)
   */
  public constructor(id: EintragId, sequenceNumber: EtbSequenceNumber, text: string, createdBy: UserId, createdAt?: Date, kategorie?: EtbKategorie, metadata?: Record<string, unknown>) {
    this._id = id;
    this._sequenceNumber = sequenceNumber;
    this._text = text;
    this._createdBy = createdBy;
    this._createdAt = createdAt ?? new Date();
    this._isDeleted = false;
    this._kategorie = kategorie ?? EtbKategorie.LAGE();
    this._metadata = metadata;
  }

  /**
   * Readonly getter für Eintrags-ID.
   */
  get id(): EintragId {
    return this._id;
  }

  /**
   * Readonly getter für Sequenznummer.
   * Wichtig für chronologische Sortierung (unveränderlich).
   */
  get sequenceNumber(): EtbSequenceNumber {
    return this._sequenceNumber;
  }

  /**
   * Readonly getter für Textinhalt.
   */
  get text(): string {
    return this._text;
  }

  /**
   * Readonly getter für Ersteller-ID.
   */
  get createdBy(): UserId {
    return this._createdBy;
  }

  /**
   * Readonly getter für Creation Timestamp.
   */
  get createdAt(): Date {
    return this._createdAt;
  }

  /**
   * Readonly getter für Last Update Timestamp.
   */
  get updatedAt(): Date | undefined {
    return this._updatedAt;
  }

  /**
   * Readonly getter für Soft-Delete Flag.
   */
  get isDeleted(): boolean {
    return this._isDeleted;
  }

  /**
   * Readonly getter für Eintrags-Kategorie.
   * Ermöglicht DRK-spezifische Filterung nach Eintragstyp.
   */
  get kategorie(): EtbKategorie {
    return this._kategorie;
  }

  /**
   * Readonly getter für Metadaten.
   * Enthält optionale Anhänge wie Screenshots.
   */
  get metadata(): Record<string, unknown> | undefined {
    return this._metadata;
  }

  /**
   * Aktualisiert den Textinhalt und setzt updatedAt Timestamp.
   *
   * Diese Methode wird vom EinsatztagebuchAggregate aufgerufen nachdem
   * alle Business Rules validiert wurden (z.B. ETB nicht gesperrt).
   * Die Entity selbst führt KEINE Validierung durch - dies ist
   * Verantwortung des parent Aggregates (Aggregate Boundary Pattern).
   *
   * @param newText - Neuer Textinhalt (Validierung erfolgt im Aggregate!)
   */
  public update(newText: string): void {
    this._text = newText;
    this._updatedAt = new Date();
  }

  /**
   * Markiert den Eintrag als gelöscht (Soft-Delete).
   *
   * Soft-Delete statt Hard-Delete garantiert DRK-konforme Revisionssicherheit:
   * - Eintrag bleibt in der Aggregate Historie
   * - Audit-Trail bleibt lückenlos nachvollziehbar
   * - Sequenznummern bleiben stabil (keine Lücken)
   * - Compliance: Keine Manipulation der Historie möglich
   *
   * Das Aggregate filtert gelöschte Einträge bei Bedarf aus (z.B. für UI),
   * speichert sie aber weiterhin in der Datenbank.
   */
  public markAsDeleted(): void {
    this._isDeleted = true;
    this._updatedAt = new Date();
  }

  /**
   * ID-based Equality Check.
   *
   * Zwei Einträge sind gleich wenn ihre IDs gleich sind, unabhängig
   * von Text, Status oder anderen Properties (Entity Identity Pattern).
   *
   * @param other - Anderer EtbEintrag zum Vergleichen (optional)
   * @returns true wenn IDs gleich, false sonst
   */
  public equals(other?: EtbEintrag): boolean {
    if (other == null) return false;
    if (other === this) return true;
    return this._id.equals(other._id);
  }
}
