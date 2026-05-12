import { EigenschutzVorfall } from '@domain/eigenschutz/aggregates/eigenschutz-vorfall.aggregate';
import { Beteiligter } from '@domain/eigenschutz/value-objects/beteiligter.vo';
import { Wo } from '@domain/eigenschutz/value-objects/wo.vo';
import { toEigenschutzVorfallDto } from '../eigenschutz-vorfall.factory';

const EINSATZ_ID = 'clw3h8x9y0000qwertyui05001';
const EINHEIT_ID = 'clw3h8x9y0000qwertyui05002';
const USER_ID = 'clw3h8x9y0000qwertyui05003';
const NOW = new Date('2026-05-06T10:00:00.000Z');

const VALID_SNAPSHOT = {
  schemaVersion: 1 as const,
  snapshotAt: NOW.toISOString(),
  einsatzId: EINSATZ_ID,
  einheitId: EINHEIT_ID,
  gefaehrdungsbeurteilung: null,
  aktivePsaProfile: [],
  sicherheitsregeln: [],
};

function buildAggregate(overrides: { wo?: Wo | null; beteiligte?: Beteiligter[]; unfallkasseRelevant?: boolean } = {}) {
  return EigenschutzVorfall.create({
    einsatzId: EINSATZ_ID,
    einheitId: EINHEIT_ID,
    vorfallZeit: NOW,
    wann: NOW,
    was: 'Sturz',
    wo: overrides.wo ?? null,
    beteiligte: overrides.beteiligte ?? [],
    massnahmen: 'Erstversorgung',
    unfallkasseRelevant: overrides.unfallkasseRelevant ?? false,
    erfasstVonUserId: USER_ID,
    kontextSnapshot: VALID_SNAPSHOT,
    now: NOW,
  }).value!;
}

describe('toEigenschutzVorfallDto (Story 5.1 + 5.2)', () => {
  it('(1) liefert vollständige Felder mit V1-kontextSnapshot (Story 5.2)', () => {
    const aggregate = buildAggregate({ unfallkasseRelevant: true });
    const dto = toEigenschutzVorfallDto(aggregate);

    expect(dto.id).toBe(aggregate.id.value);
    expect(dto.einsatzId).toBe(EINSATZ_ID);
    expect(dto.einheitId).toBe(EINHEIT_ID);
    expect(dto.vorfallZeit).toBe(NOW.toISOString());
    expect(dto.wann).toBe(NOW.toISOString());
    expect(dto.was).toBe('Sturz');
    expect(dto.wo).toBeNull();
    expect(dto.beteiligte).toEqual([]);
    expect(dto.massnahmen).toBe('Erstversorgung');
    expect(dto.unfallkasseRelevant).toBe(true);
    expect((dto.kontextSnapshot as { schemaVersion: number }).schemaVersion).toBe(1);
    expect(dto.gefBeurteilungVersionId).toBeNull();
    expect(typeof dto.erfasstAm).toBe('string');
    expect(dto.erfasstVonUserId).toBe(USER_ID);
  });

  it('(2) Beteiligter-Round-Trip behält Mix aus User+Freitext', () => {
    const beteiligte = [Beteiligter.create({ kind: 'einsatzPerson', einsatzPersonId: USER_ID }).value!, Beteiligter.create({ kind: 'freitext', name: 'Max', rolle: 'Sanitäter' }).value!];
    const aggregate = buildAggregate({ beteiligte });
    const dto = toEigenschutzVorfallDto(aggregate);

    expect(dto.beteiligte).toEqual([
      { kind: 'einsatzPerson', einsatzPersonId: USER_ID },
      { kind: 'freitext', name: 'Max', rolle: 'Sanitäter' },
    ]);
  });

  it('(3) Wo-Coordinate wird als Plain-Object serialisiert', () => {
    const wo = Wo.create({ kind: 'coordinate', longitude: 8.6821, latitude: 50.1109 }).value!;
    const aggregate = buildAggregate({ wo });
    const dto = toEigenschutzVorfallDto(aggregate);

    expect(dto.wo).toEqual({ kind: 'coordinate', longitude: 8.6821, latitude: 50.1109 });
  });

  it('(4) Wo=null bleibt null im DTO (Empty-String-Sentinel ist Mapper-Detail)', () => {
    const aggregate = buildAggregate({ wo: null });
    const dto = toEigenschutzVorfallDto(aggregate);

    expect(dto.wo).toBeNull();
  });
});
