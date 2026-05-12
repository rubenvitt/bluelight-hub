import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/shared';
import type {
  CreateGefaehrdungsbeurteilungInput,
  Gefaehrdungsbeurteilung,
  GefaehrdungsbeurteilungHistorie,
  GefaehrdungsbeurteilungVorlage,
  UpdateGefaehrdungsbeurteilungItemsInput,
} from '../schemas/gefaehrdungsbeurteilung.schema';
import type { CreateSicherheitsregelInput, SicherheitsregelDto, UpdateSicherheitsregelInput } from '../schemas/sicherheitsregel.schema';
import type { OffeneRueckmeldungDto, ResolveSyncConflictDto, SyncConflictListItemDto, SyncConflictResolveResultDto } from '@bluelight-hub/shared/client';
import { useCurrentUser } from '@/features/auth/api/use-current-user';
import { eigenschutzTelemetryQueue, getOrCreateSessionId } from '../lib/telemetry-queue';

/**
 * Zod-Guard für den 409-Response-Body-Context (Story 2.3, AC13).
 *
 * Wir konsumieren nur die Felder, die wir dem Banner zeigen; fehlende oder
 * malformed Felder (z. B. `currentVersion: "five"` aus einem älteren
 * Backend-Stand oder einem Proxy-Rewrite) führen zum Fallback-Text und
 * werfen KEINEN Runtime-Fehler. `.safeParse()` bleibt immer non-throwing.
 *
 * `currentVersion` ist explizit optional: im Reload-Failure-Pfad (Handler
 * konnte nach dem DB-Level-Conflict die aktuelle Version nicht re-lesen)
 * liefert das Backend legitim nur `attemptedVersion`. Wir wollen die valide
 * `attemptedVersion` NICHT verlieren, nur weil das komplette Objekt als
 * „invalid" abgewiesen würde.
 */
const GefaehrdungsbeurteilungConflictContextSchema = z.object({
  currentVersion: z.number().int().positive().optional(),
  attemptedVersion: z.number().int().nonnegative().optional(),
});

/**
 * Dünne Error-Subclass für den 409-Konflikt bei
 * `useUpdateGefaehrdungsbeurteilungItems` (Story 2.3, AC13).
 *
 * Trägt `currentVersion` (kann `undefined` sein bei älterem Backend ohne
 * Context-Enrichment) und `attemptedVersion` (aus dem Request-Input), damit
 * das UI einen präziseren Banner-Text rendern kann. Der ursprüngliche
 * Fetch-Error bleibt unter `originalError` erhalten, falls Debugging im
 * Sentry- oder Konsolen-Kontext nötig wird.
 */
export class GefaehrdungsbeurteilungConflictError extends Error {
  readonly statusCode = 409;
  constructor(
    readonly currentVersion: number | undefined,
    readonly attemptedVersion: number | undefined,
    readonly originalError: unknown,
  ) {
    super('ConflictDetected:Gefaehrdungsbeurteilung');
    this.name = 'GefaehrdungsbeurteilungConflictError';
  }
}

/**
 * Extrahiert aus einem beliebigen Fetch-Error einen
 * `GefaehrdungsbeurteilungConflictError`, wenn der Response-Status 409 ist.
 * Andere Statuscodes (z. B. 422, 500) liefern `null` — dann soll der
 * aufrufende Hook den Original-Error unverändert weiterwerfen.
 *
 * Der Context wird per Zod validiert; bei fehlendem/malformed Context
 * fällt `currentVersion` auf `undefined` zurück (Banner nutzt dann den
 * generischen Fallback-Text).
 */
export function extractConflictError(error: unknown, attemptedVersion: number): GefaehrdungsbeurteilungConflictError | null {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status !== 409) return null;
  const dataCandidate = (error as { response?: { data?: unknown } } | null)?.response?.data;
  const rawContext = (dataCandidate as { context?: unknown } | null)?.context;
  // Graceful Handling von non-Objekt-Kontext (String, Array, null, undefined):
  // safeParse würde das gesamte Objekt verwerfen; wir wollen die valide
  // `attemptedVersion` aus dem Request-Input trotzdem bewahren.
  const contextToValidate = rawContext !== null && typeof rawContext === 'object' && !Array.isArray(rawContext) ? rawContext : {};
  const parsed = GefaehrdungsbeurteilungConflictContextSchema.safeParse(contextToValidate);
  const currentVersion = parsed.success ? parsed.data.currentVersion : undefined;
  return new GefaehrdungsbeurteilungConflictError(currentVersion, attemptedVersion, error);
}

/**
 * Query-Key-Factory für das Eigenschutz-Feature (Story 1.6 + 2.1).
 *
 * Hierarchische Struktur gemäß Architecture §I — ermöglicht
 * gezielte Cache-Invalidierung in späteren Stories (z. B. nach
 * PSA-Profil-Update `invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.all(einsatzId) })`).
 */
export const EIGENSCHUTZ_QUERY_KEYS = {
  all: (einsatzId: string) => ['eigenschutz', einsatzId] as const,
  health: (einsatzId: string) => ['eigenschutz', einsatzId, 'health'] as const,
  ampelStatus: (einsatzId: string) => ['eigenschutz', einsatzId, 'ampel-status'] as const,
  ampelWarnBadges: (einsatzId: string) => ['eigenschutz', einsatzId, 'ampel-warn-badges'] as const,
  gefaehrdungsbeurteilungsVorlagen: (einsatzId: string) => ['eigenschutz', einsatzId, 'gefaehrdungsbeurteilungs-vorlagen'] as const,
  gefaehrdungsbeurteilungen: (einsatzId: string) => ['eigenschutz', einsatzId, 'gefaehrdungsbeurteilungen'] as const,
  gefaehrdungsbeurteilung: (einsatzId: string, id: string) => ['eigenschutz', einsatzId, 'gefaehrdungsbeurteilungen', id] as const,
  gefaehrdungsbeurteilungHistorie: (einsatzId: string, id: string) => ['eigenschutz', einsatzId, 'gefaehrdungsbeurteilungen', id, 'historie'] as const,
  /**
   * Listen-Scope der Sicherheitsregeln (Story 2.6, Task 7.2).
   *
   * Der optionale `einheitId`-Filter landet als strukturiertes Segment im Key,
   * damit einsatzweite Listen (`einheitId = undefined`) und einheiten-
   * spezifische Listen (`einheitId = <cuid>`) im Cache getrennt geführt
   * werden. Gemeinsames Prefix bleibt `[..., 'sicherheitsregeln', 'list']`,
   * sodass `invalidateQueries({ queryKey: sicherheitsregeln(einsatzId) })`
   * beide Varianten auf einen Schlag invalidiert.
   */
  sicherheitsregeln: (einsatzId: string, einheitId?: string) =>
    einheitId === undefined ? (['eigenschutz', einsatzId, 'sicherheitsregeln', 'list'] as const) : (['eigenschutz', einsatzId, 'sicherheitsregeln', 'list', { einheitId }] as const),
  sicherheitsregel: (einsatzId: string, id: string) => ['eigenschutz', einsatzId, 'sicherheitsregeln', 'detail', id] as const,
  /**
   * Quittungs-Liste pro Sicherheitsregel (Story 2.7 AC10) — Sender-View.
   * Granularität pro Regel-ID, damit `useAckSicherheitsregel.onSuccess`
   * gezielt invalidieren kann.
   */
  sicherheitsregelQuittungen: (einsatzId: string, regelId: string) => ['eigenschutz', einsatzId, 'sicherheitsregeln', 'quittungen', regelId] as const,
  /**
   * Aktive PSA-Profile einer Einheit (Story 3.1 AC9). Granularität pro
   * Einheit, damit der Toggle-Hook nach Erfolg gezielt nur die
   * betroffene Einheit invalidiert (nicht den ganzen Einsatz-Scope).
   */
  psaProfileByEinheit: (einsatzId: string, einheitId: string) => ['eigenschutz', einsatzId, 'psa-profile', einheitId] as const,
  /**
   * Quittungs-Liste pro PSA-Bekanntgabe-Gruppe (Story 3.4 AC8) — Sender-View.
   * Granularität pro `propagationGroupId`, damit `useAckPsaQuittung.onSuccess`
   * gezielt invalidieren kann, sobald ein Empfänger quittiert.
   */
  psaQuittungen: (einsatzId: string, propagationGroupId: string) => ['eigenschutz', einsatzId, 'psa-quittungen', propagationGroupId] as const,
  /**
   * Liste aller offenen (nicht vollständig quittierten) PSA-Bekanntgaben der
   * letzten 24 h (Story 3.4 AC15). Wird von der Stab-Sicht
   * (`PsaProfilePage`-Sektion „Offene PSA-Bekanntgaben") konsumiert; der
   * Live-Hook `useEigenschutzPsaQuittungLive` invalidiert den Key, wenn ein
   * `eigenschutz:psa-quittung-abgegeben`-Frame eintrifft.
   */
  offenePsaBekanntgaben: (einsatzId: string) => ['eigenschutz', einsatzId, 'psa-quittungen', 'offene-bekanntgaben'] as const,
  offeneRueckmeldungen: (einsatzId: string) => ['eigenschutz', einsatzId, 'psa-profile', 'rueckmeldungen', 'offen'] as const,
  /**
   * Listen-Scope der offenen Sync-Konflikte (Story 3.10 AC7).
   *
   * Object-Filter-Pattern analog `sicherheitsregeln(einsatzId, einheitId?)`:
   * Verschiedene Filter-Kombinationen leben getrennt im Cache; das gemeinsame
   * Prefix `[..., 'sync-conflicts']` erlaubt globale Invalidierung über
   * `invalidateQueries({ queryKey: ['eigenschutz', einsatzId, 'sync-conflicts'] })`.
   */
  syncConflicts: (einsatzId: string, filter?: { entityType?: 'PSA_PROFIL_ZUWEISUNG' | 'GEFAEHRDUNGSBEURTEILUNG_ITEM'; einheitId?: string }) =>
    filter === undefined || (filter.entityType === undefined && filter.einheitId === undefined)
      ? (['eigenschutz', einsatzId, 'sync-conflicts', 'list'] as const)
      : (['eigenschutz', einsatzId, 'sync-conflicts', 'list', filter] as const),
} as const;

