import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PiClipboard, PiHouse, PiShieldWarning } from 'react-icons/pi';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SingleEinsatzLayout } from '../SingleEinsatzLayout';

/** Minimaler Ersatz fuer EinsatzRolleProvider im Test (vi.hoisted damit vi.mock darauf zugreifen kann) */
const { StubEinsatzRolleProvider } = vi.hoisted(() => {
  const { createContext } = require('react');
  const ctx = createContext(null);
  return { StubEinsatzRolleProvider: ctx.Provider };
});

const navigateSpy = vi.fn();
const routerNavigateSpy = vi.fn();
const clearActiveEinsatzSpy = vi.fn();
const myTeilnahmeState = {
  data: {
    data: {
      einsatzPersonId: 'teilnahme-1',
      personFunkrufname: 'FL Florian 1',
    },
  },
  isLoading: false,
};
const currentUserState = {
  user: { id: 'user-1', username: 'einsatz-user' },
  isLoading: false,
};
const myRolleState = {
  data: { rolle: 'BEFEHLSGEBER', permissions: {} },
  isLoading: false,
};

const workspaceModules = [
  {
    id: 'übersicht',
    label: 'Übersicht',
    description: 'Einsatzübersicht',
    routeTarget: '/app/einsatz/$einsatzId/übersicht',
    icon: PiHouse,
    color: 'blue' as const,
    priority: 10,
    visibility: { default: 'visible' as const },
    shortcut: { modifiers: ['alt'], key: '1' },
    subPages: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/app/einsatz/$einsatzId/übersicht',
        icon: PiHouse,
        visibility: { default: 'visible' as const },
      },
    ],
  },
  {
    id: 'führung',
    label: 'Führung',
    description: 'Einsatzleitung',
    routeTarget: '/app/einsatz/$einsatzId/führung/etb',
    icon: PiClipboard,
    color: 'purple' as const,
    priority: 20,
    visibility: { default: 'visible' as const },
    shortcut: { modifiers: ['alt'], key: '2' },
    subPages: [
      {
        id: 'etb',
        label: 'ETB',
        href: '/app/einsatz/$einsatzId/führung/etb',
        icon: PiClipboard,
        visibility: { default: 'visible' as const },
      },
      {
        id: 'protokoll',
        label: 'Protokoll',
        href: '/app/einsatz/$einsatzId/führung/protokoll',
        icon: PiClipboard,
        visibility: {
          default: 'disabled' as const,
          reason: 'Später',
        },
      },
    ],
  },
  {
    id: 'kommunikation',
    label: 'Kommunikation',
    description: 'Funk und Alarmierung',
    routeTarget: '/app/einsatz/$einsatzId/kommunikation/funk',
    icon: PiClipboard,
    color: 'green' as const,
    priority: 30,
    visibility: {
      default: 'disabled' as const,
      reason: 'Später',
    },
    shortcut: { modifiers: ['alt'], key: '3' },
    subPages: [
      {
        id: 'funk',
        label: 'Funk',
        href: '/app/einsatz/$einsatzId/kommunikation/funk',
        icon: PiClipboard,
        visibility: { default: 'visible' as const },
      },
    ],
  },
  {
    id: 'sicherheit',
    label: 'Sicherheit',
    description: 'Gefahren und Eigenschutz',
    routeTarget: '/app/einsatz/$einsatzId/sicherheit/gefahren',
    icon: PiShieldWarning,
    color: 'red' as const,
    priority: 40,
    visibility: { default: 'visible' as const },
    shortcut: { modifiers: ['alt'], key: '4' },
    subPages: [
      {
        id: 'eigenschutz',
        label: 'Eigenschutz',
        href: '/app/einsatz/$einsatzId/sicherheit/eigenschutz',
        icon: PiShieldWarning,
        visibility: { default: 'visible' as const },
      },
    ],
  },
];

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params: _params, search: _search, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; params?: unknown; search?: unknown }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet">Outlet</div>,
  useMatchRoute:
    () =>
    ({ to }: { to: string }) =>
      to === '/app/einsatz/$einsatzId/führung/etb',
  useNavigate: () => navigateSpy,
  useParams: () => ({ einsatzId: 'einsatz-42' }),
  useRouter: () => ({
    state: {
      location: {
        search: {},
      },
    },
    navigate: routerNavigateSpy,
  }),
}));

