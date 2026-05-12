// Relativer Pfad in Shared-Source — Backend ist (noch) nicht ESM-migriert,
// SWC transpiliert die TS-Quelle direkt (Pattern Story 5.2 / 3.11).
import { EigenschutzVorfallExportV1 as SharedExportSchema } from '../../../../../shared/src/schemas/eigenschutz/eigenschutz-vorfall-export.schema';
import { EigenschutzVorfallExportV1 as BackendExportSchema } from '@domain/eigenschutz/schemas/eigenschutz-vorfall-export.schema';

/**
 * Story 5.5 AC1 — Drift-Detection zwischen Backend-Kopie und Shared-Quelle
 * des `EigenschutzVorfallExportV1`-Schemas. Solange das Backend nicht auf
 * ESM migriert ist, dupliziert die Schema-Datei (siehe Header-Doc); dieser
 * Test garantiert, dass beide Kopien identisch validieren.
 */
describe('EigenschutzVorfallExportV1 (Story 5.5 AC1) — Drift-Detection', () => {
  const validExport = {
    schemaVersion: 1 as const,
    exportFormat: 'json' as const,
    exportedAt: '2026-05-07T10:30:00.000+00:00',
    exportedByUserId: 'cl9caller1234567890123456',
    vorfall: {
      id: 'cl9vorfall12345678901234x',
      einsatzId: 'cl9einsatz12345678901234',
      einheitId: 'cl9einheit12345678901234a',
      vorfallZeit: '2026-05-07T10:00:00.000+00:00',
      wann: '2026-05-07T10:00:00.000+00:00',
      was: 'Sturz beim Aufbau',
      wo: null,
      beteiligte: [{ kind: 'freitext' as const, name: 'Max Mustermann', rolle: null }],
      massnahmen: 'Erstversorgung',
      unfallkasseRelevant: true,
      erfasstAm: '2026-05-07T10:01:00.000+00:00',
      erfasstVonUserId: 'cl9user12345678901234567a',
      gefBeurteilungVersionId: null,
    },
    kontextSnapshot: {},
    kontextSnapshotIsLegacyEmpty: true,
  };

  it('akzeptiert in beiden Kopien einen vollständigen, valide-konformen Export', () => {
    expect(SharedExportSchema.safeParse(validExport).success).toBe(true);
    expect(BackendExportSchema.safeParse(validExport).success).toBe(true);
  });

  it('lehnt schemaVersion !== 1 in beiden Kopien ab', () => {
    const drift = { ...validExport, schemaVersion: 2 as never };
    expect(SharedExportSchema.safeParse(drift).success).toBe(false);
    expect(BackendExportSchema.safeParse(drift).success).toBe(false);
  });

  it('lehnt unbekannte Top-Level-Properties in beiden Kopien ab (.strict)', () => {
    const drift = { ...validExport, extraField: 'nope' };
    expect(SharedExportSchema.safeParse(drift).success).toBe(false);
    expect(BackendExportSchema.safeParse(drift).success).toBe(false);
  });

  it('lehnt exportFormat !== "json" in beiden Kopien ab', () => {
    const drift = { ...validExport, exportFormat: 'pdf' as never };
    expect(SharedExportSchema.safeParse(drift).success).toBe(false);
    expect(BackendExportSchema.safeParse(drift).success).toBe(false);
  });

  it('akzeptiert V1-konformen kontextSnapshot mit kontextSnapshotIsLegacyEmpty=false', () => {
    const fullSnapshot = {
      schemaVersion: 1 as const,
      snapshotAt: '2026-05-07T10:00:00.000+00:00',
      einsatzId: 'cl9einsatz12345678901234',
      einheitId: 'cl9einheit12345678901234a',
      gefaehrdungsbeurteilung: null,
      aktivePsaProfile: [],
      sicherheitsregeln: [],
    };
    const candidate = { ...validExport, kontextSnapshot: fullSnapshot, kontextSnapshotIsLegacyEmpty: false };
    expect(SharedExportSchema.safeParse(candidate).success).toBe(true);
    expect(BackendExportSchema.safeParse(candidate).success).toBe(true);
  });

  it('lehnt unbekannte Properties unter `vorfall` in beiden Kopien ab (nested .strict)', () => {
    const drift = { ...validExport, vorfall: { ...validExport.vorfall, extraVorfallField: 'nope' } };
    expect(SharedExportSchema.safeParse(drift).success).toBe(false);
    expect(BackendExportSchema.safeParse(drift).success).toBe(false);
  });

  it('lehnt unbekannte Properties auf einem Beteiligten in beiden Kopien ab (nested .strict)', () => {
    const drift = {
      ...validExport,
      vorfall: {
        ...validExport.vorfall,
        beteiligte: [{ kind: 'freitext' as const, name: 'Max', rolle: null, extraBeteiligterField: 'nope' }],
      },
    };
    expect(SharedExportSchema.safeParse(drift).success).toBe(false);
    expect(BackendExportSchema.safeParse(drift).success).toBe(false);
  });

  it('lehnt unbekannte Properties auf einem `wo`-Coordinate in beiden Kopien ab (nested .strict)', () => {
    const drift = {
      ...validExport,
      vorfall: {
        ...validExport.vorfall,
        wo: { kind: 'coordinate' as const, lat: 50.1, lon: 8.6, addressHint: null, extraWoField: 'nope' },
      },
    };
    expect(SharedExportSchema.safeParse(drift).success).toBe(false);
    expect(BackendExportSchema.safeParse(drift).success).toBe(false);
  });

  it('akzeptiert User-Beteiligten mit `rolle` (D1 — Symmetrie zu PDF/DTO)', () => {
    const candidate = {
      ...validExport,
      vorfall: {
        ...validExport.vorfall,
        beteiligte: [{ kind: 'einsatzPerson' as const, einsatzPersonId: 'cl9user12345678901234567b', rolle: 'San' }],
      },
    };
    expect(SharedExportSchema.safeParse(candidate).success).toBe(true);
    expect(BackendExportSchema.safeParse(candidate).success).toBe(true);
  });

  it('lehnt User-Beteiligten ohne `rolle`-Feld ab (Schema verlangt es als nullable string)', () => {
    const drift = {
      ...validExport,
      vorfall: {
        ...validExport.vorfall,
        beteiligte: [{ kind: 'einsatzPerson' as const, einsatzPersonId: 'cl9user12345678901234567b' } as never],
      },
    };
    expect(SharedExportSchema.safeParse(drift).success).toBe(false);
    expect(BackendExportSchema.safeParse(drift).success).toBe(false);
  });
});