function invalidateAmpelStatus(queryClient: QueryClient, einsatzId: string): void {
  void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.ampelStatus(einsatzId) });
}

function invalidateAmpelWarnBadges(queryClient: QueryClient, einsatzId: string): void {
  void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.ampelWarnBadges(einsatzId) });
}

/**
 * Prüft robust, ob ein unbekannter Error einen HTTP-403-Status trägt.
 * Kompatibel mit `ResponseError` aus dem generierten Client (`error.response.status`).
 */
function is403(error: unknown): boolean {
  return (error as { response?: { status?: number } } | null)?.response?.status === 403;
}

/**
 * Gemeinsame Retry-Policy für Eigenschutz-GET-Queries (AC8, Zero-Toast).
 * - 403 → kein Retry (Einsatz-Zugriff wurde serverseitig abgelehnt).
 * - Sonst → maximal 2 Wiederholungen.
 */
export function eigenschutzRetry(failureCount: number, error: unknown): boolean {
  if (is403(error)) {
    return false;
  }
  return failureCount < 2;
}

/**
 * Liefert den Health-Status des Eigenschutz-Moduls für einen Einsatz.
 *
 * **Konsumiert den Story-1.6-AC2-Endpoint** und ist derzeit reiner Smoke-
 * Test: Rückgabe `{ status: 'ready' }` bedeutet, dass der Bereich gemountet
 * ist und der Einsatz-Scope serverseitig durchläuft. Epic 2+ ersetzt den
 * Hook-Konsum durch fachliche Queries.
 *
 * **403-Verhalten (AC8, Zero-Toast-Policy):**
 * - Kein Retry — 403 ist kein transientes Problem.
 * - `meta: { silentError: true }` — unterdrückt den globalen Sonner-Toast;
 *   die Route-Komponente rendert stattdessen einen `EmptyState`.
 */
export function useEigenschutzHealth(einsatzId: string) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.health(einsatzId),
    queryFn: async () => {
      const response = await api.eigenschutz().eigenschutzHealthControllerGetHealthVAlpha({ einsatzId });
      return response.data;
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    enabled: Boolean(einsatzId),
  });
}

/**
 * Liefert die aktiven Gefährdungsbeurteilungs-Seed-Vorlagen für den
 * aktuellen Einsatz (Story 2.1, AC4).
 *
 * Die Drawer-Komponente nutzt den Hook, um die Szenario-Kacheln
 * (Verkehrsunfall, MANV, PSNV, Einsatzende) mit aktivem Content zu befüllen.
 *
 * **UX-DR21 Zero-Toast-Policy:**
 * - `meta: { silentError: true }` — Fehler werden inline im Drawer gerendert,
 *   nicht über den globalen Sonner-Toast.
 * - Retry-Policy identisch zu `useEigenschutzHealth` (403 → kein Retry).
 */
export function useGefaehrdungsbeurteilungVorlagen(einsatzId: string) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.gefaehrdungsbeurteilungsVorlagen(einsatzId),
    queryFn: async (): Promise<GefaehrdungsbeurteilungVorlage[]> => {
      const response = await api.eigenschutz().gefaehrdungsbeurteilungControllerListVorlagenVAlpha({ einsatzId });
      // Defensive gegen Backend-Responseshape-Drift: ein nicht-Array-Payload
      // würde im Drawer einen Laufzeit-Typfehler („map is not a function") auslösen.
      return Array.isArray(response?.data) ? (response.data as GefaehrdungsbeurteilungVorlage[]) : [];
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    enabled: Boolean(einsatzId),
  });
}

/**
 * Liefert alle Gefährdungsbeurteilungen des aktuellen Einsatzes, zuletzt
 * geänderte zuerst. Die Listen-Page nutzt diesen Hook als echte Datenquelle
 * für den Überblick; der Create-Hook invalidiert denselben Query-Key.
 */
export function useGefaehrdungsbeurteilungen(einsatzId: string) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.gefaehrdungsbeurteilungen(einsatzId),
    queryFn: async (): Promise<Gefaehrdungsbeurteilung[]> => {
      const response = await api.eigenschutz().gefaehrdungsbeurteilungControllerListBeurteilungenVAlpha({
        einsatzId,
      });
      return Array.isArray(response?.data) ? (response.data as Gefaehrdungsbeurteilung[]) : [];
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    enabled: Boolean(einsatzId),
  });
}

/**
 * Legt eine Gefährdungsbeurteilung für eine Einheit im aktuellen Einsatz
 * an (Story 2.1, AC5).
 *
 * **Optimistic-Cache-Pattern:**
 * - `onMutate` snapshotet den aktuellen Listen-Cache unter
 *   `EIGENSCHUTZ_QUERY_KEYS.gefaehrdungsbeurteilungen(einsatzId)`.
 * - `onError` stellt den Snapshot wieder her.
 * - `onSettled` invalidiert die Liste, damit der echte Server-State nachgeladen
 *   wird (Source-of-Truth bleibt das Backend).
 *
 * Der Hook führt **keinen** Redirect durch — das macht die Drawer-Komponente
 * über den `onSuccess`-Callback mit dem zurückgegebenen Beurteilungs-Objekt.
 */
export function useCreateGefaehrdungsbeurteilung(einsatzId: string) {
  const queryClient = useQueryClient();
  const listKey = EIGENSCHUTZ_QUERY_KEYS.gefaehrdungsbeurteilungen(einsatzId);

  return useMutation({
    mutationFn: async (input: CreateGefaehrdungsbeurteilungInput): Promise<Gefaehrdungsbeurteilung> => {
      const response = await api.eigenschutz().gefaehrdungsbeurteilungControllerCreateBeurteilungVAlpha({
        einsatzId,
        createGefaehrdungsbeurteilungDto: {
          einheitId: input.einheitId,
          // null → undefined: Der generierte Client kennt nur optionale String-Felder,
          // aber das Shared-Zod-Schema erlaubt `null` als explizites „nicht gesetzt".
          vorlageId: input.vorlageId ?? undefined,
          gefahrenzoneId: input.gefahrenzoneId ?? undefined,
        },
      });
      return response.data as Gefaehrdungsbeurteilung;
    },
    onMutate: async () => {
      // Laufende Listen-Queries abbrechen, damit sie den Snapshot nicht überschreiben.
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Gefaehrdungsbeurteilung[]>(listKey);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(listKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
      invalidateAmpelWarnBadges(queryClient, einsatzId);
    },
  });
}

/**
 * Liefert eine einzelne Gefährdungsbeurteilung inkl. `items` + `version`
 * (Story 2.2, AC10). Der Query-Key ist granular pro Beurteilungs-ID, damit
 * die Mutation gezielt invalidieren kann.
 *
 * Retry- und Silent-Error-Policy identisch zum Vorlagen-Hook.
 */
export async function fetchGefaehrdungsbeurteilung(einsatzId: string, id: string): Promise<Gefaehrdungsbeurteilung> {
  const response = await api.eigenschutz().gefaehrdungsbeurteilungControllerGetBeurteilungVAlpha({
    einsatzId,
    id,
  });
  return response.data as Gefaehrdungsbeurteilung;
}

export function useGefaehrdungsbeurteilung(einsatzId: string, id: string) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.gefaehrdungsbeurteilung(einsatzId, id),
    queryFn: () => fetchGefaehrdungsbeurteilung(einsatzId, id),
    retry: eigenschutzRetry,
    meta: { silentError: true },
    enabled: Boolean(einsatzId) && Boolean(id),
  });
}

