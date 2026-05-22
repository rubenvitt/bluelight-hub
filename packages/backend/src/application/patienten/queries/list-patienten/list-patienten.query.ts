import { Result } from '@domain/common/result';
import { BEHANDLUNGSSTATUS_CODES, type BehandlungsstatusCode } from '@domain/patienten/value-objects/behandlungsstatus.vo';
import { SK_CODES, type SkCode } from '@domain/patienten/value-objects/sichtungskategorie.vo';
import { TRANSPORTSTATUS_CODES, type TransportstatusCode } from '@domain/patienten/value-objects/transportstatus.vo';
import { LIST_PATIENTEN_ERROR_CODES } from '../../errors/list-patienten-error.codes';

/**
 * Erlaubte Sortier-Felder für `ListPatientenQuery` (Story 1.6, AC3).
 *
 * - `sk` → SK-Priorität (`SK_I < SK_II < SK_III < SK_IV < TOT`); zufällig
 *   lexikografisch korrekt, deshalb keine `CASE WHEN`-Raw-SQL nötig.
 * - `zeit` → `erfasstAm`-Sortierung.
 * - `patientennummer` → lexikografisch (MVP-Heuristik, P-XXX-Präfix stabilisiert).
 */
export type ListPatientenSortField = 'sk' | 'zeit' | 'patientennummer';

/** Sortierrichtung. */
export type ListPatientenSortDirection = 'asc' | 'desc';

/**
 * Filter-Optionen — alle Felder optional; Multi-Select-Listen `[]` zählen als
 * "kein Filter" (siehe `where`-Konstruktion im Adapter).
 */
export interface ListPatientenFilters {
  sk?: SkCode[];
  behandlungsstatus?: BehandlungsstatusCode[];
  transportstatus?: TransportstatusCode[];
  search?: string;
}

/**
 * Sortier-Optionen — Default in der Factory ist `{ field: 'sk', direction: 'asc' }`
 * (Story 1.6, AC3: SK-Priorität asc + `erfasstAm` asc).
 */
export interface ListPatientenSort {
  field: ListPatientenSortField;
  direction: ListPatientenSortDirection;
}

/** 1-basierte Pagination — Defaults `{ page: 1, pageSize: 50 }`. */
export interface ListPatientenPagination {
  page: number;
  pageSize: number;
}

/** Eingangs-Props für die Factory. */
export interface ListPatientenQueryProps {
  einsatzId: string;
  filters?: ListPatientenFilters;
  sort?: ListPatientenSort;
  pagination?: ListPatientenPagination;
}

/**
 * Validierte, immutable Query zum Read-Endpoint `GET /api/v1/einsaetze/:einsatzId/patienten`
 * (Story 1.6, AC1–AC4).
 *
 * Adaption von `ListInvitesQuery.create()` (Pattern aus `application/admin/queries/`)
 * — Whitelist-Validation für jeden Enum-Filter, Page-Size-Bound, Search-Längen-Limit.
 * Failure-Pfade liefern Sentinel-Codes aus `LIST_PATIENTEN_ERROR_CODES`, die
 * `error-to-http.ts` per `Validation:`-Präfix auf HTTP-400 mappt (ohne
 * Sentinel-Leak im User-Body — Lessons-Learned 1.3/1.4).
 */
export class ListPatientenQuery {
  private static readonly ALLOWED_SORT_FIELDS: ReadonlySet<ListPatientenSortField> = new Set<ListPatientenSortField>(['sk', 'zeit', 'patientennummer']);
  private static readonly ALLOWED_SORT_DIRECTIONS: ReadonlySet<ListPatientenSortDirection> = new Set<ListPatientenSortDirection>(['asc', 'desc']);
  private static readonly ALLOWED_SK_VALUES: ReadonlySet<SkCode> = new Set<SkCode>(SK_CODES);
  private static readonly ALLOWED_BEHANDLUNGSSTATUS_VALUES: ReadonlySet<BehandlungsstatusCode> = new Set<BehandlungsstatusCode>(BEHANDLUNGSSTATUS_CODES);
  private static readonly ALLOWED_TRANSPORTSTATUS_VALUES: ReadonlySet<TransportstatusCode> = new Set<TransportstatusCode>(TRANSPORTSTATUS_CODES);

  private static readonly MIN_PAGE = 1;
  private static readonly MIN_PAGE_SIZE = 1;
  private static readonly MAX_PAGE_SIZE = 100;
  private static readonly DEFAULT_PAGE_SIZE = 50;
  private static readonly MAX_SEARCH_LENGTH = 64;

