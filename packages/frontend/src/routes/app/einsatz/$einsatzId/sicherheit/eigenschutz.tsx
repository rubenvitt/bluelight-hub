import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { EigenschutzEntryPage } from '@/features/eigenschutz';
import { useEigenschutzPsaQuittungLive } from '@/features/eigenschutz/api/use-eigenschutz-psa-quittung-live';
import { useEigenschutzLueckeGemeldetLive } from '@/features/eigenschutz/api/use-eigenschutz-luecke-gemeldet-live';
import { useEigenschutzQuittungUeberfaelligLive } from '@/features/eigenschutz/api/use-eigenschutz-quittung-ueberfaellig-live';
import { useEigenschutzKonfliktErkanntLive } from '@/features/eigenschutz/api/use-eigenschutz-konflikt-erkannt-live';
import { useEigenschutzKonfliktAufgeloestLive } from '@/features/eigenschutz/api/use-eigenschutz-konflikt-aufgeloest-live';
import { useEigenschutzTelemetry } from '@/features/eigenschutz/hooks/useEigenschutzTelemetry';
import { useEigenschutzSyncStatus } from '@/features/eigenschutz/hooks/useEigenschutzSyncStatus';
import type { KonfliktNotice } from '@/features/eigenschutz/api/use-eigenschutz-konflikt-erkannt-live';
import { PsaProfilEmpfangBanner } from '@/features/eigenschutz/ui/organisms/PsaProfilEmpfangBanner';
import { EinsatzleiterReprompEskalationBanner } from '@/features/eigenschutz/ui/organisms/EinsatzleiterReprompEskalationBanner';
import { EigenschutzSubNav } from '@/features/eigenschutz/ui/organisms/EigenschutzSubNav';
import { SyncConflictsDrawer } from '@/features/eigenschutz/ui/organisms/SyncConflictsDrawer';
import { KonfliktErkanntMikroBanner } from '@/features/eigenschutz/ui/molecules/KonfliktErkanntMikroBanner';
import { EigenschutzSyncStatusPopover } from '@/features/eigenschutz/ui/molecules/EigenschutzSyncStatusPopover';
import type { SyncConflictsFilter } from '@/features/eigenschutz/api/queries';
import { logger } from '@/shared/lib/logger';
import { Outlet, createFileRoute, useLocation, useNavigate } from '@tanstack/react-router';

/**
 * Layout-Route für den Eigenschutz-Bereich.
 *
 * Rendert den Eigenschutz-Bereich unter dem bereits geladenen Einsatz-
 * Workspace. Das konkrete Eigenschutz-Rollen-/Freigabemodell ist aktuell
 * kein Scope; der Einstieg darf deshalb nicht durch einen zusätzlichen
 * Health-/Scope-Gate blockiert werden.
 *
 * **Warum Layout-Route statt Leaf-Route:** Story 2.1 ergänzt die Dot-
 * Notation-Child-Route `eigenschutz.gefaehrdungen.tsx`; TanStack Router
 * behandelt `eigenschutz.tsx` dadurch automatisch als Parent. Ohne
 * `<Outlet />` würden Child-Routes niemals sichtbar werden.
 *
 * **Story 3.3 (AC8):** der `PsaProfilEmpfangBanner` ist hier als
 * gemeinsamer Layout-Container montiert — der kritische CBRN-Banner
 * bleibt damit auf der Entry-Page **und** allen Eigenschutz-Sub-Pages
 * persistent oberhalb des Inhalts sichtbar.
 *
 * **Goal G6 — Sync-Konflikte als Drawer:** Die frühere
 * `SyncConflictsPage`/`/sync-konflikte`-Sub-Tab-Route wurde zugunsten eines
 * Slide-in-`SyncConflictsDrawer` entfernt (Konflikt-Auflösung ist eine
 * kontextuelle BEFEHLSGEBER-Aktion, die den Workspace-Kontext sichtbar
 * lassen soll). Der Drawer wird hier zentral gemountet und über vier
 * Trigger geöffnet:
 * 1. `EigenschutzSyncStatusPopover` → `onOpenConflicts`
 * 2. `KonfliktErkanntMikroBanner` → `onOpenConflict` (mit Einheits-Filter)
 * 3. `eigenschutz-sync-conflict-summary-banner` (Inline-Section unten)
 * 4. Legacy-Deep-Link `?openConflicts=1` (Redirect von `/sync-konflikte`)
 */