/**
 * Liefert die chronologische Versionshistorie einer Gefährdungsbeurteilung
 * (Story 2.4, AC10).
 *
 * Konsumiert den Read-Only-Endpoint `GET …/gefaehrdungsbeurteilungen/:id/versionen`
 * und liefert `{ aggregateVersion, eintraege[] }` absteigend sortiert (neueste
 * Version zuerst). Backend löst `changedByUserName` pro Eintrag auf; bei
 * soft-deleted User bleibt der Wert `null` — das UI fällt dann auf die
 * UserId-Kurzform zurück.
 *
 * **Cache-Verhalten:**
 * - `staleTime: 5_000` — nach einem Schreib-Vorgang (Story 2.2/2.3) wird die
 *   Historie nicht proaktiv invalidiert; TanStack refetched beim nächsten
 *   Popover-Open nach Ablauf der Stale-Time (begründet in AC10).
 * - `retry: eigenschutzRetry` — 403 → kein Retry, sonst max. 2 Wiederholungen.
 * - `meta: { silentError: true }` — Popover rendert Fehler inline (Zero-Toast).
 */
export function useGefaehrdungsbeurteilungHistorie(einsatzId: string, id: string) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.gefaehrdungsbeurteilungHistorie(einsatzId, id),
    queryFn: async (): Promise<GefaehrdungsbeurteilungHistorie> => {
      const response = await api.eigenschutz().gefaehrdungsbeurteilungControllerGetHistorieVAlpha({
        einsatzId,
        id,
      });
      return response.data as GefaehrdungsbeurteilungHistorie;
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    enabled: Boolean(einsatzId) && Boolean(id),
    staleTime: 5_000,
    refetchOnMount: 'always',
  });
}

/**
 * Aktualisiert die Items einer Gefährdungsbeurteilung (Story 2.2, AC10).
 *
 * **Optimistic-Update-Pattern:**
 * - `onMutate`: snapshot den aktuellen Detail-Cache + setze den Cache auf
 *   eine optimistische Version (`version + 1`). Das UI rendert die neue
 *   Liste sofort; der Banner erscheint erst bei 409.
 * - `onError`: rollback auf Snapshot. 409 (ConflictDetected) wird NICHT
 *   silent — die Page-Komponente fängt den Error über `mutation.error` ab
 *   und rendert einen `SeverityBanner` (Zero-Toast-Policy UX-DR21).
 * - `onSettled`: invalidate, damit die Source-of-Truth das Backend bleibt.
 */
export function useUpdateGefaehrdungsbeurteilungItems(einsatzId: string, id: string) {
  const queryClient = useQueryClient();
  const detailKey = EIGENSCHUTZ_QUERY_KEYS.gefaehrdungsbeurteilung(einsatzId, id);
  const historieKey = EIGENSCHUTZ_QUERY_KEYS.gefaehrdungsbeurteilungHistorie(einsatzId, id);

  return useMutation<Gefaehrdungsbeurteilung, unknown, UpdateGefaehrdungsbeurteilungItemsInput, { previous: Gefaehrdungsbeurteilung | undefined }>({
    // UX-DR21 Zero-Toast-Policy: 409-Konflikte rendert die Page-Komponente als
    // `SeverityBanner`-Fallback (div role="alert"). Ein zusätzlicher
    // Sonner-Toast würde zu Doppel-Benachrichtigung führen.
    meta: { silentError: true },
    scope: {
      id: `eigenschutz-gefaehrdungsbeurteilung-items-${einsatzId}-${id}`,
    },
    mutationFn: async (input): Promise<Gefaehrdungsbeurteilung> => {
      try {
        const response = await api.eigenschutz().gefaehrdungsbeurteilungControllerUpdateItemsVAlpha({
          einsatzId,
          id,
          updateGefaehrdungsbeurteilungItemsDto: {
            items: input.items.map((item) => ({
              id: item.id ?? undefined,
              title: item.title,
              description: item.description ?? undefined,
              eintritt: item.eintritt,
              schaden: item.schaden,
              // risikoklasse wird vom Backend autoritativ berechnet — kein Client-Feld.
              schutzmassnahmen: item.schutzmassnahmen ?? undefined,
            })),
            expectedVersion: input.expectedVersion,
          },
        });
        return response.data as Gefaehrdungsbeurteilung;
      } catch (error) {
        // AC13: 409 → typsierter Error mit currentVersion-Hinweis.
        // Andere Fehler (422, 500, Network) werden unverändert durchgereicht.
        const conflict = extractConflictError(error, input.expectedVersion);
        if (conflict) throw conflict;
        throw error;
      }
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<Gefaehrdungsbeurteilung>(detailKey);
      if (previous) {
        queryClient.setQueryData<Gefaehrdungsbeurteilung>(detailKey, {
          ...previous,
          // Optimistic: Items wie eingegeben (ohne risikoklasse — Backend entscheidet).
          items: input.items,
          version: input.expectedVersion + 1,
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      // Rollback auch bei `previous === null` durchführen (Cache war vorher
      // leer): ein truthy-Check würde den optimistisch gesetzten Wert stehen
      // lassen, obwohl der Cache eigentlich leer sein sollte.
      if (context !== undefined && 'previous' in context) {
        queryClient.setQueryData(detailKey, context.previous);
      }
    },
    onSuccess: (data) => {
      // Erfolg: Server-Wahrheit übernehmen (inkl. server-berechneter risikoklasse).
      queryClient.setQueryData(detailKey, data);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey });
      void queryClient.invalidateQueries({ queryKey: historieKey });
      invalidateAmpelWarnBadges(queryClient, einsatzId);
    },
  });
}

/**
 * Zod-Guard für den 409-Response-Body-Context einer Sicherheitsregel-Mutation
 * (Story 2.6, AC3).
 *
 * Analog zu `GefaehrdungsbeurteilungConflictContextSchema` — der Hook zeigt
 * currentVersion + attemptedVersion im Banner; fehlende oder malformte Felder
 * führen zum Fallback-Text und werfen KEINEN Runtime-Fehler.
 */
const SicherheitsregelConflictContextSchema = z.object({
  currentVersion: z.number().int().positive().optional(),
  attemptedVersion: z.number().int().nonnegative().optional(),
});

/**
 * Dünne Error-Subclass für den 409-Konflikt bei `useUpdateSicherheitsregel`
 * (Story 2.6, AC3 — Optimistic-Concurrency).
 *
 * Trägt `currentVersion` (kann `undefined` sein bei Backend ohne Context-
 * Enrichment) und `attemptedVersion` (aus dem Request-Input), damit das UI
 * einen präziseren Banner-Text rendern kann. Der ursprüngliche Fetch-Error
 * bleibt unter `originalError` erhalten.
 */
export class SicherheitsregelConflictError extends Error {
  readonly statusCode = 409;
  constructor(
    readonly currentVersion: number | undefined,
    readonly attemptedVersion: number | undefined,
    readonly originalError: unknown,
  ) {
    super('ConflictDetected:Sicherheitsregel');
    this.name = 'SicherheitsregelConflictError';
  }
}

/**
 * Extrahiert aus einem Fetch-Error einen `SicherheitsregelConflictError`,
 * wenn der Response-Status 409 ist. Andere Statuscodes liefern `null` — dann
 * soll der aufrufende Hook den Original-Error unverändert weiterwerfen.
 *
 * Robust gegen non-Objekt-Errors (String, Number, null, Array): statt
 * `as { response?: ... }` zu casten (was bei Primitives wirft, sobald
 * `.response` zugegriffen wird) prüfen wir typeof === 'object' explizit.
 *
 * Bevorzugt **Server-`attemptedVersion`** aus dem 409-Body-Context, fällt
 * nur bei fehlendem Server-Wert auf das Frontend-Argument zurück — sonst
 * würde ein zukünftiger Server-side Coerce des Wertes nie sichtbar werden.
 */
export function extractSicherheitsregelConflictError(error: unknown, attemptedVersion: number): SicherheitsregelConflictError | null {
  if (error === null || error === undefined || typeof error !== 'object') return null;
  const errObj = error as { response?: unknown };
  const response = typeof errObj.response === 'object' && errObj.response !== null ? (errObj.response as { status?: unknown; data?: unknown }) : undefined;
  const status = typeof response?.status === 'number' ? response.status : undefined;
  if (status !== 409) return null;

  const dataCandidate = response?.data;
  const rawContext = typeof dataCandidate === 'object' && dataCandidate !== null && !Array.isArray(dataCandidate) ? (dataCandidate as { context?: unknown }).context : undefined;
  const contextToValidate = typeof rawContext === 'object' && rawContext !== null && !Array.isArray(rawContext) ? rawContext : {};
  const parsed = SicherheitsregelConflictContextSchema.safeParse(contextToValidate);
  const currentVersion = parsed.success ? parsed.data.currentVersion : undefined;
  const serverAttemptedVersion = parsed.success ? parsed.data.attemptedVersion : undefined;
  return new SicherheitsregelConflictError(currentVersion, serverAttemptedVersion ?? attemptedVersion, error);
}

/**
 * Transformiert die diskriminierte Union aus dem Shared-Schema auf das flache
 * Request-DTO-Shape, das der generierte Client erwartet
 * (`{titel, inhalt, einsatzweit, einheitIds?}`).
 *
 * Bei `einsatzweit === true` bleibt `einheitIds` **absent**
 * (`undefined`), weil der Backend-Controller dann ohnehin `einheitId = null`
 * erzwingt; ein leeres Array würde den Payload unnötig aufblähen. Bei
 * `einsatzweit === false` wird das TypeScript-diskriminiert garantiert
 * nicht-leere Array durchgereicht.
 */
function toCreateSicherheitsregelDto(input: CreateSicherheitsregelInput): { titel: string; inhalt: string; einsatzweit: boolean; einheitIds?: string[] } {
  if (input.einsatzweit) {
    return { titel: input.titel, inhalt: input.inhalt, einsatzweit: true };
  }
  return { titel: input.titel, inhalt: input.inhalt, einsatzweit: false, einheitIds: input.einheitIds };
}

/**
 * Identisch zu {@link toCreateSicherheitsregelDto}, ergänzt `expectedVersion`
 * für Optimistic-Concurrency (Story 2.6, AC3).
 */
function toUpdateSicherheitsregelDto(input: UpdateSicherheitsregelInput): { titel: string; inhalt: string; einsatzweit: boolean; einheitIds?: string[]; expectedVersion: number } {
  if (input.einsatzweit) {
    return { titel: input.titel, inhalt: input.inhalt, einsatzweit: true, expectedVersion: input.expectedVersion };
  }
  return { titel: input.titel, inhalt: input.inhalt, einsatzweit: false, einheitIds: input.einheitIds, expectedVersion: input.expectedVersion };
}

/**
 * Liefert die aktiven Sicherheitsregeln des aktuellen Einsatzes (Story 2.6,
 * AC6). Der optionale `einheitId`-Parameter lässt das Backend einsatzweite
 * Regeln **plus** Regeln dieser konkreten Einheit liefern — für Story 2.7
 * (Abschnittsleiter-Sicht) vorbereitet, schadet im Sender-Flow aber nicht.
 *
 * **UX-DR21 Zero-Toast-Policy:** `meta: { silentError: true }` — Fehler werden
 * inline auf der Page gerendert. Retry-Policy identisch zum Vorlagen-Hook
 * (403 → kein Retry).
 */
export function useSicherheitsregeln(einsatzId: string, einheitId?: string) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.sicherheitsregeln(einsatzId, einheitId),
    queryFn: async (): Promise<SicherheitsregelDto[]> => {
      const response = await api.eigenschutz().sicherheitsregelControllerListRegelnVAlpha({ einsatzId, einheitId });
      // Defensive gegen Envelope-Drift: non-Array-Payload würde in Tabellen zu
      // „map is not a function" führen.
      return Array.isArray(response?.data) ? (response.data as SicherheitsregelDto[]) : [];
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    enabled: Boolean(einsatzId),
  });
}

