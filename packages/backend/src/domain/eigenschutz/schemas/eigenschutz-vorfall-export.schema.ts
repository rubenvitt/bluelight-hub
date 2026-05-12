import { z } from 'zod';
import { cuidIdSchema, EigenschutzKontextSnapshotV1 } from './eigenschutz-snapshot.schema';

/**
 * Backend-Kopie des JSON-Export-Vertrags (Story 5.5 AC1).
 *
 * **Warum eine Kopie statt Re-Use von `@bluelight-hub/shared/schemas`?**
 * Backend ist (Stand Story 5.5) nicht ESM-migriert; der `package.json`-
 * `exports`-Map des shared-Pakets liefert nur ESM-Builds (`type: module`),
 * was `nest build` (CommonJS-tsc) nicht auflösen kann — und ein direkter
 * relativer Quell-Import (`../../../../../shared/src/...`) verletzt die
 * `rootDir`-Constraint des Backend-Builds. Pattern identisch zu
 * `eigenschutz-snapshot.schema.ts` und `telemetry-event.schema.ts`.
 *
 * **Vertrag:** Diese Datei spiegelt 1:1 die Shape von
 * `packages/shared/src/schemas/eigenschutz/eigenschutz-vorfall-export.schema.ts`.
 * Drift-Detection läuft im Test
 * (`__tests__/eigenschutz-vorfall-export.schema.spec.ts`) gegen die
 * shared-Quelle. Sobald das Backend auf ESM migriert ist, fällt die
 * Duplizierung weg.
 */

export const VorfallWoCoordinateExportV1 = z
  .object({
    kind: z.literal('coordinate'),
    lat: z.number(),
    lon: z.number(),
    addressHint: z.string().nullable(),
  })
  .strict();

export const VorfallWoFreitextExportV1 = z
  .object({
    kind: z.literal('freitext'),
    text: z.string(),
  })
  .strict();

export const VorfallWoExportV1 = z.discriminatedUnion('kind', [VorfallWoCoordinateExportV1, VorfallWoFreitextExportV1]);

export const VorfallBeteiligterEinsatzPersonExportV1 = z
  .object({
    kind: z.literal('einsatzPerson'),
    einsatzPersonId: cuidIdSchema,
    rolle: z.string().nullable(),
  })
  .strict();

export const VorfallBeteiligterFreitextExportV1 = z
  .object({
    kind: z.literal('freitext'),
    name: z.string(),
    rolle: z.string().nullable(),
  })
  .strict();

export const VorfallBeteiligterExportV1 = z.discriminatedUnion('kind', [VorfallBeteiligterEinsatzPersonExportV1, VorfallBeteiligterFreitextExportV1]);

export const EigenschutzVorfallExportV1 = z
  .object({
    schemaVersion: z.literal(1).describe('Schema-Version dieses Export-Formats. Phase-2-Formate erhalten eigene literal-Werte.'),
    exportFormat: z.literal('json').describe('Konkretes Export-Format. Aktuell ausschließlich `json`. Phase 2 kann `bayern-uk` etc. ergänzen.'),
    exportedAt: z.string().datetime({ offset: true }).describe('ISO-8601-Zeitpunkt der Export-Erzeugung (UTC oder mit Offset).'),
    exportedByUserId: cuidIdSchema.describe('CUID des Users, der den Export ausgelöst hat. Klar, nicht redacted — JSON ist für Maschinen-Konsum bestimmt.'),
    vorfall: z
      .object({
        id: cuidIdSchema.describe('CUID des Vorfalls.'),
        einsatzId: cuidIdSchema.describe('CUID des zugehörigen Einsatzes.'),
        einheitId: cuidIdSchema.describe('CUID der zugeordneten Einheit (Abschnitt).'),
        vorfallZeit: z.string().datetime({ offset: true }).describe('Tatsächlicher Zeitpunkt des Vorfalls (kann von Erfass-Zeit abweichen).'),
        wann: z.string().datetime({ offset: true }).describe('Erfass-Zeitpunkt im Sinne der Eingabe-UI.'),
        was: z.string().describe('Kurzbeschreibung des Vorfalls (1–80 Zeichen).'),
        wo: VorfallWoExportV1.nullable().describe('Vorfall-Ort als discriminated Union (Koordinate oder Freitext) oder `null`, wenn nicht angegeben.'),
        beteiligte: z.array(VorfallBeteiligterExportV1).describe('Liste der Beteiligten als discriminated Union (User-FK oder Freitext mit optionaler Rolle).'),
        massnahmen: z.string().describe('Eingeleitete Maßnahmen (Freitext, ≤ 4000 Zeichen).'),
        unfallkasseRelevant: z.boolean().describe('Markierung, ob der Vorfall an die Unfallkasse zu melden ist (FR32).'),
        erfasstAm: z.string().datetime({ offset: true }).describe('Server-Zeitpunkt der Persistierung (immutabel).'),
        erfasstVonUserId: cuidIdSchema.describe('CUID des Users, der den Vorfall erfasst hat.'),
        gefBeurteilungVersionId: cuidIdSchema.nullable().describe('Optionaler FK-Hint auf eine Gefährdungsbeurteilungs-Version zum Vorfall-Zeitpunkt.'),
      })
      .strict()
      .describe('Vorfall-Stammdaten (1:1-Spiegel des `EigenschutzVorfallDto` ohne `kontextSnapshot`).'),
    kontextSnapshot: z
      .union([EigenschutzKontextSnapshotV1, z.object({}).strict()])
      .describe('Zeitpunkt-genauer Kontext-Snapshot (Gefährdung, PSA-Profile, Sicherheitsregeln). Leeres Objekt für Legacy-Vorfälle aus Story-5.1-Zeit; sonst V1-konform.'),
    kontextSnapshotIsLegacyEmpty: z
      .boolean()
      .describe('Maschinen-lesbarer Marker: `true` bei Legacy-`{}`-Snapshot, `false` bei V1-konformem Snapshot. Konsument kann darauf reagieren (z. B. Warnung im Portal).'),
  })
  .strict()
  .describe('Vollständige Export-Struktur eines Vorfalls für Maschinen-Konsum (Unfallkassen-Portale, FR35). Versioniert via `schemaVersion: 1`.');

export type EigenschutzVorfallExportV1Type = z.infer<typeof EigenschutzVorfallExportV1>;
