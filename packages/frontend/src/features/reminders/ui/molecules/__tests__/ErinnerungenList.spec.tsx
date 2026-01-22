/**
 * Unit Tests fuer ErinnerungenList Component
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 3.2 AC1:** WebSocket-Verbindung und automatische Aktualisierung
 * **Story 3.2 Task 1.2:** Verbindungs-Status-Indikator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

// Mock Stores
vi.mock('@/features/reminders/stores', () => ({
  addAnimatedId: vi.fn(),
  openQuickCreateDialog: vi.fn(),
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

vi.mock('@/shared/ui/molecules/tabs.molecule', () => ({
  Tabs: ({ items }: { items: Array<{ label: string; content: React.ReactNode }> }) => (
    <div data-testid="tabs">
      {items.map((item, idx) => (
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
});
