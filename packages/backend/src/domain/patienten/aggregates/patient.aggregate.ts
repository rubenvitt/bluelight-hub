import { AggregateRoot } from '@domain/common/aggregate-root';
import { EntityId } from '@domain/common/entity-id';
import { Result } from '@domain/common/result';
import { Behandlungsstatus, BEHANDLUNGSSTATUS_CODES, type BehandlungsstatusCode } from '../value-objects/behandlungsstatus.vo';
import { DiviVakNummer } from '../value-objects/divi-vak-nummer.vo';
import { ErfasserRef } from '../value-objects/erfasser-ref.vo';
import { Patientennummer } from '../value-objects/patientennummer.vo';
import { Sichtung } from '../value-objects/sichtung.vo';
import { Sichtungskategorie, SK_CODES, type SkCode } from '../value-objects/sichtungskategorie.vo';
import { Transportstatus, TRANSPORTSTATUS_CODES, type TransportstatusCode } from '../value-objects/transportstatus.vo';
import { PatientBehandlungAbgeschlossen } from '../events/patient-behandlung-abgeschlossen.event';
import { PatientBehandlungBegonnen } from '../events/patient-behandlung-begonnen.event';
import { PatientDomainEvent } from '../events/patient-domain-event';
import { PatientErfasst } from '../events/patient-erfasst.event';
import { PatientGesichtet } from '../events/patient-gesichtet.event';
import { PatientKorrigiert, type PatientKorrekturFeld } from '../events/patient-korrigiert.event';
import { PatientSichtungAktualisiert } from '../events/patient-sichtung-aktualisiert.event';
import { PatientTransportAbgeschlossen } from '../events/patient-transport-abgeschlossen.event';
import { PatientTransportGestartet } from '../events/patient-transport-gestartet.event';

/**
 * Sentinel-Errors für das Patient-Aggregate (Story 1.1).
 *
 * Präfixe folgen dem repo-weiten Pattern (`BusinessRule:` → HTTP 422,
 * `ConflictDetected:` → HTTP 409, `Invariant:` → 500). Die HTTP-Mappings werden
 * erst durch den Controller (Story 1.2 ff.) verdrahtet; das Aggregate liefert
 * stabile Strings.
 */
export const PATIENT_BUSINESS_RULE_PATIENTENNUMMER_INVALID = 'BusinessRule:PatientennummerInvalid';
export const PATIENT_BUSINESS_RULE_EINSATZ_ID_ERFORDERLICH = 'BusinessRule:EinsatzIdErforderlich';
export const PATIENT_BUSINESS_RULE_ERFASSER_REF_ERFORDERLICH = 'BusinessRule:ErfasserRefErforderlich';
export const PATIENT_BUSINESS_RULE_ERFASST_AM_UNGUELTIG = 'BusinessRule:ErfasstAmUngueltig';
export const PATIENT_BUSINESS_RULE_INITIALE_SK_UNGUELTIG = 'BusinessRule:InitialeSkUngueltig';
export const PATIENT_BUSINESS_RULE_DIVI_VAK_NUMMER_UNGUELTIG = 'BusinessRule:DiviVakNummerUngueltig';
export const PATIENT_BUSINESS_RULE_SICHTUNG_UNGUELTIG = 'BusinessRule:SichtungUngueltig';
export const PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG = 'BusinessRule:ClockDriftUngueltig';
export const PATIENT_BUSINESS_RULE_SICHTUNG_VON_TOT_NICHT_ERLAUBT = 'BusinessRule:SichtungVonTotNichtErlaubt';
export const PATIENT_BUSINESS_RULE_SICHTUNG_UNVERAENDERT = 'BusinessRule:SichtungUnveraendert';
export const PATIENT_BUSINESS_RULE_GRUND_UNGUELTIG = 'BusinessRule:GrundUngueltig';
export const PATIENT_BUSINESS_RULE_BEHANDLUNG_UNGUELTIGER_UEBERGANG = 'BusinessRule:BehandlungUngueltigerUebergang';
export const PATIENT_BUSINESS_RULE_TRANSPORT_UNGUELTIGER_UEBERGANG = 'BusinessRule:TransportUngueltigerUebergang';
export const PATIENT_BUSINESS_RULE_KORREKTUR_FELD_INVALID = 'BusinessRule:KorrekturFeldInvalid';
export const PATIENT_BUSINESS_RULE_KORREKTUR_NEUER_WERT_INVALID = 'BusinessRule:KorrekturNeuerWertInvalid';
export const PATIENT_BUSINESS_RULE_KORREKTUR_GRUND_REQUIRED = 'BusinessRule:KorrekturGrundRequired';
export const PATIENT_BUSINESS_RULE_KORREKTUR_TOT_BENOETIGT_BESTAETIGUNG = 'BusinessRule:KorrekturTotBenoetigtBestaetigung';
export const PATIENT_BUSINESS_RULE_NOTIZ_UNGUELTIG = 'BusinessRule:NotizUngueltig';

