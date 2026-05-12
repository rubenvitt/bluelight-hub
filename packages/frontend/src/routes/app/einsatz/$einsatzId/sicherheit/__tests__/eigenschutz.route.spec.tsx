import { screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';

/**
 * Route-Tests für `/app/einsatz/$einsatzId/sicherheit/eigenschutz` (Story 1.6 AC10).
 *
 * **Testansatz:** `createFileRoute` wird gemockt, damit wir die Closure-
 * Rückgabe abfangen und die Route-Komponente isoliert rendern können
 * (Pattern aus `-befehle.spec.tsx`). Die Route rendert bewusst ohne
 * Health-/Scope-Gate, damit Eigenschutz für den aktuellen Einsatz-Workspace
 * direkt verfügbar bleibt.
 */

const { captured, mockUseParams, mockUseLocation, mockNavigate, mockUseSearch } = vi.hoisted(() => ({
  captured: { component: null as (() => React.JSX.Element) | null },
  mockUseParams: vi.fn(() => ({ einsatzId: 'einsatz-1' })),
  mockUseLocation: vi.fn(() => ({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' })),
  mockNavigate: vi.fn(),
  mockUseSearch: vi.fn(() => ({}) as Record<string, unknown>),
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createFileRoute: (_path: string) => {
      return (options: { component: () => React.JSX.Element }) => {
        captured.component = options.component;
        return {
          useParams: mockUseParams,
          useSearch: mockUseSearch,
          options,
        };
      };
    },
    useLocation: () => mockUseLocation(),
    useNavigate: () => mockNavigate,
    // Ohne `<RouterProvider>` crasht der echte Outlet in Tests — deshalb
    // stubben wir ihn hier isoliert.
    Outlet: () => <div data-testid="outlet" />,
  };
});

vi.mock('@/features/eigenschutz', () => ({
  EigenschutzEntryPage: ({ einsatzId }: { einsatzId: string }) => <div data-testid="entry-page">EntryPage:{einsatzId}</div>,
}));

vi.mock('@/features/eigenschutz/ui/organisms/PsaProfilEmpfangBanner', () => ({
  PsaProfilEmpfangBanner: ({ einsatzId }: { einsatzId: string }) => <div data-testid="psa-empfang-banner-mock">PsaBanner:{einsatzId}</div>,
}));

vi.mock('@/features/eigenschutz/ui/organisms/EinsatzleiterReprompEskalationBanner', () => ({
  EinsatzleiterReprompEskalationBanner: ({ einsatzId }: { einsatzId: string }) => <div data-testid="einsatzleiter-reprompt-mock">EinsatzleiterReprompt:{einsatzId}</div>,
}));

vi.mock('@/features/eigenschutz/ui/molecules/EigenschutzSyncStatusPopover', () => ({
  EigenschutzSyncStatusPopover: ({ einsatzId }: { einsatzId: string }) => <div data-testid="eigenschutz-sync-status-popover-mock">SyncStatus:{einsatzId}</div>,
}));

vi.mock('@/features/eigenschutz/ui/organisms/EigenschutzSubNav', () => ({
  EigenschutzSubNav: ({ einsatzId }: { einsatzId: string }) => <div data-testid="eigenschutz-subnav-mock">SubNav:{einsatzId}</div>,
}));

vi.mock('@/features/eigenschutz/ui/organisms/SyncConflictsDrawer', () => ({
  SyncConflictsDrawer: ({ einsatzId, isOpen, initialFilter }: { einsatzId: string; isOpen: boolean; initialFilter?: { entityType?: string; einheitId?: string } }) =>
    isOpen ? (
      <div data-testid="sync-conflicts-drawer-mock" data-einsatz-id={einsatzId} data-entity-type={initialFilter?.entityType ?? ''} data-einheit-id={initialFilter?.einheitId ?? ''}>
        DrawerOpen
      </div>
    ) : null,
}));

const { mockQuittungLive, mockLueckeLive, mockUeberfaelligLive, mockKonfliktLive, mockUseSyncStatus } = vi.hoisted(() => ({
  mockQuittungLive: vi.fn(),
  mockLueckeLive: vi.fn(),
  mockUeberfaelligLive: vi.fn(),
  mockKonfliktLive: vi.fn(),
  mockUseSyncStatus: vi.fn(() => ({
    status: 'synced',
    isLoaded: true,
    isOnline: true,
    pendingCount: 0,
    conflictCount: 0,
    oldestPendingAt: null,
    lastSyncAt: null,
    hasStorageReadError: false,
    hasPausedConflictQuery: false,
  })),
}));
vi.mock('@/features/eigenschutz/api/use-eigenschutz-psa-quittung-live', () => ({
  useEigenschutzPsaQuittungLive: (...args: unknown[]) => {
    mockQuittungLive(...args);
    return { status: 'connected' };
  },
}));
vi.mock('@/features/eigenschutz/api/use-eigenschutz-luecke-gemeldet-live', () => ({
  useEigenschutzLueckeGemeldetLive: (...args: unknown[]) => {
    mockLueckeLive(...args);
    return { status: 'connected' };
  },
}));
vi.mock('@/features/eigenschutz/api/use-eigenschutz-quittung-ueberfaellig-live', () => ({
  useEigenschutzQuittungUeberfaelligLive: (...args: unknown[]) => {
    mockUeberfaelligLive(...args);
    return { status: 'connected', notices: [], dismiss: () => {} };
  },
}));
vi.mock('@/features/eigenschutz/api/use-eigenschutz-konflikt-erkannt-live', () => ({
  useEigenschutzKonfliktErkanntLive: (...args: unknown[]) => {
    mockKonfliktLive(...args);
    return { notices: [], dismissNotice: () => {} };
  },
}));
vi.mock('@/features/eigenschutz/api/use-eigenschutz-konflikt-aufgeloest-live', () => ({
  useEigenschutzKonfliktAufgeloestLive: vi.fn(),
}));
vi.mock('@/features/eigenschutz/hooks/useEigenschutzTelemetry', () => ({
  useEigenschutzTelemetry: vi.fn(),
}));
vi.mock('@/features/eigenschutz/hooks/useEigenschutzSyncStatus', () => ({
  useEigenschutzSyncStatus: () => mockUseSyncStatus(),
}));

// Route-Import muss NACH den vi.mock-Aufrufen stehen (captured.component
// wird beim Modul-Import vom gemockten createFileRoute befüllt).
import '../eigenschutz';

function renderRoute() {
  if (!captured.component) {
    throw new Error('Route-Komponente wurde nicht via createFileRoute-Mock erfasst.');
  }
  const Component = captured.component;
  return renderWithProviders(<Component />);
}

describe('Eigenschutz Route (Story 1.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz/gefaehrdungen' });
    mockUseParams.mockReturnValue({ einsatzId: 'einsatz-1' });
    mockUseSearch.mockReturnValue({});
    mockUseSyncStatus.mockReturnValue({
      status: 'synced',
      isLoaded: true,
      isOnline: true,
      pendingCount: 0,
      conflictCount: 0,
      oldestPendingAt: null,
      lastSyncAt: null,
      hasStorageReadError: false,
      hasPausedConflictQuery: false,
    });
  });

  it('(a) rendert die EntryPage direkt auf der Eigenschutz-Root-Route', () => {
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' });
    renderRoute();

    expect(screen.getByTestId('entry-page')).toHaveTextContent('EntryPage:einsatz-1');
    expect(screen.queryByTestId('outlet')).toBeNull();
  });

  it('rendert die EntryPage auch auf der Root-Route mit trailing slash', () => {
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz/' });
    renderRoute();

    expect(screen.getByTestId('entry-page')).toHaveTextContent('EntryPage:einsatz-1');
    expect(screen.queryByTestId('outlet')).toBeNull();
  });

  it('rendert Outlet auf Child-Routen', () => {
    renderRoute();

    // Child-Routen bleiben über `<Outlet />` sichtbar
    // (/gefaehrdungen → GefaehrdungenPage, /gefaehrdungen/$id → DetailPage).
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
    expect(screen.queryByTestId('entry-page')).toBeNull();
  });

  it('mountet den PSA-Empfangs-Banner als gemeinsamen Layout-Container (Story 3.3 AC8)', () => {
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' });
    renderRoute();
    expect(screen.getByTestId('psa-empfang-banner-mock')).toHaveTextContent('PsaBanner:einsatz-1');
    expect(screen.getByTestId('entry-page')).toBeInTheDocument();
  });

  it('rendert PSA-Banner auch auf Child-Routen oberhalb des Outlets', () => {
    renderRoute();
    const banner = screen.getByTestId('psa-empfang-banner-mock');
    const outlet = screen.getByTestId('outlet');
    expect(banner).toBeInTheDocument();
    expect(outlet).toBeInTheDocument();
    // AC8: Banner muss DOM-mäßig **vor** Outlet stehen, damit er oberhalb des
    // Inhalts sichtbar bleibt — sonst landet der CBRN-Banner unter dem Inhalt.
    expect(banner.compareDocumentPosition(outlet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('rendert PSA-Banner auch auf der Root-Route oberhalb der EntryPage', () => {
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' });
    renderRoute();
    const banner = screen.getByTestId('psa-empfang-banner-mock');
    const entry = screen.getByTestId('entry-page');
    expect(banner.compareDocumentPosition(entry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('mountet den Sender-Live-Hook useEigenschutzPsaQuittungLive (Story 3.4 AC11)', () => {
    mockQuittungLive.mockClear();
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' });
    renderRoute();
    expect(mockQuittungLive).toHaveBeenCalledWith(expect.objectContaining({ einsatzId: 'einsatz-1' }));
  });

  it('mountet den Sender-Live-Hook useEigenschutzLueckeGemeldetLive (Story 3.6 AC14)', () => {
    mockLueckeLive.mockClear();
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' });
    renderRoute();
    expect(mockLueckeLive).toHaveBeenCalledWith(expect.objectContaining({ einsatzId: 'einsatz-1' }));
  });

  it('mountet den Reprompt-Live-Hook useEigenschutzQuittungUeberfaelligLive (Story 3.7 AC6)', () => {
    mockUeberfaelligLive.mockClear();
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' });
    renderRoute();
    expect(mockUeberfaelligLive).toHaveBeenCalledWith(expect.objectContaining({ einsatzId: 'einsatz-1' }));
  });

  it('mountet EinsatzleiterReprompEskalationBanner (Story 3.7 AC8)', () => {
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' });
    renderRoute();
    expect(screen.getByTestId('einsatzleiter-reprompt-mock')).toHaveTextContent('EinsatzleiterReprompt:einsatz-1');
  });

  it('mountet den zentralen SyncStatusBadge oberhalb der Eigenschutz-Inhalte (Story 7.5 AC1)', () => {
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz/gefaehrdungen' });
    renderRoute();

    const syncStatus = screen.getByTestId('eigenschutz-sync-status-popover-mock');
    const outlet = screen.getByTestId('outlet');
    expect(syncStatus).toHaveTextContent('SyncStatus:einsatz-1');
    expect(syncStatus.compareDocumentPosition(outlet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('rendert einen Konflikt-Summary-Banner, wenn offene Konflikte ohne Live-Notice existieren (Story 7.5 AC6)', () => {
    mockUseSyncStatus.mockReturnValue({
      status: 'conflict',
      isLoaded: true,
      isOnline: true,
      pendingCount: 0,
      conflictCount: 2,
      oldestPendingAt: null,
      lastSyncAt: null,
      hasStorageReadError: false,
      hasPausedConflictQuery: false,
    });

    renderRoute();

    expect(screen.getByTestId('eigenschutz-sync-conflict-summary-banner')).toHaveTextContent('Sync-Konflikt: jetzt auflösen');
    // Goal G6: Summary-Link ist jetzt ein Button (öffnet Drawer) — kein href mehr.
    const summaryButton = screen.getByTestId('eigenschutz-sync-conflict-summary-link');
    expect(summaryButton).toBeInTheDocument();
    expect(summaryButton.tagName).toBe('BUTTON');
  });

  it('Goal G6: öffnet den SyncConflictsDrawer, wenn openConflicts=1 als Search-Param vorliegt (Legacy-Redirect)', () => {
    mockUseSearch.mockReturnValue({ openConflicts: 1 });
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' });

    renderRoute();

    expect(screen.getByTestId('sync-conflicts-drawer-mock')).toHaveTextContent('DrawerOpen');
  });

  it('Goal G6: reicht Drawer-Filter (entityType, einheitId) aus Search-Params durch', () => {
    mockUseSearch.mockReturnValue({ openConflicts: 1, entityType: 'PSA_PROFIL_ZUWEISUNG', einheitId: 'einheit-7' });
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' });

    renderRoute();

    const drawer = screen.getByTestId('sync-conflicts-drawer-mock');
    expect(drawer.getAttribute('data-entity-type')).toBe('PSA_PROFIL_ZUWEISUNG');
    expect(drawer.getAttribute('data-einheit-id')).toBe('einheit-7');
  });

  it('Goal G6: hält den Drawer geschlossen, wenn kein openConflicts-Hint gesetzt ist', () => {
    mockUseSearch.mockReturnValue({});
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' });

    renderRoute();

    expect(screen.queryByTestId('sync-conflicts-drawer-mock')).toBeNull();
  });

  it('mountet die EigenschutzSubNav auf der Root-Route oberhalb der EntryPage (Wayfinding)', () => {
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz' });
    renderRoute();

    const subnav = screen.getByTestId('eigenschutz-subnav-mock');
    const entry = screen.getByTestId('entry-page');
    expect(subnav).toHaveTextContent('SubNav:einsatz-1');
    expect(subnav.compareDocumentPosition(entry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('mountet die EigenschutzSubNav auch auf Child-Routen oberhalb des Outlets (Wayfinding)', () => {
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-1/sicherheit/eigenschutz/gefaehrdungen' });
    renderRoute();

    const subnav = screen.getByTestId('eigenschutz-subnav-mock');
    const outlet = screen.getByTestId('outlet');
    expect(subnav).toBeInTheDocument();
    expect(subnav.compareDocumentPosition(outlet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('propagiert die aktuelle einsatzId an die EntryPage', () => {
    mockUseParams.mockReturnValue({ einsatzId: 'einsatz-xyz' });
    mockUseLocation.mockReturnValue({ pathname: '/app/einsatz/einsatz-xyz/sicherheit/eigenschutz' });
    renderRoute();

    expect(screen.getByTestId('entry-page')).toHaveTextContent('EntryPage:einsatz-xyz');
  });
});