/**
 * Lädt eine einzelne Sicherheitsregel für den Edit-Modus des Drawers
 * (Story 2.6, AC1 + Code-Review-Patch #17). Der Query-Key ist granular pro
 * Regel-ID, damit `useUpdateSicherheitsregel` gezielt invalidieren kann.
 *
 * **Frische-Strategie**: `staleTime: 0` + `refetchOnMount: 'always'` —
 * sobald der Drawer einen Edit-Open auslöst, wird die Regel server-seitig
 * neu geladen, damit der User keinen stale Stand aus der Listen-Cache
 * sieht. Der Caller (Drawer) steuert das Mounten über `options.enabled =
 * open && isEditMode`, sodass die Query nur zur tatsächlichen Bearbeitung
 * aktiv wird.
 */
export function useSicherheitsregel(einsatzId: string, id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.sicherheitsregel(einsatzId, id),
    queryFn: async (): Promise<SicherheitsregelDto> => {
      const response = await api.eigenschutz().sicherheitsregelControllerGetRegelVAlpha({ einsatzId, id });
      return response.data as SicherheitsregelDto;
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    enabled: Boolean(einsatzId) && Boolean(id) && (options?.enabled ?? true),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Legt eine Sicherheitsregel an (Story 2.6, AC2).
 *
 * **Fanout-Response:** Der Backend-Controller liefert ein Array von DTOs —
 * eine Row pro Zuordnungs-Einheit bzw. eine einzelne Row bei einsatzweiter
 * Regel. Seit dem Code-Review-Patch trägt der `@ApiWrappedCreatedResponse`-
 * Decorator `isArray: true`, der OpenAPI-Generator typisiert `data`
 * korrekt als Array — der frühere `as unknown as`-Doppel-Cast ist nicht
 * mehr nötig.
 *
 * Nach Erfolg wird **alle** `sicherheitsregeln`-Listen-Keys
 * (einsatzweit + einheiten-scoped) invalidiert — das Prefix
 * `[..., 'sicherheitsregeln', 'list']` stimmt für beide Varianten und
 * TanStack macht exact-or-prefix-Matching im `invalidateQueries`-Default.
 */
export function useCreateSicherheitsregel(einsatzId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSicherheitsregelInput): Promise<SicherheitsregelDto[]> => {
      const response = await api.eigenschutz().sicherheitsregelControllerCreateRegelnVAlpha({
        einsatzId,
        createSicherheitsregelDto: toCreateSicherheitsregelDto(input),
      });
      return (response.data ?? []) as SicherheitsregelDto[];
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: EIGENSCHUTZ_QUERY_KEYS.sicherheitsregeln(einsatzId),
      });
    },
  });
}

/**
 * Aktualisiert eine Sicherheitsregel (Story 2.6, AC3 + AC4).
 *
 * Liefert genauso wie `useCreateSicherheitsregel` ein `SicherheitsregelDto[]`
 * — bei In-Place-Update ein Einzel-Element-Array, bei Re-Wire die neu
 * erzeugten Rows (alle mit stabiler `propagationGroupId`).
 *
 * **409-Handling (Zero-Toast, UX-DR21):** Der Hook mappt Fetch-Errors mit
 * Status 409 auf einen typsierten `SicherheitsregelConflictError` (trägt
 * `currentVersion` + `attemptedVersion`). Andere Fehler (422, 500, Network)
 * werden unverändert durchgereicht; die Page rendert beide Fälle inline,
 * kein Sonner-Toast.
 *
 * **Invalidation:** sowohl die Listen-Query als auch die Detail-Query werden
 * invalidiert — Detail, damit ein weiterer Edit-Open den Server-State
 * (inkl. neuer `version`) sieht; Liste, damit die Page-Tabelle aktuell ist.
 */
export function useUpdateSicherheitsregel(einsatzId: string) {
  const queryClient = useQueryClient();

  return useMutation<SicherheitsregelDto[], unknown, UpdateSicherheitsregelInput & { id: string }>({
    meta: { silentError: true },
    mutationFn: async (input): Promise<SicherheitsregelDto[]> => {
      try {
        const response = await api.eigenschutz().sicherheitsregelControllerUpdateRegelVAlpha({
          einsatzId,
          id: input.id,
          updateSicherheitsregelDto: toUpdateSicherheitsregelDto(input),
        });
        return (response.data ?? []) as SicherheitsregelDto[];
      } catch (error) {
        const conflict = extractSicherheitsregelConflictError(error, input.expectedVersion);
        if (conflict) throw conflict;
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: EIGENSCHUTZ_QUERY_KEYS.sicherheitsregeln(einsatzId),
      });
      void queryClient.invalidateQueries({
        queryKey: EIGENSCHUTZ_QUERY_KEYS.sicherheitsregel(einsatzId, variables.id),
      });
    },
  });
}

/**
 * Input-Shape für `useAckSicherheitsregel`.
 */
export interface AckSicherheitsregelInput {
  id: string;
  einheitId: string;
  expectedRegelVersion?: number;
}

/**
 * Quittiert eine Sicherheitsregel durch eine konkrete Einheit (Story 2.7 AC2).
 *
 * **Idempotenz** (AC3): Doppelte Sends ergeben 204; kein Server-Toast, kein
 * Frontend-Sonner — der Banner verschwindet stumm.
 *
 * **Cache-Invalidation** (AC11/AC13):
 * - `sicherheitsregeln(einsatzId)` — Listen-Refresh, damit der eigene
 *   Quittungs-Status auf der Page aktuell ist.
 * - `sicherheitsregel(einsatzId, id)` — Detail-Refresh.
 * - `sicherheitsregelQuittungen(einsatzId, id)` — Sender-Counter aktualisieren.
 *
 * **Zero-Toast** (UX-DR21): Bei Mutation-Fehler (422/500/Network) wird der
 * Error unverändert weitergeworfen. Banner-Komponente rendert Inline-Error
 * (kein Sonner-Toast).
 */
