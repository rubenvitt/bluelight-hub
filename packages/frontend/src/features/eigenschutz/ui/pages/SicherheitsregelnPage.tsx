/**
 * SicherheitsregelnPage — Übersichts-Page für Sicherheitsregeln
 * (Story 2.6 / Goal G3).
 *
 * **Layout-Entscheidung (Goal G3):** Card-Grid (1 Spalte mobil, 2 Spalten
 * ab `lg`) statt flacher Liste. Eine Sicherheitsregel trägt heute mehrere
 * Anzeige-Dimensionen (Status, Zuordnung, Quittungs-Stand, Version,
 * Zeitstempel, Aktionen), die in einer einzeiligen Liste nicht ohne
 * Wahrnehmungsverlust unterzubringen sind. Die Card-Variante macht jede
 * Dimension einzeln sichtbar; der Klick auf die Card öffnet weiterhin den
 * Edit-Drawer.
 *
 * **Status-Indikator (kein persistiertes Severity-Feld):** Das DTO
 * (`SicherheitsregelDtoSchemaV1`) trägt keinen `severity`-Wert. Das UI
 * leitet den Status aus `version` ab (`version > 1` → „Aktualisiert" /
 * warning, sonst „Bekanntgabe" / info) — siehe `SicherheitsregelStatusBadge`.
 * Eine echte „kritisch"-Severity ist Follow-up, sobald das Schema
 * erweitert ist.
 *
 * **Filter & Sortierung:** Drei Filter-Selects über der Liste:
 * 1. Status (alle / Bekanntgabe / Aktualisiert).
 * 2. Zuordnung (alle / einsatzweit / einheit-spezifisch).
 * 3. Sortierung (zuletzt aktualisiert ↓ / zuerst angelegt ↑ / Titel A–Z).
 * Die Default-Sortierung bleibt `aktualisiertAm` desc (Verhalten der
 * bisherigen Liste).
 *
 * **Quittungs-Counter:** Lazy via `SicherheitsregelQuittungsBadge` —
 * verhindert das N+1-Fetch-Problem bei Listen mit vielen Karten.
 *
 * **Out-of-Scope (dokumentiert im PR-Body):**
 * - Persistiertes Severity-Feld am Backend.
 * - „Auflösen"-Aktion (DELETE-Endpoint existiert noch nicht).
 * - Quittungs-Logik (Goal G4).
 *
 * Empty-/Loading-/Error-States folgen dem bestehenden Muster der Seite.
 */

import { useSicherheitsregeln } from '@/features/eigenschutz/api/queries';
import { useAktiveEinsatzEinheit } from '@/features/eigenschutz/hooks/use-aktive-einsatz-einheit';
import type { SicherheitsregelDto } from '@/features/eigenschutz/schemas/sicherheitsregel.schema';
import { buildEigenschutzBrowserUrl } from '@/features/eigenschutz/utils/build-eigenschutz-deep-link';
import { deriveSicherheitsregelStatus } from '@/features/eigenschutz/ui/molecules/SicherheitsregelStatusBadge';
import { SicherheitsregelCard } from '@/features/eigenschutz/ui/organisms/SicherheitsregelCard';
import { SicherheitsregelDrawer } from '@/features/eigenschutz/ui/organisms/SicherheitsregelDrawer';
import { SicherheitsregelEmpfangBanner } from '@/features/eigenschutz/ui/organisms/SicherheitsregelEmpfangBanner';
import { useEinsatzEinheiten } from '@/features/kraefte/api';
import { logger } from '@/shared/lib/logger';
import { Button } from '@/shared/ui/atoms/button.atom';
import { CopyButton } from '@/shared/ui/molecules/copy-button.molecule';
import { EmptyState } from '@/shared/ui/molecules/empty-state.molecule';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PiPlus, PiShieldCheck } from 'react-icons/pi';
import { EigenschutzPageHeader } from '../molecules/EigenschutzPageHeader';

// consistency-allow: destructive-pattern - Retry-Button bei Ladefehler, keine destruktive Mutation.
export interface SicherheitsregelnPageProps {
  readonly einsatzId: string;
  readonly initialAction?: 'new-sicherheitsregel';
  readonly focusRegelId?: string;
  readonly onActionConsumed?: () => void;
}

