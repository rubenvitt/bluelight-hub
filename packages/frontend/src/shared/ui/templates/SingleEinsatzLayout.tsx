import { api } from '@/shared';
import { CommandTrigger } from '@/shared/ui/atoms/command-trigger.atom';
import { Container } from '@/shared/ui/atoms/container.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { EinsatzStatusBadge } from '@/features/einsatz/ui/molecules/einsatz-status-badge.molecule';
import { ModuleButton } from '@/features/einsatz/ui/molecules/ModuleButton';
import { ModuleOverviewCard } from '@/features/einsatz/ui/molecules/ModuleOverviewCard';
import { EinsatzBeitrittDialog } from '@/features/einsatz/ui/organisms';
import { QuickCreateErinnerungDialog, closeQuickCreateDialog, useQuickCreateDialogState, useQuickCreateErinnerungHotkeys } from '@/features/reminders';
import { CommandPalette } from '@/shared/ui/organisms/command-palette';
import { CommandPaletteErrorBoundary } from '@/shared/ui/organisms/command-palette/CommandPaletteErrorBoundary';
import { EINSATZ_QUERY_KEYS, useEinsatzDetails, useEinsatzModules, useMyEinsatzTeilnahme } from '@/features/einsatz';
import { useActiveServer } from '@/features/server/hooks';
import { ServerNameBadge } from '@/features/server/ui/atoms';
import { cn, getModuleActiveColor, getModuleColor } from '@/shared/ui';
import { Button } from '@/shared/ui/atoms/button.atom';
import { EinsatzDtoStatusEnum } from '@/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useMatchRoute, useNavigate, useParams, useRouter } from '@tanstack/react-router';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PiArrowLeft, PiArrowsOut, PiClock, PiGear, PiGridFour, PiQuestion, PiRadio, PiSiren, PiWarning } from 'react-icons/pi';

interface SingleEinsatzLayoutProps {
  className?: string;
}

