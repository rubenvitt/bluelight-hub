import { Result } from '@domain/common/result';

/**
 * Query zum Abrufen aller aktiven Teilnehmer eines Einsatzes.
 *
 * **Story 3.3 AC1:**
 * - Liefert alle aktiven Einsatz-Teilnehmer fuer "Zuweisen an" Dropdown
 * - Filter: Nur Teilnehmer mit leftAt === null (noch aktiv im Einsatz)
 *
 * **Verwendung:**
 * - Erinnerung erstellen: Auswahl des Zugewiesenen
 * - Team-Uebersicht: Liste aktiver Teammitglieder
 *
 * @example
 * ```typescript
 * const queryResult = GetEinsatzTeilnehmerQuery.create({ einsatzId: 'clw3h8x9y0001' });
 * if (queryResult.isSuccess) {
 *   const result = await handler.execute(queryResult.value!);
 * }
 * ```
 */
export class GetEinsatzTeilnehmerQuery {
  private constructor(public readonly einsatzId: string) {}

  /**
   * Factory-Methode mit Validierung.
   *
   * @param props - Query-Parameter mit einsatzId
   * @returns Result mit Query oder Fehler bei ungueltigem einsatzId
   */
  static create(props: { einsatzId: string }): Result<GetEinsatzTeilnehmerQuery> {
    if (!props.einsatzId || props.einsatzId.trim() === '') {
      return Result.fail<GetEinsatzTeilnehmerQuery>('einsatzId ist erforderlich');
    }

    return Result.ok<GetEinsatzTeilnehmerQuery>(new GetEinsatzTeilnehmerQuery(props.einsatzId));
  }
}
