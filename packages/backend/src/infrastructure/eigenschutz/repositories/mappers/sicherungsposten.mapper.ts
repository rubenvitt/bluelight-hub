import type { Sicherungsposten as PrismaSicherungspostenRow, SicherungspostenVersion as PrismaSicherungspostenVersionRow } from '@/generated/prisma/client';
import { Result } from '@domain/common/result';
import { Sicherungsposten } from '@domain/eigenschutz/aggregates/sicherungsposten.aggregate';
import type { SicherungspostenVersionReadModel } from '@domain/eigenschutz/repositories';
import { Standort, type PersonalEntryProps, type StandortProps } from '@domain/eigenschutz/value-objects/standort.vo';

/**
 * Mapper zwischen Prisma-Row (`sicherungsposten` / `sicherungsposten_versionen`)
 * und Domain-Aggregat. Defensive Rehydration: ein korruptes JSONB-Feld wird
 * als reconstitute-Failure an den Caller zurückgereicht (und vom Repository
 * auf einen `InfrastructureError`-Sentinel gemappt) — niemals stumm geschluckt.
 */
export class PrismaSicherungspostenMapper {
  static toDomain(row: PrismaSicherungspostenRow): Result<Sicherungsposten> {
    const standortPropsResult = PrismaSicherungspostenMapper.parseStandort(row.standort);
    if (standortPropsResult.isFailure || !standortPropsResult.value) {
      return Result.fail<Sicherungsposten>(standortPropsResult.error ?? 'Standort konnte nicht gelesen werden');
    }
    const standortResult = Standort.create(standortPropsResult.value);
    if (standortResult.isFailure || !standortResult.value) {
      return Result.fail<Sicherungsposten>(standortResult.error ?? 'Standort ungültig');
    }

    const personal = PrismaSicherungspostenMapper.parsePersonal(row.personal);

    return Sicherungsposten.reconstitute({
      id: row.id,
      einsatzId: row.einsatzId,
      bezeichnung: row.bezeichnung,
      standort: standortResult.value,
      personal,
      createdBy: row.erstelltVonUserId,
      einheitId: row.einheitId,
      zustaendigkeitsbereich: row.zustaendigkeitsbereich,
      abloesezeiten: row.abloesezeiten,
      version: row.version,
      aufgeloestAm: row.aufgeloestAm,
      aufgeloestVonUserId: row.aufgeloestVonUserId,
      aufloeseBegruendung: row.aufloeseBegruendung,
    });
  }

  static toVersionReadModel(row: PrismaSicherungspostenVersionRow): SicherungspostenVersionReadModel {
    return {
      postenId: row.postenId,
      version: row.version,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      gueltigVon: row.gueltigVon,
      gueltigBis: row.gueltigBis,
      changedByUserId: row.changedByUserId,
      eventId: row.eventId,
    };
  }

  /**
   * Serialisiert die für den Versions-Snapshot relevanten Top-Level-Felder
   * eines Aggregates. Die DTO-/Event-Layer können den Snapshot 1:1 lesen,
   * ohne ein Aggregate zu rehydrieren.
   */
  static toVersionPayload(aggregate: Sicherungsposten): Record<string, unknown> {
    return {
      bezeichnung: aggregate.bezeichnung,
      standort: aggregate.standort.toJSON(),
      personal: aggregate.personal.map((entry) => ({ ...entry })),
      einheitId: aggregate.einheitId,
      zustaendigkeitsbereich: aggregate.zustaendigkeitsbereich,
      abloesezeiten: aggregate.abloesezeiten,
      version: aggregate.version,
      aufgeloestAm: aggregate.aufgeloestAm?.toISOString() ?? null,
      aufgeloestVonUserId: aggregate.aufgeloestVonUserId,
      aufloeseBegruendung: aggregate.aufloeseBegruendung,
    };
  }

  private static parseStandort(raw: unknown): Result<StandortProps> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return Result.fail<StandortProps>('Standort-Payload ist kein Objekt');
    }
    const value = raw as Record<string, unknown>;
    if (value.kind === 'coordinate') {
      // Strict typeof: kein Number()-Coercion (würde null/'' stumm zu 0 wandeln → Null-Insel-Posten).
      if (typeof value.longitude !== 'number' || !Number.isFinite(value.longitude)) {
        return Result.fail<StandortProps>('Standort.coordinate: longitude muss eine endliche Zahl sein');
      }
      if (typeof value.latitude !== 'number' || !Number.isFinite(value.latitude)) {
        return Result.fail<StandortProps>('Standort.coordinate: latitude muss eine endliche Zahl sein');
      }
      const addressHint = typeof value.addressHint === 'string' ? value.addressHint : undefined;
      return Result.ok({ kind: 'coordinate', longitude: value.longitude, latitude: value.latitude, ...(addressHint !== undefined ? { addressHint } : {}) });
    }
    if (value.kind === 'address') {
      const text = typeof value.text === 'string' ? value.text : '';
      return Result.ok({ kind: 'address', text });
    }
    return Result.fail<StandortProps>('Standort.kind ist unbekannt');
  }

  private static parsePersonal(raw: unknown): PersonalEntryProps[] {
    if (!Array.isArray(raw)) return [];
    const out: PersonalEntryProps[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const v = entry as Record<string, unknown>;
      if (v.kind === 'einsatzPerson' && typeof v.einsatzPersonId === 'string' && v.einsatzPersonId.length > 0 && v.einsatzPersonId.length <= 40) {
        out.push({ kind: 'einsatzPerson', einsatzPersonId: v.einsatzPersonId });
      } else if (v.kind === 'freitext' && typeof v.name === 'string' && v.name.length > 0 && v.name.length <= 200) {
        const rolle = typeof v.rolle === 'string' && v.rolle.length > 0 && v.rolle.length <= 120 ? v.rolle : undefined;
        out.push({ kind: 'freitext', name: v.name, ...(rolle ? { rolle } : {}) });
      }
    }
    return out;
  }
}