export function SingleEinsatzLayout({ className }: SingleEinsatzLayoutProps) {
  const { einsatzId } = useParams({ from: '/app/einsatz/$einsatzId' });
  const matchRoute = useMatchRoute();
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [showBeitrittDialog, setShowBeitrittDialog] = useState(false);
  const activeServer = useActiveServer();

  // Quick-Create Erinnerung Dialog State und Hotkeys (Story 1.1 AC1)
  const [isQuickCreateOpen, quickCreateEinsatzId] = useQuickCreateDialogState();
  useQuickCreateErinnerungHotkeys({
    einsatzId,
    enabled: !commandPaletteOpen && !showEndConfirmation && !showBeitrittDialog && !isQuickCreateOpen,
  });

  // Prüfe ob User bereits dem Einsatz beigetreten ist (Funkrufname gesetzt)
  const { data: teilnahmeData, isLoading: isTeilnahmeLoading } = useMyEinsatzTeilnahme(einsatzId);
  const currentFunkrufname = teilnahmeData?.data?.funkrufname;

  // Auto-show dialog when user hasn't joined yet (only once per session using sessionStorage)
  useEffect(() => {
    // Skip if still loading
    if (isTeilnahmeLoading) return;

    // Check if we've already shown the dialog for this einsatz in this session
    const storageKey = `beitritt-dialog-shown-${einsatzId}`;
    const hasShownInSession = sessionStorage.getItem(storageKey) === 'true';

    // Only show if:
    // 1. Query has finished loading
    // 2. No funkrufname set (user hasn't joined)
    // 3. Haven't shown dialog yet in this browser session
    if (!currentFunkrufname && !hasShownInSession) {
      sessionStorage.setItem(storageKey, 'true');
      setShowBeitrittDialog(true);
    }
  }, [einsatzId, isTeilnahmeLoading, currentFunkrufname]);

  // Prüfe ob wir im Fullscreen/Presentation-Modus sind
  const currentSearch = router.state.location.search as { mode?: string };
  const isFullscreenMode = currentSearch?.mode === 'fullscreen' || currentSearch?.mode === 'presentation';

  // Prüfe ob die aktuelle Route Fullscreen unterstützt (/karte, /etb und /kräfte/dashboard Routes)
  const isOnKarteRoute = !!matchRoute({ to: '/app/einsatz/$einsatzId/übersicht/karte', fuzzy: false });
  const isOnEtbRoute = !!matchRoute({ to: '/app/einsatz/$einsatzId/führung/etb', fuzzy: false });
  const isOnKraefteDashboardRoute = !!matchRoute({ to: '/app/einsatz/$einsatzId/kräfte/dashboard', fuzzy: false });
  const supportsFullscreen = isOnKarteRoute || isOnEtbRoute || isOnKraefteDashboardRoute;

  // Lade kombinierte Einsatzdaten (Einsatz + ETB + Lagekarte)
  // ETB und Lagekarte werden im Cache vorgeladen, sodass Child-Routes diese nutzen können
  const { einsatz } = useEinsatzDetails(einsatzId);

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
    console.log('Auto-start check:', {
      status: einsatz?.status,
      expected: EinsatzDtoStatusEnum.Angelegt,
      hasStarted: hasStartedRef.current,
      isPending: startEinsatzMutation.isPending,
      matches: einsatz?.status === EinsatzDtoStatusEnum.Angelegt,
    });

    if (einsatz && einsatz.status === EinsatzDtoStatusEnum.Angelegt && !hasStartedRef.current && !startEinsatzMutation.isPending) {
      console.log('Starting einsatz automatically...');
      hasStartedRef.current = true;
      startEinsatzMutation.mutate();
    }
  }, [einsatz]);

  // Modul-Konfiguration aus Hook
  const modules = useEinsatzModules();

  // Finde das aktuelle Modul basierend auf der URL
  const currentModule = useMemo(
    () =>
      modules.find((module) =>
        module.subPages.some((page) => {
          // Nutze TanStack Router's matchRoute für sauberes Matching
          return matchRoute({ to: page.href, fuzzy: true });
        }),
      ) || modules[0],
    [modules, matchRoute],
  );

  const [showModuleOverview, setShowModuleOverview] = useState(false);

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
      router.navigate({ to: '/app/einsaetze' });
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

  // Wenn Fullscreen-Modus aktiv ist, nur Content ohne Layout rendern
  if (isFullscreenMode) {
    return (
      <div className={cn('min-h-screen bg-gray-50 dark:bg-gray-900', className)}>
        <Outlet />
      </div>
    );
  }

  return (
    <>
      {/* Module Overview Modal */}
      <ModuleOverviewCard modules={modules} currentModuleId={currentModule.id} einsatzId={einsatzId} open={showModuleOverview} onClose={() => setShowModuleOverview(false)} />

      <div className={cn('min-h-screen bg-gray-50 dark:bg-gray-900', className)}>
        {/* Fixed Header */}
        <header className="sticky top-0 z-30 border-gray-200 border-b bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <Container maxWidth="full">
            <div className="flex h-16 items-center justify-between px-4">
              {/* Left: Back and Title */}
              <div className="flex items-center gap-4">
                <Link to="/app/einsaetze">
                  <Button appearance="ghost" size="sm">
                    <PiArrowLeft className="mr-2 h-4 w-4" />
                    Übersicht
                  </Button>
                </Link>

                <div className="h-8 w-px bg-gray-300 dark:bg-gray-600" />

                {einsatz && (
                  <div className="flex items-center gap-3">
                    <PiSiren className="h-5 w-5 text-red-500" />
                    <div>
                      <h1 className="font-semibold text-gray-900 text-lg dark:text-gray-100">{einsatz.name}</h1>
                      {einsatz.alarmstichwort && (
                        <p className="text-gray-500 text-xs dark:text-gray-400">
                          {einsatz.alarmstichwort}
                          {einsatz.einsatzort && ` • ${einsatz.einsatzort}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Server Name, Fullscreen, Status and Timer */}
              {einsatz && (
                <div className="flex items-center gap-4">
                  {/* Server Name Badge */}
                  {activeServer && <ServerNameBadge name={activeServer.name} className="hidden md:flex" />}

                  {/* Fullscreen-Button (für /karte und /etb Routes) */}
                  {supportsFullscreen && (
                    <Button appearance="ghost" size="sm" onClick={handleFullscreenToggle} className="gap-2" title="Vollbildmodus aktivieren">
                      <PiArrowsOut className="h-4 w-4" />
                      <span className="hidden lg:inline">Vollbild</span>
                    </Button>
                  )}

                  {duration && (
                    <div className="flex items-center gap-2 text-sm">
                      <PiClock className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-400">{duration}</span>
                    </div>
                  )}
                  <EinsatzStatusBadge status={einsatz.status} size="sm" />
                </div>
              )}
            </div>
          </Container>
        </header>

        {/* Module Navigation (Horizontal) */}
        <nav className="sticky top-16 z-20 border-gray-200 border-b bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <Container maxWidth="full">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                {/* Desktop: Alle Module mit Text */}
                <div className="hidden gap-3 overflow-x-auto 2xl:flex">
                  {modules.map((module, index) => {
                    const isActive = module.id === currentModule.id;
                    const hotkey = index < 9 ? `alt+${index + 1}` : undefined;
                    return (
                      <ModuleButton
                        key={module.id}
                        to={module.subPages[0].href}
                        params={{ einsatzId }}
                        hotkey={hotkey}
                        isActive={isActive}
                        colorClasses={isActive ? getModuleActiveColor(module.color) : getModuleColor(module.color)}
                      >
                        <module.icon className="h-4 w-4" />
                        {module.name}
                      </ModuleButton>
                    );
                  })}
                </div>

                {/* Smaller Desktop: Icons + erste 6 wichtigsten, Rest in Dropdown */}
                <div className="hidden items-center gap-2 lg:flex 2xl:hidden">
                  {modules.slice(0, 5).map((module, index) => {
                    const isActive = module.id === currentModule.id;
                    const hotkey = index < 5 ? `alt+${index + 1}` : undefined;
                    return (
                      <ModuleButton
                        key={module.id}
                        to={module.subPages[0].href}
                        params={{ einsatzId }}
                        hotkey={hotkey}
                        isActive={isActive}
                        colorClasses={isActive ? getModuleActiveColor(module.color) : getModuleColor(module.color)}
                        className="px-3"
                      >
                        <module.icon className="h-4 w-4" />
                        <span className="hidden md:inline">{module.name}</span>
                      </ModuleButton>
                    );
                  })}
                  {modules.length > 5 && (
                    <div className="relative">
                      <Button
                        appearance="ghost"
                        size="sm"
                        onClick={() => setShowModuleOverview(true)}
                        className={cn('px-3', modules.slice(3).some((m) => m.id === currentModule.id) && 'ring-2 ring-blue-500')}
                      >
                        <PiGridFour className="h-4 w-4" />
                        <span className="ml-2 hidden md:inline">Mehr</span>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Tablet: Icons + erste 3-4 wichtigsten, Rest in Dropdown */}
                <div className="hidden items-center gap-2 sm:flex lg:hidden">
                  {modules.slice(0, 3).map((module, index) => {
                    const isActive = module.id === currentModule.id;
                    const hotkey = index < 3 ? `alt+${index + 1}` : undefined;
                    return (
                      <ModuleButton
                        key={module.id}
                        to={module.subPages[0].href}
                        params={{ einsatzId }}
                        hotkey={hotkey}
                        isActive={isActive}
                        colorClasses={isActive ? getModuleActiveColor(module.color) : getModuleColor(module.color)}
                        className="px-3"
                      >
                        <module.icon className="h-4 w-4" />
                        <span className="hidden md:inline">{module.name}</span>
                      </ModuleButton>
                    );
                  })}
                  {modules.length > 3 && (
                    <div className="relative">
                      <Button
                        appearance="ghost"
                        size="sm"
                        onClick={() => setShowModuleOverview(true)}
                        className={cn('px-3', modules.slice(3).some((m) => m.id === currentModule.id) && 'ring-2 ring-blue-500')}
                      >
                        <PiGridFour className="h-4 w-4" />
                        <span className="ml-2 hidden md:inline">Mehr</span>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Mobile: Nur Icons oder kompakter Dropdown */}
                <div className="flex flex-1 items-center gap-2 sm:hidden">
                  {/* Aktives Modul prominent */}
                  <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-sm', getModuleActiveColor(currentModule.color))}>
                    <currentModule.icon className="h-4 w-4" />
                    <span>{currentModule.name}</span>
                  </div>

                  {/* Module-Wechsler als Dropdown */}
                  <Button appearance="ghost" size="sm" onClick={() => setShowModuleOverview(true)} className="ml-auto">
                    <PiGridFour className="h-5 w-5" />
                  </Button>
                </div>

                {/* Command Palette Trigger */}
                <div className="ml-4">
                  <CommandTrigger onClick={() => setCommandPaletteOpen(true)} />
                </div>
              </div>
              {/* Module Description with Help - nur auf Desktop */}
              <div className="mt-2 hidden items-center justify-between lg:flex">
                <p className="text-gray-500 text-xs dark:text-gray-400">{currentModule.description}</p>
                <Button appearance="ghost" size="sm" className="h-6 w-6 p-0" title="Modulübersicht anzeigen" onClick={() => setShowModuleOverview(true)}>
                  <PiQuestion className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Container>
        </nav>

        {/* Main Content */}
        <main className="flex-1">
          <Container maxWidth="full">
            <div className="flex gap-6">
              {/* Sidebar with Sub-Pages */}
              <aside className="hidden w-64 flex-shrink-0 pt-6 lg:block">
                <div className="sticky top-36 space-y-1">
                  <h3 className="mb-2 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">{currentModule.name} Navigation</h3>
                  {currentModule.subPages.map((page) => {
                    const isActive = !!matchRoute({ to: page.href });
                    return (
                      <Link
                        key={page.href}
                        to={page.href}
                        params={{ einsatzId }}
                        className={cn(
                          'group flex items-start gap-3 rounded-lg px-3 py-2 transition-colors',
                          isActive ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800',
                        )}
                      >
                        <page.icon
                          className={cn(
                            'mt-0.5 h-5 w-5 flex-shrink-0 transition-colors',
                            isActive ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{page.name}</span>
                            {page.badge && <span className="rounded bg-blue-500 px-1.5 py-0.5 font-semibold text-white text-xs">{page.badge}</span>}
                          </div>
                          {page.description && <p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">{page.description}</p>}
                        </div>
                      </Link>
                    );
                  })}

                  {/* Quick Actions */}
                  <div className="mt-6 border-gray-200 border-t pt-6 dark:border-gray-700">
                    {/* Funkrufname / Einsatz-Beitritt */}
                    <Button appearance="ghost" size="sm" className="mb-2 w-full justify-start" onClick={() => setShowBeitrittDialog(true)}>
                      <PiRadio className="mr-2 h-4 w-4" />
                      {currentFunkrufname ? <span className="truncate">{currentFunkrufname}</span> : <span className="text-blue-600 dark:text-blue-400">Funkrufname setzen</span>}
                    </Button>
                    <Button appearance="ghost" size="sm" className="mb-2 w-full">
                      <PiGear className="mr-2 h-4 w-4" />
                      Modul-Einstellungen
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
                </div>
              </aside>

              {/* Mobile Sub-Navigation */}
              <div className="fixed right-0 bottom-0 left-0 z-20 border-gray-200 border-t bg-white p-4 lg:hidden dark:border-gray-700 dark:bg-gray-800">
                <div className="flex gap-2 overflow-x-auto">
                  {currentModule.subPages.map((page) => {
                    const isActive = !!matchRoute({ to: page.href });
                    return (
                      <Link
                        key={page.href}
                        to={page.href}
                        params={{ einsatzId }}
                        className={cn(
                          'flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm',
                          isActive ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400',
                        )}
                      >
                        <page.icon className="h-4 w-4" />
                        {page.name}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Content Area */}
              <div className="min-w-0 flex-1 py-6 pb-24 lg:pb-6">
                <Outlet />
              </div>
            </div>
          </Container>
        </main>
      </div>

      {/* Command Palette Modal */}
      <CommandPaletteErrorBoundary>
        <CommandPalette
          modules={modules.map((module) => ({
            ...module,
            subPages: module.subPages.map((page) => ({
              ...page,
              badge: page.badge?.toString(), // Convert number to string if needed
            })),
          }))}
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
        />
      </CommandPaletteErrorBoundary>

      {/* Einsatz beenden Confirmation Dialog */}
      <Dialog isOpen={showEndConfirmation} onClose={() => !endEinsatzMutation.isPending && setShowEndConfirmation(false)} className="max-w-md">
        <Dialog.CloseButton onClose={() => !endEinsatzMutation.isPending && setShowEndConfirmation(false)} />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <PiWarning className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>

          <div className="flex-1">
            <Dialog.Title className="font-semibold text-gray-900 text-lg dark:text-white">Einsatz beenden?</Dialog.Title>

            <Dialog.Body className="mt-2">
              <p className="text-gray-600 text-sm dark:text-gray-400">
                Möchten Sie den Einsatz <span className="font-semibold">"{einsatz?.name}"</span> wirklich beenden?
              </p>
              <p className="mt-2 text-gray-600 text-sm dark:text-gray-400">Der Status wird auf "Abgeschlossen" gesetzt. Diese Aktion kann nicht direkt rückgängig gemacht werden.</p>
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
      <EinsatzBeitrittDialog einsatzId={einsatzId} isOpen={showBeitrittDialog} onClose={() => setShowBeitrittDialog(false)} />

      {/* Quick-Create Erinnerung Dialog (Story 1.1 AC1) */}
      <QuickCreateErinnerungDialog isOpen={isQuickCreateOpen} einsatzId={quickCreateEinsatzId ?? einsatzId} onClose={closeQuickCreateDialog} />
    </>
  );
}
