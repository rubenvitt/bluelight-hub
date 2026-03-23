import { useCurrentUser } from '@/features/auth';
import { useBefehlNotifications, useBefehlWebSocket, useMissedBefehlAlerts, useUnquittierteBefehleCount } from '@/features/befehl';
import { EINSATZ_QUERY_KEYS, useActiveEinsatz, useEinsatzDetails, useMyEinsatzTeilnahme } from '@/features/einsatz';
import { EinsatzStatusBadge } from '@/features/einsatz/ui/molecules/einsatz-status-badge.molecule';
import { EinsatzSwitcher } from '@/features/einsatz/ui/molecules/EinsatzSwitcher.molecule';
import { ModuleOverviewCard } from '@/features/einsatz/ui/molecules/ModuleOverviewCard';
import { EinsatzBeitrittDialog } from '@/features/einsatz/ui/organisms';
import { closeQuickCreateNotizDialog, CreateNotizDialog, useQuickCreateNotizDialogState, useQuickCreateNotizHotkeys } from '@/features/notizen';
import {
  closeDeleteDialog,
  closeEditDialog,
  closeMarkErledigtDialog,
  closeQuickCreateDialog,
  closeStopRecurringDialog,
  ErinnerungDeleteDialog,
  ErinnerungEditDialog,
  ErinnerungMarkErledigtDialog,
  QuickCreateErinnerungDialog,
  StopRecurringErinnerungDialog,
  useAlarmTrigger,
  useDeleteDialogState,
  useEditDialogState,
  useErinnerungenByEinsatz,
  useMarkErledigtDialogState,
  useQuickCreateDialogStateWithEtb,
  useQuickCreateErinnerungHotkeys,
  useStopRecurringDialogState,
} from '@/features/reminders';
import { filterMyErinnerungen } from '@/features/reminders/utils/erinnerung-ownership';
import { AudioSettingsDialog } from '@/features/settings';
import { useEinsatzWorkspaceShell, useWorkspaceModules, useWorkspaceResume, WorkspaceShell } from '@/features/workspace';
import { api, EinsatzDtoStatusEnum } from '@/shared';
import { cn } from '@/shared/ui';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { CommandPalette } from '@/shared/ui/organisms/command-palette';
import { CommandPaletteErrorBoundary } from '@/shared/ui/organisms/command-palette/CommandPaletteErrorBoundary';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Outlet, useMatchRoute, useNavigate, useParams, useRouter } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PiArrowsOut, PiClock, PiRadio, PiSiren, PiSpeakerHigh, PiWarning } from 'react-icons/pi';
import { toast } from 'sonner';
import { hasBlockingWorkspaceOverlay, shouldBlockWorkspaceHotkey } from './single-einsatz-layout.utils';

interface SingleEinsatzLayoutProps {
  className?: string;
}

function isHiddenVisibility(state: { default: 'visible' | 'hidden' | 'disabled' }): boolean {
  return state.default === 'hidden';
}

function isDisabledVisibility(state: { default: 'visible' | 'hidden' | 'disabled' }): boolean {
  return state.default === 'disabled';
}

