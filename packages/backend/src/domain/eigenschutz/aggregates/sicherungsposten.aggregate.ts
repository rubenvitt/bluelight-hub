import { AggregateRoot } from '@domain/common/aggregate-root';
import { EntityId } from '@domain/common/entity-id';
import { Result } from '@domain/common/result';
import { SicherungspostenAktualisiertEvent, type SicherungspostenAktualisiertChangedFields, type SicherungspostenFieldKey } from '../events/sicherungsposten-aktualisiert.event';
import { SicherungspostenEingerichtetEvent } from '../events/sicherungsposten-eingerichtet.event';
import { Standort, type PersonalEntryProps } from '../value-objects/standort.vo';

/**
 * Sentinel-Error aus `update`, wenn der Client mit einer veralteten
 * `expectedVersion` kam. Der Controller mappt diesen Präfix auf HTTP 409 mit
 * `:current=<n>`-Suffix (Pattern aus Story 2.3 / Gefährdungsbeurteilung).
 */
export const SICHERUNGSPOSTEN_CONFLICT_DETECTED = 'ConflictDetected:Sicherungsposten';

/**
 * Sentinel-Error aus `aufloesen`, wenn der Posten bereits aufgelöst ist.
 * Der Controller mappt das auf HTTP 422.
 */
export const SICHERUNGSPOSTEN_BEREITS_AUFGELOEST = 'BusinessRule:BereitsAufgeloest';

const BEZEICHNUNG_MIN = 1;
const BEZEICHNUNG_MAX = 200;
const ZUSTAENDIGKEIT_MAX = 4000;
const ABLOESEZEITEN_MAX = 2000;
const PERSONAL_MAX = 50;
const BEGRUENDUNG_MIN = 1;
const BEGRUENDUNG_MAX = 2000;

export class SicherungspostenId extends EntityId<'Sicherungsposten'> {}

export interface CreateSicherungspostenProps {
  id?: string;
  einsatzId: string;
  bezeichnung: string;
  standort: Standort;
  personal: PersonalEntryProps[];
  createdBy: string;
  einheitId?: string | null;
  zustaendigkeitsbereich?: string | null;
  abloesezeiten?: string | null;
}

export interface ReconstituteSicherungspostenProps {
  id: string;
  einsatzId: string;
  bezeichnung: string;
  standort: Standort;
  personal: PersonalEntryProps[];
  createdBy: string;
  einheitId: string | null;
  zustaendigkeitsbereich: string | null;
  abloesezeiten: string | null;
  version: number;
  aufgeloestAm: Date | null;
  aufgeloestVonUserId: string | null;
  aufloeseBegruendung: string | null;
}

export interface UpdateSicherungspostenChanges {
  bezeichnung?: string;
  standort?: Standort;
  personal?: PersonalEntryProps[];
  einheitId?: string | null;
  zustaendigkeitsbereich?: string | null;
  abloesezeiten?: string | null;
}

interface NormalizedFields {
  bezeichnung: string;
  einheitId: string | null;
  zustaendigkeitsbereich: string | null;
  abloesezeiten: string | null;
  personal: PersonalEntryProps[];
}

function normalizeBezeichnung(value: string): Result<string> {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length < BEZEICHNUNG_MIN) {
    return Result.fail<string>('Bezeichnung ist erforderlich');
  }
  if (trimmed.length > BEZEICHNUNG_MAX) {
    return Result.fail<string>(`Bezeichnung darf maximal ${BEZEICHNUNG_MAX} Zeichen haben`);
  }
  return Result.ok(trimmed);
}

function normalizeOptionalString(value: string | null | undefined, max: number, label: string): Result<string | null> {
  if (value === undefined || value === null) return Result.ok(null);
  const trimmed = value.trim();
  if (trimmed.length === 0) return Result.ok(null);
  if (trimmed.length > max) {
    return Result.fail<string | null>(`${label} darf maximal ${max} Zeichen haben`);
  }
  return Result.ok(trimmed);
}