vi.mock('@/features/auth', () => ({
  useCurrentUser: () => currentUserState,
}));

vi.mock('@/features/befehl', () => ({
  useBefehlNotifications: () => ({
    onBefehlErstellt: vi.fn(),
    onBefehlQuittiert: vi.fn(),
  }),
  useBefehlWebSocket: vi.fn(),
  useMissedBefehlAlerts: vi.fn(),
  useUnquittierteBefehleCount: () => 0,
}));

vi.mock('@/features/befehl/api/use-my-einsatz-rolle', () => ({
  useMyEinsatzRolle: () => myRolleState,
}));

vi.mock('@/features/einsatz', () => ({
  EINSATZ_QUERY_KEYS: {
    detail: () => ['einsatz', 'detail'],
    detailsCombined: () => ['einsatz', 'detailsCombined'],
    lists: () => ['einsatz', 'lists'],
    activeWithCounts: () => ['einsatz', 'activeWithCounts'],
  },
  EinsatzRolleProvider: StubEinsatzRolleProvider,
  useEinsatzDetails: () => ({
    einsatz: {
      id: 'einsatz-42',
      nummer: '12-34',
      name: 'Wohnhausbrand',
      alarmstichwort: 'B 4',
      einsatzort: 'Musterstraße 7',
      status: 'Laufend',
      createdAt: '2026-03-16T10:00:00.000Z',
    },
    isLoading: false,
  }),
  useMyEinsatzTeilnahme: () => ({
    data: myTeilnahmeState.data,
    isLoading: myTeilnahmeState.isLoading,
  }),
  useActiveEinsatz: () => ({
    clearActiveEinsatz: clearActiveEinsatzSpy,
  }),
}));

vi.mock('@/features/einsatz/ui/molecules/einsatz-status-badge.molecule', () => ({
  EinsatzStatusBadge: ({ status }: { status: string }) => <div data-testid="einsatz-status-badge">{status}</div>,
}));

vi.mock('@/features/einsatz/ui/molecules/EinsatzSwitcher.molecule', () => ({
  EinsatzSwitcher: () => <div data-testid="einsatz-switcher">EinsatzSwitcher</div>,
}));

vi.mock('@/features/einsatz/ui/molecules/ModuleOverviewCard', () => ({
  ModuleOverviewCard: ({ open }: { open: boolean }) => (open ? <div data-testid="module-overview-overlay">Module Overview</div> : null),
}));

vi.mock('@/features/einsatz/ui/organisms', () => ({
  EinsatzBeitrittDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="einsatz-beitritt-dialog">Beitritt</div> : null),
}));

vi.mock('@/features/notizen', () => ({
  closeQuickCreateNotizDialog: vi.fn(),
  CreateNotizDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="create-notiz-dialog">Notiz</div> : null),
  useQuickCreateNotizDialogState: () => [false, null],
  useQuickCreateNotizHotkeys: vi.fn(),
}));

