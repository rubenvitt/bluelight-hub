import type { BehandlungsstatusEnum, SkEnum, TransportstatusEnum } from '@bluelight-hub/shared/client';
import { isCuid2 } from '@/shared/constants/cuid';
import type { PatientenListSortBy, PatientenListSortDir } from './use-patienten-list';

/**
 * Geteilte Search-Param-Validierung für die Patienten-Listen-Routen
 * (`/app/einsatz/$einsatzId/patienten/` und `/app/einsatz/$einsatzId/patienten/liste`).
 *
 * Beide Routen brauchen identische Deep-Link-/Filter-Normalisierung — der gemeinsame
 * Helper hier verhindert Drift zwischen den `validateSearch`-Implementierungen.
 */

export const SK_VALUES: ReadonlySet<SkEnum> = new Set(['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT']);
export const BEHANDLUNG_VALUES: ReadonlySet<BehandlungsstatusEnum> = new Set(['UNVERSORGT', 'IN_BEHANDLUNG', 'VERSORGT', 'TRANSPORTBEREIT']);
export const TRANSPORT_VALUES: ReadonlySet<TransportstatusEnum> = new Set(['WARTEND', 'IM_TRANSPORT', 'IM_KRANKENHAUS']);

const SORT_BY_VALUES = ['sk', 'zeit', 'patientennummer'] as const satisfies readonly PatientenListSortBy[];
const SORT_DIR_VALUES = ['asc', 'desc'] as const satisfies readonly PatientenListSortDir[];

export type PatientenListSearch = {
  sk?: SkEnum[];
  behandlungsstatus?: BehandlungsstatusEnum[];
  transportstatus?: TransportstatusEnum[];
  search?: string;
  sortBy?: PatientenListSortBy;
  sortDir?: PatientenListSortDir;
  page?: number;
  pageSize?: number;
  /**
   * Story 1.7 (AC11): Deep-Link-Eintrittsweg. Beim Mount triggert die
   * Komponente eine `navigate({ to: '/.../$patientId' })`, sodass die
   * canonical Route-URL gewinnt und Browser-Back/Forward sauber bleibt.
   */
  action?: 'detail';
  patientId?: string;
};

function toArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter((v) => v.length > 0);
  if (typeof value === 'string' && value.length > 0) {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return undefined;
}

function whitelist<T extends string>(values: string[] | undefined, allowed: ReadonlySet<T>): T[] | undefined {
  if (!values) return undefined;
  const filtered = values.filter((v): v is T => (allowed as ReadonlySet<string>).has(v));
  return filtered.length > 0 ? filtered : undefined;
}

/**
 * Konvertiert beliebige Search-Param-Werte zu einer Ganzzahl innerhalb [min, max].
 *
 * F34: Lehnt Floats explizit ab (`?page=1.5` → undefined statt lautloser `Math.floor`).
 * Damit fällt die Route auf den Default zurück, anstatt eine falsche Annahme über
 * die User-Intention zu treffen.
 */
function toNumber(value: unknown, min: number, max: number): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  if (!Number.isInteger(n)) return undefined;
  return n;
}

/**
 * Validiert + normalisiert die Search-Params der Patienten-Listen-Routen.
 *
 * Whitelisting verhindert, dass ungültige Filter aus manipulierten URLs in den
 * State gelangen. CUID2-Validierung (F30) ersetzt die frühere Magic-Number
 * `length >= 6` durch eine konsistente, mit dem Backend abgestimmte Prüfung.
 */
export function validatePatientenListSearch(search: Record<string, unknown>): PatientenListSearch {
  const sortByRaw = typeof search.sortBy === 'string' ? (search.sortBy as PatientenListSortBy) : undefined;
  const sortDirRaw = typeof search.sortDir === 'string' ? (search.sortDir as PatientenListSortDir) : undefined;

  const rawPatientId = typeof search.patientId === 'string' ? search.patientId.trim() : undefined;
  const validPatientId = rawPatientId && isCuid2(rawPatientId) ? rawPatientId : undefined;
  const action = search.action === 'detail' && validPatientId ? 'detail' : undefined;

  return {
    sk: whitelist<SkEnum>(toArray(search.sk), SK_VALUES),
    behandlungsstatus: whitelist<BehandlungsstatusEnum>(toArray(search.behandlungsstatus), BEHANDLUNG_VALUES),
    transportstatus: whitelist<TransportstatusEnum>(toArray(search.transportstatus), TRANSPORT_VALUES),
    search: typeof search.search === 'string' && search.search.length > 0 ? search.search : undefined,
    sortBy: sortByRaw && SORT_BY_VALUES.includes(sortByRaw) ? sortByRaw : undefined,
    sortDir: sortDirRaw && SORT_DIR_VALUES.includes(sortDirRaw) ? sortDirRaw : undefined,
    page: toNumber(search.page, 1, 10_000),
    pageSize: toNumber(search.pageSize, 1, 100),
    action,
    patientId: validPatientId,
  };
}
