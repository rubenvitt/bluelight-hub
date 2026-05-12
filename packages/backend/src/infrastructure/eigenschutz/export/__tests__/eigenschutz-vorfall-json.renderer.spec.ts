import { EigenschutzVorfallExportV1 } from '../../../../../../shared/src/schemas/eigenschutz/eigenschutz-vorfall-export.schema';
import { EigenschutzVorfallJsonRenderer } from '../eigenschutz-vorfall-json.renderer';
import { EigenschutzVorfall } from '@domain/eigenschutz/aggregates/eigenschutz-vorfall.aggregate';
import { Beteiligter } from '@domain/eigenschutz/value-objects/beteiligter.vo';
import { Wo } from '@domain/eigenschutz/value-objects/wo.vo';

const EINSATZ_ID = 'clw3h8x9y0000qwertyui05001';
const EINHEIT_ID = 'clw3h8x9y0000qwertyui05002';
const VORFALL_ID = 'clw3h8x9y0000qwertyui05010';
const ERFASSER_ID = 'clw3h8x9y0000qwertyui05003';
const CALLER_ID = 'clw3h8x9y0000qwertyui05004';
const NOW = new Date('2026-05-07T10:30:00.000Z');

interface SnapshotOverrides {
  empty?: boolean;
  invalidExtraField?: boolean;
  gefaehrdungItems?: number;
  psaProfile?: number;
  sicherheitsregeln?: number;
}

function buildSnapshot(overrides: SnapshotOverrides = {}): Record<string, unknown> {
  if (overrides.empty) return {};
  const items = Array.from({ length: overrides.gefaehrdungItems ?? 10 }, (_, i) => ({
    id: `clw3h8x9y0000qwertyui05${String(100 + i).padStart(3, '0')}`,
    title: `Gefährdung ${i + 1}`,
    description: `Beschreibung der Gefährdung ${i + 1}`,
    eintritt: 'HAEUFIG' as const,
    schaden: 'KATASTROPHAL' as const,
    risikoklasse: 'ROT' as const,
    schutzmassnahmen: 'PSA tragen, Bereich absperren',
  }));
  const psa = Array.from({ length: overrides.psaProfile ?? 3 }, (_, i) => ({
    id: `clw3h8x9y0000qwertyui05${String(200 + i).padStart(3, '0')}`,
    profil: ['BASIS', 'INFEKTION', 'VU'][i % 3] as 'BASIS' | 'INFEKTION' | 'VU',
    gueltigVon: '2026-05-07T08:00:00.000+00:00',
    gueltigBis: null,
    begruendung: 'Ärztliche Anordnung',
    propagationGroupId: `clw3h8x9y0000qwertyui05${String(300 + i).padStart(3, '0')}`,
  }));
  const regeln = Array.from({ length: overrides.sicherheitsregeln ?? 5 }, (_, i) => ({
    regelId: `clw3h8x9y0000qwertyui05${String(400 + i).padStart(3, '0')}`,
    versionId: `clw3h8x9y0000qwertyui05${String(500 + i).padStart(3, '0')}`,
    version: 1,
    titel: `Regel ${i + 1}`,
    inhalt: `Erläuterung der Regel ${i + 1}`,
    einsatzweit: i % 2 === 0,
    einheitIds: [EINHEIT_ID],
    gueltigVon: '2026-05-07T08:00:00.000+00:00',
  }));
  const snapshot: Record<string, unknown> = {
    schemaVersion: 1,
    snapshotAt: '2026-05-07T10:00:00.000+00:00',
    einsatzId: EINSATZ_ID,
    einheitId: EINHEIT_ID,
    gefaehrdungsbeurteilung: {
      versionId: 'clw3h8x9y0000qwertyui05088',
      version: 3,
      gueltigVon: '2026-05-07T08:00:00.000+00:00',
      items,
    },
    aktivePsaProfile: psa,
    sicherheitsregeln: regeln,
  };
  if (overrides.invalidExtraField) {
    snapshot.invalidExtraField = 'x';
  }
  return snapshot;
}