export function useAckSicherheitsregel(einsatzId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, unknown, AckSicherheitsregelInput>({
    meta: { silentError: true },
    mutationFn: async (input) => {
      try {
        await api.eigenschutz().sicherheitsregelControllerQuittierenVAlpha({
          einsatzId,
          id: input.id,
          ackSicherheitsregelDto: {
            einheitId: input.einheitId,
            expectedRegelVersion: input.expectedRegelVersion,
          },
        });
      } catch (error) {
        // Story 2.7 Code-Review-Patch: 409 (Optimistic-Concurrency-Mismatch
        // bei `expectedRegelVersion`) auf einen typisierten
        // `SicherheitsregelConflictError` mit `currentVersion`/
        // `attemptedVersion`-Kontext anreichern, sodass UI-Komponenten den
        // Banner mit präzisen Versions-Daten neu prompten können. Andere
        // Statuscodes (422, 500, Network) werden 1:1 weitergeworfen.
        if (input.expectedRegelVersion !== undefined) {
          const conflict = extractSicherheitsregelConflictError(error, input.expectedRegelVersion);
          if (conflict !== null) {
            throw conflict;
          }
        }
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.sicherheitsregeln(einsatzId) });
      void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.sicherheitsregel(einsatzId, variables.id) });
      void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.sicherheitsregelQuittungen(einsatzId, variables.id) });
    },
  });
}

/**
 * Element-Shape für die Quittungs-Liste (Sender-View, Story 2.7 AC10).
 *
 * Spiegelt das Backend-DTO 1:1; `quittiertVonUserName` ist Phase-2-Enrichment.
 */
export interface SicherheitsregelQuittungEntry {
  einheitId: string;
  einheitName: string;
  quittiertAm: string;
  quittiertVonUserId: string;
  quittiertVonUserName?: string;
}

/**
 * Listet alle Quittungen einer Sicherheitsregel — Sender-View
 * (Story 2.7 AC10/AC13). Wird vom Stab-Dashboard und vom
 * `AcknowledgmentStatusBadge`-Popover konsumiert.
 */
export function useSicherheitsregelQuittungen(einsatzId: string, regelId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.sicherheitsregelQuittungen(einsatzId, regelId),
    queryFn: async (): Promise<SicherheitsregelQuittungEntry[]> => {
      const response = await api.eigenschutz().sicherheitsregelControllerListQuittungenVAlpha({ einsatzId, id: regelId });
      // `@ApiWrappedResponse(... { isArray: true })` (Story 2.6 Wrapper-
      // Decorator) erzeugt einen typisierten `data: Array<…>` — kein
      // defensiver Cast mehr nötig (Story 2.7 Code-Review-Decision 4).
      const rows = response?.data ?? [];
      return rows.map((row) => ({
        einheitId: row.einheitId,
        einheitName: row.einheitName,
        quittiertAm: row.quittiertAm,
        quittiertVonUserId: row.quittiertVonUserId,
        quittiertVonUserName: row.quittiertVonUserName,
      }));
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    // Goal G3: Card-Listen rendern N Karten und brauchen die Quittungs-
    // Detailliste pro Regel nur on-demand (Popover-Open). Default-Verhalten
    // bleibt unverändert (`enabled: true`).
    enabled: (options?.enabled ?? true) && Boolean(einsatzId) && Boolean(regelId),
  });
}

// ============================================================================
// Story 3.1 — PSA-Profil aktivieren / deaktivieren
// ============================================================================

/**
 * Strukturierter 409-Konflikt-Error für PSA-Profil-Mutationen (Story 3.1 AC4).
 *
 * Trägt entweder `currentVersion` (OCC-Verletzung beim Schließen) oder
 * `rule = 'DuplicateActiveProfile'` (Race-bedingte Doppelaktivierung,
 * AC8). UI rendert beide Fälle inline (Zero-Toast, UX-DR21).
 */
export class PsaProfilConflictError extends Error {
  readonly statusCode = 409;
  constructor(
    readonly variant: 'OCC' | 'DuplicateActiveProfile',
    readonly currentVersion: number | undefined,
    readonly attemptedVersion: number | undefined,
    readonly originalError: unknown,
    /**
     * Story 3.2 (AC6): bei Bulk-Konflikten trägt der 409-Body
     * `context.einheitId` und `context.profil` mit, damit der Drawer den
     * Banner mit der Einheit identifizieren kann. Im Single-Pfad sind die
     * Felder optional (Server kann sie redundant zur Path-Param-Einheit
     * mitsenden, aber das UI nutzt sie nur im Bulk-Modus).
     */
    readonly einheitId?: string,
    readonly profil?: 'BASIS' | 'INFEKTION' | 'VU' | 'CBRN_PATIENT' | 'VOLLSCHUTZ',
    /**
     * Story 3.9 (AC1): bei OCC- und DuplicateActive-Konflikten trägt der
     * 409-Body die `zuweisungId` der konfliktierenden `PsaProfilZuweisung`-Row
     * mit. Sie wird vom 409-Folgecall `POST /sync-conflicts` als `entityId`
     * benötigt. Bei älteren Backend-Ständen (vor AC1) fehlt das Feld; der
     * Folgecall wird dann übersprungen (siehe useChangePsaProfil).
     */
    readonly zuweisungId?: string,
  ) {
    super(variant === 'DuplicateActiveProfile' ? 'ConflictDetected:DuplicateActivePsaProfilZuweisung' : 'ConflictDetected:PsaProfilZuweisung');
    this.name = 'PsaProfilConflictError';
  }
}

const PsaProfilConflictContextSchema = z.object({
  currentVersion: z.number().int().positive().optional(),
  attemptedVersion: z.number().int().nonnegative().optional(),
  rule: z.string().optional(),
  einheitId: z.string().optional(),
  profil: z.enum(['BASIS', 'INFEKTION', 'VU', 'CBRN_PATIENT', 'VOLLSCHUTZ']).optional(),
  // Story 3.9 (AC1): cuid2-Format der Verlierer-PsaProfilZuweisung-Row.
  zuweisungId: z.string().optional(),
});

function extractPsaProfilConflictError(error: unknown, attemptedVersion: number | undefined): PsaProfilConflictError | null {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status !== 409) return null;
  const dataCandidate = (error as { response?: { data?: unknown } } | null)?.response?.data;
  const rawContext = (dataCandidate as { context?: unknown } | null)?.context;
  const contextToValidate = rawContext !== null && typeof rawContext === 'object' && !Array.isArray(rawContext) ? rawContext : {};
  const parsed = PsaProfilConflictContextSchema.safeParse(contextToValidate);
  const ctx = parsed.success ? parsed.data : {};
  // Variant explizit aufschlüsseln: nur bekannte rule-Werte mappen klar auf
  // Banner-Texte. Unbekannte Werte (z. B. künftige Sentinel-Erweiterungen)
  // fallen sicher auf den generischen OCC-Banner zurück, aber wir loggen
  // sie, damit ein Drift im Dev-Konsolen-Log auffällt.
  let variant: 'OCC' | 'DuplicateActiveProfile';
  if (ctx.rule === 'DuplicateActiveProfile') {
    variant = 'DuplicateActiveProfile';
  } else if (ctx.rule === undefined || ctx.rule === 'OCC' || ctx.rule === 'PsaProfilZuweisung') {
    variant = 'OCC';
  } else {
    console.warn('[extractPsaProfilConflictError] Unbekannter rule-Wert im 409-Body:', ctx.rule);
    variant = 'OCC';
  }
  return new PsaProfilConflictError(variant, ctx.currentVersion, ctx.attemptedVersion ?? attemptedVersion, error, ctx.einheitId, ctx.profil, ctx.zuweisungId);
}

export interface PsaProfileByEinheitDto {
  id: string;
  einsatzId: string;
  einheitId: string;
  profil: 'BASIS' | 'INFEKTION' | 'VU' | 'CBRN_PATIENT' | 'VOLLSCHUTZ';
  gueltigVon: string;
  gueltigBis: string | null;
  aktiviertVonUserId: string;
  begruendung: string;
  propagationGroupId: string;
  version: number;
}

/**
 * Lädt die aktuell aktiven PSA-Profile einer Einheit (Story 3.1 AC9).
 *
 * Stale-Time analog zu den anderen Eigenschutz-Detail-Queries (15 s) —
 * der WS-Adapter (`useEigenschutzPsaLiveBanner`, Story 3.1 später) wird
 * im Erfolgsfall ohnehin invalidieren.
 */
export function usePsaProfileByEinheit(einsatzId: string, einheitId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.psaProfileByEinheit(einsatzId, einheitId),
    queryFn: async (): Promise<PsaProfileByEinheitDto[]> => {
      const response = await api.eigenschutz().psaProfilControllerGetPsaProfileVAlpha({ einsatzId, einheitId });
      const rows = (response?.data ?? []) as PsaProfileByEinheitDto[];
      return rows;
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    staleTime: 15_000,
    enabled: (options?.enabled ?? true) && Boolean(einsatzId) && Boolean(einheitId),
  });
}

