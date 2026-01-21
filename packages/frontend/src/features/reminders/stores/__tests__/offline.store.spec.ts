/**
 * Unit Tests fuer Offline Store
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.8 AC1, AC2:**
 * - pendingErinnerungen: Offline erstellte Erinnerungen
 * - syncQueue: Ausstehende Sync-Aktionen
 * - Helper Functions fuer Offline-State Management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  offlineStore,
  resetOfflineStore,
  addPendingErinnerung,
  removePendingErinnerung,
  queueSyncAction,
  clearProcessedActions,
  setLastSync,
  setOfflineState,
  getPendingErinnerungById,
  usePendingErinnerungen,
  useSyncQueueCount,
  useLastSync,
  useOfflineState,
  OFFLINE_STORE_KEYS,
  type PendingErinnerung,
  type SyncQueueAction,
} from '../offline.store';

/**
 * Factory fuer Test-PendingErinnerung
 */
function createTestPendingErinnerung(overrides: Partial<PendingErinnerung> = {}): PendingErinnerung {
  return {
    id: 'temp_test-id-1',
    einsatzId: 'einsatz-1',
    titel: 'Test Erinnerung',
    beschreibung: null,
    faelligAm: new Date(2026, 0, 19, 12, 30, 0).toISOString(),
    createdAt: new Date(2026, 0, 19, 12, 0, 0).toISOString(),
    ...overrides,
  };
}

/**
 * Factory fuer Test-SyncQueueAction
 */
function createTestSyncAction(overrides: Partial<SyncQueueAction> = {}): SyncQueueAction {
  return {
    id: 'action-1',
    action: 'create',
    erinnerungId: 'temp_test-id-1',
    payload: { titel: 'Test' },
    timestamp: new Date(2026, 0, 19, 12, 0, 0).toISOString(),
    retryCount: 0,
    ...overrides,
  };
}

