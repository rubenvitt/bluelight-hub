/**
 * Sentinel-Error-Codes für den `list-patienten`-Read-Use-Case (Story 1.6).
 *
 * Konsumenten:
 * - `ListPatientenQuery.create()` für Validation-Failures vor SQL-Ausführung
 * - `ListPatientenHandler` für Repository-/Mapper-Failures
 * - `mapErrorToHttp` im Modules-Layer für die HTTP-Übersetzung
 *
 * Codes folgen dem repo-weiten Pattern (`Präfix:Kennung[:Detail]`); `Validation:`
 * mappt auf HTTP-400, `Infrastructure:` auf HTTP-500.
 */
export const LIST_PATIENTEN_ERROR_CODES = {
  /** `einsatzId` fehlt oder ist leer-getrimmt. */
  EINSATZ_ID_REQUIRED: 'Validation:EinsatzIdRequired',
  /** Ein `sk`-Filterwert ist nicht im erlaubten Enum-Set. */
  SK_FILTER_INVALID: 'Validation:SkFilterInvalid',
  /** Ein `behandlungsstatus`-Filterwert ist nicht im erlaubten Enum-Set. */
  BEHANDLUNGSSTATUS_FILTER_INVALID: 'Validation:BehandlungsstatusFilterInvalid',
  /** Ein `transportstatus`-Filterwert ist nicht im erlaubten Enum-Set. */
  TRANSPORTSTATUS_FILTER_INVALID: 'Validation:TransportstatusFilterInvalid',
  /** `search` überschreitet das Längen-Limit (64 Zeichen, DoS-Schutz). */
  SEARCH_INVALID: 'Validation:SearchInvalid',
  /** `sortBy` ist kein erlaubtes Sort-Feld. */
  SORT_FIELD_INVALID: 'Validation:SortFieldInvalid',
  /** `sortDir` ist nicht `asc` oder `desc`. */
  SORT_DIRECTION_INVALID: 'Validation:SortDirectionInvalid',
  /** `page` < 1. */
  PAGE_INVALID: 'Validation:PageInvalid',
  /** `pageSize` außerhalb [1..100]. */
  PAGE_SIZE_INVALID: 'Validation:PageSizeInvalid',
  /** Prisma-Query oder Count fehlgeschlagen. */
  LIST_QUERY_FAILED: 'Infrastructure:PatientListQueryFailed',
} as const;

export type ListPatientenErrorCode = (typeof LIST_PATIENTEN_ERROR_CODES)[keyof typeof LIST_PATIENTEN_ERROR_CODES];
