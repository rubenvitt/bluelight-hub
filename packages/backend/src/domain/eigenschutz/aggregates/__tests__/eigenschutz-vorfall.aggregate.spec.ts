import { EigenschutzVorfall, VORFALL_WALLCLOCK_DRIFT } from '../eigenschutz-vorfall.aggregate';
import { VorfallGemeldetEvent } from '../../events/vorfall-gemeldet.event';
import { Beteiligter } from '../../value-objects/beteiligter.vo';
import { Wo } from '../../value-objects/wo.vo';
import { makeValidKontextSnapshot } from './__fixtures__/make-valid-kontext-snapshot';

describe('EigenschutzVorfall Aggregate (Story 5.1 + 5.2)', () => {
  const EINSATZ_ID = 'clw3h8x9y0000qwertyui05001';
  const EINHEIT_ID = 'clw3h8x9y0000qwertyui05002';
  const USER_ID = 'clw3h8x9y0000qwertyui05003';
  const NOW = new Date('2026-05-06T10:00:00.000Z');

  function buildBaseProps(overrides: Partial<Parameters<typeof EigenschutzVorfall.create>[0]> = {}) {
    return {
      einsatzId: EINSATZ_ID,
      einheitId: EINHEIT_ID,
      vorfallZeit: NOW,
      wann: NOW,
      was: 'Sturz beim Aufstieg',
      wo: null,
      beteiligte: [],
      massnahmen: '',
      unfallkasseRelevant: false,
      erfasstVonUserId: USER_ID,
      kontextSnapshot: makeValidKontextSnapshot({ einsatzId: EINSATZ_ID, einheitId: EINHEIT_ID }),
      now: NOW,
      ...overrides,
    };
  }

  it('(1) create() liefert Success und Initialwerte mit V1-Snapshot (Story 5.2)', () => {
    const result = EigenschutzVorfall.create(buildBaseProps());
    expect(result.isSuccess).toBe(true);
    const aggregate = result.value!;
    expect(aggregate.einsatzId).toBe(EINSATZ_ID);
    expect(aggregate.einheitId).toBe(EINHEIT_ID);
    expect(aggregate.was).toBe('Sturz beim Aufstieg');
    expect(aggregate.wo).toBeNull();
    expect(aggregate.unfallkasseRelevant).toBe(false);
    expect(aggregate.kontextSnapshot.schemaVersion).toBe(1);
    expect(aggregate.gefBeurteilungVersionId).toBeNull();
  });

  it('(2) create() emittiert genau ein VorfallGemeldetEvent mit korrekten Audit-Feldern', () => {
    const aggregate = EigenschutzVorfall.create(buildBaseProps({ unfallkasseRelevant: true })).value!;
    const events = aggregate.getDomainEvents();
    expect(events).toHaveLength(1);
    const event = events[0] as VorfallGemeldetEvent;
    expect(event).toBeInstanceOf(VorfallGemeldetEvent);
    expect(event.einsatzId).toBe(EINSATZ_ID);
    expect(event.userId).toBe(USER_ID);
    expect(event.einheitId).toBe(EINHEIT_ID);
    expect(event.vorfallId).toBe(aggregate.id.value);
    expect(event.unfallkasseRelevant).toBe(true);
    expect(event.vorfallZeit).toEqual(NOW);
  });

  it('(3) create() lehnt leere "was"-Beschreibung ab', () => {
    const result = EigenschutzVorfall.create(buildBaseProps({ was: '   ' }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/was/);
  });

  it('(4) create() lehnt zu lange "was"-Beschreibung (>80) ab', () => {
    const result = EigenschutzVorfall.create(buildBaseProps({ was: 'a'.repeat(81) }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/80/);
  });

  it('(5) create() trimmt "was" und persistiert getrimmten Wert', () => {
    const aggregate = EigenschutzVorfall.create(buildBaseProps({ was: '  Stolper-Unfall  ' })).value!;
    expect(aggregate.was).toBe('Stolper-Unfall');
  });

  it('(6) create() lehnt "vorfallZeit" mit > 5 min Future-Drift ab (Wallclock-Slack)', () => {
    const future = new Date(NOW.getTime() + 6 * 60 * 1000);
    const result = EigenschutzVorfall.create(buildBaseProps({ vorfallZeit: future, wann: future }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe(VORFALL_WALLCLOCK_DRIFT);
  });

  it('(7) create() akzeptiert "vorfallZeit" innerhalb des 5-min-Slacks', () => {
    const slightlyFuture = new Date(NOW.getTime() + 4 * 60 * 1000);
    const result = EigenschutzVorfall.create(buildBaseProps({ vorfallZeit: slightlyFuture, wann: slightlyFuture }));
    expect(result.isSuccess).toBe(true);
  });

  it('(8) create() akzeptiert wo=Wo-VO und Mix-Beteiligte', () => {
    const wo = Wo.create({ kind: 'freitext', text: 'Eingang Süd' }).value!;
    const beteiligte = [Beteiligter.create({ kind: 'einsatzPerson', einsatzPersonId: USER_ID }).value!, Beteiligter.create({ kind: 'freitext', name: 'Max Mustermann', rolle: 'Sanitäter' }).value!];
    const aggregate = EigenschutzVorfall.create(buildBaseProps({ wo, beteiligte })).value!;
    expect(aggregate.wo).toBe(wo);
    expect(aggregate.beteiligte).toHaveLength(2);
    expect(aggregate.beteiligte[0]).toEqual({ kind: 'einsatzPerson', einsatzPersonId: USER_ID });
    expect(aggregate.beteiligte[1]).toEqual({ kind: 'freitext', name: 'Max Mustermann', rolle: 'Sanitäter' });
  });

  it('(9) create() lehnt rohe Beteiligter-Plain-Objects ab (VO-Pflicht)', () => {
    const result = EigenschutzVorfall.create(
      buildBaseProps({
        // eslint-disable-next-line typescript/no-explicit-any -- forced raw object for guard test
        beteiligte: [{ kind: 'einsatzPerson', einsatzPersonId: USER_ID } as any],
      }),
    );
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Beteiligter-VO/);
  });

  it('(10) create() lehnt zu lange massnahmen (>4000) ab', () => {
    const result = EigenschutzVorfall.create(buildBaseProps({ massnahmen: 'a'.repeat(4001) }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/4000/);
  });

  it('(11) create() akzeptiert leere massnahmen (Epic „optional")', () => {
    const result = EigenschutzVorfall.create(buildBaseProps({ massnahmen: '' }));
    expect(result.isSuccess).toBe(true);
    expect(result.value!.massnahmen).toBe('');
  });

  it('(12) create() lehnt nicht-V1-konformen kontextSnapshot ab (Story 5.2)', () => {
    const result = EigenschutzVorfall.create(
      buildBaseProps({
        // eslint-disable-next-line typescript/no-explicit-any -- forced array for guard test
        kontextSnapshot: [] as any,
      }),
    );
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^ValidationFailed:KontextSnapshot:SchemaParseError/);
  });

  it('(12a) create() lehnt 5.1-Stub `{}` ab (V1-Snapshot ist Pflicht ab Story 5.2)', () => {
    const result = EigenschutzVorfall.create(buildBaseProps({ kontextSnapshot: {} }));
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/^ValidationFailed:KontextSnapshot:SchemaParseError/);
  });

  it('(12b) create() leitet gefBeurteilungVersionId aus dem Snapshot ab', () => {
    const versionId = 'cl9gbversion123456789012';
    const snapshot = makeValidKontextSnapshot({
      einsatzId: EINSATZ_ID,
      einheitId: EINHEIT_ID,
      gefaehrdungsbeurteilung: {
        versionId,
        version: 1,
        gueltigVon: '2026-05-01T08:00:00.000+02:00',
        items: [{ title: 'Glatteis' }],
      },
    });
    const aggregate = EigenschutzVorfall.create(buildBaseProps({ kontextSnapshot: snapshot })).value!;
    expect(aggregate.gefBeurteilungVersionId).toBe(versionId);
  });

  it('(13) Aggregate hat KEIN update() und KEIN delete() (append-only)', () => {
    const aggregate = EigenschutzVorfall.create(buildBaseProps()).value!;
    // eslint-disable-next-line typescript/no-explicit-any -- runtime contract verification
    expect(typeof (aggregate as any).update).toBe('undefined');
    // eslint-disable-next-line typescript/no-explicit-any -- runtime contract verification
    expect(typeof (aggregate as any).delete).toBe('undefined');
  });

  it('(14) reconstitute() erzeugt Aggregate ohne Event-Emission', () => {
    const id = 'clw3h8x9y0000qwertyui05050';
    const erfasstAm = new Date('2026-05-06T09:55:00.000Z');
    const result = EigenschutzVorfall.reconstitute({
      id,
      einsatzId: EINSATZ_ID,
      einheitId: EINHEIT_ID,
      vorfallZeit: NOW,
      wann: NOW,
      was: 'Sturz',
      wo: null,
      beteiligte: [],
      massnahmen: '',
      unfallkasseRelevant: false,
      erfasstVonUserId: USER_ID,
      erfasstAm,
      kontextSnapshot: {},
      gefBeurteilungVersionId: null,
    });
    expect(result.isSuccess).toBe(true);
    const aggregate = result.value!;
    expect(aggregate.id.value).toBe(id);
    expect(aggregate.getDomainEvents()).toHaveLength(0);
    expect(aggregate.erfasstAm).toEqual(erfasstAm);
  });
});