function normalizePersonal(personal: PersonalEntryProps[]): Result<PersonalEntryProps[]> {
  if (!Array.isArray(personal)) {
    return Result.fail<PersonalEntryProps[]>('personal muss ein Array sein');
  }
  if (personal.length > PERSONAL_MAX) {
    return Result.fail<PersonalEntryProps[]>(`personal darf maximal ${PERSONAL_MAX} Einträge haben`);
  }
  const normalized: PersonalEntryProps[] = [];
  for (const entry of personal) {
    if (!entry || typeof entry !== 'object') {
      return Result.fail<PersonalEntryProps[]>('Ungültiger Personal-Eintrag');
    }
    if (entry.kind === 'einsatzPerson') {
      const einsatzPersonId = entry.einsatzPersonId?.trim() ?? '';
      if (einsatzPersonId.length === 0) {
        return Result.fail<PersonalEntryProps[]>('Personal-Eintrag (einsatzPerson): einsatzPersonId ist erforderlich');
      }
      normalized.push({ kind: 'einsatzPerson', einsatzPersonId });
    } else if (entry.kind === 'freitext') {
      const name = entry.name?.trim() ?? '';
      if (name.length === 0) {
        return Result.fail<PersonalEntryProps[]>('Personal-Eintrag (freitext): name ist erforderlich');
      }
      const rolle = entry.rolle?.trim();
      normalized.push({ kind: 'freitext', name, ...(rolle && rolle.length > 0 ? { rolle } : {}) });
    } else {
      return Result.fail<PersonalEntryProps[]>('Personal-Eintrag: kind muss einsatzPerson oder freitext sein');
    }
  }
  return Result.ok(normalized);
}

function deepEqualPersonal(a: readonly PersonalEntryProps[], b: readonly PersonalEntryProps[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] as PersonalEntryProps;
    const y = b[i] as PersonalEntryProps;
    if (x.kind !== y.kind) return false;
    if (x.kind === 'einsatzPerson' && y.kind === 'einsatzPerson') {
      if (x.einsatzPersonId !== y.einsatzPersonId) return false;
    } else if (x.kind === 'freitext' && y.kind === 'freitext') {
      if (x.name !== y.name) return false;
      if ((x.rolle ?? null) !== (y.rolle ?? null)) return false;
    }
  }
  return true;
}

/**
 * Aggregate Root für einen Sicherungsposten (Story 4.1).
 *
 * Invarianten:
 * 1. `einsatzId`, `bezeichnung`, `standort`, `createdBy` sind Pflicht.
 * 2. `personal` ist ein Array mit ≥ 0 Einträgen (Multi-Select-Mix aus User+Freitext).
 * 3. `update(...)` enforced Optimistic-Concurrency via `expectedVersion`.
 * 4. `aufloesen(...)` ist idempotent: zweiter Aufruf liefert
 *    `BusinessRule:BereitsAufgeloest` ohne Event.
 */
export class Sicherungsposten extends AggregateRoot<SicherungspostenId> {
  private constructor(
    id: SicherungspostenId,
    private readonly _einsatzId: string,
    private _bezeichnung: string,
    private _standort: Standort,
    private _personal: PersonalEntryProps[],
    private readonly _createdBy: string,
    private _einheitId: string | null,
    private _zustaendigkeitsbereich: string | null,
    private _abloesezeiten: string | null,
    private _version: number,
    private _aufgeloestAm: Date | null,
    private _aufgeloestVonUserId: string | null,
    private _aufloeseBegruendung: string | null,
  ) {
    super(id);
  }

