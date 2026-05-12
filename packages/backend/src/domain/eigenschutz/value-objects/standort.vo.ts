import { Result } from '@domain/common/result';

/**
 * Discriminated-Union-Shape für den Standort eines Sicherungspostens.
 *
 * Spiegelt das Shared-Schema `standortSchema` aus
 * `@bluelight-hub/shared/schemas/eigenschutz`. Domain bleibt aber bewusst
 * Framework-frei — kein Zod-Import, dafür ein deckungsgleicher Result-Validator.
 */
export type StandortProps = { kind: 'coordinate'; longitude: number; latitude: number; addressHint?: string } | { kind: 'address'; text: string };

const ADDRESS_HINT_MAX = 500;
const ADDRESS_TEXT_MIN = 1;
const ADDRESS_TEXT_MAX = 500;

/**
 * Wert-Objekt `Standort`. Persistiert 1:1 als JSONB im Sicherungsposten-
 * Aggregate (kein GeoJSON-Wrap in 4.1 — Story 4.3 mappt erst beim MapGL-Layer).
 *
 * Invarianten:
 * - `kind = 'coordinate'`: longitude ∈ [−180, 180], latitude ∈ [−90, 90],
 *   `addressHint` optional und nach Trim ≤ 500 Zeichen.
 * - `kind = 'address'`: `text` nach Trim 1–500 Zeichen.
 */
export class Standort {
  private constructor(private readonly props: StandortProps) {}

  static create(props: StandortProps): Result<Standort> {
    if (!props || typeof props !== 'object') {
      return Result.fail<Standort>('Standort ist erforderlich');
    }

    if (props.kind === 'coordinate') {
      if (!Number.isFinite(props.longitude) || props.longitude < -180 || props.longitude > 180) {
        return Result.fail<Standort>('longitude muss zwischen -180 und 180 liegen');
      }
      if (!Number.isFinite(props.latitude) || props.latitude < -90 || props.latitude > 90) {
        return Result.fail<Standort>('latitude muss zwischen -90 und 90 liegen');
      }
      let addressHint: string | undefined;
      if (props.addressHint !== undefined) {
        const trimmed = props.addressHint.trim();
        if (trimmed.length > ADDRESS_HINT_MAX) {
          return Result.fail<Standort>(`addressHint darf maximal ${ADDRESS_HINT_MAX} Zeichen haben`);
        }
        addressHint = trimmed.length === 0 ? undefined : trimmed;
      }
      return Result.ok(new Standort({ kind: 'coordinate', longitude: props.longitude, latitude: props.latitude, addressHint }));
    }

    if (props.kind === 'address') {
      const text = props.text?.trim() ?? '';
      if (text.length < ADDRESS_TEXT_MIN) {
        return Result.fail<Standort>('Adress-Text ist erforderlich');
      }
      if (text.length > ADDRESS_TEXT_MAX) {
        return Result.fail<Standort>(`Adress-Text darf maximal ${ADDRESS_TEXT_MAX} Zeichen haben`);
      }
      return Result.ok(new Standort({ kind: 'address', text }));
    }

    return Result.fail<Standort>('Unbekannter Standort-Typ');
  }

  /**
   * Liefert eine Kopie der zugrundeliegenden Props (für Persistierung +
   * DTO-Serialisierung). Garantiert keine Referenz-Leckage.
   */
  toJSON(): StandortProps {
    if (this.props.kind === 'coordinate') {
      return {
        kind: 'coordinate',
        longitude: this.props.longitude,
        latitude: this.props.latitude,
        ...(this.props.addressHint !== undefined ? { addressHint: this.props.addressHint } : {}),
      };
    }
    return { kind: 'address', text: this.props.text };
  }

  get kind(): StandortProps['kind'] {
    return this.props.kind;
  }

  equals(other: Standort): boolean {
    if (this.props.kind !== other.props.kind) return false;
    if (this.props.kind === 'coordinate' && other.props.kind === 'coordinate') {
      return this.props.longitude === other.props.longitude && this.props.latitude === other.props.latitude && (this.props.addressHint ?? null) === (other.props.addressHint ?? null);
    }
    if (this.props.kind === 'address' && other.props.kind === 'address') {
      return this.props.text === other.props.text;
    }
    return false;
  }
}

/**
 * Personal-Eintrag (EinsatzPerson-Referenz oder Freitext), spiegelt das
 * Shared-Schema `personalEntrySchema`. Kein eigenes VO — wird im Aggregate
 * als Plain-Object geführt (Persistenz via JSONB), Validierung erfolgt im
 * Aggregate-Factory.
 *
 * `einsatzPerson`-Variante verweist auf eine im jeweiligen Einsatz
 * registrierte EinsatzPerson (siehe `EinsatzPerson` aus dem
 * `kraefte`-Modul). Existenzprüfung gegen den Einsatz erfolgt im
 * Command-Handler.
 */
export type PersonalEntryProps = { kind: 'einsatzPerson'; einsatzPersonId: string } | { kind: 'freitext'; name: string; rolle?: string };
