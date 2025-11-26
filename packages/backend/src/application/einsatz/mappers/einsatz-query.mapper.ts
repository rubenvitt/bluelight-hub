import type { Einsatz } from '@domain/aggregates/einsatz.aggregate';
import type { Address } from '@domain/value-objects/address';
import type { EinsatzDto, EinsatzStatusType } from '@application/einsatz/dto/einsatz.dto';
import type { AddressDto } from '@application/einsatz/dto/address.dto';

/**
 * Query Mapper fuer Einsatz Domain → DTO Transformation.
 *
 * Trennt Domain-Schicht (EinsatzAggregate mit Business Logic)
 * von der API-Schicht (DTOs als reine Daten-Objekte).
 *
 * **Warum separater Mapper:**
 * - Versionierung: API-Struktur kann unabhaengig von Domain evolvieren
 * - Projektion: Nur API-relevante Felder werden exportiert (keine Domain Events)
 * - Security: Interne Domain-Details bleiben verborgen
 * - Testbarkeit: Mapper koennen isoliert ohne Domain-Logik getestet werden
 *
 * **Pattern:**
 * - Pure Functions: Kein State, keine Side Effects, keine Dependencies
 * - Immutable Input: Aggregates werden nicht modifiziert
 * - Static Methods: Keine Instanziierung notwendig
 *
 * @example
 * ```typescript
 * // Aggregate zu DTO konvertieren
 * const dto = EinsatzQueryMapper.toEinsatzDto(einsatzAggregate);
 *
 * // Array konvertieren
 * const dtos = aggregates.map(EinsatzQueryMapper.toEinsatzDto);
 * ```
 */
export class EinsatzQueryMapper {
  /**
   * Konvertiert ein EinsatzAggregate zu einem EinsatzDto.
   *
   * Diese Transformation trennt die Domain-Schicht von der API-Schicht,
   * damit interne Aenderungen am Aggregate die API-Struktur nicht brechen.
   *
   * **Mapping-Details:**
   * - Value Objects (id, status, createdBy) werden auf .value gemappt
   * - Address Value Object wird zu AddressDto transformiert
   * - Optional fields (einsatzort, bemerkung, abgeschlossenAt, archivedAt) werden nur gesetzt wenn vorhanden
   *
   * @param aggregate - Das zu konvertierende EinsatzAggregate
   * @returns EinsatzDto fuer API-Response
   */
  static toEinsatzDto(aggregate: Einsatz): EinsatzDto {
    const dto: EinsatzDto = {
      id: aggregate.id.value,
      nummer: aggregate.nummer,
      alarmstichwort: aggregate.alarmstichwort,
      status: aggregate.status.value as EinsatzStatusType,
      createdBy: aggregate.createdBy.value,
      createdAt: aggregate.createdAt,
    };

    // Optional: einsatzort nur setzen wenn vorhanden
    if (aggregate.einsatzort !== undefined) {
      dto.einsatzort = EinsatzQueryMapper.toAddressDto(aggregate.einsatzort);
    }

    // Optional: bemerkung nur setzen wenn vorhanden
    if (aggregate.bemerkung !== undefined) {
      dto.bemerkung = aggregate.bemerkung;
    }

    // Optional: abgeschlossenAt nur setzen wenn vorhanden
    if (aggregate.abgeschlossenAt !== undefined) {
      dto.abgeschlossenAt = aggregate.abgeschlossenAt;
    }

    // Optional: archivedAt nur setzen wenn vorhanden
    if (aggregate.archivedAt !== undefined) {
      dto.archivedAt = aggregate.archivedAt;
    }

    return dto;
  }

  /**
   * Konvertiert ein Address Value Object zu einem AddressDto.
   *
   * Extrahiert die Properties aus dem Address Value Object
   * fuer die API-Response. Fehlende Required-Felder werden mit
   * leeren Strings gefuellt, da AddressDto required fields hat.
   *
   * @param address - Das zu konvertierende Address Value Object
   * @returns AddressDto fuer API-Response
   */
  static toAddressDto(address: Address): AddressDto {
    const dto: AddressDto = {
      strasse: address.strasse ?? '',
      plz: address.plz ?? '',
      ort: address.ort ?? '',
    };

    // Optional fields
    if (address.hausnummer !== undefined) {
      dto.hausnummer = address.hausnummer;
    }

    return dto;
  }
}