  static create(props: CreateSicherungspostenProps): Result<Sicherungsposten> {
    if (!props.einsatzId || props.einsatzId.trim().length === 0) {
      return Result.fail<Sicherungsposten>('einsatzId ist erforderlich');
    }
    if (!props.createdBy || props.createdBy.trim().length === 0) {
      return Result.fail<Sicherungsposten>('createdBy ist erforderlich');
    }
    if (!(props.standort instanceof Standort)) {
      return Result.fail<Sicherungsposten>('standort muss ein Standort-VO sein');
    }

    const bezeichnungResult = normalizeBezeichnung(props.bezeichnung);
    if (bezeichnungResult.isFailure || bezeichnungResult.value === undefined) {
      return Result.fail<Sicherungsposten>(bezeichnungResult.error ?? 'Bezeichnung ungültig');
    }

    const einheitResult = normalizeOptionalString(props.einheitId ?? null, 40, 'einheitId');
    if (einheitResult.isFailure) return Result.fail<Sicherungsposten>(einheitResult.error ?? 'einheitId ungültig');

    const zustaendigResult = normalizeOptionalString(props.zustaendigkeitsbereich ?? null, ZUSTAENDIGKEIT_MAX, 'zustaendigkeitsbereich');
    if (zustaendigResult.isFailure) return Result.fail<Sicherungsposten>(zustaendigResult.error ?? 'zustaendigkeitsbereich ungültig');

    const abloeseResult = normalizeOptionalString(props.abloesezeiten ?? null, ABLOESEZEITEN_MAX, 'abloesezeiten');
    if (abloeseResult.isFailure) return Result.fail<Sicherungsposten>(abloeseResult.error ?? 'abloesezeiten ungültig');

    const personalResult = normalizePersonal(props.personal);
    if (personalResult.isFailure || personalResult.value === undefined) {
      return Result.fail<Sicherungsposten>(personalResult.error ?? 'personal ungültig');
    }

    const idResult = SicherungspostenId.create(props.id);
    if (idResult.isFailure || !idResult.value) {
      return Result.fail<Sicherungsposten>(idResult.error ?? 'Ungültige ID');
    }

    const aggregate = new Sicherungsposten(
      idResult.value as SicherungspostenId,
      props.einsatzId,
      bezeichnungResult.value,
      props.standort,
      personalResult.value,
      props.createdBy,
      einheitResult.value ?? null,
      zustaendigResult.value ?? null,
      abloeseResult.value ?? null,
      1,
      null,
      null,
      null,
    );

    aggregate.addDomainEvent(
      new SicherungspostenEingerichtetEvent(
        props.einsatzId,
        props.createdBy,
        aggregate.id.value,
        aggregate._bezeichnung,
        aggregate._standort.kind,
        aggregate._personal.length,
        aggregate._einheitId ?? undefined,
      ),
    );

    return Result.ok(aggregate);
  }

  static reconstitute(props: ReconstituteSicherungspostenProps): Result<Sicherungsposten> {
    if (!props.einsatzId || props.einsatzId.trim().length === 0) {
      return Result.fail<Sicherungsposten>('Sicherungsposten.reconstitute: einsatzId ist erforderlich');
    }
    if (!props.createdBy || props.createdBy.trim().length === 0) {
      return Result.fail<Sicherungsposten>('Sicherungsposten.reconstitute: createdBy ist erforderlich');
    }
    if (!Array.isArray(props.personal)) {
      return Result.fail<Sicherungsposten>('Sicherungsposten.reconstitute: personal muss ein Array sein');
    }
    if (!Number.isInteger(props.version) || props.version < 1) {
      return Result.fail<Sicherungsposten>(`Sicherungsposten.reconstitute: version muss Integer ≥ 1 sein (erhalten: ${String(props.version)})`);
    }
    const bezeichnungResult = normalizeBezeichnung(props.bezeichnung);
    if (bezeichnungResult.isFailure || bezeichnungResult.value === undefined) {
      return Result.fail<Sicherungsposten>(bezeichnungResult.error ?? 'Bezeichnung ungültig');
    }

    const idResult = SicherungspostenId.create(props.id);
    if (idResult.isFailure || !idResult.value) {
      return Result.fail<Sicherungsposten>(`Sicherungsposten.reconstitute: ungültige ID ${props.id} (${idResult.error ?? 'unknown'})`);
    }

    return Result.ok(
      new Sicherungsposten(
        idResult.value as SicherungspostenId,
        props.einsatzId,
        bezeichnungResult.value,
        props.standort,
        [...props.personal],
        props.createdBy,
        props.einheitId,
        props.zustaendigkeitsbereich,
        props.abloesezeiten,
        props.version,
        props.aufgeloestAm,
        props.aufgeloestVonUserId,
        props.aufloeseBegruendung,
      ),
    );
  }