/**
 * Story 3.2: der Hook akzeptiert sowohl `einheitId` (Single-Pfad) als auch
 * `einheitIds` (Bulk-Pfad). Wenn `einheitIds.length > 1` ist, ruft der Hook
 * den Bulk-Endpoint, sonst den Single-Endpoint. `einheitId` bleibt für
 * Backward-Compat zur Story-3.1-Single-Drawer-API erhalten.
 */
export interface ChangePsaProfilHookInput {
  /** Single-Modus (Story 3.1). Mutually exclusive mit `einheitIds`. */
  einheitId?: string;
  /** Bulk-Modus (Story 3.2). Wenn length > 1 → Bulk-Endpoint; length=1 → Single. */
  einheitIds?: string[];
  profilToggles: Array<{ profil: PsaProfileByEinheitDto['profil']; aktivieren: boolean; expectedVersion?: number }>;
  begruendung: string;
}

export interface ChangePsaProfilHookResult {
  propagationGroupId: string;
  affected: PsaProfileByEinheitDto[];
}

function resolveEinheitIds(input: ChangePsaProfilHookInput): string[] {
  if (input.einheitIds && input.einheitIds.length > 0) return input.einheitIds;
  if (input.einheitId !== undefined) return [input.einheitId];
  throw new Error('useChangePsaProfil: weder einheitId noch einheitIds gesetzt');
}

/**
 * Toggle-Mutation für PSA-Profile einer oder mehrerer Einheiten
 * (Story 3.1 AC1/AC9 + Story 3.2 AC4).
 *
 * **Retry-Policy:** kein Retry bei 403 (fehlende Permission/Rolle), 404
 * (Active-Row inzwischen weg), 409 (OCC oder DUPLICATE) oder 422
 * (BusinessRule). 5xx erlauben das default-Retry der Eigenschutz-Hooks.
 *
 * **Cache-Invalidation:** Granular pro betroffener Einheit + Kräfte-Liste.
 *
 * **Zero-Toast:** Fehler werden typisiert (`PsaProfilConflictError`)
 * durchgereicht — der Drawer rendert sie inline.
 */
export function useChangePsaProfil(einsatzId: string) {
  const queryClient = useQueryClient();
  // Story 3.9 AC7: Folgecall-Hook für Sync-Konflikt-Audit. Wird ohne `await`
  // im 409-Pfad getriggert — der UI-Banner kommt aus dem WS-Frame
  // `eigenschutz:konflikt-erkannt` parallel zum Drawer-Banner.
  const reportSyncConflict = useReportSyncConflict(einsatzId);

  return useMutation<ChangePsaProfilHookResult, unknown, ChangePsaProfilHookInput>({
    meta: { silentError: true },
    retry: (failureCount, error) => {
      if (error instanceof PsaProfilConflictError) return false;
      const status = (error as { response?: { status?: number } } | null)?.response?.status;
      if (status === 401 || status === 403 || status === 404 || status === 409 || status === 422) return false;
      return failureCount < 1;
    },
    mutationFn: async (input): Promise<ChangePsaProfilHookResult> => {
      const ids = resolveEinheitIds(input);
      const isBulk = ids.length > 1;
      try {
        if (isBulk) {
          const response = await api.eigenschutz().psaProfilControllerBulkChangePsaProfilVAlpha({
            einsatzId,
            bulkChangePsaProfilDto: {
              einheitIds: ids,
              profilToggles: input.profilToggles.map((t) => ({ profil: t.profil, aktivieren: t.aktivieren, expectedVersion: t.expectedVersion })),
              begruendung: input.begruendung,
            },
          });
          // F4: 2xx ohne Body bedeutet, dass Server oder Proxy den Response
          // verschluckt hat. Silent Success würde den User glauben lassen, die
          // Mutation sei durch — Drawer schließt, Selection wird geleert.
          // Stattdessen werfen wir, damit der Drawer den Inline-Fehler-Pfad
          // läuft und der User retry/refetch entscheiden kann.
          if (!response?.data) {
            throw new Error('Bulk-PSA-Mutation: Response ohne Body — Server-Status unbekannt');
          }
          return response.data as ChangePsaProfilHookResult;
        }
        const response = await api.eigenschutz().psaProfilControllerChangePsaProfilVAlpha({
          einsatzId,
          einheitId: ids[0]!,
          changePsaProfilDto: {
            profilToggles: input.profilToggles.map((t) => ({ profil: t.profil, aktivieren: t.aktivieren, expectedVersion: t.expectedVersion })),
            begruendung: input.begruendung,
          },
        });
        if (!response?.data) {
          throw new Error('PSA-Mutation: Response ohne Body — Server-Status unbekannt');
        }
        return response.data as ChangePsaProfilHookResult;
      } catch (error) {
        const definedVersions = input.profilToggles.map((t) => t.expectedVersion).filter((v): v is number => typeof v === 'number');
        const distinct = new Set(definedVersions);
        const attempted = distinct.size === 1 ? definedVersions[0] : undefined;
        const conflict = extractPsaProfilConflictError(error, attempted);
        if (conflict) {
          // Story 3.9 AC7: Best-Effort-Folgecall an `POST /sync-conflicts`,
          // damit der Verlierer-State auditierbar in `sync_conflicts` landet
          // und der WS-Mikro-Banner getriggert wird. KEIN await — der Drawer-
          // Banner bleibt der primäre UX-Pfad, der 202-Echo zählt nicht für
          // die Promise-Latenz.
          if (conflict.zuweisungId) {
            // Code-Review P9: Reporting nur, wenn beide Versions-Felder
            // tatsächlich vom Backend gekommen sind. Ein 0-Fallback würde
            // gegen die Backend-Validation `>= 1` laufen → 422
            // `VersionInvalid`/`VERSION_NOT_CONFLICT`, das `meta.silentError`
            // verschluckt. Folge: Audit-Eintrag für den Verlierer ginge
            // verloren, ohne sichtbare Fehlerquelle. Lieber loggen und nicht
            // melden — Backend-Backward-Compat-Fall.
            if (typeof conflict.currentVersion !== 'number' || typeof conflict.attemptedVersion !== 'number') {
              console.warn('[useChangePsaProfil] 409 ohne currentVersion/attemptedVersion — Sync-Conflict-Folgecall übersprungen (alter Backend-Stand?)', {
                hasCurrentVersion: typeof conflict.currentVersion === 'number',
                hasAttemptedVersion: typeof conflict.attemptedVersion === 'number',
              });
            } else {
              const conflictedEinheitId = conflict.einheitId ?? input.einheitId ?? null;
              const localPayload: Record<string, unknown> = {
                toggles: input.profilToggles.map((t) => ({ profil: t.profil, aktivieren: t.aktivieren, expectedVersion: t.expectedVersion })),
                begruendung: input.begruendung,
                resolvedEinheitIds: resolveEinheitIds(input),
              };
              reportSyncConflict.mutate({
                einheitId: conflictedEinheitId,
                entityId: conflict.zuweisungId,
                fieldPath: 'profil',
                localPayload,
                serverVersion: conflict.currentVersion,
                localExpectedVersion: conflict.attemptedVersion,
              });
            }
          } else {
            console.warn('[useChangePsaProfil] 409 ohne zuweisungId — Konflikt nicht meldbar (alter Backend-Stand?)');
          }
          throw conflict;
        }
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      const ids = resolveEinheitIds(variables);
      // Story 3.2 AC7: pro betroffener Einheit gezielt invalidieren — kein
      // grobes Page-Wide-Refetch.
      for (const id of ids) {
        void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.psaProfileByEinheit(einsatzId, id) });
      }
      invalidateAmpelStatus(queryClient, einsatzId);
      invalidateAmpelWarnBadges(queryClient, einsatzId);
      void queryClient.invalidateQueries({ queryKey: ['kraefte', einsatzId, 'einheiten'] });
    },
  });
}

// ============================================================================
// Story 3.4 — PSA-Quittung + Quittungsstand-Anzeige
// ============================================================================

/**
 * Input-Shape für `useAckPsaQuittung` (Story 3.4 AC9).
 */
export interface AckPsaQuittungInput {
  propagationGroupId: string;
  einheitId: string;
}

/**
 * Eintrag in der Quittungs-Liste pro Bekanntgabe-Gruppe (Story 3.4 AC8).
 *
 * Status-Union enthält schon `OVERDUE` als Forward-Compat-Marker für
 * Story 3.7 (`Re-Prompt-Scheduler`); Story 3.4-Daten liefern nur
 * `AUSSTEHEND | QUITTIERT`.
 */
export interface PsaQuittungEntry {
  einheitId: string;
  einheitName: string;
  status: 'AUSSTEHEND' | 'QUITTIERT' | 'OVERDUE';
  quittiertAm?: string;
  quittiertVonUserId?: string;
  quittiertVonUserName?: string;
  /** Story 3.6 AC8 — true = Empfänger hat eine Ausrüstungs-Lücke gemeldet. */
  lueckeGemeldet?: boolean;
  /** Story 3.6 AC8 — Klartext der Lücken-Meldung. Nur gesetzt, wenn `lueckeGemeldet === true`. */
  lueckeNotiz?: string;
}