describe('offlineStore', () => {
  beforeEach(() => {
    resetOfflineStore();
  });

  describe('OFFLINE_STORE_KEYS', () => {
    it('should export correct store keys', () => {
      // Then (Assert)
      expect(OFFLINE_STORE_KEYS.PENDING_ERINNERUNGEN).toBe('reminders.offline.pending');
      expect(OFFLINE_STORE_KEYS.SYNC_QUEUE).toBe('reminders.offline.syncQueue');
      expect(OFFLINE_STORE_KEYS.LAST_SYNC).toBe('reminders.offline.lastSync');
      expect(OFFLINE_STORE_KEYS.OFFLINE_STATE).toBe('reminders.offline.state');
    });
  });

  describe('initial state', () => {
    it('should have empty pendingErinnerungen', () => {
      // When (Act)
      const state = offlineStore.state;

      // Then (Assert)
      expect(state.pendingErinnerungen).toEqual([]);
    });

    it('should have empty syncQueue', () => {
      // When (Act)
      const state = offlineStore.state;

      // Then (Assert)
      expect(state.syncQueue).toEqual([]);
    });

    it('should have null lastSync', () => {
      // When (Act)
      const state = offlineStore.state;

      // Then (Assert)
      expect(state.lastSync).toBeNull();
    });

    it('should have isOffline false by default', () => {
      // When (Act)
      const state = offlineStore.state;

      // Then (Assert)
      expect(state.isOffline).toBe(false);
      expect(state.offlineSince).toBeNull();
    });
  });

  describe('addPendingErinnerung()', () => {
    it('should add pending erinnerung to store (AC1)', () => {
      // Given (Arrange)
      const erinnerung = createTestPendingErinnerung();

      // When (Act)
      addPendingErinnerung(erinnerung);

      // Then (Assert)
      expect(offlineStore.state.pendingErinnerungen).toHaveLength(1);
      expect(offlineStore.state.pendingErinnerungen[0]).toEqual(erinnerung);
    });

    it('should add multiple pending erinnerungen', () => {
      // Given (Arrange)
      const erinnerung1 = createTestPendingErinnerung({ id: 'temp_1' });
      const erinnerung2 = createTestPendingErinnerung({ id: 'temp_2' });

      // When (Act)
      addPendingErinnerung(erinnerung1);
      addPendingErinnerung(erinnerung2);

      // Then (Assert)
      expect(offlineStore.state.pendingErinnerungen).toHaveLength(2);
    });

    it('should not add duplicate erinnerung (same ID)', () => {
      // Given (Arrange)
      const erinnerung = createTestPendingErinnerung({ id: 'temp_1' });

      // When (Act)
      addPendingErinnerung(erinnerung);
      addPendingErinnerung(erinnerung);

      // Then (Assert)
      expect(offlineStore.state.pendingErinnerungen).toHaveLength(1);
    });
  });

  describe('removePendingErinnerung()', () => {
    it('should remove pending erinnerung by ID', () => {
      // Given (Arrange)
      const erinnerung = createTestPendingErinnerung({ id: 'temp_1' });
      addPendingErinnerung(erinnerung);
      expect(offlineStore.state.pendingErinnerungen).toHaveLength(1);

      // When (Act)
      removePendingErinnerung('temp_1');

      // Then (Assert)
      expect(offlineStore.state.pendingErinnerungen).toHaveLength(0);
    });

    it('should not throw when removing non-existent ID', () => {
      // When (Act) & Then (Assert)
      expect(() => removePendingErinnerung('non-existent')).not.toThrow();
    });
  });

  describe('getPendingErinnerungById()', () => {
    it('should return pending erinnerung by ID', () => {
      // Given (Arrange)
      const erinnerung = createTestPendingErinnerung({ id: 'temp_1' });
      addPendingErinnerung(erinnerung);

      // When (Act)
      const result = getPendingErinnerungById('temp_1');

      // Then (Assert)
      expect(result).toEqual(erinnerung);
    });

    it('should return undefined for non-existent ID', () => {
      // When (Act)
      const result = getPendingErinnerungById('non-existent');

      // Then (Assert)
      expect(result).toBeUndefined();
    });
  });

  describe('queueSyncAction()', () => {
    it('should add action to sync queue (AC2)', () => {
      // Given (Arrange)
      const action = createTestSyncAction();

      // When (Act)
      queueSyncAction(action);

      // Then (Assert)
      expect(offlineStore.state.syncQueue).toHaveLength(1);
      expect(offlineStore.state.syncQueue[0]).toEqual(action);
    });

    it('should add multiple actions in order', () => {
      // Given (Arrange)
      const action1 = createTestSyncAction({ id: 'action-1', timestamp: '2026-01-19T12:00:00.000Z' });
      const action2 = createTestSyncAction({ id: 'action-2', timestamp: '2026-01-19T12:01:00.000Z' });

      // When (Act)
      queueSyncAction(action1);
      queueSyncAction(action2);

      // Then (Assert)
      expect(offlineStore.state.syncQueue).toHaveLength(2);
      expect(offlineStore.state.syncQueue[0].id).toBe('action-1');
      expect(offlineStore.state.syncQueue[1].id).toBe('action-2');
    });

    it('should not add duplicate action (same ID)', () => {
      // Given (Arrange)
      const action = createTestSyncAction({ id: 'action-1' });

      // When (Act)
      queueSyncAction(action);
      queueSyncAction(action);

      // Then (Assert)
      expect(offlineStore.state.syncQueue).toHaveLength(1);
    });
  });

  describe('clearProcessedActions()', () => {
    it('should remove processed actions by IDs', () => {
      // Given (Arrange)
      const action1 = createTestSyncAction({ id: 'action-1' });
      const action2 = createTestSyncAction({ id: 'action-2' });
      const action3 = createTestSyncAction({ id: 'action-3' });
      queueSyncAction(action1);
      queueSyncAction(action2);
      queueSyncAction(action3);

      // When (Act)
      clearProcessedActions(['action-1', 'action-3']);

      // Then (Assert)
      expect(offlineStore.state.syncQueue).toHaveLength(1);
      expect(offlineStore.state.syncQueue[0].id).toBe('action-2');
    });

    it('should handle empty IDs array', () => {
      // Given (Arrange)
      const action = createTestSyncAction();
      queueSyncAction(action);

      // When (Act)
      clearProcessedActions([]);

      // Then (Assert)
      expect(offlineStore.state.syncQueue).toHaveLength(1);
    });
  });

  describe('setLastSync()', () => {
    it('should update lastSync timestamp', () => {
      // Given (Arrange)
      const timestamp = '2026-01-19T12:00:00.000Z';

      // When (Act)
      setLastSync(timestamp);

      // Then (Assert)
      expect(offlineStore.state.lastSync).toBe(timestamp);
    });

    it('should allow setting to null', () => {
      // Given (Arrange)
      setLastSync('2026-01-19T12:00:00.000Z');

      // When (Act)
      setLastSync(null);

      // Then (Assert)
      expect(offlineStore.state.lastSync).toBeNull();
    });
  });

  describe('setOfflineState()', () => {
    it('should update offline state', () => {
      // Given (Arrange)
      const offlineSince = '2026-01-19T12:00:00.000Z';

      // When (Act)
      setOfflineState(true, offlineSince);

      // Then (Assert)
      expect(offlineStore.state.isOffline).toBe(true);
      expect(offlineStore.state.offlineSince).toBe(offlineSince);
    });

    it('should clear offlineSince when going online', () => {
      // Given (Arrange)
      setOfflineState(true, '2026-01-19T12:00:00.000Z');

      // When (Act)
      setOfflineState(false, null);

      // Then (Assert)
      expect(offlineStore.state.isOffline).toBe(false);
      expect(offlineStore.state.offlineSince).toBeNull();
    });
  });

  describe('resetOfflineStore()', () => {
    it('should reset all state to initial values', () => {
      // Given (Arrange)
      addPendingErinnerung(createTestPendingErinnerung());
      queueSyncAction(createTestSyncAction());
      setLastSync('2026-01-19T12:00:00.000Z');
      setOfflineState(true, '2026-01-19T11:00:00.000Z');

      // When (Act)
      resetOfflineStore();

      // Then (Assert)
      expect(offlineStore.state.pendingErinnerungen).toEqual([]);
      expect(offlineStore.state.syncQueue).toEqual([]);
      expect(offlineStore.state.lastSync).toBeNull();
      expect(offlineStore.state.isOffline).toBe(false);
      expect(offlineStore.state.offlineSince).toBeNull();
    });
  });

  describe('SyncQueueAction types', () => {
    it('should support create action', () => {
      // Given (Arrange)
      const action = createTestSyncAction({ action: 'create' });

      // When (Act)
      queueSyncAction(action);

      // Then (Assert)
      expect(offlineStore.state.syncQueue[0].action).toBe('create');
    });

    it('should support trigger action', () => {
      // Given (Arrange)
      const action = createTestSyncAction({ action: 'trigger' });

      // When (Act)
      queueSyncAction(action);

      // Then (Assert)
      expect(offlineStore.state.syncQueue[0].action).toBe('trigger');
    });

    it('should support acknowledge action', () => {
      // Given (Arrange)
      const action = createTestSyncAction({ action: 'acknowledge' });

      // When (Act)
      queueSyncAction(action);

      // Then (Assert)
      expect(offlineStore.state.syncQueue[0].action).toBe('acknowledge');
    });

    it('should support update action', () => {
      // Given (Arrange)
      const action = createTestSyncAction({ action: 'update' });

      // When (Act)
      queueSyncAction(action);

      // Then (Assert)
      expect(offlineStore.state.syncQueue[0].action).toBe('update');
    });
  });

  describe('retryCount tracking', () => {
    it('should preserve retryCount in queue', () => {
      // Given (Arrange)
      const action = createTestSyncAction({ retryCount: 2 });

      // When (Act)
      queueSyncAction(action);

      // Then (Assert)
      expect(offlineStore.state.syncQueue[0].retryCount).toBe(2);
    });
  });

  describe('React hooks exports', () => {
    it('should export usePendingErinnerungen hook', () => {
      // Then (Assert)
      expect(typeof usePendingErinnerungen).toBe('function');
    });

    it('should export useSyncQueueCount hook', () => {
      // Then (Assert)
      expect(typeof useSyncQueueCount).toBe('function');
    });

    it('should export useLastSync hook', () => {
      // Then (Assert)
      expect(typeof useLastSync).toBe('function');
    });

    it('should export useOfflineState hook', () => {
      // Then (Assert)
      expect(typeof useOfflineState).toBe('function');
    });
  });
});