  get einsatzId(): string {
    return this._einsatzId;
  }
  get bezeichnung(): string {
    return this._bezeichnung;
  }
  get standort(): Standort {
    return this._standort;
  }
  get personal(): readonly PersonalEntryProps[] {
    return Object.freeze([...this._personal]);
  }
  get einheitId(): string | null {
    return this._einheitId;
  }
  get zustaendigkeitsbereich(): string | null {
    return this._zustaendigkeitsbereich;
  }
  get abloesezeiten(): string | null {
    return this._abloesezeiten;
  }
  get createdBy(): string {
    return this._createdBy;
  }
  get version(): number {
    return this._version;
  }
  get aufgeloestAm(): Date | null {
    return this._aufgeloestAm;
  }
  get aufgeloestVonUserId(): string | null {
    return this._aufgeloestVonUserId;
  }
  get aufloeseBegruendung(): string | null {
    return this._aufloeseBegruendung;
  }
  get isAufgeloest(): boolean {
    return this._aufgeloestAm !== null;
  }

  /**
   * Wendet eine partielle Aktualisierung an, inkrementiert die Version und
   * emittiert ein `SicherungspostenAktualisiertEvent` mit Diff-Set über die
   * Top-Level-Felder.
   *
   * Optimistic-Concurrency: `expectedVersion` muss exakt der aktuellen Version
   * entsprechen. Mismatch liefert `SICHERUNGSPOSTEN_CONFLICT_DETECTED`.
   * Aufgelöste Posten dürfen nicht mehr geändert werden — Aufruf liefert
   * `BusinessRule:BereitsAufgeloest`.
   */
  update(changes: UpdateSicherungspostenChanges, expectedVersion: number, userId: string): Result<void> {
    if (this._version !== expectedVersion) {
      return Result.fail<void>(SICHERUNGSPOSTEN_CONFLICT_DETECTED);
    }
    if (this.isAufgeloest) {
      return Result.fail<void>(SICHERUNGSPOSTEN_BEREITS_AUFGELOEST);
    }
    if (!userId || userId.trim().length === 0) {
      return Result.fail<void>('userId ist erforderlich');
    }

    const next: NormalizedFields = {
      bezeichnung: this._bezeichnung,
      einheitId: this._einheitId,
      zustaendigkeitsbereich: this._zustaendigkeitsbereich,
      abloesezeiten: this._abloesezeiten,
      personal: this._personal,
    };
    let nextStandort = this._standort;

    if (changes.bezeichnung !== undefined) {
      const result = normalizeBezeichnung(changes.bezeichnung);
      if (result.isFailure || result.value === undefined) {
        return Result.fail<void>(result.error ?? 'Bezeichnung ungültig');
      }
      next.bezeichnung = result.value;
    }
    if (changes.einheitId !== undefined) {
      const result = normalizeOptionalString(changes.einheitId, 40, 'einheitId');
      if (result.isFailure) return Result.fail<void>(result.error ?? 'einheitId ungültig');
      next.einheitId = result.value ?? null;
    }
    if (changes.zustaendigkeitsbereich !== undefined) {
      const result = normalizeOptionalString(changes.zustaendigkeitsbereich, ZUSTAENDIGKEIT_MAX, 'zustaendigkeitsbereich');
      if (result.isFailure) return Result.fail<void>(result.error ?? 'zustaendigkeitsbereich ungültig');
      next.zustaendigkeitsbereich = result.value ?? null;
    }
    if (changes.abloesezeiten !== undefined) {
      const result = normalizeOptionalString(changes.abloesezeiten, ABLOESEZEITEN_MAX, 'abloesezeiten');
      if (result.isFailure) return Result.fail<void>(result.error ?? 'abloesezeiten ungültig');
      next.abloesezeiten = result.value ?? null;
    }
    if (changes.personal !== undefined) {
      const result = normalizePersonal(changes.personal);
      if (result.isFailure || result.value === undefined) {
        return Result.fail<void>(result.error ?? 'personal ungültig');
      }
      next.personal = result.value;
    }
    if (changes.standort !== undefined) {
      if (!(changes.standort instanceof Standort)) {
        return Result.fail<void>('standort muss ein Standort-VO sein');
      }
      nextStandort = changes.standort;
    }

    const changed: SicherungspostenFieldKey[] = [];
    if (next.bezeichnung !== this._bezeichnung) changed.push('bezeichnung');
    if (!nextStandort.equals(this._standort)) changed.push('standort');
    if (!deepEqualPersonal(next.personal, this._personal)) changed.push('personal');
    if (next.einheitId !== this._einheitId) changed.push('einheitId');
    if (next.zustaendigkeitsbereich !== this._zustaendigkeitsbereich) changed.push('zustaendigkeitsbereich');
    if (next.abloesezeiten !== this._abloesezeiten) changed.push('abloesezeiten');

    if (changed.length === 0) {
      return Result.fail<void>('BusinessRule:KeineAenderung');
    }

    const fromVersion = this._version;
    const toVersion = this._version + 1;

    this._bezeichnung = next.bezeichnung;
    this._standort = nextStandort;
    this._personal = next.personal;
    this._einheitId = next.einheitId;
    this._zustaendigkeitsbereich = next.zustaendigkeitsbereich;
    this._abloesezeiten = next.abloesezeiten;
    this._version = toVersion;

    const changedFields: SicherungspostenAktualisiertChangedFields = { changed };
    this.addDomainEvent(new SicherungspostenAktualisiertEvent(this._einsatzId, userId, this.id.value, fromVersion, toVersion, changedFields, this._einheitId ?? undefined));

    return Result.ok();
  }

