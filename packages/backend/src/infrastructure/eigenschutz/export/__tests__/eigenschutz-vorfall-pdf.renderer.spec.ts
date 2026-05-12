import { EigenschutzVorfallPdfRenderer } from '../eigenschutz-vorfall-pdf.renderer';
import { EigenschutzVorfall } from '@domain/eigenschutz/aggregates/eigenschutz-vorfall.aggregate';
import { Beteiligter } from '@domain/eigenschutz/value-objects/beteiligter.vo';
import { Wo } from '@domain/eigenschutz/value-objects/wo.vo';
import * as redactModule from '@/shared/utils/pii-redact.util';

const EINSATZ_ID = 'clw3h8x9y0000qwertyui05001';
const EINHEIT_ID = 'clw3h8x9y0000qwertyui05002';
const VORFALL_ID = 'clw3h8x9y0000qwertyui05010';
const ERFASSER_ID = 'clw3h8x9y0000qwertyui05003';
const CALLER_ID = 'clw3h8x9y0000qwertyui05004';
const NOW = new Date('2026-05-06T10:00:00.000Z');

interface SnapshotOverrides {
  empty?: boolean;
  driftAktivePsaProfile?: unknown;
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
    gueltigVon: '2026-05-06T08:00:00.000+00:00',
    gueltigBis: null,
    begruendung: 'Ärztliche Anordnung',
    propagationGroupId: `clw3h8x9y0000qwertyui05${String(300 + i).padStart(3, '0')}`,
  }));
  const regeln = Array.from({ length: overrides.sicherheitsregeln ?? 5 }, (_, i) => ({
    regelId: `clw3h8x9y0000qwertyui05${String(400 + i).padStart(3, '0')}`,
    versionId: `clw3h8x9y0000qwertyui05${String(500 + i).padStart(3, '0')}`,
    version: 1,
    titel: `Regel ${i + 1}`,
    inhalt: `Lange Erläuterung der Regel ${i + 1}. ` + 'Inhalt '.repeat(40),
    einsatzweit: i % 2 === 0,
    einheitIds: [EINHEIT_ID],
    gueltigVon: '2026-05-06T08:00:00.000+00:00',
  }));
  const snapshot: Record<string, unknown> = {
    schemaVersion: 1,
    snapshotAt: '2026-05-06T10:00:00.000+00:00',
    einsatzId: EINSATZ_ID,
    einheitId: EINHEIT_ID,
    gefaehrdungsbeurteilung: {
      versionId: 'clw3h8x9y0000qwertyui05088',
      version: 3,
      gueltigVon: '2026-05-06T08:00:00.000+00:00',
      items,
    },
    aktivePsaProfile: psa,
    sicherheitsregeln: regeln,
  };
  if (overrides.driftAktivePsaProfile !== undefined) {
    snapshot.aktivePsaProfile = overrides.driftAktivePsaProfile;
  }
  return snapshot;
}

function buildAggregate(snapshot: Record<string, unknown>, opts: { beteiligteCount?: number } = {}): EigenschutzVorfall {
  const baseBeteiligte = [
    Beteiligter.create({ kind: 'einsatzPerson', einsatzPersonId: ERFASSER_ID, rolle: 'San' }).value!,
    Beteiligter.create({ kind: 'freitext', name: 'Hans Müller', rolle: 'Patient' }).value!,
    Beteiligter.create({ kind: 'einsatzPerson', einsatzPersonId: CALLER_ID }).value!,
    Beteiligter.create({ kind: 'freitext', name: 'Anna Schmidt' }).value!,
    Beteiligter.create({ kind: 'einsatzPerson', einsatzPersonId: 'clw3h8x9y0000qwertyui05009' }).value!,
  ];
  const requested = opts.beteiligteCount ?? baseBeteiligte.length;
  const beteiligte =
    requested <= baseBeteiligte.length
      ? baseBeteiligte.slice(0, requested)
      : [
          ...baseBeteiligte,
          ...Array.from({ length: requested - baseBeteiligte.length }, (_, i) => Beteiligter.create({ kind: 'freitext', name: `Worst-Case Beteiligter ${baseBeteiligte.length + i + 1}` }).value!),
        ];
  const wo = Wo.create({ kind: 'coordinate', longitude: 8.6789, latitude: 50.12345, addressHint: 'Hauptstraße 12' }).value!;
  const result = EigenschutzVorfall.reconstitute({
    id: VORFALL_ID,
    einsatzId: EINSATZ_ID,
    einheitId: EINHEIT_ID,
    vorfallZeit: NOW,
    wann: NOW,
    was: 'Sturz beim Aufstieg ins Fahrzeug',
    wo,
    beteiligte,
    massnahmen: 'Erste Hilfe geleistet, Rettungsdienst informiert',
    unfallkasseRelevant: true,
    erfasstVonUserId: ERFASSER_ID,
    erfasstAm: NOW,
    kontextSnapshot: snapshot,
    gefBeurteilungVersionId: snapshot.gefaehrdungsbeurteilung ? ((snapshot.gefaehrdungsbeurteilung as Record<string, unknown>).versionId as string) : null,
  });
  if (result.isFailure || !result.value) throw new Error(`Reconstitute failed: ${result.error}`);
  return result.value;
}

