import { SICHERUNGSPOSTEN_BEREITS_AUFGELOEST, SICHERUNGSPOSTEN_CONFLICT_DETECTED, Sicherungsposten } from '../sicherungsposten.aggregate';
import { SicherungspostenAktualisiertEvent } from '../../events/sicherungsposten-aktualisiert.event';
import { SicherungspostenEingerichtetEvent } from '../../events/sicherungsposten-eingerichtet.event';
import { Standort } from '../../value-objects/standort.vo';

describe('Sicherungsposten Aggregate (Story 4.1)', () => {
  const EINSATZ_ID = 'clw3h8x9y0000qwertyui04001';
  const EINHEIT_ID = 'clw3h8x9y0000qwertyui04002';
  const USER_ID = 'clw3h8x9y0000qwertyui04003';
  const OTHER_USER = 'clw3h8x9y0000qwertyui04004';

  function buildAddressStandort(text = 'Eingang Hörsaal C'): Standort {
    return Standort.create({ kind: 'address', text }).value!;
  }
  function buildCoordinateStandort(): Standort {
    return Standort.create({ kind: 'coordinate', longitude: 8.6821, latitude: 50.1109 }).value!;
  }

  it('(1) create() liefert Success und Initialwerte', () => {
    const result = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Nord',
      standort: buildAddressStandort(),
      personal: [],
      createdBy: USER_ID,
    });
    expect(result.isSuccess).toBe(true);
    const aggregate = result.value!;
    expect(aggregate.einsatzId).toBe(EINSATZ_ID);
    expect(aggregate.bezeichnung).toBe('Posten Nord');
    expect(aggregate.version).toBe(1);
    expect(aggregate.isAufgeloest).toBe(false);
    expect(aggregate.personal).toHaveLength(0);
  });

  it('(2) create() emittiert genau ein SicherungspostenEingerichtetEvent', () => {
    const aggregate = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Süd',
      standort: buildCoordinateStandort(),
      personal: [{ kind: 'einsatzPerson', einsatzPersonId: USER_ID }],
      createdBy: USER_ID,
      einheitId: EINHEIT_ID,
    }).value!;
    const events = aggregate.getDomainEvents();
    expect(events).toHaveLength(1);
    const event = events[0] as SicherungspostenEingerichtetEvent;
    expect(event).toBeInstanceOf(SicherungspostenEingerichtetEvent);
    expect(event.einsatzId).toBe(EINSATZ_ID);
    expect(event.userId).toBe(USER_ID);
    expect(event.einheitId).toBe(EINHEIT_ID);
    expect(event.sicherungspostenId).toBe(aggregate.id.value);
    expect(event.bezeichnung).toBe('Posten Süd');
    expect(event.standortKind).toBe('coordinate');
    expect(event.personalCount).toBe(1);
  });

  it('(3) create() lehnt leere Bezeichnung ab', () => {
    const result = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: '   ',
      standort: buildAddressStandort(),
      personal: [],
      createdBy: USER_ID,
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Bezeichnung/);
  });

  it('(4) create() lehnt zu langen Zuständigkeitsbereich ab', () => {
    const result = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten X',
      standort: buildAddressStandort(),
      personal: [],
      createdBy: USER_ID,
      zustaendigkeitsbereich: 'a'.repeat(4001),
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/zustaendigkeitsbereich/);
  });

  it('(5) Personal akzeptiert User+Freitext gemischt und normalisiert Trim', () => {
    const aggregate = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Mischbesetzung',
      standort: buildAddressStandort(),
      personal: [
        { kind: 'einsatzPerson', einsatzPersonId: USER_ID },
        { kind: 'freitext', name: '  Externer Helfer  ', rolle: '  Sanitäter  ' },
      ],
      createdBy: USER_ID,
    }).value!;
    const personal = aggregate.personal;
    expect(personal).toHaveLength(2);
    expect(personal[0]).toEqual({ kind: 'einsatzPerson', einsatzPersonId: USER_ID });
    expect(personal[1]).toEqual({ kind: 'freitext', name: 'Externer Helfer', rolle: 'Sanitäter' });
  });

  it('(6) update() bei Versionskonflikt liefert SICHERUNGSPOSTEN_CONFLICT_DETECTED', () => {
    const aggregate = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Nord',
      standort: buildAddressStandort(),
      personal: [],
      createdBy: USER_ID,
    }).value!;
    const result = aggregate.update({ bezeichnung: 'Posten Nord 2' }, 99, USER_ID);
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(SICHERUNGSPOSTEN_CONFLICT_DETECTED);
  });

  it('(7) update() inkrementiert Version, emittiert Event mit changedFields', () => {
    const aggregate = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Nord',
      standort: buildAddressStandort('Position A'),
      personal: [],
      createdBy: USER_ID,
    }).value!;
    aggregate.clearDomainEvents();
    const result = aggregate.update({ bezeichnung: 'Posten Nord neu', standort: buildAddressStandort('Position B') }, 1, OTHER_USER);
    expect(result.isSuccess).toBe(true);
    expect(aggregate.version).toBe(2);
    expect(aggregate.bezeichnung).toBe('Posten Nord neu');
    const events = aggregate.getDomainEvents();
    expect(events).toHaveLength(1);
    const event = events[0] as SicherungspostenAktualisiertEvent;
    expect(event).toBeInstanceOf(SicherungspostenAktualisiertEvent);
    expect(event.userId).toBe(OTHER_USER);
    expect(event.fromVersion).toBe(1);
    expect(event.toVersion).toBe(2);
    expect(event.changedFields.changed).toEqual(expect.arrayContaining(['bezeichnung', 'standort']));
    expect(event.changedFields.changed).toHaveLength(2);
    expect(event.changedFields.aufgeloest).toBeUndefined();
  });

  it('(8) update() ohne tatsächliche Änderung liefert KeineAenderung-Sentinel', () => {
    const aggregate = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Nord',
      standort: buildAddressStandort(),
      personal: [],
      createdBy: USER_ID,
    }).value!;
    aggregate.clearDomainEvents();
    const result = aggregate.update({ bezeichnung: 'Posten Nord' }, 1, USER_ID);
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('BusinessRule:KeineAenderung');
    expect(aggregate.version).toBe(1);
    expect(aggregate.getDomainEvents()).toHaveLength(0);
  });

  it('(9) aufloesen() setzt Felder, inkrementiert Version, emittiert Event mit aufgeloest=true', () => {
    const aggregate = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Nord',
      standort: buildAddressStandort(),
      personal: [],
      createdBy: USER_ID,
    }).value!;
    aggregate.clearDomainEvents();
    const result = aggregate.aufloesen(OTHER_USER, 'Posten nicht mehr benötigt', 1);
    expect(result.isSuccess).toBe(true);
    expect(aggregate.version).toBe(2);
    expect(aggregate.isAufgeloest).toBe(true);
    expect(aggregate.aufloeseBegruendung).toBe('Posten nicht mehr benötigt');
    expect(aggregate.aufgeloestVonUserId).toBe(OTHER_USER);
    const events = aggregate.getDomainEvents();
    expect(events).toHaveLength(1);
    const event = events[0] as SicherungspostenAktualisiertEvent;
    expect(event.changedFields.aufgeloest).toBe(true);
    expect(event.changedFields.changed).toEqual(['aufgeloest']);
  });

  it('(10) aufloesen() ist idempotent (zweiter Aufruf → BereitsAufgeloest, kein zusätzliches Event)', () => {
    const aggregate = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Nord',
      standort: buildAddressStandort(),
      personal: [],
      createdBy: USER_ID,
    }).value!;
    aggregate.aufloesen(USER_ID, 'Erste Auflösung', 1);
    aggregate.clearDomainEvents();
    const second = aggregate.aufloesen(USER_ID, 'Zweite Auflösung', 2);
    expect(second.isFailure).toBe(true);
    expect(second.error).toBe(SICHERUNGSPOSTEN_BEREITS_AUFGELOEST);
    expect(aggregate.getDomainEvents()).toHaveLength(0);
    expect(aggregate.aufloeseBegruendung).toBe('Erste Auflösung');
  });

  it('(11) aufloesen() lehnt leere Begründung ab', () => {
    const aggregate = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Nord',
      standort: buildAddressStandort(),
      personal: [],
      createdBy: USER_ID,
    }).value!;
    const result = aggregate.aufloesen(USER_ID, '   ', 1);
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Begründung/);
  });

  it('(12) update() auf bereits aufgelöstem Posten verboten', () => {
    const aggregate = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Nord',
      standort: buildAddressStandort(),
      personal: [],
      createdBy: USER_ID,
    }).value!;
    aggregate.aufloesen(USER_ID, 'Auflösen', 1);
    const result = aggregate.update({ bezeichnung: 'Posten Nord 2' }, 2, USER_ID);
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(SICHERUNGSPOSTEN_BEREITS_AUFGELOEST);
  });

  it('(13) Standort discriminated union: invalid longitude wird abgelehnt', () => {
    const result = Standort.create({ kind: 'coordinate', longitude: 999, latitude: 0 });
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/longitude/);
  });

  it('(14) Standort.address: leerer Text wird abgelehnt, Trim wird angewandt', () => {
    expect(Standort.create({ kind: 'address', text: '   ' }).isFailure).toBe(true);
    const ok = Standort.create({ kind: 'address', text: '  Hauptbahnhof  ' });
    expect(ok.isSuccess).toBe(true);
    expect(ok.value!.toJSON()).toEqual({ kind: 'address', text: 'Hauptbahnhof' });
  });

  it('(15) reconstitute() rehydriert Aggregate ohne Events zu emittieren', () => {
    const result = Sicherungsposten.reconstitute({
      id: 'clw3h8x9y0000qwertyui04099',
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Reconstitute',
      standort: buildAddressStandort(),
      personal: [{ kind: 'einsatzPerson', einsatzPersonId: USER_ID }],
      createdBy: USER_ID,
      einheitId: null,
      zustaendigkeitsbereich: null,
      abloesezeiten: null,
      version: 5,
      aufgeloestAm: null,
      aufgeloestVonUserId: null,
      aufloeseBegruendung: null,
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value!.version).toBe(5);
    expect(result.value!.getDomainEvents()).toHaveLength(0);
  });

  it('(16-S4.2-A) update() akzeptiert abloesezeiten mit 2000 Zeichen und führt changedFields = ["abloesezeiten"]', () => {
    const aggregate = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Nord',
      standort: buildAddressStandort(),
      personal: [],
      createdBy: USER_ID,
    }).value!;
    aggregate.clearDomainEvents();
    const longText = 'a'.repeat(2000);
    const result = aggregate.update({ abloesezeiten: longText }, 1, USER_ID);
    expect(result.isSuccess).toBe(true);
    expect(aggregate.abloesezeiten).toBe(longText);
    expect(aggregate.version).toBe(2);
    const events = aggregate.getDomainEvents();
    expect(events).toHaveLength(1);
    const event = events[0] as SicherungspostenAktualisiertEvent;
    expect(event.changedFields.changed).toEqual(['abloesezeiten']);
  });

  it('(17-S4.2-B) update() lehnt abloesezeiten mit 2001 Zeichen ab', () => {
    const aggregate = Sicherungsposten.create({
      einsatzId: EINSATZ_ID,
      bezeichnung: 'Posten Nord',
      standort: buildAddressStandort(),
      personal: [],
      createdBy: USER_ID,
    }).value!;
    const result = aggregate.update({ abloesezeiten: 'a'.repeat(2001) }, 1, USER_ID);
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/abloesezeiten/);
  });
});