  /**
   * Löst den Sicherungsposten auf (idempotent). Setzt `aufgeloestAm`,
   * `aufgeloestVonUserId`, `aufloeseBegruendung` und inkrementiert die Version.
   *
   * Optimistic-Concurrency wie bei `update`. Zweiter Aufruf bei bereits
   * aufgelöstem Posten liefert `BusinessRule:BereitsAufgeloest` ohne Event.
   */
  aufloesen(userId: string, begruendung: string, expectedVersion: number): Result<void> {
    if (this.isAufgeloest) {
      return Result.fail<void>(SICHERUNGSPOSTEN_BEREITS_AUFGELOEST);
    }
    if (this._version !== expectedVersion) {
      return Result.fail<void>(SICHERUNGSPOSTEN_CONFLICT_DETECTED);
    }
    if (!userId || userId.trim().length === 0) {
      return Result.fail<void>('userId ist erforderlich');
    }
    const trimmed = begruendung?.trim() ?? '';
    if (trimmed.length < BEGRUENDUNG_MIN) {
      return Result.fail<void>('Begründung ist erforderlich');
    }
    if (trimmed.length > BEGRUENDUNG_MAX) {
      return Result.fail<void>(`Begründung darf maximal ${BEGRUENDUNG_MAX} Zeichen haben`);
    }

    const fromVersion = this._version;
    const toVersion = this._version + 1;
    const at = new Date();

    this._aufgeloestAm = at;
    this._aufgeloestVonUserId = userId;
    this._aufloeseBegruendung = trimmed;
    this._version = toVersion;

    const changedFields: SicherungspostenAktualisiertChangedFields = { changed: ['aufgeloest'], aufgeloest: true };
    this.addDomainEvent(new SicherungspostenAktualisiertEvent(this._einsatzId, userId, this.id.value, fromVersion, toVersion, changedFields, this._einheitId ?? undefined, undefined, at));

    return Result.ok();
  }
}
