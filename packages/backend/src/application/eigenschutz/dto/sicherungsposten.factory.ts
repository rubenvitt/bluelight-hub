import type { Sicherungsposten } from '@domain/eigenschutz/aggregates/sicherungsposten.aggregate';
import { PersonalEinsatzPersonEntryDto, PersonalFreitextEntryDto, SicherungspostenDto, StandortAddressDto, StandortCoordinateDto } from './sicherungsposten.dto';

/**
 * Mapped ein Aggregate plus Persistenz-Metadaten auf das Response-DTO
 * (Story 4.1, AC7).
 */
export function toSicherungspostenDto(args: { aggregate: Sicherungsposten; erstelltAm: Date; aktualisiertAm: Date; aktualisiertVonUserId: string }): SicherungspostenDto {
  const { aggregate } = args;
  const dto = new SicherungspostenDto();
  dto.id = aggregate.id.value;
  dto.einsatzId = aggregate.einsatzId;
  dto.einheitId = aggregate.einheitId;
  dto.bezeichnung = aggregate.bezeichnung;

  const standortJson = aggregate.standort.toJSON();
  if (standortJson.kind === 'coordinate') {
    const coordinate = new StandortCoordinateDto();
    coordinate.kind = 'coordinate';
    coordinate.longitude = standortJson.longitude;
    coordinate.latitude = standortJson.latitude;
    if (standortJson.addressHint !== undefined) coordinate.addressHint = standortJson.addressHint;
    dto.standort = coordinate;
  } else {
    const address = new StandortAddressDto();
    address.kind = 'address';
    address.text = standortJson.text;
    dto.standort = address;
  }

  dto.personal = aggregate.personal.map((entry) => {
    if (entry.kind === 'einsatzPerson') {
      const ep = new PersonalEinsatzPersonEntryDto();
      ep.kind = 'einsatzPerson';
      ep.einsatzPersonId = entry.einsatzPersonId;
      return ep;
    }
    const freitext = new PersonalFreitextEntryDto();
    freitext.kind = 'freitext';
    freitext.name = entry.name;
    if (entry.rolle !== undefined) freitext.rolle = entry.rolle;
    return freitext;
  });

  dto.zustaendigkeitsbereich = aggregate.zustaendigkeitsbereich;
  dto.abloesezeiten = aggregate.abloesezeiten;
  dto.version = aggregate.version;
  dto.erstelltAm = args.erstelltAm.toISOString();
  dto.erstelltVonUserId = aggregate.createdBy;
  dto.aktualisiertAm = args.aktualisiertAm.toISOString();
  dto.aktualisiertVonUserId = args.aktualisiertVonUserId;
  dto.aufgeloestAm = aggregate.aufgeloestAm?.toISOString() ?? null;
  dto.aufgeloestVonUserId = aggregate.aufgeloestVonUserId;
  dto.aufloeseBegruendung = aggregate.aufloeseBegruendung;
  return dto;
}