/**
 * pdfkit emittiert Text in `TJ`-Blöcken als hex-kodierte Strings (kerning-aware
 * Splits). `extractText(buffer)` enthält daher die *Hex-Repräsentation*
 * der Zeichen, nicht den Klartext. Dieser Helper sammelt alle Hex-Chunks aus
 * `TJ`-Blöcken (`[<HEX> ... <HEX> ...]`-Form) und konkateniert sie zu einem
 * suchbaren String — Substring-Asserts bleiben damit auch über kerning-bedingte
 * Chunk-Grenzen hinweg robust.
 */
function extractText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const tjBlocks = raw.match(/\[\s*<[^\]]+\]\s*TJ/g) ?? [];
  const out: string[] = [];
  for (const block of tjBlocks) {
    const hexChunks = block.match(/<([0-9a-fA-F]+)>/g) ?? [];
    let text = '';
    for (const chunk of hexChunks) {
      const hex = chunk.slice(1, -1);
      const bytes = Buffer.from(hex, 'hex');
      text += bytes.toString('latin1');
    }
    out.push(text);
  }
  return out.join('\n');
}

describe('EigenschutzVorfallPdfRenderer (Story 5.4)', () => {
  it('(1) erzeugt Buffer mit length > 1000 für Standard-Vorfall', async () => {
    const renderer = new EigenschutzVorfallPdfRenderer();
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('(2) Buffer beginnt mit %PDF Magic-Bytes (compress-unabhängig)', async () => {
    const renderer = new EigenschutzVorfallPdfRenderer();
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  // NFR-P5: lokal ≤ 5 s; CI-Hard-Limit ≤ 10 s
  it('(3) Performance-Smoke: Standard-Vorfall < 10 s (NFR-P5: lokal ≤ 5 s)', async () => {
    const renderer = new EigenschutzVorfallPdfRenderer();
    const start = Date.now();
    await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10000);
  });

  it('(4) leerer Snapshot ({}) rendert Hinweis ohne Throw', async () => {
    const renderer = new EigenschutzVorfallPdfRenderer({ compress: false });
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot({ empty: true })),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    expect(extractText(buffer)).toContain('Kontext-Snapshot nicht verfügbar');
  });

  it('(5) Schema-Drift: aktivePsaProfile als String → Hinweis statt Throw', async () => {
    const renderer = new EigenschutzVorfallPdfRenderer({ compress: false });
    // Reconstitute prüft strikt gegen das V1-Schema (rejectet non-Array PSA).
    // Für den Drift-Test bauen wir mit gültigem Snapshot auf und mutieren das
    // private `_kontextSnapshot`-Feld nachträglich, um den Renderer-Defense-Pfad
    // zu prüfen (nicht ideal, aber der Renderer ist Append-only-konsumentenseitig
    // und muss korrupte DB-JSONB-Daten tolerieren).
    const aggregate = buildAggregate(buildSnapshot());
    const driftSnapshot = { ...buildSnapshot(), aktivePsaProfile: 'not-an-array' as unknown };
    const mutated = aggregate as unknown as { _kontextSnapshot: Record<string, unknown> };
    mutated._kontextSnapshot = driftSnapshot;
    const buffer = await renderer.generate({
      vorfall: aggregate,
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    expect(extractText(buffer)).toContain('Daten-Format nicht lesbar');
  });

  it('(6) PII-Hygiene: Klar-IDs werden via redactId(id, 8) maskiert', async () => {
    const klarId = 'cuid2klaridnotredactedplease24';
    const renderer = new EigenschutzVorfallPdfRenderer({ compress: false });
    const aggregate = buildAggregate(buildSnapshot());
    const buffer = await renderer.generate({
      vorfall: aggregate,
      erzeugtAm: NOW,
      erzeugtVonUserId: klarId,
    });
    const text = extractText(buffer);

    // Output-zentriert: der deterministische Redact-Hash für jede ID muss im
    // PDF-Text erscheinen; der Klar-CUID darf in keinem Text-Run auftauchen
    // (DSGVO-Minimierung im exportierten PDF).
    //
    // Code-Review-Patch (P4): die ältere Version verglich gegen den `latin1`-
    // Roh-Buffer — pdfkit kodiert Glyphen jedoch hex in `TJ`-Blöcken, der
    // Klar-CUID stand also nie als latin1-Bytes drin. Der Check war damit
    // tautologisch. Wir vergleichen jetzt gegen den decoded `extractText`-
    // Output, der den tatsächlich gerenderten Text repräsentiert — falls
    // der Renderer eine Klar-ID schreiben würde, wäre sie hier sichtbar.
    for (const id of [klarId, EINSATZ_ID, VORFALL_ID, ERFASSER_ID]) {
      const expectedHash = redactModule.redactId(id, 8)!;
      expect(text).toContain(expectedHash);
      expect(text).not.toContain(id);
    }
  });

  it('(7) Header enthält Titel "Vorfall-Meldung Eigenschutz"', async () => {
    const renderer = new EigenschutzVorfallPdfRenderer({ compress: false });
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    expect(extractText(buffer)).toContain('Vorfall-Meldung Eigenschutz');
  });

  it('(8) Footer enthält Permission-String, Datum und Erzeugungs-Hinweis', async () => {
    const renderer = new EigenschutzVorfallPdfRenderer({ compress: false });
    const buffer = await renderer.generate({
      vorfall: buildAggregate(buildSnapshot()),
      erzeugtAm: NOW,
      erzeugtVonUserId: CALLER_ID,
    });
    const text = extractText(buffer);
    expect(text).toContain('Permission');
    expect(text).toContain('eigenschutz:vorfall:export');
    expect(text).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });

  /**
   * Story 7.10 AC6 — NFR-P5 Performance-Audit.
   *
   * **Begründung der deterministischen Backend-Wallclock-Messung statt Prometheus:**
   * Story-7.9-Deferred dokumentiert, dass `MetricsInterceptor` bei 404-Pfaden auf
   * `request.url` zurückfällt und das Grafana-Panel 5 (Vorfall-Export-Dauer) mit
   * 404-Datapoints kontaminieren würde. Diese Spec umgeht die Kontamination
   * komplett durch direkte Wallclock-Messung im Test.
   *
   * **Worst-Case-Snapshot:** 100 Gefährdungs-Items, 5 PSA-Profile, 10 Sicherheitsregeln,
   * 10 Beteiligte (begrenzt durch Aggregate-Konstruktion), 4000-Zeichen-Maßnahmen-Text.
   *
   * **Gate:** p95 (30 Iterationen) < 5000 ms (NFR-P5 Hard-Limit).
   */
  describe('NFR-P5 Performance-Audit (Story 7.10 AC6)', () => {
    function buildWorstCaseAggregate(): EigenschutzVorfall {
      const snapshot = buildSnapshot({ gefaehrdungItems: 100, psaProfile: 5, sicherheitsregeln: 10 });
      const aggregate = buildAggregate(snapshot, { beteiligteCount: 10 });
      // 4000-Zeichen-Maßnahmen-Text — mutiert nach Reconstitute, da der Worst-Case-Text
      // die Aggregate-Validierung sprengt (max-length-Constraint im VO). Renderer muss
      // mit Defense-Pfad das tolerieren.
      const worstCaseMassnahmen = 'Maßnahmenausführung Worst-Case: '.repeat(125).slice(0, 4000);
      const mutated = aggregate as unknown as { _massnahmen: string };
      const before = mutated._massnahmen;
      mutated._massnahmen = worstCaseMassnahmen;
      // Defensive Verifikation: bei zukünftigem Refactor auf `#massnahmen` (private-class-field)
      // wäre die Mutation ein silent no-op und die Spec würde nur die 47-Zeichen-Baseline messen.
      // Diese Assertion bricht laut statt leise.
      if (mutated._massnahmen !== worstCaseMassnahmen || before === worstCaseMassnahmen) {
        throw new Error('buildWorstCaseAggregate: _massnahmen-Override hat nicht gegriffen — vermutlich private-class-field-Refactor. Test ist nicht mehr Worst-Case-aussagefähig.');
      }
      return aggregate;
    }

    function percentile(sortedValues: number[], p: number): number {
      if (sortedValues.length === 0) return 0;
      const index = Math.min(sortedValues.length - 1, Math.floor(p * sortedValues.length));
      return sortedValues[index];
    }

    it(
      'p95 der Renderer-Wallclock liegt unter 5 s bei Worst-Case-Snapshot (NFR-P5)',
      async () => {
        const renderer = new EigenschutzVorfallPdfRenderer({ compress: false });
        const samples: number[] = [];
        const iterations = 30;

        for (let i = 0; i < iterations; i++) {
          const aggregate = buildWorstCaseAggregate();
          const start = Date.now();
          await renderer.generate({
            vorfall: aggregate,
            erzeugtAm: NOW,
            erzeugtVonUserId: CALLER_ID,
          });
          samples.push(Date.now() - start);
        }

        const sorted = [...samples].sort((a, b) => a - b);
        const min = sorted[0];
        const p50 = percentile(sorted, 0.5);
        const p95 = percentile(sorted, 0.95);
        const p99 = percentile(sorted, 0.99);
        const max = sorted[sorted.length - 1];

        // eslint-disable-next-line no-console
        console.info(`[Story 7.10 AC6] PDF-Renderer Wallclock: n=${iterations} min=${min}ms p50=${p50}ms p95=${p95}ms p99=${p99}ms max=${max}ms`);

        if (p95 >= 5000) {
          throw new Error(`NFR-P5 verletzt: p95=${p95}ms ≥ 5000ms. Verteilung: min=${min} p50=${p50} p95=${p95} p99=${p99} max=${max}`);
        }
        expect(p95).toBeLessThan(5000);
      },
      5 * 60 * 1000,
    );
  });
});