vi.mock('@/features/reminders', () => ({
  closeDeleteDialog: vi.fn(),
  closeEditDialog: vi.fn(),
  closeMarkErledigtDialog: vi.fn(),
  closeQuickCreateDialog: vi.fn(),
  closeStopRecurringDialog: vi.fn(),
  ErinnerungDeleteDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="erinnerung-delete-dialog">Delete</div> : null),
  ErinnerungEditDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="erinnerung-edit-dialog">Edit</div> : null),
  ErinnerungMarkErledigtDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="erinnerung-erledigt-dialog">Erledigt</div> : null),
  QuickCreateErinnerungDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="quick-create-erinnerung-dialog">Quick Create</div> : null),
  StopRecurringErinnerungDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="stop-recurring-erinnerung-dialog">Stop Recurring</div> : null),
  useAlarmTrigger: vi.fn(),
  useDeleteDialogState: () => [false, null, null],
  useEditDialogState: () => [false, null, null],
  useErinnerungenByEinsatz: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useMarkErledigtDialogState: () => [false, null, null],
  useQuickCreateDialogStateWithEtb: () => ({
    isOpen: false,
    einsatzId: null,
    etbEintragId: null,
    etbEintragText: null,
    fromTemplate: undefined,
  }),
  useQuickCreateErinnerungHotkeys: vi.fn(),
  useStopRecurringDialogState: () => [false, null, null],
}));

vi.mock('@/features/reminders/utils/erinnerung-ownership', () => ({
  filterMyErinnerungen: () => [],
}));

vi.mock('@/features/settings', () => ({
  AudioSettingsDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="audio-settings-dialog">Audio</div> : null),
}));

vi.mock('@/features/workspace', async () => {
  const actual = await vi.importActual<typeof import('@/features/workspace')>('@/features/workspace');

  return {
    ...actual,
    useWorkspaceModules: () => workspaceModules,
    useWorkspaceResume: () => undefined,
  };
});