export class PatientId extends EntityId<'Patient'> {}

export interface CreatePatientProps {
  id?: string;
  einsatzId: string;
  patientennummer: Patientennummer;
  erfasserRef: ErfasserRef;
  erfasstAm: Date;
  initialeSk?: Sichtungskategorie;
  diviVakNummer?: DiviVakNummer;
  clockDriftSeconds?: number;
}

export interface ReconstitutePatientProps {
  id: string;
  einsatzId: string;
  patientennummer: Patientennummer;
  diviVakNummer: DiviVakNummer | null;
  aktuelleSk: Sichtungskategorie;
  behandlungsstatus: Behandlungsstatus;
  transportstatus: Transportstatus;
  erfasstAm: Date;
  erfasserRef: ErfasserRef;
  /** Aktueller Event-Version-Stand aus DB (`MAX(event_version)` über patient_events). Story 1.2 verdrahtet die Persistierung. */
  eventVersion: number;
  clockDriftSeconds: number | null;
  /** Persistierter Notiz-Snapshot (Story 1.7, AC9). `null` = nie gesetzt oder via Korrektur-Pfad gelöscht. */
  notiz: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * AggregateRoot `Patient` (Story 1.1, Architecture §D-1).
 *
 * **Scope Story 1.1:** Factory + Skeleton-Methoden für die folgenden Status-
 * Übergänge — die fachliche Logik (Validierungen, Cross-Field-Checks, ETB-
 * Verzahnung, Outbox-Registrierung) füllen Stories 1.2 ff.
 *
 * **Append-only-Vertrag:** `aktuelleSk`, `behandlungsstatus`, `transportstatus`
 * sind denormalisierte Snapshots, die ausschließlich über Events fortgeschrieben
 * werden (`applyEvent`). Korrekturen laufen über ein dediziertes
 * `PatientKorrigiert`-Event (Story 1.3) — Story 1.1 implementiert das noch nicht.
 */
export class Patient extends AggregateRoot<PatientId> {
  private constructor(
    id: PatientId,
    private readonly _einsatzId: string,
    private readonly _patientennummer: Patientennummer,
    private _diviVakNummer: DiviVakNummer | null,
    private _aktuelleSk: Sichtungskategorie,
    private _behandlungsstatus: Behandlungsstatus,
    private _transportstatus: Transportstatus,
    private readonly _erfasstAm: Date,
    private readonly _erfasserRef: ErfasserRef,
    private _eventVersion: number,
    private readonly _clockDriftSeconds: number | null,
    private _notiz: string | null,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static create(props: CreatePatientProps): Result<Patient> {
    if (!props.einsatzId || typeof props.einsatzId !== 'string' || props.einsatzId.trim().length === 0) {
      return Result.fail<Patient>(PATIENT_BUSINESS_RULE_EINSATZ_ID_ERFORDERLICH);
    }
    if (!(props.patientennummer instanceof Patientennummer)) {
      return Result.fail<Patient>(PATIENT_BUSINESS_RULE_PATIENTENNUMMER_INVALID);
    }
    if (!(props.erfasserRef instanceof ErfasserRef)) {
      return Result.fail<Patient>(PATIENT_BUSINESS_RULE_ERFASSER_REF_ERFORDERLICH);
    }
    if (!(props.erfasstAm instanceof Date) || Number.isNaN(props.erfasstAm.getTime())) {
      return Result.fail<Patient>(PATIENT_BUSINESS_RULE_ERFASST_AM_UNGUELTIG);
    }
    if (props.initialeSk !== undefined && !(props.initialeSk instanceof Sichtungskategorie)) {
      return Result.fail<Patient>(PATIENT_BUSINESS_RULE_INITIALE_SK_UNGUELTIG);
    }
    if (props.diviVakNummer !== undefined && !(props.diviVakNummer instanceof DiviVakNummer)) {
      return Result.fail<Patient>(PATIENT_BUSINESS_RULE_DIVI_VAK_NUMMER_UNGUELTIG);
    }
    if (props.clockDriftSeconds !== undefined && (typeof props.clockDriftSeconds !== 'number' || !Number.isFinite(props.clockDriftSeconds) || !Number.isInteger(props.clockDriftSeconds))) {
      return Result.fail<Patient>(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);
    }

    const idResult = PatientId.create(props.id);
    if (idResult.isFailure || !idResult.value) {
      return Result.fail<Patient>(idResult.error ?? 'Invariant:UngueltigePatientId');
    }

    // Default-SK bei Erfassung ohne explizite Sichtung: SK_III (gehfähig / leicht);
    // operativ wird das je nach Workflow später überschrieben (Story 1.3
    // Reevaluierungs-Pfad).
    const initialeSkResult = props.initialeSk ?? Sichtungskategorie.create('SK_III').value!;

    const patient = new Patient(
      idResult.value as PatientId,
      props.einsatzId,
      props.patientennummer,
      props.diviVakNummer ?? null,
      initialeSkResult,
      Behandlungsstatus.initial(),
      Transportstatus.initial(),
      props.erfasstAm,
      props.erfasserRef,
      1,
      props.clockDriftSeconds ?? null,
      null,
    );

    patient.addDomainEvent(new PatientErfasst(props.einsatzId, patient.id.value, props.patientennummer.value, initialeSkResult.code, props.erfasserRef.data, props.clockDriftSeconds, props.erfasstAm));

    return Result.ok(patient);
  }

  /**
   * Rekonstruiert ein Aggregate aus DB-State (Mapper-Pfad). Emittiert keine
   * Events — der persistierte Zustand wurde seinerzeit bereits veröffentlicht.
   */
  static reconstitute(props: ReconstitutePatientProps): Result<Patient> {
    const idResult = PatientId.create(props.id);
    if (idResult.isFailure || !idResult.value) {
      return Result.fail<Patient>(`Invariant:UngueltigePatientId:${props.id} (${idResult.error ?? 'unknown'})`);
    }
    if (!Number.isInteger(props.eventVersion) || props.eventVersion < 1) {
      return Result.fail<Patient>(`Invariant:UngueltigerEventVersionStand:${props.eventVersion}`);
    }
    return Result.ok(
      new Patient(
        idResult.value as PatientId,
        props.einsatzId,
        props.patientennummer,
        props.diviVakNummer,
        props.aktuelleSk,
        props.behandlungsstatus,
        props.transportstatus,
        props.erfasstAm,
        props.erfasserRef,
        props.eventVersion,
        props.clockDriftSeconds,
        props.notiz,
        props.createdAt,
        props.updatedAt,
      ),
    );
  }

  // ===== Getter =====

  get einsatzId(): string {
    return this._einsatzId;
  }
  get patientennummer(): Patientennummer {
    return this._patientennummer;
  }
  get diviVakNummer(): DiviVakNummer | null {
    return this._diviVakNummer;
  }
  get aktuelleSk(): Sichtungskategorie {
    return this._aktuelleSk;
  }
  get behandlungsstatus(): Behandlungsstatus {
    return this._behandlungsstatus;
  }
  get transportstatus(): Transportstatus {
    return this._transportstatus;
  }
  get erfasstAm(): Date {
    return this._erfasstAm;
  }
  get erfasserRef(): ErfasserRef {
    return this._erfasserRef;
  }
  get eventVersion(): number {
    return this._eventVersion;
  }
  get clockDriftSeconds(): number | null {
    return this._clockDriftSeconds;
  }
  get notiz(): string | null {
    return this._notiz;
  }

  // ===== Domain-Methoden (Skeleton — Story 1.3/1.4 baut darauf auf) =====

  /**
   * Reicht eine Sichtung nach. Die fachliche Vollvalidierung
   * (Drift-Annotation, Doppel-Sichtung-Schutz, Reevaluierungs-Marker)
   * verdrahtet Story 1.3 — Story 1.1 stellt nur die signaturkonforme
   * Skeleton-Methode.
   */
  gesichtet(sichtung: Sichtung, options: { actorUserId?: string; actorDeviceId?: string; originSessionId?: string; clockDriftSeconds?: number; gesichtetAm?: Date } = {}): Result<void> {
    if (!(sichtung instanceof Sichtung)) {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_SICHTUNG_UNGUELTIG);
    }
    // Domain-Rule: Eine als TOT markierte Person darf nicht via reguläre Sichtung
    // zurück in eine Lebend-Kategorie (SK_I–SK_IV) wechseln. Rücksprünge laufen
    // ausschließlich über das `PatientKorrigiert`-Event (Story 1.3).
    if (this._aktuelleSk.code === 'TOT' && sichtung.sk.code !== 'TOT') {
      return Result.fail<void>(`${PATIENT_BUSINESS_RULE_SICHTUNG_VON_TOT_NICHT_ERLAUBT}:TOT->${sichtung.sk.code}`);
    }
    if (options.clockDriftSeconds !== undefined && (!Number.isFinite(options.clockDriftSeconds) || !Number.isInteger(options.clockDriftSeconds))) {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);
    }
    this._aktuelleSk = sichtung.sk;
    const nextVersion = this._eventVersion + 1;
    this.addDomainEvent(
      new PatientGesichtet(
        this._einsatzId,
        this.id.value,
        nextVersion,
        sichtung.sk.code,
        sichtung.sichtungArt,
        sichtung.sichter,
        options.clockDriftSeconds,
        options.gesichtetAm ?? sichtung.gesichtetAm,
      ),
    );
    this._eventVersion = nextVersion;
    this.updateTimestamp();
    return Result.ok();
  }

