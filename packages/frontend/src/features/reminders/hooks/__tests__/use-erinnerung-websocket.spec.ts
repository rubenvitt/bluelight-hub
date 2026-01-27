/**
 * Unit Tests für useErinnerungWebSocket Hook
 *
 * Verifiziert die WebSocket Integration, insbesondere:
 * - Connection Handling
 * - Event Processing
 * - Assignment Notification Logic (AC2)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErinnerungWebSocket, type ErinnerungAssignedWebSocketEvent } from '../use-erinnerung-websocket';
import { toast } from 'sonner';

// Mock dependencies
const { mockSocket, mockIo } = vi.hoisted(() => {
  const socket = {
    connected: false,
    emit: vi.fn(),
    on: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
  };
  return {
    mockSocket: socket,
    mockIo: vi.fn(() => socket),
  };
});

vi.mock('socket.io-client', () => ({
  io: mockIo,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    getMutationCache: () => ({
      find: vi.fn().mockReturnValue(undefined), // No pending mutations by default
    }),
  }),
  QueryClient: class {
    getQueryCache() {
      return { subscribe: vi.fn() };
    }
    getMutationCache() {
      return { subscribe: vi.fn() };
    }
    setDefaultOptions() {}
  },
  QueryCache: class {
    subscribe() {}
  },
  MutationCache: class {
    subscribe() {}
  },
}));

vi.mock('@/features/auth/api', () => ({
  useCurrentUser: () => ({
    user: { id: 'current-user-id', name: 'Current User' },
  }),
}));

vi.mock('@/shared/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../api/queries', () => ({
  ERINNERUNG_QUERY_KEYS: {
    list: (id: string) => ['erinnerungen', 'list', id],
  },
}));

// Mock @/shared to prevent crash in implicitly loaded ETB types
vi.mock('@/shared', () => ({
  AddEintragDtoKategorieEnum: {
    Alarmierung: 'Alarmierung',
  },
  api: {},
}));

vi.mock('../../services/notification.service', () => ({
  sendAssignmentNotification: vi.fn().mockResolvedValue({ success: true }),
}));

describe('useErinnerungWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    mockSocket.on.mockImplementation((event, callback) => {
      if (event === 'connect') {
        mockSocket.connected = true;
        callback();
      }
    });
  });

  it('should connect on mount', () => {
    renderHook(() => useErinnerungWebSocket({ einsatzId: 'einsatz-1' }));

    expect(mockIo).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith('join', { einsatzId: 'einsatz-1' });
  });

  describe('handleAssigned (Story 3.7 AC1/AC2)', () => {
    it('should show notification and toast when assigned to current user', async () => {
      // Setup
      renderHook(() => useErinnerungWebSocket({ einsatzId: 'einsatz-1' }));

      // Simulate connect
      const connectCallback = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
      act(() => connectCallback?.());
      mockSocket.connected = true;

      // Get the 'erinnerung.assigned' handler
      const assignedHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'erinnerung.assigned')?.[1];

      const event: ErinnerungAssignedWebSocketEvent = {
        erinnerungId: 'erinnerung-1',
        einsatzId: 'einsatz-1',
        titel: 'Test Task',
        timestamp: new Date().toISOString(),
        assignedToId: 'current-user-id', // Assigned TO me
        assignedToName: 'Current User',
        assignedById: 'other-user-id', // Assigned BY someone else
        assignedByName: 'Other User',
      };

      // Act
      await act(async () => {
        await assignedHandler(event);
      });

      // Assert
      const { sendAssignmentNotification } = await import('../../services/notification.service');

      // AC1: OS Notification
      expect(sendAssignmentNotification).toHaveBeenCalledWith('Test Task', 'Other User', 'erinnerung-1', 'einsatz-1');

      // AC2: In-App Toast
      expect(toast.info).toHaveBeenCalledWith(
        'Other User hat dir eine Erinnerung zugewiesen',
        expect.objectContaining({
          description: 'Test Task',
          duration: 5000,
        }),
      );
    });

    it('should NOT show notification when user assigns to themselves', async () => {
      // Setup
      renderHook(() => useErinnerungWebSocket({ einsatzId: 'einsatz-1' }));

      // Simulate connect
      const connectCallback = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
      act(() => connectCallback?.());

      // Get the 'erinnerung.assigned' handler
      const assignedHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'erinnerung.assigned')?.[1];

      const event: ErinnerungAssignedWebSocketEvent = {
        erinnerungId: 'erinnerung-1',
        einsatzId: 'einsatz-1',
        titel: 'Self Task',
        timestamp: new Date().toISOString(),
        assignedToId: 'current-user-id', // Assigned TO me
        assignedToName: 'Current User',
        assignedById: 'current-user-id', // Assigned BY me (Self-Assignment)
        assignedByName: 'Current User',
      };

      // Act
      await act(async () => {
        await assignedHandler(event);
      });

      // Assert
      const { sendAssignmentNotification } = await import('../../services/notification.service');

      expect(sendAssignmentNotification).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
    });

    it('should show generic toast when assigned to someone else', async () => {
      // Setup
      renderHook(() => useErinnerungWebSocket({ einsatzId: 'einsatz-1' }));

      // Simulate connect
      const connectCallback = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
      act(() => connectCallback?.());
      mockSocket.connected = true;

      // Get the 'erinnerung.assigned' handler
      const assignedHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'erinnerung.assigned')?.[1];

      const event: ErinnerungAssignedWebSocketEvent = {
        erinnerungId: 'erinnerung-1',
        einsatzId: 'einsatz-1',
        titel: 'Other Task',
        timestamp: new Date().toISOString(),
        assignedToId: 'other-user-id', // Assigned TO someone else
        assignedToName: 'Other User',
        assignedById: 'third-user-id', // Assigned BY someone else
        assignedByName: 'Third User',
      };

      // Act
      await act(async () => {
        await assignedHandler(event);
      });

      // Assert
      const { sendAssignmentNotification } = await import('../../services/notification.service');

      // No OS Notification for assignments to others
      expect(sendAssignmentNotification).not.toHaveBeenCalled();

      // Generic Toast
      expect(toast.info).toHaveBeenCalledWith(
        'Erinnerung zugewiesen',
        expect.objectContaining({
          description: expect.stringMatching(/Third User hat eine Erinnerung an Other User zugewiesen/),
          duration: 5000,
        }),
      );
    });
  });

  describe('handleEscalated (Story 4.5)', () => {
    it('should show error toast and notification when escalated to current user', async () => {
      renderHook(() => useErinnerungWebSocket({ einsatzId: 'einsatz-1' }));
      const connectCallback = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
      act(() => connectCallback?.());
      mockSocket.connected = true;

      const escalatedHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'erinnerung.escalated')?.[1];
      const event = {
        erinnerungId: 'erinnerung-1',
        einsatzId: 'einsatz-1',
        titel: 'Escalated Task',
        timestamp: new Date().toISOString(),
        eskalationsPersonId: 'current-user-id',
        erstelltVon: 'other-user-id',
        eskaliertAm: new Date().toISOString(),
      };

      await act(async () => {
        await escalatedHandler(event);
      });

      const { sendAssignmentNotification } = await import('../../services/notification.service');
      expect(sendAssignmentNotification).toHaveBeenCalledWith('ESKALATION: Escalated Task', 'System', 'erinnerung-1', 'einsatz-1');
      expect(toast.error).toHaveBeenCalledWith(
        'ESKALATION: Escalated Task',
        expect.objectContaining({
          description: 'Diese Erinnerung wurde an dich eskaliert!',
          duration: 5000,
        }),
      );
    });

    it('should show warning toast when own reminder is escalated', async () => {
      renderHook(() => useErinnerungWebSocket({ einsatzId: 'einsatz-1' }));
      const connectCallback = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
      act(() => connectCallback?.());
      mockSocket.connected = true;

      const escalatedHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'erinnerung.escalated')?.[1];
      const event = {
        erinnerungId: 'erinnerung-1',
        einsatzId: 'einsatz-1',
        titel: 'My Task',
        timestamp: new Date().toISOString(),
        eskalationsPersonId: 'boss-id',
        erstelltVon: 'current-user-id', // ME
        eskaliertAm: new Date().toISOString(),
      };

      await act(async () => {
        await escalatedHandler(event);
      });

      expect(toast.warning).toHaveBeenCalledWith(
        'Deine Erinnerung wurde eskaliert: My Task',
        expect.objectContaining({
          description: 'Zeitüberschreitung - an Vorgesetzten eskaliert',
        }),
      );
    });

    it('should show generic warning toast for other escalations', async () => {
      renderHook(() => useErinnerungWebSocket({ einsatzId: 'einsatz-1' }));
      const connectCallback = mockSocket.on.mock.calls.find((call) => call[0] === 'connect')?.[1];
      act(() => connectCallback?.());
      mockSocket.connected = true;

      const escalatedHandler = mockSocket.on.mock.calls.find((call) => call[0] === 'erinnerung.escalated')?.[1];
      const event = {
        erinnerungId: 'erinnerung-1',
        einsatzId: 'einsatz-1',
        titel: 'Other Task',
        timestamp: new Date().toISOString(),
        eskalationsPersonId: 'boss-id',
        erstelltVon: 'other-user-id',
        eskaliertAm: new Date().toISOString(),
      };

      await act(async () => {
        await escalatedHandler(event);
      });

      expect(toast.warning).toHaveBeenCalledWith(
        'Erinnerung eskaliert: Other Task',
        expect.objectContaining({
          description: 'Zeitüberschreitung',
        }),
      );
    });
  });
});