const EigenschutzSearchSchema = z
  .object({
    /** Legacy-Deep-Link-Hint: `1` öffnet den `SyncConflictsDrawer` automatisch. */
    openConflicts: z.literal(1).optional(),
    /** Optional: Drawer-Filter (Entity-Typ) aus Legacy-URL oder Mikro-Banner. */
    entityType: z.enum(['PSA_PROFIL_ZUWEISUNG', 'GEFAEHRDUNGSBEURTEILUNG_ITEM']).optional(),
    /** Optional: Drawer-Filter (Einheit) aus Legacy-URL oder Mikro-Banner. */
    einheitId: z.string().optional(),
  })
  .optional();

export const Route = createFileRoute('/app/einsatz/$einsatzId/sicherheit/eigenschutz')({
  component: EigenschutzRouteComponent,
  validateSearch: (search) => {
    const result = EigenschutzSearchSchema.safeParse(search);
    return result.success ? (result.data ?? {}) : {};
  },
});

function EigenschutzRouteComponent() {
  const { einsatzId } = Route.useParams();
  const location = useLocation();
  const search = Route.useSearch() as { openConflicts?: 1; entityType?: 'PSA_PROFIL_ZUWEISUNG' | 'GEFAEHRDUNGSBEURTEILUNG_ITEM'; einheitId?: string } | undefined;

  // Story 3.4 AC11 — Sender-Live-Hook auf demselben Layout-Mount wie der
  // Empfänger-Banner-Hook (`useEigenschutzPsaLiveBanner` im
  // `PsaProfilEmpfangBanner` weiter unten). Beide Subscriptions sind
  // unabhängig — separater Channel + separater LRU-Cache + separater
  // Hook-Lifecycle, kein Cross-Talk.
  useEigenschutzPsaQuittungLive({ einsatzId });
  // Story 3.6 AC14 — separate Subscription für `eigenschutz:luecke-gemeldet`
  // (eigener Channel, eigener LRU-Cache, eigener Hook-Lifecycle). Keine
  // Beeinflussung des Quittungs-Live-Hooks.
  useEigenschutzLueckeGemeldetLive({ einsatzId });
  // Story 3.7 AC6 — Re-Prompt-Live-Hook für überfällige PSA-Quittungen.
  // Liefert `notices` für sowohl Empfänger-Re-Prompt-Pfad (PsaProfilEmpfangBanner)
  // als auch Einsatzleiter-Polite-Eskalation. Der Hook bleibt hier zentral
  // gemountet, damit beide Konsumenten denselben Notice-Buffer teilen.
  const reprompt = useEigenschutzQuittungUeberfaelligLive({ einsatzId });
  // Story 3.9 AC8 — Konflikt-Erkannt-Live-Hook + Mikro-Banner. Pattern Story
  // 3.7 (`reprompt`): Hook liefert notices + dismiss; Banner gated
  // intern auf `BEFEHLSGEBER`-Rolle (Pattern Story 3.7 — `useMyEinsatzPermissions`
  // existiert noch nicht; Spec-Wortlaut „eigenschutz:psa:write" ist auf eine
  // Phase-2-Permission-Hook-Story aufgeschoben).
  const konfliktLive = useEigenschutzKonfliktErkanntLive({ einsatzId });
  // Story 3.10 AC7 — Konflikt-Aufgelöst-Live-Hook. Cache-Invalidation only;
  // kein Banner. Sofortiges Cross-Hook-Dismiss zwischen Erkannt- und
  // Aufgelöst-Frames würde eine Schema-Erweiterung um `syncConflictId` als
  // Korrelator auf dem Erkannt-Frame voraussetzen — als Schema-Bump
  // (Story 3.9-Schema) auf eine separate Folgestory aufgeschoben. Der 30-s-
  // Auto-Dismiss in `KonfliktErkanntMikroBanner` deckt die UX-Lücke.
  useEigenschutzKonfliktAufgeloestLive({ einsatzId });
  // Story 3.11 Task 9.3 — Telemetrie-Flush-Hook am Layout-Mount: drei
  // unabhängige Trigger (10-s-Timer, Threshold ≥ 50 Events,
  // Visibility/Pagehide). Die Queue selbst lebt modul-global; der Hook
  // bindet nur den Flush-Pfad an den Einsatz-Kontext.
  useEigenschutzTelemetry(einsatzId);
  const syncStatus = useEigenschutzSyncStatus(einsatzId);

  const navigate = useNavigate();

  // Goal G6 — Drawer-Open-State. `null` = geschlossen; sonst aktueller
  // Filter-Snapshot, der an die Liste durchgereicht wird (Pattern: Story 3.5
  // `propagationGroupId` als Open-Signal).
  const [conflictsFilter, setConflictsFilter] = useState<SyncConflictsFilter | null>(null);

  const openSyncConflicts = useCallback((filter?: SyncConflictsFilter) => {
    setConflictsFilter(filter ?? {});
  }, []);

  const closeSyncConflicts = useCallback(() => {
    setConflictsFilter(null);
    // Falls der Drawer per Deep-Link geöffnet wurde, den `openConflicts`-Hint
    // aus der URL entfernen, damit ein Reload nicht erneut autoöffnet.
    void navigate({
      to: '.',
      search: (prev) => {
        const next = { ...(prev as Record<string, unknown>) };
        delete next.openConflicts;
        delete next.entityType;
        delete next.einheitId;
        return next as never;
      },
      replace: true,
    });
  }, [navigate]);

  // Mikro-Banner-Wiring (Story 3.9 → 3.10): „Konflikte ansehen" öffnet den
  // Drawer mit optionalem Einheits-Filter, statt zu navigieren.
  const handleOpenConflict = useCallback(
    (notice: KonfliktNotice) => {
      openSyncConflicts(notice.einheitId ? { einheitId: notice.einheitId } : {});
    },
    [openSyncConflicts],
  );

  const handleOpenSyncConflicts = useCallback(() => {
    openSyncConflicts({});
  }, [openSyncConflicts]);

  // Legacy-Deep-Link / Redirect von `/sync-konflikte`: wenn `openConflicts=1`
  // im Search-State landet, den Drawer einmalig öffnen. Der Hint bleibt in
  // der URL, bis der User den Drawer schließt — dann räumt `closeSyncConflicts`
  // ihn weg. Functional-Update auf `setConflictsFilter` verhindert ein
  // erneutes Öffnen, wenn der User den Drawer aktiv geschlossen hat (Filter
  // bleibt `null`, bis der `openConflicts`-Hint aus der URL verschwindet).
  useEffect(() => {
    if (search?.openConflicts !== 1) return;
    setConflictsFilter((prev) => (prev === null ? { entityType: search.entityType, einheitId: search.einheitId } : prev));
  }, [search?.openConflicts, search?.entityType, search?.einheitId]);

  const isEigenschutzRoot = location.pathname.replace(/\/+$/, '').endsWith('/sicherheit/eigenschutz');

  // AC6-Stub: Story 3.3 verlangt einen Stub-Handler für die Primary-Action
  // „Details ansehen" — die volle Detail-Ansicht (mit Ausrüstungs-Checkliste)
  // kommt in Story 3.5. Ohne diesen Handler würde `SeverityBanner` den Button
  // permanent disabled rendern und der CBRN-kritische Aktions-Pfad wäre tot.
  const handleShowPsaDetails = useCallback((propagationGroupId: string) => {
    logger.info?.('[eigenschutz] Details-Stub geklickt — Story 3.5 ergänzt Detail-Page', { propagationGroupId });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2" data-testid="eigenschutz-sync-status-row">
        <EigenschutzSyncStatusPopover einsatzId={einsatzId} syncStatus={syncStatus} onOpenConflicts={handleOpenSyncConflicts} />
      </div>
      <PsaProfilEmpfangBanner einsatzId={einsatzId} onShowDetails={handleShowPsaDetails} repromptNotices={reprompt.notices} onRepromptDismiss={reprompt.dismiss} />
      <EinsatzleiterReprompEskalationBanner einsatzId={einsatzId} notices={reprompt.notices} onDismiss={reprompt.dismiss} />
      <KonfliktErkanntMikroBanner einsatzId={einsatzId} notices={konfliktLive.notices} onDismiss={konfliktLive.dismissNotice} onOpenConflict={handleOpenConflict} />
      <EigenschutzSubNav einsatzId={einsatzId} />
      {syncStatus.conflictCount > 0 && konfliktLive.notices.length === 0 ? (
        <section
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-sync-conflict-border bg-sync-conflict-surface px-3 py-2 text-body-sm text-sync-conflict-text"
          data-testid="eigenschutz-sync-conflict-summary-banner"
        >
          <span className="font-medium">Sync-Konflikt: jetzt auflösen</span>
          <button
            type="button"
            onClick={handleOpenSyncConflicts}
            className="inline-flex min-h-11 items-center rounded-control px-3 py-1.5 text-body-sm font-semibold hover:bg-surface-panel focus:outline-none focus-visible:shadow-focus-ring"
            data-testid="eigenschutz-sync-conflict-summary-link"
          >
            Konflikte auflösen
          </button>
        </section>
      ) : null}
      {isEigenschutzRoot ? <EigenschutzEntryPage einsatzId={einsatzId} /> : <Outlet />}
      <SyncConflictsDrawer einsatzId={einsatzId} isOpen={conflictsFilter !== null} onClose={closeSyncConflicts} initialFilter={conflictsFilter ?? undefined} />
    </div>
  );
}