function buildAggregate(snapshot: Record<string, unknown>): EigenschutzVorfall {
  const beteiligte = [
    Beteiligter.create({ kind: 'einsatzPerson', einsatzPersonId: ERFASSER_ID, rolle: 'San' }).value!,
    Beteiligter.create({ kind: 'freitext', name: 'Hans Müller', rolle: 'Patient' }).value!,
    Beteiligter.create({ kind: 'einsatzPerson', einsatzPersonId: CALLER_ID }).value!,
    Beteiligter.create({ kind: 'freitext', name: 'Anna Schmidt' }).value!,
    Beteiligter.create({ kind: 'einsatzPerson', einsatzPersonId: 'clw3h8x9y0000qwertyui05009' }).value!,
  ];
  const wo = Wo.create({ kind: 'coordinate', longitude: 8.6789, latitude: 50.12345, addressHint: 'Hauptstraße 12' }).value!;
  const result = EigenschutzVorfall.reconstitute({
    id: VORFALL_ID,
    einsatzId: EINSATZ_ID,
    einheitId: EINHEIT_ID,
    vorfallZeit: NOW,
    wann: NOW,
    was: 'Sturz beim Aufstieg ins Fahrzeug — äöüß',
    wo,
    beteiligte,
    massnahmen: 'Erste Hilfe geleistet, Rettungsdienst informiert (äöüß)',
    unfallkasseRelevant: true,
    erfasstVonUserId: ERFASSER_ID,
    erfasstAm: NOW,
    kontextSnapshot: snapshot,
    gefBeurteilungVersionId: snapshot.gefaehrdungsbeurteilung ? ((snapshot.gefaehrdungsbeurteilung as Record<string, unknown>).versionId as string) : null,
  });
  if (result.isFailure || !result.value) throw new Error(`Reconstitute failed: ${result.error}`);
  return result.value;
}

