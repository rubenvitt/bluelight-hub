/**
 * Unit Tests fuer Sync Service
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 1.8 AC3:**
 * - Sync Queue Processing bei Reconnect
 * - ID-Mapping von temp_ zu Server-IDs
 * - Last-Write-Wins Conflict Resolution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncService, syncService } from '../sync.service';
import { offlineStore, resetOfflineStore, addPendingErinnerung, queueSyncAction, type PendingErinnerung } from '../../stores/offline.store';

// Mock the API
vi.mock('@/shared', () => ({
  api: {
    erinnerungen: () => ({
      erinnerungControllerCreateVAlpha: vi.fn(),
      erinnerungControllerTriggerVAlpha: vi.fn(),
      erinnerungControllerAcknowledgeVAlpha: vi.fn(),
    }),
  },
}));

// Mock the query client
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

describe('SyncService', () => {
  let service: SyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetOfflineStore();
    service = new SyncService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create singleton instance', () => {
      // Then (Assert)
      expect(syncService).toBeInstanceOf(SyncService);
    });
  });

  describe('hasPendingSync()', () => {
    it('should return false when no pending items', () => {
      // When (Act)
      const result = service.hasPendingSync();

      // Then (Assert)
      expect(result).toBe(false);
    });

    it('should return true when pending erinnerungen exist', () => {
      // Given (Arrange)
      addPendingErinnerung({
        id: 'temp_1',
        einsatzId: 'einsatz-1',
        titel: 'Test',
        beschreibung: null,
        faelligAm: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      // When (Act)
      const result = service.hasPendingSync();

      // Then (Assert)
      expect(result).toBe(true);
    });

    it('should return true when sync queue has items', () => {
      // Given (Arrange)
      queueSyncAction({
        id: 'action-1',
        action: 'trigger',
        erinnerungId: 'erin-1',
        payload: {},
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      // When (Act)
      const result = service.hasPendingSync();

      // Then (Assert)
      expect(result).toBe(true);
    });
  });

  describe('getPendingCount()', () => {
    it('should return 0 when empty', () => {
      // When (Act)
      const result = service.getPendingCount();

      // Then (Assert)
      expect(result).toBe(0);
    });

    it('should count pending erinnerungen and queue actions', () => {
      // Given (Arrange)
      addPendingErinnerung({
        id: 'temp_1',
        einsatzId: 'einsatz-1',
        titel: 'Test 1',
        beschreibung: null,
        faelligAm: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      addPendingErinnerung({
        id: 'temp_2',
        einsatzId: 'einsatz-1',
        titel: 'Test 2',
        beschreibung: null,
        faelligAm: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      queueSyncAction({
        id: 'action-1',
        action: 'trigger',
        erinnerungId: 'erin-1',
        payload: {},
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });

      // When (Act)
      const result = service.getPendingCount();

      // Then (Assert)
      expect(result).toBe(3); // 2 pending + 1 queue action
    });
  });

  describe('generateTempId()', () => {
    it('should generate ID with temp_ prefix', () => {
      // When (Act)
      const id = service.generateTempId();

      // Then (Assert)
      expect(id.startsWith('temp_')).toBe(true);
    });

    it('should generate unique IDs', () => {
      // When (Act)
      const id1 = service.generateTempId();
      const id2 = service.generateTempId();

      // Then (Assert)
      expect(id1).not.toBe(id2);
    });
  });

  describe('isTempId()', () => {
    it('should return true for temp_ prefixed IDs', () => {
      // When (Act) & Then (Assert)
      expect(service.isTempId('temp_abc-123')).toBe(true);
    });

    it('should return false for regular IDs', () => {
      // When (Act) & Then (Assert)
      expect(service.isTempId('abc-123')).toBe(false);
    });
  });

  describe('queueCreateAction()', () => {
    it('should add pending erinnerung and queue action', () => {
      // Given (Arrange)
      const pendingErinnerung: PendingErinnerung = {
        id: 'temp_1',
        einsatzId: 'einsatz-1',
        titel: 'Test',
        beschreibung: 'Beschreibung',
        faelligAm: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      // When (Act)
      service.queueCreateAction(pendingErinnerung);

      // Then (Assert)
      expect(offlineStore.state.pendingErinnerungen).toHaveLength(1);
      expect(offlineStore.state.syncQueue).toHaveLength(1);
      expect(offlineStore.state.syncQueue[0].action).toBe('create');
    });
  });

  describe('queueTriggerAction()', () => {
    it('should queue trigger action with einsatzId', () => {
      // When (Act)
      service.queueTriggerAction('erin-1', 'einsatz-1');

      // Then (Assert)
      expect(offlineStore.state.syncQueue).toHaveLength(1);
      expect(offlineStore.state.syncQueue[0].action).toBe('trigger');
      expect(offlineStore.state.syncQueue[0].erinnerungId).toBe('erin-1');
      expect(offlineStore.state.syncQueue[0].payload).toEqual({ einsatzId: 'einsatz-1' });
    });
  });

  describe('queueAcknowledgeAction()', () => {
    it('should queue acknowledge action with einsatzId', () => {
      // When (Act)
      service.queueAcknowledgeAction('erin-1', 'einsatz-1');

      // Then (Assert)
      expect(offlineStore.state.syncQueue).toHaveLength(1);
      expect(offlineStore.state.syncQueue[0].action).toBe('acknowledge');
      expect(offlineStore.state.syncQueue[0].erinnerungId).toBe('erin-1');
      expect(offlineStore.state.syncQueue[0].payload).toEqual({ einsatzId: 'einsatz-1' });
    });
  });

  describe('getIdMapping()', () => {
    it('should return empty map initially', () => {
      // When (Act)
      const mapping = service.getIdMapping();

      // Then (Assert)
      expect(mapping.size).toBe(0);
    });
  });

  describe('clearIdMapping()', () => {
    it('should clear the ID mapping', () => {
      // Given (Arrange) - Add a mapping internally
      // (In real impl this would be set during sync)

      // When (Act)
      service.clearIdMapping();

      // Then (Assert)
      expect(service.getIdMapping().size).toBe(0);
    });
  });
});
