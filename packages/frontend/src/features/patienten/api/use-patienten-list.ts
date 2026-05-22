/**
 * Query-Hook für die paginierte/gefilterte/sortierte Patientenliste eines
 * Einsatzes (Story 1.6, AC5).
 *
 * Wrappt den generierten OpenAPI-Client
 * (`api.patienten().patientenControllerListVAlpha`) und liefert die TanStack-
 * Query. Alle Mutation-Hooks (`use-erfasse-patient`, `use-sichtung-aktualisieren`,
 * `use-behandlung-aktualisieren`, `use-transport-aktualisieren`,
 * `use-korrigiere-patient`) invalidieren `PATIENT_QUERY_KEYS.list(einsatzId)`
 * — der Hook re-queryt automatisch nach jeder Patient-Mutation.
 *
 * **Verbote:**
 *  - Kein direkter Low-Level-Request, kein eigener API-Wrapper.
 *  - Niemals `fetch()` (CLAUDE.md AC5).
 *
 * **Default-Optionen:**
 *  - `staleTime: 2_000` — Liste mutiert häufiger als KPI, kurze Frische OK.
 *  - `gcTime: 60_000` — GC nach 1 min Inaktivität.
 *  - `refetchOnWindowFocus: false` — Tablet im BHP-Zelt, kein Focus-Refetch.
 *  - `placeholderData: keepPreviousData` — sanftes Pagination-Wechseln ohne
 *    Skeleton-Flash, weil die Listen-UX als Liste-mit-Pagination konsumiert wird.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  BehandlungsstatusEnum,
  PatientListItemDto,
  PatientenControllerListVAlpha200Response,
  PatientenControllerListVAlpha200ResponsePagination,
  ResponseError,
  SkEnum,
  TransportstatusEnum,
} from '@bluelight-hub/shared/client';
import { api } from '@/shared';
import { PATIENT_QUERY_KEYS } from './queries';

export type PatientenListSortBy = 'sk' | 'zeit' | 'patientennummer';
export type PatientenListSortDir = 'asc' | 'desc';

export interface PatientenListFilters {
  sk?: SkEnum[];
  behandlungsstatus?: BehandlungsstatusEnum[];
  transportstatus?: TransportstatusEnum[];
  search?: string;
  sortBy?: PatientenListSortBy;
  sortDir?: PatientenListSortDir;
  page?: number;
  pageSize?: number;
}

export interface UsePatientenListResultValue {
  items: PatientListItemDto[];
  pagination: PatientenControllerListVAlpha200ResponsePagination;
}

interface UsePatientenListOptions {
  /** Query aktivieren — default `true`, falls einsatzId nicht-leer. */
  enabled?: boolean;
}

function csvOrUndefined(values: readonly string[] | undefined): string | undefined {
  if (!values || values.length === 0) return undefined;
  return values.join(',');
}

const MAX_SEARCH_LENGTH = 64;

function normalizeSearch(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, MAX_SEARCH_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

export function usePatientenList(einsatzId: string, filters: PatientenListFilters, options: UsePatientenListOptions = {}) {
  // Story-1.5-Pattern: Trim-Check vor `enabled`, damit Whitespace-IDs keinen
  // vermeidbaren Validation:EinsatzIdRequired-Roundtrip triggern. Konsistente
  // Verwendung der getrimmten ID in queryKey + Request, damit Whitespace-
  // Varianten denselben Cache-Slot belegen (Code-Review P12).
  const normalizedEinsatzId = typeof einsatzId === 'string' ? einsatzId.trim() : '';
  const hasValidEinsatzId = normalizedEinsatzId.length > 0;
  // Frontend-seitig trimmen + auf Backend-MaxLength clampen (Code-Review P10),
  // damit `?search=    ` keinen Roundtrip auslöst und `>64 Zeichen` nicht in
  // einen 400er-Fehler ohne UI-Surface läuft.
  const normalizedSearch = normalizeSearch(filters.search);

  return useQuery<UsePatientenListResultValue, ResponseError>({
    // Filter ins Query-Key aufnehmen, damit Filter-Wechsel automatisch
    // re-queryen. Objekt-Form ist deep-equal-fähig (TanStack-Query default).
    queryKey: [...PATIENT_QUERY_KEYS.list(normalizedEinsatzId), { ...filters, search: normalizedSearch }] as const,
    queryFn: async () => {
      const response = (await api.patienten().patientenControllerListVAlpha({
        einsatzId: normalizedEinsatzId,
        sk: csvOrUndefined(filters.sk),
        behandlungsstatus: csvOrUndefined(filters.behandlungsstatus),
        transportstatus: csvOrUndefined(filters.transportstatus),
        search: normalizedSearch,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
        page: filters.page,
        pageSize: filters.pageSize,
      })) as PatientenControllerListVAlpha200Response;

      return {
        items: response.data ?? [],
        pagination: response.pagination ?? { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      };
    },
    enabled: (options.enabled ?? true) && hasValidEinsatzId,
    staleTime: 2_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}