vi.mock('@/features/eigenschutz/hooks/use-aktive-einsatz-einheit', () => ({
  useAktiveEinsatzEinheit: () => ({
    einheitId: 'einheit-1',
    einheitName: 'RTW 1',
    einheiten: [],
    setAktiveEinheit: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('@/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared')>();
  return {
    ...actual,
    api: {
      einsatz: () => ({
        einsatzControllerStartVAlpha: vi.fn(),
        einsatzControllerCompleteVAlpha: vi.fn(),
      }),
    },
  };
});

vi.mock('@/shared/ui/organisms/command-palette', () => ({
  CommandPalette: ({ modules, open }: { modules: Array<{ name: string; subPages: Array<{ name: string; disabled?: boolean; disabledReason?: string }> }>; open: boolean }) =>
    open ? (
      <div data-testid="command-palette">
        {modules.map((module) => (
          <div key={module.name}>
            <span>{module.name}</span>
            {module.subPages.map((page) => (
              <span key={`${module.name}-${page.name}`}>
                {page.name}
                {page.disabled ? ` (${page.disabledReason})` : ''}
              </span>
            ))}
          </div>
        ))}
      </div>
    ) : null,
}));

vi.mock('@/shared/ui/organisms/command-palette/CommandPaletteErrorBoundary', () => ({
  CommandPaletteErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SingleEinsatzLayout workspace hotkeys', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    routerNavigateSpy.mockReset();
    clearActiveEinsatzSpy.mockReset();
    currentUserState.user = { id: 'user-1', username: 'einsatz-user' };
    currentUserState.isLoading = false;
    myRolleState.data = { rolle: 'BEFEHLSGEBER', permissions: {} };
    myRolleState.isLoading = false;
    myTeilnahmeState.data = {
      data: {
        einsatzPersonId: 'teilnahme-1',
        personFunkrufname: 'FL Florian 1',
      },
    };
    myTeilnahmeState.isLoading = false;
  });

  function renderLayout() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <SingleEinsatzLayout />
      </QueryClientProvider>,
    );
  }

  it('lässt Workspace-Modul-Hotkeys ohne blockierendes Overlay durch', () => {
    renderLayout();

    const event = createEvent.keyDown(window, { key: '1', altKey: true });
    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith({
      to: '/app/einsatz/$einsatzId/übersicht',
      params: { einsatzId: 'einsatz-42' },
      search: expect.any(Function),
    });
  });

  it('zeigt deaktivierte Module und Unterseiten in der Command Palette nur mit verständlicher Sperrbegründung', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getAllByRole('button', { name: /befehle und navigation/i })[0]);

    const palette = screen.getByTestId('command-palette');

    expect(palette).toHaveTextContent('Übersicht');
    expect(palette).toHaveTextContent('Führung');
    expect(palette).toHaveTextContent('ETB');
    expect(palette).toHaveTextContent('Kommunikation');
    expect(palette).toHaveTextContent('Protokoll (Später)');
  });

  it('speist Eigenschutz-Aktionen als eigene Command-Palette-Gruppe ein', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getAllByRole('button', { name: /befehle und navigation/i })[0]);

    const palette = screen.getByTestId('command-palette');
    expect(palette).toHaveTextContent('Eigenschutz');
    expect(palette).toHaveTextContent('Eigenschutz: Neue Gefährdungsbeurteilung');
    expect(palette).toHaveTextContent('Eigenschutz: Neuer Vorfall');
    expect(palette).toHaveTextContent('Eigenschutz: PSA-Profil ändern');
    expect(palette).toHaveTextContent('Eigenschutz: Vorfall-Archiv öffnen');
  });

  it('zeigt Konfliktauflösung für Nicht-Befehlsgeber als gesperrten Befehl', async () => {
    const user = userEvent.setup();
    myRolleState.data = { rolle: 'EMPFAENGER', permissions: {} };
    renderLayout();

    await user.click(screen.getAllByRole('button', { name: /befehle und navigation/i })[0]);

    const palette = screen.getByTestId('command-palette');
    expect(palette).toHaveTextContent('Eigenschutz: Konflikte auflösen (Nur Befehlsgeber dürfen Konflikte auflösen.)');
  });

  it('blockiert Workspace-Modul-Hotkeys, sobald ein Overlay aktiv ist', () => {
    renderLayout();

    fireEvent.click(screen.getAllByRole('button', { name: 'Modulübersicht öffnen' })[0]);

    expect(screen.getByTestId('module-overview-overlay')).toBeInTheDocument();

    const event = createEvent.keyDown(window, { key: '1', altKey: true });
    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('blockiert Workspace-Modul-Hotkeys, solange die Teilnahme noch unklar ist', () => {
    myTeilnahmeState.isLoading = true;
    myTeilnahmeState.data = null;

    renderLayout();

    const event = createEvent.keyDown(window, { key: '1', altKey: true });
    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('lässt aus dem blockierten Zuordnungszustand zurück in die Einsatzliste navigieren', async () => {
    const user = userEvent.setup();
    myTeilnahmeState.data = null;

    renderLayout();

    await user.click(screen.getByRole('button', { name: /zur einsatzliste/i }));

    expect(clearActiveEinsatzSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/app/einsaetze' });
  });

  it('öffnet den ETB-Composer per Quick-Action-Button', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getAllByRole('button', { name: /etb-eintrag/i })[0]);

    expect(navigateSpy).toHaveBeenCalledWith({
      to: '/app/einsatz/$einsatzId/führung/etb',
      params: { einsatzId: 'einsatz-42' },
    });
  });

  it('öffnet den ETB-Composer per Cmd+Shift+E', () => {
    renderLayout();

    fireEvent.keyDown(document, { key: 'e', code: 'KeyE', ctrlKey: true, shiftKey: true });

    expect(navigateSpy).toHaveBeenCalledWith({
      to: '/app/einsatz/$einsatzId/führung/etb',
      params: { einsatzId: 'einsatz-42' },
    });
  });

  it('blockiert Cmd+Shift+E, sobald ein Overlay aktiv ist', () => {
    renderLayout();

    fireEvent.click(screen.getAllByRole('button', { name: 'Modulübersicht öffnen' })[0]);
    navigateSpy.mockClear();

    fireEvent.keyDown(document, { key: 'e', code: 'KeyE', ctrlKey: true, shiftKey: true });

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