  /**
   * Reevaluierung der Sichtungs-Kategorie eines bereits erfassten Patienten
   * (Story 1.3, Architecture §D-2 / §D-8, FR17). Emittiert
   * `PatientSichtungAktualisiert` (fachlich getrennt von der initialen
   * `PatientGesichtet`-Sichtung) und aktualisiert den denormalisierten
   * `aktuelleSk`-Snapshot. Der Originaleintrag bleibt unverändert im
   * Event-Stream (append-only, NFR-S5).
   *
   * Business-Rules:
   *  - TOT → SK_*: verboten (Rücksprung läuft ausschließlich über das
   *    `PatientKorrigiert`-Event, Story 1.4 ff.).
   *  - SK gleich: verboten (No-Op-Schutz, NFR-I4 — Audit-Trail bleibt
   *    aussagekräftig, kein Event-Spam).
   *  - `grund` ist optional; wenn gesetzt, max. 500 Zeichen nach Trim.
   */
  sichtungAktualisieren(
    sichtung: Sichtung,
    options: { actorUserId?: string; actorDeviceId?: string; originSessionId?: string; clockDriftSeconds?: number; gesichtetAm?: Date; grund?: string } = {},
  ): Result<void> {
    if (!(sichtung instanceof Sichtung)) {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_SICHTUNG_UNGUELTIG);
    }
    if (this._aktuelleSk.code === 'TOT' && sichtung.sk.code !== 'TOT') {
      return Result.fail<void>(`${PATIENT_BUSINESS_RULE_SICHTUNG_VON_TOT_NICHT_ERLAUBT}:TOT->${sichtung.sk.code}`);
    }
    if (this._aktuelleSk.code === sichtung.sk.code) {
      return Result.fail<void>(`${PATIENT_BUSINESS_RULE_SICHTUNG_UNVERAENDERT}:${sichtung.sk.code}`);
    }
    if (options.clockDriftSeconds !== undefined && (!Number.isFinite(options.clockDriftSeconds) || !Number.isInteger(options.clockDriftSeconds))) {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);
    }
    let grund: string | undefined;
    if (options.grund !== undefined) {
      if (typeof options.grund !== 'string') {
        return Result.fail<void>(PATIENT_BUSINESS_RULE_GRUND_UNGUELTIG);
      }
      const trimmed = options.grund.trim();
      if (trimmed.length === 0 || trimmed.length > 500) {
        return Result.fail<void>(PATIENT_BUSINESS_RULE_GRUND_UNGUELTIG);
      }
      grund = trimmed;
    }

    const vorher = this._aktuelleSk.code;
    this._aktuelleSk = sichtung.sk;
    const nextVersion = this._eventVersion + 1;
    this.addDomainEvent(
      new PatientSichtungAktualisiert(
        this._einsatzId,
        this.id.value,
        nextVersion,
        vorher,
        sichtung.sk.code,
        sichtung.sichtungArt,
        sichtung.sichter,
        grund,
        options.clockDriftSeconds,
        options.gesichtetAm ?? sichtung.gesichtetAm,
      ),
    );
    this._eventVersion = nextVersion;
    this.updateTimestamp();
    return Result.ok();
  }

  /**
   * Markiert den Beginn der Behandlung. Erlaubter Übergang:
   * `UNVERSORGT → IN_BEHANDLUNG`.
   */
  behandlungBeginnen(options: { actorUserId?: string; actorDeviceId?: string; originSessionId?: string; clockDriftSeconds?: number; occurredAt?: Date } = {}): Result<void> {
    if (options.clockDriftSeconds !== undefined && (!Number.isFinite(options.clockDriftSeconds) || !Number.isInteger(options.clockDriftSeconds))) {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);
    }
    const target: BehandlungsstatusCode = 'IN_BEHANDLUNG';
    if (!this._behandlungsstatus.canTransitionTo(target)) {
      return Result.fail<void>(`${PATIENT_BUSINESS_RULE_BEHANDLUNG_UNGUELTIGER_UEBERGANG}:${this._behandlungsstatus.code}->${target}`);
    }
    const vorher = this._behandlungsstatus.code;
    const nextStatusResult = Behandlungsstatus.create(target);
    if (nextStatusResult.isFailure || !nextStatusResult.value) {
      return Result.fail<void>(`Invariant:BehandlungsstatusKonnteNichtErzeugtWerden:${target}`);
    }
    this._behandlungsstatus = nextStatusResult.value;
    const nextVersion = this._eventVersion + 1;
    this.addDomainEvent(
      new PatientBehandlungBegonnen(
        this._einsatzId,
        this.id.value,
        nextVersion,
        vorher,
        target,
        options.actorUserId,
        options.actorDeviceId,
        options.originSessionId,
        options.clockDriftSeconds,
        options.occurredAt,
      ),
    );
    this._eventVersion = nextVersion;
    this.updateTimestamp();
    return Result.ok();
  }

  /**
   * Markiert den Start des Transports. Erlaubter Übergang:
   * `WARTEND → IM_TRANSPORT`.
   */
  transportStarten(options: { actorUserId?: string; actorDeviceId?: string; originSessionId?: string; clockDriftSeconds?: number; occurredAt?: Date } = {}): Result<void> {
    if (options.clockDriftSeconds !== undefined && (!Number.isFinite(options.clockDriftSeconds) || !Number.isInteger(options.clockDriftSeconds))) {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);
    }
    const target: TransportstatusCode = 'IM_TRANSPORT';
    if (!this._transportstatus.canTransitionTo(target)) {
      return Result.fail<void>(`${PATIENT_BUSINESS_RULE_TRANSPORT_UNGUELTIGER_UEBERGANG}:${this._transportstatus.code}->${target}`);
    }
    const vorher = this._transportstatus.code;
    const nextStatusResult = Transportstatus.create(target);
    if (nextStatusResult.isFailure || !nextStatusResult.value) {
      return Result.fail<void>(`Invariant:TransportstatusKonnteNichtErzeugtWerden:${target}`);
    }
    this._transportstatus = nextStatusResult.value;
    const nextVersion = this._eventVersion + 1;
    this.addDomainEvent(
      new PatientTransportGestartet(
        this._einsatzId,
        this.id.value,
        nextVersion,
        vorher,
        target,
        options.actorUserId,
        options.actorDeviceId,
        options.originSessionId,
        options.clockDriftSeconds,
        options.occurredAt,
      ),
    );
    this._eventVersion = nextVersion;
    this.updateTimestamp();
    return Result.ok();
  }

  /**
   * Schließt die Behandlung ab (Story 1.4, FR18). Erlaubte Übergänge aus
   * `IN_BEHANDLUNG`: `VERSORGT` oder `TRANSPORTBEREIT` (operative MANV-Realität —
   * OrgL kann direkt zur Transportphase springen, ohne `VERSORGT` zu durchlaufen).
   * Übergänge aus anderen Ausgangszuständen liefern den Übergangs-Sentinel.
   */
  behandlungAbschliessen(
    neu: BehandlungsstatusCode,
    options: { actorUserId?: string; actorDeviceId?: string; originSessionId?: string; clockDriftSeconds?: number; occurredAt?: Date } = {},
  ): Result<void> {
    if (neu !== 'VERSORGT' && neu !== 'TRANSPORTBEREIT') {
      return Result.fail<void>(`${PATIENT_BUSINESS_RULE_BEHANDLUNG_UNGUELTIGER_UEBERGANG}:${this._behandlungsstatus.code}->${neu}`);
    }
    if (options.clockDriftSeconds !== undefined && (!Number.isFinite(options.clockDriftSeconds) || !Number.isInteger(options.clockDriftSeconds))) {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);
    }
    if (!this._behandlungsstatus.canTransitionTo(neu)) {
      return Result.fail<void>(`${PATIENT_BUSINESS_RULE_BEHANDLUNG_UNGUELTIGER_UEBERGANG}:${this._behandlungsstatus.code}->${neu}`);
    }
    const vorher = this._behandlungsstatus.code;
    const nextStatusResult = Behandlungsstatus.create(neu);
    if (nextStatusResult.isFailure || !nextStatusResult.value) {
      return Result.fail<void>(`Invariant:BehandlungsstatusKonnteNichtErzeugtWerden:${neu}`);
    }
    this._behandlungsstatus = nextStatusResult.value;
    const nextVersion = this._eventVersion + 1;
    this.addDomainEvent(
      new PatientBehandlungAbgeschlossen(
        this._einsatzId,
        this.id.value,
        nextVersion,
        vorher,
        neu,
        options.actorUserId,
        options.actorDeviceId,
        options.originSessionId,
        options.clockDriftSeconds,
        options.occurredAt,
      ),
    );
    this._eventVersion = nextVersion;
    this.updateTimestamp();
    return Result.ok();
  }

  /**
   * Schließt den Transport ab (Story 1.4, FR19). Einziger erlaubter Übergang:
   * `IM_TRANSPORT → IM_KRANKENHAUS`.
   */
  transportAbschliessen(options: { actorUserId?: string; actorDeviceId?: string; originSessionId?: string; clockDriftSeconds?: number; occurredAt?: Date } = {}): Result<void> {
    if (options.clockDriftSeconds !== undefined && (!Number.isFinite(options.clockDriftSeconds) || !Number.isInteger(options.clockDriftSeconds))) {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);
    }
    const target: TransportstatusCode = 'IM_KRANKENHAUS';
    if (!this._transportstatus.canTransitionTo(target)) {
      return Result.fail<void>(`${PATIENT_BUSINESS_RULE_TRANSPORT_UNGUELTIGER_UEBERGANG}:${this._transportstatus.code}->${target}`);
    }
    const vorher = this._transportstatus.code;
    const nextStatusResult = Transportstatus.create(target);
    if (nextStatusResult.isFailure || !nextStatusResult.value) {
      return Result.fail<void>(`Invariant:TransportstatusKonnteNichtErzeugtWerden:${target}`);
    }
    this._transportstatus = nextStatusResult.value;
    const nextVersion = this._eventVersion + 1;
    this.addDomainEvent(
      new PatientTransportAbgeschlossen(
        this._einsatzId,
        this.id.value,
        nextVersion,
        vorher,
        target,
        options.actorUserId,
        options.actorDeviceId,
        options.originSessionId,
        options.clockDriftSeconds,
        options.occurredAt,
      ),
    );
    this._eventVersion = nextVersion;
    this.updateTimestamp();
    return Result.ok();
  }

  /**
   * Append-only Korrektur eines Snapshot-Felds (Story 1.4, FR42, Story 1.7
   * AC9 für `notiz`). Im Gegensatz zu den regulären Status-Übergängen findet
   * **keine** Übergangs-Validierung statt — die Korrektur darf jeden gültigen
   * Enum-Wert (bzw. eine getrimmte Notiz / `null`) erreichen. Der Originalwert
   * bleibt im Event-Stream erhalten (NFR-S5).
   *
   * Schutz vor versehentlicher TOT-Markierung (Story 1.4 Code-Review Feature 2):
   * Wechsel auf `feld='sichtung' && neuerWert='TOT'` gegen einen lebenden
   * Patienten verlangt `options.bestaetigeTotKorrektur === true`; sonst
   * `KorrekturTotBenoetigtBestaetigung`.
   */
  korrigieren(
    feld: PatientKorrekturFeld,
    neuerWert: string | null,
    grund: string,
    options: { actorUserId?: string; actorDeviceId?: string; originSessionId?: string; clockDriftSeconds?: number; occurredAt?: Date; bestaetigeTotKorrektur?: boolean } = {},
  ): Result<void> {
    if (feld !== 'sichtung' && feld !== 'behandlungsstatus' && feld !== 'transportstatus' && feld !== 'notiz') {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_KORREKTUR_FELD_INVALID);
    }
    if (typeof grund !== 'string') {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_KORREKTUR_GRUND_REQUIRED);
    }
    const grundTrimmed = grund.trim();
    if (grundTrimmed.length === 0 || grundTrimmed.length > 500) {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_KORREKTUR_GRUND_REQUIRED);
    }
    if (options.clockDriftSeconds !== undefined && (!Number.isFinite(options.clockDriftSeconds) || !Number.isInteger(options.clockDriftSeconds))) {
      return Result.fail<void>(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);
    }

    let vorher: string | null;
    let neu: string | null;

    if (feld === 'sichtung') {
      if (typeof neuerWert !== 'string' || !SK_CODES.includes(neuerWert as SkCode)) {
        return Result.fail<void>(PATIENT_BUSINESS_RULE_KORREKTUR_NEUER_WERT_INVALID);
      }
      // Schutz vor versehentlicher TOT-Markierung lebender Patienten.
      if (neuerWert === 'TOT' && this._aktuelleSk.code !== 'TOT' && options.bestaetigeTotKorrektur !== true) {
        return Result.fail<void>(PATIENT_BUSINESS_RULE_KORREKTUR_TOT_BENOETIGT_BESTAETIGUNG);
      }
      const skResult = Sichtungskategorie.create(neuerWert);
      if (skResult.isFailure || !skResult.value) {
        return Result.fail<void>(PATIENT_BUSINESS_RULE_KORREKTUR_NEUER_WERT_INVALID);
      }
      vorher = this._aktuelleSk.code;
      neu = neuerWert;
      this._aktuelleSk = skResult.value;
    } else if (feld === 'behandlungsstatus') {
      if (typeof neuerWert !== 'string' || !BEHANDLUNGSSTATUS_CODES.includes(neuerWert as BehandlungsstatusCode)) {
        return Result.fail<void>(PATIENT_BUSINESS_RULE_KORREKTUR_NEUER_WERT_INVALID);
      }
      const statusResult = Behandlungsstatus.create(neuerWert);
      if (statusResult.isFailure || !statusResult.value) {
        return Result.fail<void>(PATIENT_BUSINESS_RULE_KORREKTUR_NEUER_WERT_INVALID);
      }
      vorher = this._behandlungsstatus.code;
      neu = neuerWert;
      this._behandlungsstatus = statusResult.value;
    } else if (feld === 'transportstatus') {
      if (typeof neuerWert !== 'string' || !TRANSPORTSTATUS_CODES.includes(neuerWert as TransportstatusCode)) {
        return Result.fail<void>(PATIENT_BUSINESS_RULE_KORREKTUR_NEUER_WERT_INVALID);
      }
      const statusResult = Transportstatus.create(neuerWert);
      if (statusResult.isFailure || !statusResult.value) {
        return Result.fail<void>(PATIENT_BUSINESS_RULE_KORREKTUR_NEUER_WERT_INVALID);
      }
      vorher = this._transportstatus.code;
      neu = neuerWert;
      this._transportstatus = statusResult.value;
    } else {
      // feld === 'notiz' — `null` löscht, sonst getrimmter String 1..500 Zeichen.
      if (neuerWert !== null && typeof neuerWert !== 'string') {
        return Result.fail<void>(PATIENT_BUSINESS_RULE_NOTIZ_UNGUELTIG);
      }
      let normalized: string | null;
      if (neuerWert === null) {
        normalized = null;
      } else {
        const trimmed = neuerWert.trim();
        if (trimmed.length === 0 || trimmed.length > 500) {
          return Result.fail<void>(PATIENT_BUSINESS_RULE_NOTIZ_UNGUELTIG);
        }
        normalized = trimmed;
      }
      vorher = this._notiz;
      neu = normalized;
      this._notiz = normalized;
    }

    const nextVersion = this._eventVersion + 1;
    this.addDomainEvent(
      new PatientKorrigiert(
        this._einsatzId,
        this.id.value,
        nextVersion,
        feld,
        vorher,
        neu,
        grundTrimmed,
        options.actorUserId,
        options.actorDeviceId,
        options.originSessionId,
        options.clockDriftSeconds,
        options.occurredAt,
      ),
    );
    this._eventVersion = nextVersion;
    this.updateTimestamp();
    return Result.ok();
  }

  /**
   * Setzt den Snapshot anhand eines bereits emittierten Events fort. Wird vom
   * Repository beim Replay genutzt (Story 1.2 ff. — bis dahin nur als Vertrag
   * verfügbar).
   */
  applyEvent(event: PatientDomainEvent): void {
    if (event instanceof PatientErfasst) {
      // initialer Snapshot — durch `create` bereits aufgebaut. EventVersion
      // dennoch nachziehen, falls Replay aus persistiertem Stream startet.
      this._eventVersion = Math.max(this._eventVersion, event.eventVersion);
      return;
    }
    if (event instanceof PatientGesichtet) {
      const sk = Sichtungskategorie.create(event.sk);
      if (sk.isFailure || !sk.value) {
        throw new Error(`Invariant:ApplyEventInvalidSk:${event.sk}`);
      }
      this._aktuelleSk = sk.value;
      this._eventVersion = Math.max(this._eventVersion, event.eventVersion);
      return;
    }
    if (event instanceof PatientSichtungAktualisiert) {
      const sk = Sichtungskategorie.create(event.neu);
      if (sk.isFailure || !sk.value) {
        throw new Error(`Invariant:ApplyEventInvalidSk:${event.neu}`);
      }
      this._aktuelleSk = sk.value;
      this._eventVersion = Math.max(this._eventVersion, event.eventVersion);
      return;
    }
    if (event instanceof PatientBehandlungBegonnen) {
      const status = Behandlungsstatus.create(event.neu);
      if (status.isFailure || !status.value) {
        throw new Error(`Invariant:ApplyEventInvalidBehandlungsstatus:${event.neu}`);
      }
      this._behandlungsstatus = status.value;
      this._eventVersion = Math.max(this._eventVersion, event.eventVersion);
      return;
    }
    if (event instanceof PatientBehandlungAbgeschlossen) {
      const status = Behandlungsstatus.create(event.neu);
      if (status.isFailure || !status.value) {
        throw new Error(`Invariant:ApplyEventInvalidBehandlungsstatus:${event.neu}`);
      }
      this._behandlungsstatus = status.value;
      this._eventVersion = Math.max(this._eventVersion, event.eventVersion);
      return;
    }
    if (event instanceof PatientTransportGestartet) {
      const status = Transportstatus.create(event.neu);
      if (status.isFailure || !status.value) {
        throw new Error(`Invariant:ApplyEventInvalidTransportstatus:${event.neu}`);
      }
      this._transportstatus = status.value;
      this._eventVersion = Math.max(this._eventVersion, event.eventVersion);
      return;
    }
    if (event instanceof PatientTransportAbgeschlossen) {
      const status = Transportstatus.create(event.neu);
      if (status.isFailure || !status.value) {
        throw new Error(`Invariant:ApplyEventInvalidTransportstatus:${event.neu}`);
      }
      this._transportstatus = status.value;
      this._eventVersion = Math.max(this._eventVersion, event.eventVersion);
      return;
    }
    if (event instanceof PatientKorrigiert) {
      if (event.feld === 'sichtung') {
        if (event.neu === null) {
          throw new Error('Invariant:ApplyEventInvalidKorrigiert:sichtung-neu-null');
        }
        const sk = Sichtungskategorie.create(event.neu);
        if (sk.isFailure || !sk.value) {
          throw new Error(`Invariant:ApplyEventInvalidSk:${event.neu}`);
        }
        this._aktuelleSk = sk.value;
      } else if (event.feld === 'behandlungsstatus') {
        if (event.neu === null) {
          throw new Error('Invariant:ApplyEventInvalidKorrigiert:behandlungsstatus-neu-null');
        }
        const status = Behandlungsstatus.create(event.neu);
        if (status.isFailure || !status.value) {
          throw new Error(`Invariant:ApplyEventInvalidBehandlungsstatus:${event.neu}`);
        }
        this._behandlungsstatus = status.value;
      } else if (event.feld === 'transportstatus') {
        if (event.neu === null) {
          throw new Error('Invariant:ApplyEventInvalidKorrigiert:transportstatus-neu-null');
        }
        const status = Transportstatus.create(event.neu);
        if (status.isFailure || !status.value) {
          throw new Error(`Invariant:ApplyEventInvalidTransportstatus:${event.neu}`);
        }
        this._transportstatus = status.value;
      } else {
        // feld === 'notiz' — `null` ist ein gültiger Lösch-Wert (Story 1.7 AC9).
        this._notiz = event.neu;
      }
      this._eventVersion = Math.max(this._eventVersion, event.eventVersion);
      return;
    }
    throw new Error(`Invariant:UnknownPatientEvent:${(event as { constructor?: { name?: string } })?.constructor?.name ?? 'unknown'}`);
  }
}