  private constructor(
    public readonly einsatzId: string,
    public readonly filters: ListPatientenFilters,
    public readonly sort: ListPatientenSort,
    public readonly pagination: ListPatientenPagination,
  ) {}

  static create(props: ListPatientenQueryProps): Result<ListPatientenQuery> {
    if (!props.einsatzId || props.einsatzId.trim().length === 0) {
      return Result.fail<ListPatientenQuery>(LIST_PATIENTEN_ERROR_CODES.EINSATZ_ID_REQUIRED);
    }

    const filters: ListPatientenFilters = {};

    if (props.filters?.sk !== undefined) {
      for (const value of props.filters.sk) {
        if (!ListPatientenQuery.ALLOWED_SK_VALUES.has(value)) {
          return Result.fail<ListPatientenQuery>(`${LIST_PATIENTEN_ERROR_CODES.SK_FILTER_INVALID}:${value}`);
        }
      }
      if (props.filters.sk.length > 0) {
        filters.sk = [...props.filters.sk];
      }
    }

    if (props.filters?.behandlungsstatus !== undefined) {
      for (const value of props.filters.behandlungsstatus) {
        if (!ListPatientenQuery.ALLOWED_BEHANDLUNGSSTATUS_VALUES.has(value)) {
          return Result.fail<ListPatientenQuery>(`${LIST_PATIENTEN_ERROR_CODES.BEHANDLUNGSSTATUS_FILTER_INVALID}:${value}`);
        }
      }
      if (props.filters.behandlungsstatus.length > 0) {
        filters.behandlungsstatus = [...props.filters.behandlungsstatus];
      }
    }

    if (props.filters?.transportstatus !== undefined) {
      for (const value of props.filters.transportstatus) {
        if (!ListPatientenQuery.ALLOWED_TRANSPORTSTATUS_VALUES.has(value)) {
          return Result.fail<ListPatientenQuery>(`${LIST_PATIENTEN_ERROR_CODES.TRANSPORTSTATUS_FILTER_INVALID}:${value}`);
        }
      }
      if (props.filters.transportstatus.length > 0) {
        filters.transportstatus = [...props.filters.transportstatus];
      }
    }

    if (props.filters?.search !== undefined) {
      const trimmed = props.filters.search.trim();
      if (trimmed.length > ListPatientenQuery.MAX_SEARCH_LENGTH) {
        return Result.fail<ListPatientenQuery>(`${LIST_PATIENTEN_ERROR_CODES.SEARCH_INVALID}:length>${ListPatientenQuery.MAX_SEARCH_LENGTH}`);
      }
      if (trimmed.length > 0) {
        filters.search = trimmed;
      }
    }

    let sort: ListPatientenSort = { field: 'sk', direction: 'asc' };
    if (props.sort !== undefined) {
      if (!ListPatientenQuery.ALLOWED_SORT_FIELDS.has(props.sort.field)) {
        return Result.fail<ListPatientenQuery>(`${LIST_PATIENTEN_ERROR_CODES.SORT_FIELD_INVALID}:${props.sort.field}`);
      }
      if (!ListPatientenQuery.ALLOWED_SORT_DIRECTIONS.has(props.sort.direction)) {
        return Result.fail<ListPatientenQuery>(`${LIST_PATIENTEN_ERROR_CODES.SORT_DIRECTION_INVALID}:${props.sort.direction}`);
      }
      sort = { ...props.sort };
    }

    let pagination: ListPatientenPagination = {
      page: ListPatientenQuery.MIN_PAGE,
      pageSize: ListPatientenQuery.DEFAULT_PAGE_SIZE,
    };
    if (props.pagination !== undefined) {
      if (!Number.isInteger(props.pagination.page) || props.pagination.page < ListPatientenQuery.MIN_PAGE) {
        return Result.fail<ListPatientenQuery>(`${LIST_PATIENTEN_ERROR_CODES.PAGE_INVALID}:${props.pagination.page}`);
      }
      if (!Number.isInteger(props.pagination.pageSize) || props.pagination.pageSize < ListPatientenQuery.MIN_PAGE_SIZE || props.pagination.pageSize > ListPatientenQuery.MAX_PAGE_SIZE) {
        return Result.fail<ListPatientenQuery>(`${LIST_PATIENTEN_ERROR_CODES.PAGE_SIZE_INVALID}:${props.pagination.pageSize}`);
      }
      pagination = { ...props.pagination };
    }

    return Result.ok<ListPatientenQuery>(new ListPatientenQuery(props.einsatzId.trim(), filters, sort, pagination));
  }
}
