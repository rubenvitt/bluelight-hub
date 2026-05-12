import { Injectable } from '@nestjs/common';
// Backend-lokale Schema-Kopie (siehe Header-Dokumentation der Schema-Datei).
// Drift-Detection gegen die shared-Quelle läuft im Test.
import { EigenschutzKontextSnapshotV1 } from '@domain/eigenschutz/schemas/eigenschutz-snapshot.schema';
import { EigenschutzVorfallExportV1, type EigenschutzVorfallExportV1Type } from '@domain/eigenschutz/schemas/eigenschutz-vorfall-export.schema';
import type { EigenschutzVorfallJsonInput, IEigenschutzVorfallJsonRenderer } from '@/application/eigenschutz/ports/i-eigenschutz-vorfall-json-renderer.port';
import { toEigenschutzVorfallDto } from '@/application/eigenschutz/dto/eigenschutz-vorfall.factory';
import type { BeteiligterFreitextDto, BeteiligterEinsatzPersonDto, WoCoordinateDto, WoFreitextDto } from '@/application/eigenschutz/dto/report-vorfall.dto';

/**
 * Sentinel-Error-Prefix für Schema-Validation-Failures im JSON-Export-Pfad
 * (AC3 Z. 255). Controller/Logger erkennen den Prefix und mappen auf 500
 * ohne Schema-Details im Response (Information-Disclosure-Schutz).
 */
const SCHEMA_VALIDATION_FAILED_PREFIX = 'InfrastructureError:VorfallJsonExport:SchemaValidationFailed';

/**
 * Story 5.5 — JSON-Renderer für den Eigenschutz-Vorfall-Export (FR35).
 *
 * Self-contained: liest ausschließlich aus dem Aggregate + dem darin
 * eingebetteten `kontextSnapshot`. Keine Live-Joins, keine Repository-
 * Aufrufe, keine I/O. Pattern 1:1 zum `EigenschutzVorfallPdfRenderer`
 * (Story 5.4) — der Zod-`parse` ersetzt pdfkit als Output-Korrektheits-Anker.
 *
 * **PII-Hygiene:** im Gegensatz zum PDF-Pfad werden Identifier hier **klar**
 * geschrieben. Der JSON-Body ist für Maschinen-Konsum bestimmt
 * (Unfallkassen-Portale, FR35); klare User-/Vorfall-IDs sind notwendig für
 * Auflösung im Ziel-System. Schutz erfolgt über Permission-Gate und
 * `Cache-Control: no-store, private`-Header (Controller-seitig).
 */
@Injectable()
export class EigenschutzVorfallJsonRenderer implements IEigenschutzVorfallJsonRenderer {
  async generate(input: EigenschutzVorfallJsonInput): Promise<Buffer> {
    const exportObj = this.buildExport(input);
    let parsed: EigenschutzVorfallExportV1Type;
    try {
      parsed = EigenschutzVorfallExportV1.parse(exportObj);
    } catch (cause) {
      throw new Error(`${SCHEMA_VALIDATION_FAILED_PREFIX}:exportSchema`, { cause });
    }
    return Buffer.from(JSON.stringify(parsed, null, 2), 'utf-8');
  }

  private buildExport(input: EigenschutzVorfallJsonInput): EigenschutzVorfallExportV1Type {
    const { kontextSnapshot: rawSnapshot, gefBeurteilungVersionId, wo, beteiligte, ...vorfallRest } = toEigenschutzVorfallDto(input.vorfall);

    const isLegacyEmpty = Object.keys(rawSnapshot).length === 0;
    // Diskriminator vor Schema-Parse: bei V1-Pfad explizit gegen das
    // Snapshot-Schema validieren — saubere Error-Message statt Union-Cryptic.
    // `as unknown` ist nötig, weil `kontextSnapshot` im DTO als
    // `Record<string, unknown>` typisiert ist; Zod führt die Laufzeit-
    // Validierung gegen `EigenschutzKontextSnapshotV1` durch.
    let validatedSnapshot: Record<string, never> | ReturnType<typeof EigenschutzKontextSnapshotV1.parse>;
    if (isLegacyEmpty) {
      validatedSnapshot = {} as Record<string, never>;
    } else {
      try {
        validatedSnapshot = EigenschutzKontextSnapshotV1.parse(rawSnapshot as unknown);
      } catch (cause) {
        throw new Error(`${SCHEMA_VALIDATION_FAILED_PREFIX}:kontextSnapshot`, { cause });
      }
    }

    const exportObj: EigenschutzVorfallExportV1Type = {
      schemaVersion: 1,
      exportFormat: 'json',
      exportedAt: input.erzeugtAm.toISOString(),
      exportedByUserId: input.erzeugtVonUserId,
      vorfall: {
        ...vorfallRest,
        wo: serializeWo(wo),
        beteiligte: beteiligte.map(serializeBeteiligter),
        // Type-Tightening: DTO-Feld ist `optional UND nullable`; das Export-
        // Schema verlangt strikt `string | null`. `?? null` deckt beide
        // `undefined`-Quellen ab (DTO-Refactor + Aggregate-Getter).
        gefBeurteilungVersionId: gefBeurteilungVersionId ?? null,
      },
      kontextSnapshot: validatedSnapshot,
      kontextSnapshotIsLegacyEmpty: isLegacyEmpty,
    };

    return exportObj;
  }
}

function serializeWo(wo: WoCoordinateDto | WoFreitextDto | null): EigenschutzVorfallExportV1Type['vorfall']['wo'] {
  if (wo === null) return null;
  if (wo.kind === 'coordinate') {
    return {
      kind: 'coordinate',
      lat: wo.latitude,
      lon: wo.longitude,
      addressHint: wo.addressHint ?? null,
    };
  }
  return { kind: 'freitext', text: wo.text };
}

function serializeBeteiligter(b: BeteiligterEinsatzPersonDto | BeteiligterFreitextDto): EigenschutzVorfallExportV1Type['vorfall']['beteiligte'][number] {
  if (b.kind === 'einsatzPerson') {
    return { kind: 'einsatzPerson', einsatzPersonId: b.einsatzPersonId, rolle: b.rolle ?? null };
  }
  return { kind: 'freitext', name: b.name, rolle: b.rolle ?? null };
}