export function SingleEinsatzLayout({ className }: SingleEinsatzLayoutProps) {
  const { einsatzId } = useParams({ from: '/app/einsatz/$einsatzId' });
  const matchRoute = useMatchRoute();
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clearActiveEinsatz } = useActiveEinsatz();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showModuleOverview, setShowModuleOverview] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [showBeitrittDialog, setShowBeitrittDialog] = useState(false);
  const [showAudioDialog, setShowAudioDialog] = useState(false);

  // Quick-Create Erinnerung Dialog State und Hotkeys (Story 1.1 AC1, Story 5.4)
  const { isOpen: isQuickCreateOpen, einsatzId: quickCreateEinsatzId, etbEintragId, etbEintragText, fromTemplate } = useQuickCreateDialogStateWithEtb();
  // Edit Erinnerung Dialog State (Story 1.3 AC1)
  const [isEditDialogOpen, erinnerungToEdit, editDialogEinsatzId] = useEditDialogState();
  // Delete Erinnerung Dialog State (Story 1.4 AC2)
  const [isDeleteDialogOpen, erinnerungToDelete, deleteDialogEinsatzId] = useDeleteDialogState();
  // MarkErledigt Erinnerung Dialog State (Story 2.5)
  const [isMarkErledigtDialogOpen, erinnerungToMarkErledigt, markErledigtDialogEinsatzId] = useMarkErledigtDialogState();
  // StopRecurring Erinnerung Dialog State (Story 6.5)
  const [isStopRecurringDialogOpen, erinnerungToStopRecurring, stopRecurringDialogEinsatzId] = useStopRecurringDialogState();

  // Quick-Create Notiz Dialog State und Hotkeys
  const [isQuickCreateNotizOpen, quickCreateNotizEinsatzId] = useQuickCreateNotizDialogState();
  const { data: teilnahmeData, isLoading: isTeilnahmeLoading } = useMyEinsatzTeilnahme(einsatzId);
  const currentEinsatzPersonId = teilnahmeData?.data?.einsatzPersonId;
  const requiresAssignment = !isTeilnahmeLoading && !currentEinsatzPersonId;
  const beitrittDialogOpen = showBeitrittDialog || requiresAssignment;

  const anyDialogOpen = hasBlockingWorkspaceOverlay({
    commandPaletteOpen,
    showModuleOverview,
    showEndConfirmation,
    showBeitrittDialog: beitrittDialogOpen,
    showAudioDialog,
    isQuickCreateOpen,
    isEditDialogOpen,
    isDeleteDialogOpen,
    isMarkErledigtDialogOpen,
    isStopRecurringDialogOpen,
    isQuickCreateNotizOpen,
  });
  const workspaceIsBlocked = anyDialogOpen || isTeilnahmeLoading;

  useQuickCreateErinnerungHotkeys({
    einsatzId,
    enabled: !workspaceIsBlocked,
  });
  useQuickCreateNotizHotkeys({
    einsatzId,
    enabled: !workspaceIsBlocked,
  });

  // Story 4.1: Ctrl+B navigiert zum Befehlsarbeitsraum
  useEffect(() => {
    if (workspaceIsBlocked) return;

    function handleCtrlB(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const isInput = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
      if (isInput) return;

      if ((event.ctrlKey || event.metaKey) && event.key === 'b' && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        void navigate({
          to: '/app/einsatz/$einsatzId/führung/befehle',
          params: { einsatzId },
        });
      }
    }

    window.addEventListener('keydown', handleCtrlB);
    return () => window.removeEventListener('keydown', handleCtrlB);
  }, [einsatzId, navigate, workspaceIsBlocked]);

  // Story App-weite Erinnerungsprüfung: Globaler Alarm-Trigger für den aktiven Einsatz
  // Triggert Sound + OS-Notification für Erinnerungen die den User betreffen:
  // - Mir zugewiesen (assignedToId === user.id)
  // - An mich eskaliert (status === 'ESKALIERT' && eskalationsPersonId === user.id)
  // - Von mir erstellt und niemand anderem zugewiesen (!assignedTo && erstelltVon === user.id)
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const { data: alleErinnerungen = [], isLoading: isErinnerungenLoading, error: erinnerungenError } = useErinnerungenByEinsatz({ einsatzId });

  // Filterlogik via shared utility (DRY mit ErinnerungenList)
  const meineErinnerungen = useMemo(() => {
    if (!user?.id) return [];
    return filterMyErinnerungen(alleErinnerungen, user.id);
  }, [alleErinnerungen, user?.id]);

  // Alarm-Trigger nur wenn User UND Erinnerungen geladen sind (Race Condition Fix)
  const isAlarmTriggerReady = !!user?.id && !isUserLoading && !isErinnerungenLoading && !erinnerungenError;

  useAlarmTrigger({
    erinnerungen: meineErinnerungen,
    einsatzId,
    enabled: isAlarmTriggerReady,
    onTriggerSuccess: (erinnerung) => {
      toast.success('Erinnerung ausgelöst', {
        description: erinnerung.titel,
        duration: 10000,
      });
    },
    onTriggerError: (erinnerung, err) => {
      toast.error('Erinnerung fehlgeschlagen', {
        description: `${erinnerung.titel}: ${err.message}`,
      });
    },
  });

  // Befehl-Notifications: WebSocket-Verbindung auf Layout-Ebene, damit Empfaenger
  // Alarm-Toast + OS-Notification auf JEDER Einsatz-Seite erhalten (nicht nur befehle).
  const { onBefehlErstellt, onBefehlQuittiert } = useBefehlNotifications({ einsatzId });
  useBefehlWebSocket({ einsatzId, onBefehlErstellt, onBefehlQuittiert });

  // Quittierung-Alerts: Zeigt persistente Alarm-Toasts fuer verpasste
  // RUECKFRAGE/NICHT_VERSTANDEN Quittierungen (z.B. nach erneutem Login).
  useMissedBefehlAlerts(einsatzId);

  // Prüfe ob wir im Fullscreen/Presentation-Modus sind
  const currentSearch = router.state.location.search as { mode?: string };
  const currentPathname = router.state.location.pathname;

  useWorkspaceResume({
    einsatzId,
    pathname: currentPathname,
    search: currentSearch as Record<string, unknown>,
    requiresAssignment,
  });

  const isFullscreenMode = currentSearch?.mode === 'fullscreen' || currentSearch?.mode === 'presentation';

  // Prüfe ob die aktuelle Route Fullscreen unterstützt (/karte, /etb und /kräfte/dashboard Routes)
  const isOnKarteRoute = !!matchRoute({ to: '/app/einsatz/$einsatzId/übersicht/karte', fuzzy: false });
  const isOnEtbRoute = !!matchRoute({ to: '/app/einsatz/$einsatzId/führung/etb', fuzzy: false });
  const isOnKraefteDashboardRoute = !!matchRoute({ to: '/app/einsatz/$einsatzId/kräfte/dashboard', fuzzy: false });
  const supportsFullscreen = isOnKarteRoute || isOnEtbRoute || isOnKraefteDashboardRoute;

  // Lade kombinierte Einsatzdaten (Einsatz + ETB + Lagekarte)
  // ETB und Lagekarte werden im Cache vorgeladen, sodass Child-Routes diese nutzen können
  const { einsatz, isLoading: isEinsatzLoading } = useEinsatzDetails(einsatzId);

  // Track if we've already started this einsatz to avoid duplicate API calls
  const hasStartedRef = useRef(false);

  // Reset hasStartedRef when einsatzId changes (ref mutation doesn't require deps)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Ref mutation doesn't require dependencies
  useEffect(() => {
    hasStartedRef.current = false;
  }, [einsatzId]);

  // Mutation für Einsatz automatisch starten (wenn Status = ANGELEGT)
  const startEinsatzMutation = useMutation({
    mutationFn: async () => {
      const response = await api.einsatz().einsatzControllerStartVAlpha({
        id: einsatzId,
      });
      return response.data;
    },
    onSuccess: async () => {
      // Invalidate all relevant queries to refresh UI
      // Use Promise.all to ensure all invalidations complete before UI updates
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: EINSATZ_QUERY_KEYS.detail(einsatzId) }),
        queryClient.invalidateQueries({ queryKey: EINSATZ_QUERY_KEYS.detailsCombined(einsatzId) }),
        queryClient.invalidateQueries({ queryKey: EINSATZ_QUERY_KEYS.lists() }),
        queryClient.invalidateQueries({ queryKey: EINSATZ_QUERY_KEYS.activeWithCounts() }),
      ]);
    },
    onError: (error) => {
      console.error('Fehler beim automatischen Starten des Einsatzes:', error);
      // Silent fail - don't block user from viewing the einsatz
    },
  });

  // Automatisch Einsatz starten wenn Status ANGELEGT ist
  // biome-ignore lint/correctness/useExhaustiveDependencies: startEinsatzMutation intentionally excluded to prevent re-trigger on mutation state changes
  useEffect(() => {
    // Erst nach geladener Teilnahme entscheiden.
    if (isTeilnahmeLoading) return;

    // Ohne aktive Teilnahme kann der User den Einsatz nicht starten.
    if (!currentEinsatzPersonId) return;

    if (einsatz && einsatz.status === EinsatzDtoStatusEnum.Angelegt && !hasStartedRef.current && !startEinsatzMutation.isPending) {
      hasStartedRef.current = true;
      startEinsatzMutation.mutate();
    }
  }, [einsatz, isTeilnahmeLoading, currentEinsatzPersonId]);

  // Modul-Konfiguration aus Hook
  const baseModules = useWorkspaceModules();

  // Badge-Counter fuer unquittierte Befehle (WP4.3)
  const unquittiertCount = useUnquittierteBefehleCount(einsatzId);

  // Module mit dynamischem Badge fuer Befehle-Tab
  const modules = useMemo(
    () =>
      baseModules.map((module) => ({
        ...module,
        badgeHint: module.badgeHint
          ? {
              ...module.badgeHint,
              value: module.badgeHint.kind === 'status' && unquittiertCount > 0 ? unquittiertCount : module.badgeHint.value,
            }
          : module.badgeHint,
        subPages: module.subPages.map((page) => {
          if (page.href.includes('/führung/befehle') && unquittiertCount > 0) {
            return { ...page, badge: unquittiertCount };
          }
          return page;
        }),
      })),
    [baseModules, unquittiertCount],
  );

  useEffect(() => {
    if (!workspaceIsBlocked) {
      return;
    }

    function handleBlockedWorkspaceHotkey(event: KeyboardEvent) {
      if (event.defaultPrevented || !shouldBlockWorkspaceHotkey(event, modules)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    window.addEventListener('keydown', handleBlockedWorkspaceHotkey, true);

    return () => {
      window.removeEventListener('keydown', handleBlockedWorkspaceHotkey, true);
    };
  }, [modules, workspaceIsBlocked]);

  const visibleModules = useMemo(() => modules.filter((module) => !isHiddenVisibility(module.visibility)), [modules]);
  const matchesCurrentPath = (href: string) => !!matchRoute({ to: href, fuzzy: true });

  // Finde das aktuelle Modul basierend auf der URL
  const currentModule =
    [...visibleModules]
      .map((module) => ({
        module,
        matchedPage: [...module.subPages].filter((page) => matchesCurrentPath(page.href)).sort((left, right) => right.href.length - left.href.length)[0],
      }))
      .filter((entry) => entry.matchedPage)
      .sort((left, right) => (right.matchedPage?.href.length ?? 0) - (left.matchedPage?.href.length ?? 0))[0]?.module ??
    visibleModules[0] ??
    null;

  // Mutation für Einsatz beenden
  const endEinsatzMutation = useMutation({
    mutationFn: async () => {
      const response = await api.einsatz().einsatzControllerCompleteVAlpha({
        id: einsatzId,
      });
      return response.data;
    },
    onSuccess: async () => {
      // Invalidate all relevant queries to refresh UI
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: EINSATZ_QUERY_KEYS.detail(einsatzId) }),
        queryClient.invalidateQueries({ queryKey: EINSATZ_QUERY_KEYS.detailsCombined(einsatzId) }),
        queryClient.invalidateQueries({ queryKey: EINSATZ_QUERY_KEYS.lists() }),
        queryClient.invalidateQueries({ queryKey: EINSATZ_QUERY_KEYS.activeWithCounts() }),
      ]);
      // Navigate back to overview
      await router.navigate({ to: '/app/einsaetze' });
    },
    onError: (error) => {
      console.error('Fehler beim Beenden des Einsatzes:', error);
      // Here you could add toast notification for error feedback
    },
  });

  const handleEndEinsatz = () => {
    endEinsatzMutation.mutate();
    setShowEndConfirmation(false);
  };

  // Calculate duration if einsatz is loaded
  const startTime = useMemo(() => (einsatz?.alarmierungszeit ? new Date(einsatz.alarmierungszeit) : einsatz?.createdAt ? new Date(einsatz.createdAt) : null), [einsatz]);

  const duration = startTime ? formatDistanceToNow(startTime, { locale: de, addSuffix: false }) : null;

  const activePageHref = currentModule ? [...currentModule.subPages].filter((page) => matchesCurrentPath(page.href)).sort((left, right) => right.href.length - left.href.length)[0]?.href : undefined;

  const { statusItems } = useEinsatzWorkspaceShell({
    isLoading: isTeilnahmeLoading || isUserLoading || isEinsatzLoading,
    requiresAssignment,
    isRemindersDegraded: Boolean(erinnerungenError),
  });

  const moduleOverviewModules = useMemo(
    () =>
      modules.map((module) => ({
        id: module.id,
        name: module.label,
        icon: module.icon,
        description: module.description,
        color: module.color,
        visibility: module.visibility,
        routeTarget: module.routeTarget,
        shortcut: module.shortcut,
        badgeHint: module.badgeHint,
        subPages: module.subPages.map((page) => ({
          name: page.label,
          href: page.href,
          icon: page.icon,
        })),
      })),
    [modules],
  );

  const commandPaletteModules = useMemo(
    () =>
      modules
        .filter((module) => !isHiddenVisibility(module.visibility))
        .map((module) => ({
          id: module.id,
          name: module.label,
          color: module.color,
          icon: module.icon,
          subPages: module.subPages
            .filter((page) => !isHiddenVisibility(page.visibility))
            .map((page) => ({
              id: page.id,
              name: page.label,
              href: page.href,
              icon: page.icon,
              description: page.description,
              badge: page.badge?.toString(),
              disabled: isDisabledVisibility(module.visibility) || isDisabledVisibility(page.visibility),
              disabledReason: page.visibility.reason ?? module.visibility.reason,
            })),
        }))
        .filter((module) => module.subPages.length > 0),
    [modules],
  );

  /**
   * Handler für Fullscreen-Toggle
   * Navigiert zur aktuellen Route mit mode=fullscreen
   */
  const handleFullscreenToggle = () => {
    navigate({
      search: (prev) => ({
        ...prev,
        mode: 'fullscreen',
      }),
    });
  };

  const handleReturnToEinsatzliste = async () => {
    clearActiveEinsatz();
    await navigate({ to: '/app/einsaetze' });
  };

  // Wenn Fullscreen-Modus aktiv ist, nur Content ohne Layout rendern
  if (isFullscreenMode) {
    return (
      <div className={cn('min-h-screen bg-surface-canvas text-text-primary', className)}>
        <Outlet />
      </div>
    );
  }

  return (
    <>
      <WorkspaceShell
        className={className}
        contextBar={{
          icon: einsatz ? PiSiren : undefined,
          title: einsatz ? (
            <span className="truncate">
              <span className="font-mono text-body-sm text-text-secondary">{einsatz.nummer}</span>
              <span className="mx-1.5 text-border-strong">|</span>
              {einsatz.name}
            </span>
          ) : (
            'Einsatz'
          ),
          subtitle: einsatz?.alarmstichwort ? (
            <>
              {einsatz.alarmstichwort}
              {einsatz.einsatzort && ` • ${einsatz.einsatzort}`}
            </>
          ) : undefined,
          backAction: {
            href: '/app/einsaetze',
            label: 'Übersicht',
          },
          endSlot: einsatz ? (
            <>
              {supportsFullscreen && (
                <Button appearance="ghost" size="sm" onClick={handleFullscreenToggle} className="gap-2" title="Vollbildmodus aktivieren">
                  <PiArrowsOut className="h-4 w-4" />
                  <span className="hidden lg:inline">Vollbild</span>
                </Button>
              )}
              {duration && (
                <div className="flex items-center gap-2 text-body-sm">
                  <PiClock className="h-4 w-4 text-text-muted" />
                  <span className="text-text-secondary">{duration}</span>
                </div>
              )}
              <EinsatzStatusBadge status={einsatz.status} size="sm" />
            </>
          ) : null,
        }}
        modules={modules}
        activeModuleId={currentModule?.id ?? ''}
        activePageHref={activePageHref}
        routeParams={{ einsatzId }}
        statusItems={statusItems}
        blockingOverlay={{ isBlocking: workspaceIsBlocked }}
        commandTriggerLabel="Befehle und Navigation"
        moduleOverviewLabel="Modulübersicht öffnen"
        onCommandTriggerClick={() => setCommandPaletteOpen(true)}
        onOpenModuleOverview={() => setShowModuleOverview(true)}
        sidebarHeader={<EinsatzSwitcher />}
        quickActionsSlot={
          <div className="border-border-subtle border-t pt-4">
            <Button appearance="ghost" size="sm" className="mb-2 w-full justify-start" onClick={() => setShowBeitrittDialog(true)}>
              <PiRadio className="mr-2 h-4 w-4" />
              {currentEinsatzPersonId ? (
                <span className="truncate">{teilnahmeData?.data?.personFunkrufname || `${teilnahmeData?.data?.personVorname} ${teilnahmeData?.data?.personNachname}`}</span>
              ) : (
                <span className="text-action-primary">Person wählen</span>
              )}
            </Button>
            <Button appearance="ghost" size="sm" className="mb-2 w-full justify-start" onClick={() => setShowAudioDialog(true)} aria-haspopup="dialog">
              <PiSpeakerHigh className="mr-2 h-4 w-4" />
              Audio-Einstellungen
            </Button>
            <Button
              intent="danger"
              size="sm"
              className="w-full"
              onClick={() => setShowEndConfirmation(true)}
              disabled={einsatz?.status === EinsatzDtoStatusEnum.Abgeschlossen || einsatz?.status === EinsatzDtoStatusEnum.Archiviert}
            >
              Einsatz beenden
            </Button>
          </div>
        }
        sidebarFooter={null}
        overlaySlot={
          <ModuleOverviewCard modules={moduleOverviewModules} currentModuleId={currentModule?.id} einsatzId={einsatzId} open={showModuleOverview} onClose={() => setShowModuleOverview(false)} />
        }
      >
        {isTeilnahmeLoading ? (
          <div className="rounded-panel border border-border-subtle bg-surface-panel p-6 shadow-panel">
            <output aria-live="polite" className="block">
              <span className="block font-semibold text-text-primary text-title-sm">Arbeitsraum wird vorbereitet</span>
              <span className="mt-2 block text-body-sm text-text-secondary">Teilnahme und Einsatzkontext werden geprüft. Der Arbeitsraum bleibt bis zur Entscheidung blockiert.</span>
            </output>
          </div>
        ) : requiresAssignment ? (
          <div className="rounded-panel border border-amber-300 bg-amber-50 p-6 shadow-panel dark:border-amber-900/40 dark:bg-amber-950/40" role="alert">
            <p className="font-semibold text-amber-900 text-title-sm dark:text-amber-100">Zuordnung erforderlich</p>
            <p className="mt-2 text-amber-900/90 text-body-sm dark:text-amber-200">
              Der Einsatz bleibt gesperrt, bis Sie sich eindeutig zuordnen. Nutzen Sie den geöffneten AssignmentGate, um eine vorhandene Person auszuwählen oder direkt neu anzulegen.
            </p>
            <Button appearance="ghost" size="sm" className="mt-4" onClick={() => void handleReturnToEinsatzliste()}>
              Zur Einsatzliste
            </Button>
          </div>
        ) : (
          <Outlet />
        )}
      </WorkspaceShell>

      {/* Command Palette Modal */}
      <CommandPaletteErrorBoundary>
        <CommandPalette modules={commandPaletteModules} open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      </CommandPaletteErrorBoundary>

      {/* Einsatz beenden Confirmation Dialog */}
      <Dialog isOpen={showEndConfirmation} onClose={() => !endEinsatzMutation.isPending && setShowEndConfirmation(false)} className="max-w-md">
        <Dialog.CloseButton onClose={() => !endEinsatzMutation.isPending && setShowEndConfirmation(false)} />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-danger-surface">
              <PiWarning className="h-6 w-6 text-status-danger-text" />
            </div>
          </div>

          <div className="flex-1">
            <Dialog.Title className="font-semibold text-text-primary text-title-sm">Einsatz beenden?</Dialog.Title>

            <Dialog.Body className="mt-2">
              <p className="text-body-sm text-text-secondary">
                Möchten Sie den Einsatz <span className="font-semibold">"{einsatz?.name}"</span> wirklich beenden?
              </p>
              <p className="mt-2 text-body-sm text-text-secondary">Der Status wird auf "Abgeschlossen" gesetzt. Diese Aktion kann nicht direkt rückgängig gemacht werden.</p>
            </Dialog.Body>
          </div>
        </div>

        <Dialog.Footer>
          <Button appearance="ghost" size="sm" onClick={() => setShowEndConfirmation(false)} disabled={endEinsatzMutation.isPending}>
            Abbrechen
          </Button>
          <Button intent="danger" size="sm" onClick={handleEndEinsatz} disabled={endEinsatzMutation.isPending}>
            {endEinsatzMutation.isPending ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Beende Einsatz...
              </>
            ) : (
              'Einsatz beenden'
            )}
          </Button>
        </Dialog.Footer>
      </Dialog>

      {/* Einsatz Beitritt / Funkrufname Dialog */}
      <EinsatzBeitrittDialog einsatzId={einsatzId} isOpen={beitrittDialogOpen} onClose={() => setShowBeitrittDialog(false)} onReturnToOverview={handleReturnToEinsatzliste} />

      {/* Quick-Create Erinnerung Dialog (Story 1.1 AC1, Story 5.4) */}
      <QuickCreateErinnerungDialog
        isOpen={isQuickCreateOpen}
        einsatzId={quickCreateEinsatzId ?? einsatzId}
        onClose={closeQuickCreateDialog}
        fromEtb={etbEintragId && etbEintragText ? { entryId: etbEintragId, text: etbEintragText } : undefined}
        fromTemplate={fromTemplate}
      />

      {/* Edit Erinnerung Dialog (Story 1.3 AC1) */}
      <ErinnerungEditDialog isOpen={isEditDialogOpen} erinnerung={erinnerungToEdit} einsatzId={editDialogEinsatzId ?? einsatzId} onClose={closeEditDialog} />

      {/* Delete Erinnerung Dialog (Story 1.4 AC2) */}
      <ErinnerungDeleteDialog isOpen={isDeleteDialogOpen} erinnerung={erinnerungToDelete} einsatzId={deleteDialogEinsatzId ?? einsatzId} onClose={closeDeleteDialog} />

      {/* MarkErledigt Erinnerung Dialog (Story 2.5) */}
      <ErinnerungMarkErledigtDialog isOpen={isMarkErledigtDialogOpen} erinnerung={erinnerungToMarkErledigt} einsatzId={markErledigtDialogEinsatzId ?? einsatzId} onClose={closeMarkErledigtDialog} />

      {/* StopRecurring Erinnerung Dialog (Story 6.5) */}
      <StopRecurringErinnerungDialog
        isOpen={isStopRecurringDialogOpen}
        erinnerung={erinnerungToStopRecurring}
        einsatzId={stopRecurringDialogEinsatzId ?? einsatzId}
        onClose={closeStopRecurringDialog}
      />

      {/* Quick-Create Notiz Dialog */}
      <CreateNotizDialog isOpen={isQuickCreateNotizOpen} einsatzId={quickCreateNotizEinsatzId ?? einsatzId} onClose={closeQuickCreateNotizDialog} />

      {/* Audio-Einstellungen Dialog (Story 2.7) */}
      <AudioSettingsDialog isOpen={showAudioDialog} onClose={() => setShowAudioDialog(false)} />
    </>
  );
}