/**
 * Aggregat-Eintrag in der „Offene PSA-Bekanntgaben"-Liste (Story 3.4 AC15).
 */
export interface OffenePsaBekanntgabeEntry {
  propagationGroupId: string;
  occurredAt: string;
  begruendungAnriss: string;
  profilToggles: Array<{ profil: PsaProfileByEinheitDto['profil']; aktion: 'AKTIVIERT' | 'DEAKTIVIERT' }>;
  betroffeneEinheitIds: string[];
  ackCount: number;
  totalCount: number;
  status: 'pending' | 'partial';
  /** Story 3.6 AC8 — Anzahl Empfänger-Einheiten mit gemeldeter Ausrüstungs-Lücke. */
  lueckenCount?: number;
}

export type OffeneRueckmeldungEntry = OffeneRueckmeldungDto;

/**
 * Quittiert eine PSA-Bekanntgabe für eine konkrete Einheit (Story 3.4 AC1, AC9).
 *
 * **Idempotenz** (AC3): Doppelte Sends ergeben 204; kein Server-Toast,
 * kein Frontend-Sonner — der Banner verschwindet stumm aus der Hook-Queue
 * (siehe `PsaProfilEmpfangBanner` Primary-Action).
 *
 * **Cache-Invalidation** (AC9, AC15):
 * - `psaQuittungen(einsatzId, propagationGroupId)` — Sender-Counter aktualisieren.
 * - `offenePsaBekanntgaben(einsatzId)` — vollständig quittierte Gruppe verschwindet aus der Liste.
 * - `psaProfileByEinheit(einsatzId, einheitId)` — Empfänger-Detail-Refetch.
 *
 * **Telemetrie** (AC14): Bei Erfolgreich-Quittung wird genau ein
 * `psa_quittung_abgegeben`-Event in die Telemetrie-Queue gepushed (für
 * Story 3.11 End-zu-End-Trace `assess_started → all_banners_delivered →
 * psa_quittung_abgegeben`). Bei Fehler kein Event.
 *
 * **Zero-Toast** (UX-DR21): Bei Mutation-Fehler (422/500/Network) wird der
 * Error 1:1 weitergeworfen — `meta: { silentError: true }` greift, kein
 * Sonner-Toast. Banner-Komponente rendert Inline-Error-Attribut.
 */
export function useAckPsaQuittung(einsatzId: string) {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation<void, unknown, AckPsaQuittungInput>({
    meta: { silentError: true },
    mutationFn: async (input) => {
      await api.eigenschutz().psaProfilControllerQuittierenVAlpha({
        einsatzId,
        propagationGroupId: input.propagationGroupId,
        ackPsaQuittungDto: { einheitId: input.einheitId },
      });
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.psaQuittungen(einsatzId, variables.propagationGroupId) });
      void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.offenePsaBekanntgaben(einsatzId) });
      void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.offeneRueckmeldungen(einsatzId) });
      void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.psaProfileByEinheit(einsatzId, variables.einheitId) });
      invalidateAmpelStatus(queryClient, einsatzId);
      invalidateAmpelWarnBadges(queryClient, einsatzId);

      // Telemetrie: AC14 — genau ein Event pro Erfolgreich-Quittung. Story
      // 3.11 nutzt `psa_quittung_abgegeben` als dritte Marke im
      // CBRN-End-zu-End-Trace.
      // Wenn der User noch nicht geladen ist (sehr seltener Race), skippen
      // wir die Telemetrie — ein Event ohne valide userId würde den
      // End-zu-End-Trace verzerren statt ihn zu erweitern.
      if (!user?.id) return;
      eigenschutzTelemetryQueue.push({
        eventName: 'psa_quittung_abgegeben',
        propagationGroupIdCandidate: variables.propagationGroupId,
        abschnittCount: 1,
        userId: user.id,
        sessionId: getOrCreateSessionId(),
        clientTime: new Date().toISOString(),
        metadata: { einheitIdCandidate: variables.einheitId },
      });
    },
  });
}

// ============================================================================
// Story 3.6 — Lücke-Meldung (FR20)
// ============================================================================

/**
 * Input-Shape für `useMeldeLuecke` (Story 3.6 AC10).
 */
export interface MeldeLueckeInput {
  propagationGroupId: string;
  einheitId: string;
  /** Bereits vom Aufrufer getrimmt; Backend trimmt zusätzlich (Defense-in-Depth). */
  meldung: string;
}

/**
 * Meldet eine Ausrüstungs-Lücke zu einer PSA-Bekanntgabe (Story 3.6, FR20).
 *
 * **Cache-Invalidation** (analog `useAckPsaQuittung`):
 * - `psaQuittungen(einsatzId, propagationGroupId)` — Sender-Counter sieht
 *   `lueckeGemeldet=true` für die meldende Einheit.
 * - `offenePsaBekanntgaben(einsatzId)` — `lueckenCount` aktualisiert sich.
 * - `psaProfileByEinheit(einsatzId, einheitId)` — Empfänger-Detail-Refetch.
 *
 * **Telemetrie (AC15):** Bei Erfolg wird genau ein `luecke_gemeldet`-Event
 * in die Telemetrie-Queue gepushed (analog `psa_quittung_abgegeben` Story
 * 3.4). Bei `!user.id` (sehr seltener Race) kein Event — würde den
 * End-zu-End-Trace verzerren.
 *
 * **Zero-Toast** (UX-DR21): `meta: { silentError: true }`. Inline-Error im
 * `MeldeLueckeDialog` (AC11) — kein Sonner-Toast.
 */
export function useMeldeLuecke(einsatzId: string) {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation<void, unknown, MeldeLueckeInput>({
    meta: { silentError: true },
    mutationFn: async (input) => {
      await api.eigenschutz().psaProfilControllerMeldeLueckeVAlpha({
        einsatzId,
        propagationGroupId: input.propagationGroupId,
        meldeLueckeDto: { einheitId: input.einheitId, meldung: input.meldung },
      });
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.psaQuittungen(einsatzId, variables.propagationGroupId) });
      void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.offenePsaBekanntgaben(einsatzId) });
      void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.offeneRueckmeldungen(einsatzId) });
      void queryClient.invalidateQueries({ queryKey: EIGENSCHUTZ_QUERY_KEYS.psaProfileByEinheit(einsatzId, variables.einheitId) });
      invalidateAmpelStatus(queryClient, einsatzId);
      invalidateAmpelWarnBadges(queryClient, einsatzId);

      if (!user?.id) return;
      // Telemetrie darf den Mutation-Success-Pfad nicht zum Inline-Fehler
      // umkippen lassen, falls die Queue (z. B. Quota-Overflow) wirft.
      try {
        eigenschutzTelemetryQueue.push({
          eventName: 'luecke_gemeldet',
          propagationGroupIdCandidate: variables.propagationGroupId,
          abschnittCount: 1,
          userId: user.id,
          sessionId: getOrCreateSessionId(),
          clientTime: new Date().toISOString(),
          metadata: { einheitIdCandidate: variables.einheitId, meldungLength: variables.meldung.length },
        });
      } catch {
        // Telemetrie ist best-effort — Mutation ist semantisch erfolgreich.
      }
    },
  });
}

// ============================================================================
// Story 3.9 — Sync-Konflikt-Folgecall (FR50)
// ============================================================================

/**
 * Input-Shape für `useReportSyncConflict` (Story 3.9 AC7).
 *
 * Wird vom 409-Pfad in `useChangePsaProfil` ohne `await` getriggert
 * (Best-Effort-Audit). Der Verlierer-State (`localPayload`) trägt das
 * vollständige Hook-Input — Story 3.10 zeigt es in der `ConflictResolutionList`.
 */
export interface ReportSyncConflictInput {
  einheitId: string | null;
  entityId: string;
  fieldPath: string;
  localPayload: Record<string, unknown>;
  serverVersion: number;
  localExpectedVersion: number;
}

/**
 * Meldet einen Sync-Konflikt nach 409-Mutation (Story 3.9 AC7, FR50).
 *
 * Pattern: TanStack-Mutation um den generierten Client-Call. Best-Effort-
 * Audit: Mutation-Fehler werden silent verworfen (`meta.silentError`),
 * weil der UI-Banner ohnehin via WS-Frame `eigenschutz:konflikt-erkannt`
 * kommt und die Drawer-Banner-UX vom 409 selbst getragen wird.
 */
export function useReportSyncConflict(einsatzId: string) {
  return useMutation<{ syncConflictId: string; alreadyExisted: boolean }, unknown, ReportSyncConflictInput>({
    meta: { silentError: true },
    mutationFn: async (input) => {
      const response = await api.eigenschutz().syncConflictControllerReportSyncConflictVAlpha({
        einsatzId,
        reportSyncConflictDto: {
          einheitId: input.einheitId ?? undefined,
          entityId: input.entityId,
          fieldPath: input.fieldPath,
          localPayload: input.localPayload,
          serverVersion: input.serverVersion,
          localExpectedVersion: input.localExpectedVersion,
        },
      });
      const data = (response?.data ?? {}) as { syncConflictId?: string; alreadyExisted?: boolean };
      return {
        syncConflictId: data.syncConflictId ?? '',
        alreadyExisted: data.alreadyExisted ?? false,
      };
    },
  });
}

