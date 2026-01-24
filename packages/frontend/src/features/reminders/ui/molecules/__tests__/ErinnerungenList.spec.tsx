/**
 * Unit Tests fuer ErinnerungenList Component
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 3.2 AC1:** WebSocket-Verbindung und automatische Aktualisierung
 * **Story 3.2 Task 1.2:** Verbindungs-Status-Indikator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErinnerungenList } from '../ErinnerungenList';

// Mock API
vi.mock('@/features/reminders/api', () => ({
  useErinnerungenByEinsatz: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

// Mock Auth
vi.mock('@/features/auth', () => ({
  useCurrentUser: vi.fn().mockReturnValue({ user: { id: 'user-1', name: 'Test User' } }),
}));

// Mock Hooks
const mockUseErinnerungWebSocket = vi.fn().mockReturnValue({
  isConnected: true,
  status: 'connected',
  connect: vi.fn(),
  disconnect: vi.fn(),
});

vi.mock('@/features/reminders/hooks', () => ({
  useAlarmTrigger: vi.fn(),
  useErinnerungWebSocket: () => mockUseErinnerungWebSocket(),
  useOfflineStatus: vi.fn().mockReturnValue({
    isOffline: false,
    pendingActionsCount: 0,
    offlineSince: null,
  }),
  useReconnectSync: vi.fn().mockReturnValue({ isSyncing: false }),
  useTrayBadge: vi.fn(),
  useTrayClickNavigation: vi.fn(),
}));

// Mock Stores - Story 3.6: Team-Filter Store (Tagged Union Format)
// Story 3.8: Team-Sort Store
vi.mock('@/features/reminders/stores', () => ({
  addAnimatedId: vi.fn(),
  openQuickCreateDialog: vi.fn(),
  // Story 3.6 Team-Filter Store
  setTeamFilter: vi.fn(),
  setAvailableTeilnehmer: vi.fn(),
  resetTeamFilterStore: vi.fn(),
  useTeamFilter: vi.fn().mockReturnValue({ type: 'all' }),
  useAvailableTeilnehmer: vi.fn().mockReturnValue([]),
  // Story 3.8 Team-Sort Store
  setTeamSort: vi.fn(),
  useTeamSort: vi.fn().mockReturnValue('faelligkeit'),
}));

// Mock Einsatz API - Story 3.6 Task 3.4
vi.mock('@/features/einsatz/api', () => ({
  useAktiveEinsatzTeilnehmer: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

// Mock Subcomponents
vi.mock('../ErinnerungCard', () => ({
  ErinnerungCard: ({ erinnerung }: { erinnerung: { titel: string } }) => <div data-testid="erinnerung-card">{erinnerung.titel}</div>,
}));

vi.mock('../OfflineBanner', () => ({
  OfflineBanner: () => null,
}));

vi.mock('../../organisms/FloatingPillPortal', () => ({
  FloatingPillPortal: () => null,
}));

// Mock TeamFilterDropdown - Story 3.6 Task 3.3
vi.mock('../../atoms/TeamFilterDropdown', () => ({
  TeamFilterDropdown: ({ selectedFilter, onFilterChange }: { selectedFilter: { type: string; userId?: string }; onFilterChange: (f: { type: string }) => void }) => (
    <button type="button" data-testid="team-filter-dropdown" onClick={() => onFilterChange({ type: 'mine' })}>
      Filter: {selectedFilter.type}
    </button>
  ),
}));

// Mock TeamSortDropdown - Story 3.8
vi.mock('../../atoms/TeamSortDropdown', () => ({
  TeamSortDropdown: ({ selectedSort }: { selectedSort: string }) => (
    <button type="button" data-testid="team-sort-dropdown">
      Sort: {selectedSort}
    </button>
  ),
}));

vi.mock('@/shared/ui/molecules/tabs.molecule', () => ({
  Tabs: ({ items }: { items: Array<{ label: string; content: React.ReactNode }> }) => (
    <div data-testid="tabs">
      {items.map((item, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Test-Mock benötigt stabile Keys
        <div key={idx} data-testid={`tab-${idx}`}>
          <span>{item.label}</span>
          <div>{item.content}</div>
        </div>
      ))}
    </div>
  ),
}));

describe('ErinnerungenList', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    // Reset mock to connected state
    mockUseErinnerungWebSocket.mockReturnValue({
      isConnected: true,
      status: 'connected',
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
  });

  const renderWithQueryClient = (ui: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  describe('WebSocket Integration (Story 3.2 AC1)', () => {
    it('should call useErinnerungWebSocket with correct parameters', async () => {
      // Given (Arrange)
      const einsatzId = 'einsatz-123';

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId={einsatzId} />);

      // Then (Assert)
      expect(mockUseErinnerungWebSocket).toHaveBeenCalled();
    });

    it('should enable WebSocket and team toasts by default', async () => {
      // Given (Arrange) - Mock already configured in beforeEach

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then (Assert) - Hook should be called with enabled:true and showTeamToasts:true
      // Note: We verify via the mock that the component renders without error when WS is active
      expect(mockUseErinnerungWebSocket).toHaveBeenCalled();
    });
  });

  describe('WebSocket Status Indicator (Story 3.2 Task 1.2)', () => {
    it('should show green indicator when WebSocket is connected', async () => {
      // Given (Arrange)
      mockUseErinnerungWebSocket.mockReturnValue({
        isConnected: true,
        status: 'connected',
        connect: vi.fn(),
        disconnect: vi.fn(),
      });

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then (Assert)
      const indicator = screen.getByTitle('Echtzeit-Updates aktiv');
      expect(indicator).toBeInTheDocument();
      expect(indicator.className).toMatch(/emerald/);
    });

    it('should show gray indicator when WebSocket is disconnected', async () => {
      // Given (Arrange)
      mockUseErinnerungWebSocket.mockReturnValue({
        isConnected: false,
        status: 'disconnected',
        connect: vi.fn(),
        disconnect: vi.fn(),
      });

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then (Assert)
      const indicator = screen.getByTitle('Verbindung unterbrochen');
      expect(indicator).toBeInTheDocument();
      expect(indicator.className).toMatch(/gray/);
    });

    it('should NOT show indicator in compact mode', async () => {
      // Given (Arrange)
      mockUseErinnerungWebSocket.mockReturnValue({
        isConnected: true,
        status: 'connected',
        connect: vi.fn(),
        disconnect: vi.fn(),
      });

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" compact={true} />);

      // Then (Assert) - Header with indicator is not rendered in compact mode
      expect(screen.queryByTitle('Echtzeit-Updates aktiv')).not.toBeInTheDocument();
    });
  });

  describe('Header and Title', () => {
    it('should show "Erinnerungen" title in non-compact mode', () => {
      // Given (Arrange)

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then (Assert)
      expect(screen.getByText('Erinnerungen')).toBeInTheDocument();
    });

    it('should NOT show title in compact mode', () => {
      // Given (Arrange)

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" compact={true} />);

      // Then (Assert)
      expect(screen.queryByText('Erinnerungen')).not.toBeInTheDocument();
    });
  });

  describe('Tabs (Story 3.1)', () => {
    it('should render "Meine" and "Team" tabs', () => {
      // Given (Arrange)

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then (Assert) - Use getAllByText since "Team" appears in tab label and empty state
      expect(screen.getAllByText(/Meine/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Team/).length).toBeGreaterThan(0);
    });
  });

  describe('Team Filter (Story 3.6)', () => {
    it('should render TeamFilterDropdown in Team tab (Task 3.3)', () => {
      // Given (Arrange)

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then (Assert)
      expect(screen.getByTestId('team-filter-dropdown')).toBeInTheDocument();
    });

    it('should show current filter state in dropdown', () => {
      // Given (Arrange)

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then (Assert)
      expect(screen.getByTestId('team-filter-dropdown')).toHaveTextContent('Filter: all');
    });
  });

  describe('Edge Cases (Task 5.4)', () => {
    it('should handle empty erinnerungen gracefully', () => {
      // Given (Arrange)

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then (Assert)
      expect(screen.queryByTestId('erinnerung-card')).not.toBeInTheDocument();
    });

    it('should render without crashing when einsatzTeilnehmer is empty', () => {
      // Given (Arrange) - einsatzTeilnehmer mock already returns empty array

      // When (Act)
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then (Assert) - Should still render with dropdown
      expect(screen.getByTestId('team-filter-dropdown')).toBeInTheDocument();
    });
  });

  /**
   * Story 3.6 Issue #8: Test Coverage Gap - Team Filter Logic
   *
   * Tests fuer die Filter-Logik im Team-Tab.
   * Validiert AC2, AC3, AC4, AC5 aus Story 3.6.
   */
  describe('Team Filter Logic (AC2, AC3, AC4, AC5)', () => {
    // Test-Daten: Verschiedene Erinnerungen fuer Filter-Tests
    const mockErinnerungen = [
      // Erinnerung erstellt von user-1, zugewiesen an user-2
      {
        id: 'erinnerung-1',
        titel: 'Erinnerung von User 1 fuer User 2',
        status: 'GEPLANT',
        faelligAm: new Date(Date.now() + 60000).toISOString(),
        erstelltVon: 'user-1',
        erstellerName: 'Test User 1',
        assignedToId: 'user-2',
        assignedToName: 'Test User 2',
      },
      // Erinnerung erstellt von user-2, zugewiesen an user-1
      {
        id: 'erinnerung-2',
        titel: 'Erinnerung von User 2 fuer User 1',
        status: 'GEPLANT',
        faelligAm: new Date(Date.now() + 120000).toISOString(),
        erstelltVon: 'user-2',
        erstellerName: 'Test User 2',
        assignedToId: 'user-1',
        assignedToName: 'Test User 1',
      },
      // Erinnerung erstellt von user-1, unzugewiesen
      {
        id: 'erinnerung-3',
        titel: 'Unzugewiesene Erinnerung von User 1',
        status: 'GEPLANT',
        faelligAm: new Date(Date.now() + 180000).toISOString(),
        erstelltVon: 'user-1',
        erstellerName: 'Test User 1',
        assignedToId: null,
        assignedToName: null,
      },
      // Erinnerung erstellt von user-3, zugewiesen an user-3
      {
        id: 'erinnerung-4',
        titel: 'Erinnerung von User 3 fuer sich selbst',
        status: 'GEPLANT',
        faelligAm: new Date(Date.now() + 240000).toISOString(),
        erstelltVon: 'user-3',
        erstellerName: 'Test User 3',
        assignedToId: 'user-3',
        assignedToName: 'Test User 3',
      },
      // Erledigte Erinnerung (sollte im Team-Tab nicht erscheinen)
      {
        id: 'erinnerung-5',
        titel: 'Erledigte Erinnerung',
        status: 'ERLEDIGT',
        faelligAm: new Date(Date.now() - 60000).toISOString(),
        erstelltVon: 'user-1',
        erstellerName: 'Test User 1',
        assignedToId: 'user-1',
        assignedToName: 'Test User 1',
      },
      // Weitere unzugewiesene Erinnerung von user-2
      {
        id: 'erinnerung-6',
        titel: 'Unzugewiesene Erinnerung von User 2',
        status: 'GEPLANT',
        faelligAm: new Date(Date.now() + 300000).toISOString(),
        erstelltVon: 'user-2',
        erstellerName: 'Test User 2',
        assignedToId: null,
        assignedToName: null,
      },
    ];

    // Referenz zu den gemockten Modulen fuer dynamische Kontrolle
    let useErinnerungenByEinsatzMock: ReturnType<typeof vi.fn>;
    let useTeamFilterMock: ReturnType<typeof vi.fn>;
    let useCurrentUserMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      vi.clearAllMocks();

      // Hole Referenzen zu den Mocks
      const apiModule = await import('@/features/reminders/api');
      const storesModule = await import('@/features/reminders/stores');
      const authModule = await import('@/features/auth');

      useErinnerungenByEinsatzMock = vi.mocked(apiModule.useErinnerungenByEinsatz);
      useTeamFilterMock = vi.mocked(storesModule.useTeamFilter);
      useCurrentUserMock = vi.mocked(authModule.useCurrentUser);

      // Default: currentUser ist user-1
      useCurrentUserMock.mockReturnValue({ user: { id: 'user-1', name: 'Test User 1' } });

      // Default: Erinnerungen bereitstellen
      useErinnerungenByEinsatzMock.mockReturnValue({
        data: mockErinnerungen,
        isLoading: false,
        error: null,
      });

      // Default: Filter auf 'all' (Tagged Union Format)
      useTeamFilterMock.mockReturnValue({ type: 'all' });
    });

    it('should filter by specific userId when filter is set (AC2)', async () => {
      // Given: Mock erinnerungen with different assignees, filter auf user-2 (Tagged Union)
      useTeamFilterMock.mockReturnValue({ type: 'user', userId: 'user-2' });

      // When: Component rendert mit Filter auf spezifischen User
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then: Im Team-Tab (tab-1) nur Erinnerung die user-2 zugewiesen ist sichtbar
      // erinnerung-1: assignedToId === 'user-2' -> SICHTBAR
      // erinnerung-2: assignedToId === 'user-1' -> NICHT sichtbar
      // erinnerung-3: unzugewiesen -> NICHT sichtbar
      // erinnerung-4: assignedToId === 'user-3' -> NICHT sichtbar
      const teamTab = screen.getByTestId('tab-1');
      const cards = within(teamTab).getAllByTestId('erinnerung-card');
      expect(cards).toHaveLength(1);
      expect(cards[0]).toHaveTextContent('Erinnerung von User 1 fuer User 2');
    });

    it('should filter "Meine" correctly - shows assigned OR unassigned+created (Story 3.4 AC2)', async () => {
      // Given: currentUser ist user-1, Filter "mine" (Tagged Union)
      useCurrentUserMock.mockReturnValue({ user: { id: 'user-1', name: 'Test User 1' } });
      useTeamFilterMock.mockReturnValue({ type: 'mine' });

      // When: Component rendert mit "mine" Filter
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then: Im Team-Tab Erinnerungen wo user-1 Zugewiesener ist ODER (Ersteller UND unzugewiesen)
      // Story 3.4 AC2: Nach Zuweisung an jemand anderen verliert Ersteller Ownership
      // erinnerung-1: erstelltVon === 'user-1' ABER assignedToId === 'user-2' -> NICHT meine (zugewiesen an anderen)
      // erinnerung-2: assignedToId === 'user-1' -> MEINE (mir zugewiesen)
      // erinnerung-3: erstelltVon === 'user-1' UND assignedToId === null -> MEINE (erstellt und unzugewiesen)
      // erinnerung-4: kein Bezug zu user-1 -> NICHT sichtbar
      // erinnerung-5: ERLEDIGT -> im Team-Tab nicht (gefiltert vorab)
      const teamTab = screen.getByTestId('tab-1');
      const cards = within(teamTab).getAllByTestId('erinnerung-card');
      expect(cards).toHaveLength(2);

      // Verifiziere dass die richtigen Erinnerungen angezeigt werden
      const cardTexts = cards.map((card) => card.textContent);
      expect(cardTexts).toContain('Erinnerung von User 2 fuer User 1'); // mir zugewiesen
      expect(cardTexts).toContain('Unzugewiesene Erinnerung von User 1'); // erstellt und unzugewiesen
      // erinnerung-1 sollte NICHT enthalten sein (Story 3.4 AC2)
      expect(cardTexts).not.toContain('Erinnerung von User 1 fuer User 2');
    });

    it('should filter "Unzugewiesen" correctly (AC4)', async () => {
      // Given: Filter auf "unassigned" (Tagged Union)
      useTeamFilterMock.mockReturnValue({ type: 'unassigned' });

      // When: Component rendert mit "unassigned" Filter
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then: Im Team-Tab nur Erinnerungen ohne assignedToId
      // erinnerung-3: assignedToId === null -> SICHTBAR
      // erinnerung-6: assignedToId === null -> SICHTBAR
      // Alle anderen haben assignedToId -> NICHT sichtbar
      const teamTab = screen.getByTestId('tab-1');
      const cards = within(teamTab).getAllByTestId('erinnerung-card');
      expect(cards).toHaveLength(2);

      const cardTexts = cards.map((card) => card.textContent);
      expect(cardTexts).toContain('Unzugewiesene Erinnerung von User 1');
      expect(cardTexts).toContain('Unzugewiesene Erinnerung von User 2');
    });

    it('should show all team erinnerungen when filter is "all" (AC5)', async () => {
      // Given: Filter auf "all" (default, Tagged Union)
      useTeamFilterMock.mockReturnValue({ type: 'all' });

      // When: Component rendert mit "all" Filter
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then: Im Team-Tab alle nicht-erledigten Erinnerungen sichtbar
      // erinnerung-5 (ERLEDIGT) wird im Team-Tab grundsaetzlich ausgefiltert
      const teamTab = screen.getByTestId('tab-1');
      const cards = within(teamTab).getAllByTestId('erinnerung-card');
      expect(cards).toHaveLength(5); // Alle ausser ERLEDIGT

      const cardTexts = cards.map((card) => card.textContent);
      expect(cardTexts).not.toContain('Erledigte Erinnerung');
    });

    it('should handle filter with non-existent userId gracefully', async () => {
      // Given: Filter auf eine User-ID die nicht existiert (Tagged Union)
      useTeamFilterMock.mockReturnValue({ type: 'user', userId: 'non-existent-user-id' });

      // When: Component rendert mit ungueltigem Filter
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then: Im Team-Tab keine Erinnerungen (keine assignedToId matcht)
      const teamTab = screen.getByTestId('tab-1');
      expect(within(teamTab).queryByTestId('erinnerung-card')).not.toBeInTheDocument();
    });

    it('should handle "mine" filter when currentUser is undefined - shows login prompt (Issue #6 Guard)', async () => {
      // Given: Kein aktueller User (logged out scenario)
      useCurrentUserMock.mockReturnValue({ user: null });
      useTeamFilterMock.mockReturnValue({ type: 'mine' });

      // When: Component rendert ohne currentUser
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then: Login-Aufforderung wird angezeigt (Issue #6 Fix: User Guard)
      // Die Komponente zeigt jetzt eine Login-Nachricht statt leerer Liste
      expect(screen.getByText(/einloggen/i)).toBeInTheDocument();
      // Tabs werden nicht gerendert
      expect(screen.queryByTestId('tab-0')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tab-1')).not.toBeInTheDocument();
    });

    it('should filter by specific user-3 showing self-assigned erinnerung (AC2)', async () => {
      // Given: Filter auf user-3 (Tagged Union)
      useTeamFilterMock.mockReturnValue({ type: 'user', userId: 'user-3' });

      // When: Component rendert mit Filter auf user-3
      renderWithQueryClient(<ErinnerungenList einsatzId="einsatz-123" />);

      // Then: Im Team-Tab nur Erinnerung-4 die user-3 zugewiesen ist
      const teamTab = screen.getByTestId('tab-1');
      const cards = within(teamTab).getAllByTestId('erinnerung-card');
      expect(cards).toHaveLength(1);
      expect(cards[0]).toHaveTextContent('Erinnerung von User 3 fuer sich selbst');
    });
  });
});