const FORBIDDEN_ENTITY_MESSAGE = 'Diese Entität gehört zu einem anderen Einsatz oder ist für dich nicht freigegeben.';

type StatusFilter = 'all' | 'info' | 'warning';
type ScopeFilter = 'all' | 'einsatzweit' | 'einheit';
type SortKey = 'updated-desc' | 'created-asc' | 'title-asc';

function getHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { status?: number; response?: { status?: number }; cause?: { status?: number } };
  return candidate.status ?? candidate.response?.status ?? candidate.cause?.status ?? null;
}

function compareIso(a: string, b: string): number {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return a.localeCompare(b);
  return da - db;
}

export function SicherheitsregelnPage({ einsatzId, initialAction, focusRegelId, onActionConsumed }: SicherheitsregelnPageProps) {
  const [drawerOpen, setDrawerOpen] = useState(initialAction === 'new-sicherheitsregel');
  const [editRegel, setEditRegel] = useState<SicherheitsregelDto | undefined>(undefined);
  const [dismissedFocusRegelId, setDismissedFocusRegelId] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updated-desc');
  const aktiveEinheit = useAktiveEinsatzEinheit(einsatzId);
  const regelnQuery = useSicherheitsregeln(einsatzId);
  const einheitenQuery = useEinsatzEinheiten(einsatzId);
  const regeln = useMemo(() => regelnQuery.data ?? [], [regelnQuery.data]);

  useEffect(() => {
    if (initialAction === 'new-sicherheitsregel') {
      setEditRegel(undefined);
      setDrawerOpen(true);
    }
  }, [initialAction]);

  useEffect(() => {
    if (!focusRegelId || regelnQuery.isPending || regelnQuery.isError) return;
    if (dismissedFocusRegelId === focusRegelId) return;
    const match = regeln.find((regel) => regel.id === focusRegelId);
    if (!match) return;
    setEditRegel(match);
    setDrawerOpen(true);
  }, [dismissedFocusRegelId, focusRegelId, regeln, regelnQuery.isError, regelnQuery.isPending]);

  const einheitNameById = useMemo(() => {
    return new Map((einheitenQuery.data ?? []).map((einheit) => [einheit.id, einheit.name]));
  }, [einheitenQuery.data]);

  const einheitenAnzahl = einheitenQuery.data?.length ?? 0;

  const filteredAndSorted = useMemo(() => {
    let result = regeln;
    if (statusFilter !== 'all') {
      result = result.filter((regel) => deriveSicherheitsregelStatus(regel) === statusFilter);
    }
    if (scopeFilter === 'einsatzweit') {
      result = result.filter((regel) => regel.einheitId === null);
    } else if (scopeFilter === 'einheit') {
      result = result.filter((regel) => regel.einheitId !== null);
    }
    // Stable sort via copy.
    const sorted = [...result];
    if (sortKey === 'updated-desc') {
      sorted.sort((a, b) => compareIso(b.aktualisiertAm, a.aktualisiertAm));
    } else if (sortKey === 'created-asc') {
      sorted.sort((a, b) => compareIso(a.erstelltAm, b.erstelltAm));
    } else if (sortKey === 'title-asc') {
      sorted.sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
    }
    return sorted;
  }, [regeln, scopeFilter, sortKey, statusFilter]);

  const handleOpenCreate = useCallback(() => {
    setEditRegel(undefined);
    setDrawerOpen(true);
  }, []);

  const clearActionParam = useCallback(() => {
    if (initialAction !== 'new-sicherheitsregel') return;
    onActionConsumed?.();
  }, [initialAction, onActionConsumed]);

  const handleOpenEdit = useCallback(
    (regel: SicherheitsregelDto) => {
      if (focusRegelId === regel.id) {
        setDismissedFocusRegelId(undefined);
      }
      setEditRegel(regel);
      setDrawerOpen(true);
    },
    [focusRegelId],
  );

  const handleClose = useCallback(() => {
    if (focusRegelId && editRegel?.id === focusRegelId) {
      setDismissedFocusRegelId(focusRegelId);
    }
    setDrawerOpen(false);
    setEditRegel(undefined);
    clearActionParam();
  }, [clearActionParam, editRegel?.id, focusRegelId]);

  const handleSaved = useCallback(
    (regelIds: string[]) => {
      logger.info('Sicherheitsregel(n) gespeichert', { einsatzId, regelIds });
      setDismissedFocusRegelId(focusRegelId);
      setDrawerOpen(false);
      setEditRegel(undefined);
      clearActionParam();
    },
    [clearActionParam, einsatzId, focusRegelId],
  );

  const showMissingFocusRegel = Boolean(focusRegelId) && !regelnQuery.isPending && !regelnQuery.isError && !regeln.some((regel) => regel.id === focusRegelId);
  const detailUrl = focusRegelId ? buildEigenschutzBrowserUrl({ type: 'sicherheitsregel', einsatzId, id: focusRegelId }) : undefined;
  const listErrorStatus = getHttpStatus((regelnQuery as { error?: unknown }).error);
  const isFilteredEmpty = !regelnQuery.isPending && !regelnQuery.isError && regeln.length > 0 && filteredAndSorted.length === 0;

  return (
    <div className="space-y-4">
      <EigenschutzPageHeader
        title="Sicherheitsregeln"
        description="Spezifische Regeln für den gesamten Einsatz oder einzelne Einheiten dokumentieren und bekannt geben."
        actions={
          <>
            {detailUrl ? (
              <CopyButton text={detailUrl} idleLabel="Link kopieren" copiedLabel="Link kopiert" errorLabel="Link konnte nicht kopiert werden" size="sm" statusTestId="sicherheitsregel-copy-status" />
            ) : null}
            <Button intent="primary" onClick={handleOpenCreate} data-testid="sicherheitsregeln-neue-regel">
              <PiPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Sicherheitsregel
            </Button>
          </>
        }
      />

      {/* Empfangs-Bereich für die aktuell aktive Einheit (unverändert). */}
      {aktiveEinheit.einheitId !== null && (
        <section data-testid="sicherheitsregeln-empfang" aria-label="Live-Bekanntgaben für deine Einheit">
          <SicherheitsregelEmpfangBanner einsatzId={einsatzId} />
        </section>
      )}

      {regelnQuery.isPending ? (
        <div className="rounded-panel border border-border-subtle bg-surface-panel p-4 text-sm text-text-muted" data-testid="sicherheitsregeln-list-loading">
          Lade Sicherheitsregeln…
        </div>
      ) : null}

      {regelnQuery.isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-panel border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-text"
          data-testid="sicherheitsregeln-list-error"
        >
          <div>
            <p className="font-medium">
              {listErrorStatus === 403 ? FORBIDDEN_ENTITY_MESSAGE : listErrorStatus === 404 ? 'Sicherheitsregeln nicht gefunden.' : 'Sicherheitsregeln konnten nicht geladen werden.'}
            </p>
            {listErrorStatus !== 403 && listErrorStatus !== 404 ? (
              <p className="mt-1 text-xs">Bitte erneut versuchen. Falls das Problem bestehen bleibt, ist der Bereich möglicherweise nicht freigegeben.</p>
            ) : null}
          </div>
          {listErrorStatus !== 403 && listErrorStatus !== 404 ? (
            <Button intent="danger" appearance="outline" size="sm" type="button" onClick={() => void regelnQuery.refetch()} data-testid="sicherheitsregeln-list-retry">
              Erneut versuchen
            </Button>
          ) : null}
        </div>
      ) : null}

      {showMissingFocusRegel ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-panel border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm text-status-warning-text"
          data-testid="sicherheitsregel-missing-state"
        >
          <p className="font-medium">Sicherheitsregel nicht gefunden.</p>
          <a
            href={`/app/einsatz/${encodeURIComponent(einsatzId)}/sicherheit/eigenschutz/sicherheitsregeln`}
            className="mt-1 inline-flex font-medium text-action-primary underline-offset-2 hover:underline"
          >
            Zur Sicherheitsregeln-Liste
          </a>
        </div>
      ) : null}

      {!regelnQuery.isPending && !regelnQuery.isError && regeln.length === 0 ? (
        <EmptyState
          icon={PiShieldCheck}
          title="Noch keine Sicherheitsregeln"
          description="Lege die erste Regel für den Einsatz oder einzelne Einheiten an. Danach erscheint sie hier in der Übersicht."
          action={{ label: 'Erste Regel anlegen', onClick: handleOpenCreate }}
        />
      ) : null}

      {!regelnQuery.isPending && !regelnQuery.isError && regeln.length > 0 ? (
        <div
          className="flex flex-wrap items-end gap-3 rounded-panel border border-border-subtle bg-surface-panel-elevated px-3 py-2 text-sm"
          data-testid="sicherheitsregeln-filter-bar"
          aria-label="Filter und Sortierung"
        >
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-control border border-border-subtle bg-surface-panel px-2 py-1 text-sm text-text-primary focus:outline-none focus-visible:shadow-focus-ring"
              data-testid="sicherheitsregeln-filter-status"
            >
              <option value="all">Alle</option>
              <option value="info">Bekanntgabe</option>
              <option value="warning">Aktualisiert</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            <span>Zuordnung</span>
            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)}
              className="rounded-control border border-border-subtle bg-surface-panel px-2 py-1 text-sm text-text-primary focus:outline-none focus-visible:shadow-focus-ring"
              data-testid="sicherheitsregeln-filter-scope"
            >
              <option value="all">Alle</option>
              <option value="einsatzweit">Einsatzweit</option>
              <option value="einheit">Einheiten-spezifisch</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            <span>Sortierung</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="rounded-control border border-border-subtle bg-surface-panel px-2 py-1 text-sm text-text-primary focus:outline-none focus-visible:shadow-focus-ring"
              data-testid="sicherheitsregeln-sort"
            >
              <option value="updated-desc">Zuletzt aktualisiert</option>
              <option value="created-asc">Zuerst angelegt</option>
              <option value="title-asc">Titel A–Z</option>
            </select>
          </label>
          <span className="ml-auto text-xs text-text-muted" data-testid="sicherheitsregeln-count">
            {filteredAndSorted.length} von {regeln.length}
          </span>
        </div>
      ) : null}

      {isFilteredEmpty ? (
        <div role="status" aria-live="polite" className="rounded-panel border border-border-subtle bg-surface-panel px-4 py-3 text-sm text-text-muted" data-testid="sicherheitsregeln-filter-empty">
          Keine Regeln passen zu den aktuellen Filtern.
        </div>
      ) : null}

      {!regelnQuery.isPending && !regelnQuery.isError && filteredAndSorted.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="sicherheitsregeln-list" aria-label="Sicherheitsregeln">
          {filteredAndSorted.map((regel) => {
            const einheitName = regel.einheitId === null ? undefined : einheitNameById.get(regel.einheitId);
            // Hint für den Quittungs-Counter: einheit-scoped → 1 Empfänger,
            // einsatzweit → alle aktuell bekannten Einheiten als UI-seitige
            // Obergrenze. Achtung: Diese Zahl ist nicht zwingend identisch
            // mit der tatsächlichen Fanout-Kardinalität — wurden Einheiten
            // nach dem Anlegen der Regel hinzugefügt, überschätzt der Hint
            // den Total-Counter geringfügig. Sobald das Popover geöffnet
            // wird, ersetzt der echte Fetch (`useSicherheitsregelQuittungen`)
            // diesen Hint mit dem Quittungs-Bestand vom Server.
            const quittungenHintTotal = regel.einheitId === null ? (einheitenAnzahl > 0 ? einheitenAnzahl : undefined) : 1;
            return (
              <li key={regel.id}>
                <SicherheitsregelCard einsatzId={einsatzId} regel={regel} einheitName={einheitName} quittungenHintTotal={quittungenHintTotal} onEdit={handleOpenEdit} />
              </li>
            );
          })}
        </ul>
      ) : null}

      {drawerOpen ? <SicherheitsregelDrawer einsatzId={einsatzId} open={drawerOpen} onClose={handleClose} onSaved={handleSaved} regel={editRegel} /> : null}
    </div>
  );
}