/**
 * Listet alle Quittungen einer PSA-Bekanntgabe-Gruppe — Sender-View
 * (Story 3.4 AC8). Wird vom `AcknowledgmentStatusBadge`-Popover und der
 * Sender-Sektion auf `PsaProfilePage` konsumiert.
 *
 * Stale-Time = 15 s (analog zu den anderen Eigenschutz-Detail-Queries) —
 * der WS-Live-Hook (`useEigenschutzPsaQuittungLive`) invalidiert ohnehin
 * sofort, sobald ein neuer Quittungs-Frame eintrifft.
 */
export function useEigenschutzPsaQuittungen(einsatzId: string, propagationGroupId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.psaQuittungen(einsatzId, propagationGroupId),
    queryFn: async (): Promise<PsaQuittungEntry[]> => {
      const response = await api.eigenschutz().psaProfilControllerListQuittungenVAlpha({ einsatzId, propagationGroupId });
      const rows = (response?.data ?? []) as PsaQuittungEntry[];
      return rows;
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    staleTime: 15_000,
    enabled: (options?.enabled ?? true) && Boolean(einsatzId) && Boolean(propagationGroupId),
  });
}

/**
 * Listet alle offenen (nicht vollständig quittierten) PSA-Bekanntgaben der
 * letzten 24 h (Story 3.4 AC15) — Sender-View für `PsaProfilePage`-Sektion
 * „Offene PSA-Bekanntgaben". Phase-2-Migrate-Pfad (Story 6.2): Die Anzeige
 * wandert in die `AmpelCard`; der Hook bleibt unverändert wiederverwendbar.
 */
export function useOffenePsaBekanntgaben(einsatzId: string, options?: { enabled?: boolean; seitISO?: string }) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.offenePsaBekanntgaben(einsatzId),
    queryFn: async (): Promise<OffenePsaBekanntgabeEntry[]> => {
      const response = await api.eigenschutz().psaProfilControllerListOffeneBekanntgabenVAlpha({ einsatzId, seit: options?.seitISO });
      const rows = (response?.data ?? []) as OffenePsaBekanntgabeEntry[];
      return rows;
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    staleTime: 15_000,
    enabled: (options?.enabled ?? true) && Boolean(einsatzId),
  });
}

/**
 * Listet einzelne offene Ausrüstungs-Lücken-Rückmeldungen für das
 * einsatzweite Eigenschutz-Seitenpanel (Story 6.4).
 */
export function useOffeneRueckmeldungen(einsatzId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.offeneRueckmeldungen(einsatzId),
    queryFn: async (): Promise<OffeneRueckmeldungEntry[]> => {
      const response = await api.eigenschutz().psaProfilControllerListOffeneRueckmeldungenVAlpha({ einsatzId });
      return (response?.data ?? []) as OffeneRueckmeldungEntry[];
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    staleTime: 15_000,
    enabled: (options?.enabled ?? true) && Boolean(einsatzId),
  });
}

// ============================================================================
// Story 3.10 — Sync-Konflikt-Liste & Auflösung (FR50, UX-DR6)
// ============================================================================

/**
 * Filter-Shape für `useSyncConflicts` (Story 3.10 AC7).
 *
 * Optionale Server-seitige Filter:
 * - `entityType`: nur PSA-Konflikte oder nur GB-Konflikte (Phase 2).
 * - `einheitId`: nur Konflikte einer spezifischen Einheit.
 *
 * Filter-Felder werden per Query-Key strukturell separiert
 * (`EIGENSCHUTZ_QUERY_KEYS.syncConflicts`) — verschiedene Filter-Kombinationen
 * leben getrennt im Cache; gemeinsames Prefix erlaubt globale Invalidation.
 */
export interface SyncConflictsFilter {
  entityType?: 'PSA_PROFIL_ZUWEISUNG' | 'GEFAEHRDUNGSBEURTEILUNG_ITEM';
  einheitId?: string;
}

/**
 * Listet offene Sync-Konflikte für den Einsatz (Story 3.10 AC7, FR50).
 *
 * **Pattern:** `useQuery` um `syncConflictControllerListSyncConflictsVAlpha`.
 * Filter werden 1:1 an den Backend-Endpoint durchgereicht (`undefined`-Felder
 * werden vom generierten Client ignoriert).
 *
 * **UX-DR21 Zero-Toast:** `meta: { silentError: true }` — die
 * `ConflictResolutionList` (Task 8) rendert Fehler inline (Empty-State /
 * Error-State), nicht über den globalen Sonner-Toast. 403 bricht die
 * Retry-Schleife sofort ab (`eigenschutzRetry`).
 */
export function useSyncConflicts(einsatzId: string, filter?: SyncConflictsFilter) {
  return useQuery({
    queryKey: EIGENSCHUTZ_QUERY_KEYS.syncConflicts(einsatzId, filter),
    queryFn: async (): Promise<SyncConflictListItemDto[]> => {
      const response = await api.eigenschutz().syncConflictControllerListSyncConflictsVAlpha({
        einsatzId,
        entityType: filter?.entityType,
        einheitId: filter?.einheitId,
      });
      // Defensive gegen Backend-Responseshape-Drift: ein nicht-Array-Payload
      // würde in der List-Organism einen Laufzeit-Typfehler auslösen.
      const rows = response?.data;
      return Array.isArray(rows) ? (rows as SyncConflictListItemDto[]) : [];
    },
    retry: eigenschutzRetry,
    meta: { silentError: true },
    enabled: Boolean(einsatzId),
  });
}

/**
 * Löst einen Sync-Konflikt auf (Story 3.10 AC7, FR50).
 *
 * **Resolutions-Modi (Server-Sentinels, Story 3.10 AC5):**
 * - `SERVER_WINS`: Server-State wird übernommen, Verlierer-Eingabe verworfen.
 * - `LOCAL_WINS`: Verlierer-State wird re-applied — schreibt das PSA-Profil
 *   neu (mit aktueller Server-Version als `expectedVersion`). Erzeugt eine
 *   neue PSA-Profil-Mutation; der Live-Hook
 *   (`useEigenschutzKonfliktAufgeloestLive`) invalidiert daraufhin auch das
 *   `psa-profile`-Cache-Prefix.
 * - `MERGED`: Beide Toggle-Sets werden vereint (Phase 2; Backend kann das
 *   für Phase 1 mit `NotImplemented` ablehnen).
 *
 * **Cache-Invalidation:**
 * - Immer: `['eigenschutz', einsatzId, 'sync-conflicts']` — der aufgelöste
 *   Konflikt verschwindet aus der Liste (alle Filter-Varianten dank
 *   gemeinsamem Prefix).
 * - Immer: `['eigenschutz', einsatzId, 'psa-profile']` — auch
 *   `SERVER_WINS` und `MERGED` referenzieren den Server-State (Server kann
 *   beim Konflikt-Resolve weitere Felder rebuilden). Der WS-Live-Hook
 *   (`useEigenschutzKonfliktAufgeloestLive`) invalidiert ebenfalls für alle
 *   drei Modi; falls der WS-Frame wegen Reconnect oder Race nicht zuerst
 *   eintrifft, bleibt der `psa-profile`-Cache sonst stale (Story 3.10 F3).
 *
 * **Zero-Toast:** `meta: { silentError: true }` — die
 * `ConflictResolutionList`-Organism rendert Fehler inline; Server-Sentinels
 * (z. B. `ConflictAlreadyResolved`) werden vom UI als Hinweis angezeigt.
 */
export function useResolveKonflikt(einsatzId: string) {
  const queryClient = useQueryClient();
  return useMutation<SyncConflictResolveResultDto, unknown, { syncConflictId: string; resolution: 'SERVER_WINS' | 'LOCAL_WINS' | 'MERGED' }>({
    meta: { silentError: true },
    mutationFn: async ({ syncConflictId, resolution }) => {
      const response = await api.eigenschutz().syncConflictControllerResolveSyncConflictVAlpha({
        einsatzId,
        syncConflictId,
        resolveSyncConflictDto: { resolution } as ResolveSyncConflictDto,
      });
      return response.data;
    },
    onSuccess: () => {
      // Beide Caches IMMER invalidieren (Story 3.10 F3): unabhängig von der
      // Resolution kann sich der Server-State (psa-profile) verschoben
      // haben, und der WS-Frame trifft nicht garantiert zuerst ein.
      void queryClient.invalidateQueries({ queryKey: ['eigenschutz', einsatzId, 'sync-conflicts'] });
      void queryClient.invalidateQueries({ queryKey: ['eigenschutz', einsatzId, 'psa-profile'] });
      invalidateAmpelStatus(queryClient, einsatzId);
      invalidateAmpelWarnBadges(queryClient, einsatzId);
    },
  });
}
