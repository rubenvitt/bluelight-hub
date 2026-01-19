import { Result } from '@domain/common/result';
import { ERINNERUNG_ERROR_CODES } from '../../errors/erinnerung-error.codes';

/**
 * Props für die GetErinnerungenByEinsatzQuery Erstellung.
 */
export interface GetErinnerungenByEinsatzQueryProps {
  einsatzId: string;
}

/**
 * Query zum Abrufen aller Erinnerungen eines Einsatzes.
 *
 * Factory Method Pattern mit Result<T> für konsistente Validierung.
 *
 * **Story 1.1 AC2:**
 * "die Erinnerung erscheint in meiner Liste"
 *
 * @example
 * ```typescript
 * const result = GetErinnerungenByEinsatzQuery.create({
 *   einsatzId: 'clw3h8x9y0001...',
 * });
 *
 * if (result.isSuccess) {
 *   const erinnerungen = await handler.execute(result.value!);
 * }
 * ```
 */
export class GetErinnerungenByEinsatzQuery {
  /**
   * CUID2 Pattern für ID-Validierung.
   */
  private static readonly CUID2_PATTERN = /^[a-z0-9]{24,32}$/;

  private constructor(public readonly einsatzId: string) {}

  /**
   * Factory Method zur Erstellung einer validierten Query.
   *
   * @param props - Query Properties
   * @returns Result<GetErinnerungenByEinsatzQuery> - Validierte Query oder Fehler
   */
  static create(props: GetErinnerungenByEinsatzQueryProps): Result<GetErinnerungenByEinsatzQuery> {
    const trimmedEinsatzId = props.einsatzId?.trim() ?? '';

    if (trimmedEinsatzId.length === 0) {
      return Result.fail<GetErinnerungenByEinsatzQuery>(ERINNERUNG_ERROR_CODES.QUERY_EINSATZ_ID_REQUIRED);
    }

    if (!GetErinnerungenByEinsatzQuery.CUID2_PATTERN.test(trimmedEinsatzId)) {
      return Result.fail<GetErinnerungenByEinsatzQuery>(ERINNERUNG_ERROR_CODES.EINSATZ_ID_INVALID);
    }

    return Result.ok(new GetErinnerungenByEinsatzQuery(trimmedEinsatzId));
  }
}
