import type { EigenschutzVorfall } from '@domain/eigenschutz/aggregates/eigenschutz-vorfall.aggregate';
import type { EigenschutzVorfallDto } from './eigenschutz-vorfall.dto';
import type { BeteiligterFreitextDto, BeteiligterEinsatzPersonDto, WoCoordinateDto, WoFreitextDto } from './report-vorfall.dto';

/**
 * Factory `EigenschutzVorfall → EigenschutzVorfallDto` (Story 5.1, AC6).
 */
export function toEigenschutzVorfallDto(aggregate: EigenschutzVorfall): EigenschutzVorfallDto {
  return {
    id: aggregate.id.value,
    einsatzId: aggregate.einsatzId,
    einheitId: aggregate.einheitId,
    vorfallZeit: aggregate.vorfallZeit.toISOString(),
    wann: aggregate.wann.toISOString(),
    was: aggregate.was,
    wo: serializeWo(aggregate.wo),
    beteiligte: aggregate.beteiligte.map((b) => ({ ...b }) as BeteiligterEinsatzPersonDto | BeteiligterFreitextDto),
    massnahmen: aggregate.massnahmen,
    unfallkasseRelevant: aggregate.unfallkasseRelevant,
    erfasstAm: aggregate.erfasstAm.toISOString(),
    erfasstVonUserId: aggregate.erfasstVonUserId,
    kontextSnapshot: aggregate.kontextSnapshot,
    gefBeurteilungVersionId: aggregate.gefBeurteilungVersionId,
  };
}

function serializeWo(wo: EigenschutzVorfall['wo']): WoCoordinateDto | WoFreitextDto | null {
  if (wo === null) return null;
  return wo.toJSON() as WoCoordinateDto | WoFreitextDto;
}