describe('EigenschutzVorfallJsonRenderer (Story 5.5)', () => {
  it('(1) erzeugt Buffer > 1000 Bytes für Standard-Vorfall und besteht Zod-Roundtrip', async () => {
    const renderer = new EigenschutzVorfallJsonRenderer();
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    const parsed = JSON.parse(buffer.toString('utf-8')) as unknown;
    expect(() => EigenschutzVorfallExportV1.parse(parsed)).not.toThrow();
  });

  it('(2) Body enthält schemaVersion === 1 und exportFormat === "json"', async () => {
    const renderer = new EigenschutzVorfallJsonRenderer();
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    const body = JSON.parse(buffer.toString('utf-8')) as Record<string, unknown>;
    expect(body.schemaVersion).toBe(1);
    expect(body.exportFormat).toBe('json');
  });

  it('(3) exportedAt ist gültiger ISO-8601-Datetime mit Offset oder Z', async () => {
    const renderer = new EigenschutzVorfallJsonRenderer();
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    const body = JSON.parse(buffer.toString('utf-8')) as { exportedAt: string };
    const parsed = Date.parse(body.exportedAt);
    expect(Number.isFinite(parsed)).toBe(true);
    expect(body.exportedAt).toMatch(/(Z|[+-]\d{2}:\d{2})$/);
  });

  it('(4) exportedByUserId entspricht klar dem erzeugtVonUserId', async () => {
    const renderer = new EigenschutzVorfallJsonRenderer();
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    const body = JSON.parse(buffer.toString('utf-8')) as { exportedByUserId: string };
    expect(body.exportedByUserId).toBe(CALLER_ID);
  });

  it('(5) vorfall-Stammdaten 1:1 + UTF-8-Umlaute werden NICHT als \\uXXXX escaped', async () => {
    const renderer = new EigenschutzVorfallJsonRenderer();
    const aggregate = buildAggregate(buildSnapshot());
    const buffer = await renderer.generate({
      vorfall: aggregate,
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    const utf8 = buffer.toString('utf-8');
    expect(utf8).toContain('äöüß');
    // JSON.stringify darf deutsche Sonderzeichen nicht in `\uXXXX`-Escapes
    // umwandeln — der Roh-String enthält alle vier Klassen direkt.
    // Code-Points: ä=00e4, ö=00f6, ü=00fc, ß=00df.
    expect(utf8).not.toMatch(/\\u00(e4|f6|fc|df)/i);

    const body = JSON.parse(utf8) as { vorfall: { id: string; einsatzId: string; einheitId: string; was: string; massnahmen: string } };
    expect(body.vorfall.id).toBe(aggregate.id.value);
    expect(body.vorfall.einsatzId).toBe(EINSATZ_ID);
    expect(body.vorfall.einheitId).toBe(EINHEIT_ID);
    expect(body.vorfall.was).toContain('äöüß');
    expect(body.vorfall.massnahmen).toContain('äöüß');
  });

  it('(6) beteiligte mischt user und freitext und behält den Discriminator', async () => {
    const renderer = new EigenschutzVorfallJsonRenderer();
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    const body = JSON.parse(buffer.toString('utf-8')) as {
      vorfall: { beteiligte: Array<{ kind: string; userId?: string; name?: string; rolle?: string | null }> };
    };
    const beteiligte = body.vorfall.beteiligte;
    expect(beteiligte).toHaveLength(5);
    expect(beteiligte.filter((b) => b.kind === 'einsatzPerson')).toHaveLength(3);
    expect(beteiligte.filter((b) => b.kind === 'freitext')).toHaveLength(2);
    const freitextEntry = beteiligte.find((b) => b.kind === 'freitext' && b.name === 'Anna Schmidt');
    expect(freitextEntry?.rolle).toBeNull();
    // User-Beteiligte propagieren `rolle` symmetrisch zum PDF-Pfad (D1):
    // ERFASSER_ID hat 'San', CALLER_ID/clw…05009 haben kein rolle → null.
    const userMitRolle = beteiligte.find((b) => b.kind === 'einsatzPerson' && b.userId === ERFASSER_ID);
    expect(userMitRolle?.rolle).toBe('San');
    const userOhneRolle = beteiligte.find((b) => b.kind === 'einsatzPerson' && b.userId === CALLER_ID);
    expect(userOhneRolle?.rolle).toBeNull();
  });

  it('(7) Empty-Snapshot-Pfad: kontextSnapshot={} und kontextSnapshotIsLegacyEmpty=true', async () => {
    const renderer = new EigenschutzVorfallJsonRenderer();
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot({ empty: true })),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    const body = JSON.parse(buffer.toString('utf-8')) as { kontextSnapshot: Record<string, unknown>; kontextSnapshotIsLegacyEmpty: boolean };
    expect(body.kontextSnapshot).toEqual({});
    expect(body.kontextSnapshotIsLegacyEmpty).toBe(true);
  });

  it('(8) Voll-Snapshot-Pfad: V1-Shape passt durch; Legacy-Marker false', async () => {
    const renderer = new EigenschutzVorfallJsonRenderer();
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    const body = JSON.parse(buffer.toString('utf-8')) as {
      kontextSnapshot: { schemaVersion: number; aktivePsaProfile: unknown[]; sicherheitsregeln: unknown[] };
      kontextSnapshotIsLegacyEmpty: boolean;
    };
    expect(body.kontextSnapshotIsLegacyEmpty).toBe(false);
    expect(body.kontextSnapshot.schemaVersion).toBe(1);
    expect(Array.isArray(body.kontextSnapshot.aktivePsaProfile)).toBe(true);
    expect(Array.isArray(body.kontextSnapshot.sicherheitsregeln)).toBe(true);
  });

  it('(9) Schema-Drift: Snapshot mit unbekanntem Top-Level-Feld → Renderer wirft Sentinel-Error', async () => {
    const renderer = new EigenschutzVorfallJsonRenderer();
    const aggregate = buildAggregate(buildSnapshot());
    // `Object.defineProperty` über den öffentlichen Getter — kein Zugriff auf
    // ein internes Feld-Symbol. In Produktion blockiert
    // `EigenschutzVorfall.reconstitute` derart driftende Snapshots; dieser
    // Test fixiert die Defense-in-Depth des Renderers für den Fall, dass
    // der Aggregate-Pfad jemals umgeht wird.
    const driftSnapshot = buildSnapshot({ invalidExtraField: true });
    Object.defineProperty(aggregate, 'kontextSnapshot', {
      value: driftSnapshot,
      configurable: true,
    });

    await expect(
      renderer.generate({
        vorfall: aggregate,
        erzeugtAm: NOW,
        erzeugtVonUserId: CALLER_ID,
      }),
    ).rejects.toThrow(/SchemaValidationFailed/);
  });

  it('(10) Performance-Smoke: Standard-Vorfall < 1000 ms', async () => {
    const renderer = new EigenschutzVorfallJsonRenderer();
    const start = Date.now();
    await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('(11) Top-Level-Feld-Reihenfolge ist deterministisch (schemaVersion zuerst, kontextSnapshotIsLegacyEmpty zuletzt)', async () => {
    const renderer = new EigenschutzVorfallJsonRenderer();
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    const body = JSON.parse(buffer.toString('utf-8')) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['schemaVersion', 'exportFormat', 'exportedAt', 'exportedByUserId', 'vorfall', 'kontextSnapshot', 'kontextSnapshotIsLegacyEmpty']);
  });
});
