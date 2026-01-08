import { describe, it, expect, beforeEach, vi } from 'vitest';
import { serverStore, addServer, setActiveServer, removeServer, hydrateServerStore, updateConnectionStatus } from '../server.store';
import * as persistence from '../server-persistence';
import type { ServerConfig } from '../../types/server-config';

// Mock Storage Adapter
vi.mock('@/shared/services/storage/storage-adapter.factory', () => ({
  getStorageAdapter: vi.fn(() => ({
    setItem: vi.fn(),
    getItem: vi.fn(),
  })),
}));

// Mock Persistence Functions
vi.mock('../server-persistence', () => ({
  saveServers: vi.fn(),
  loadServers: vi.fn(),
}));

describe('serverStore', () => {
  beforeEach(() => {
    // Reset Store State vor jedem Test
    serverStore.setState({
      servers: [],
      activeServerId: null,
      connectionStatus: new Map(),
      isHydrated: false,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('addServer()', () => {
    it('should add server and sync to storage', async () => {
      // Given
      const config = { name: 'Test Server', url: 'https://test.com', isDefault: false, lastUsedAt: null };

      // When
      await addServer(config);

      // Then
      expect(serverStore.state.servers).toHaveLength(1);
      expect(serverStore.state.servers[0].name).toBe('Test Server');
      expect(serverStore.state.servers[0].url).toBe('https://test.com');
      expect(serverStore.state.servers[0].id).toBeDefined();
      expect(serverStore.state.servers[0].createdAt).toBeDefined();
      expect(serverStore.state.servers[0].lastUsedAt).toBeDefined();
      expect(persistence.saveServers).toHaveBeenCalledWith(serverStore.state.servers);
    });

    it('should throw error for invalid URL', async () => {
      // Given - HTTP statt HTTPS
      const config = { name: 'Test', url: 'http://test.com', isDefault: false, lastUsedAt: null };

      // When/Then
      await expect(addServer(config)).rejects.toThrow('Invalid server URL');
    });

    it('should throw error for empty name', async () => {
      // Given
      const config = { name: '', url: 'https://test.com', isDefault: false, lastUsedAt: null };

      // When/Then
      await expect(addServer(config)).rejects.toThrow('Server name must be at least 1 character long');
    });

    it('should allow localhost for development', async () => {
      // Given
      const config = { name: 'Local Dev', url: 'http://localhost:3091', isDefault: false, lastUsedAt: null };

      // When
      await addServer(config);

      // Then
      expect(serverStore.state.servers).toHaveLength(1);
      expect(serverStore.state.servers[0].url).toBe('http://localhost:3091');
    });
  });

  describe('setActiveServer()', () => {
    it('should set active server and update isDefault', async () => {
      // Given
      const server1: ServerConfig = {
        id: '1',
        name: 'Server 1',
        url: 'https://server1.com',
        isDefault: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastUsedAt: '2025-01-01T00:00:00.000Z',
      };
      const server2: ServerConfig = {
        id: '2',
        name: 'Server 2',
        url: 'https://server2.com',
        isDefault: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastUsedAt: '2025-01-01T00:00:00.000Z',
      };

      serverStore.setState((state) => ({
        ...state,
        servers: [server1, server2],
        activeServerId: '1',
      }));

      // When
      await setActiveServer('2');

      // Then
      expect(serverStore.state.activeServerId).toBe('2');
      expect(serverStore.state.servers[0].isDefault).toBe(false); // Server 1
      expect(serverStore.state.servers[1].isDefault).toBe(true); // Server 2
      expect(persistence.saveServers).toHaveBeenCalledWith(serverStore.state.servers);
    });

    it('should throw error for non-existent server ID', async () => {
      // Given
      const server: ServerConfig = {
        id: '1',
        name: 'Server 1',
        url: 'https://server1.com',
        isDefault: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastUsedAt: '2025-01-01T00:00:00.000Z',
      };

      serverStore.setState((state) => ({
        ...state,
        servers: [server],
      }));

      // When/Then
      await expect(setActiveServer('non-existent-id')).rejects.toThrow('Server with id "non-existent-id" does not exist');
    });

    it('should update lastUsedAt timestamp', async () => {
      // Use fake timers for deterministic timing
      vi.useFakeTimers();
      const initialTime = new Date('2025-01-08T11:00:00.000Z');
      vi.setSystemTime(initialTime);

      // Given: Server with old timestamp
      const oldTimestamp = '2025-01-01T00:00:00.000Z';
      const server: ServerConfig = {
        id: '1',
        name: 'Server 1',
        url: 'https://server1.com',
        isDefault: true,
        createdAt: oldTimestamp,
        lastUsedAt: oldTimestamp,
      };

      serverStore.setState((state) => ({
        ...state,
        servers: [server],
        activeServerId: '1',
      }));

      // When: Advance time and set active
      const newTime = new Date('2025-01-08T12:01:00.000Z');
      vi.setSystemTime(newTime);
      await setActiveServer('1');

      // Then: Timestamp should match exact new time
      const updatedServer = serverStore.state.servers[0];
      expect(updatedServer.lastUsedAt).toBe(newTime.toISOString());

      // Cleanup
      vi.useRealTimers();
    });
  });

  describe('removeServer()', () => {
    it('should remove server and sync to storage', async () => {
      // Given
      const server: ServerConfig = {
        id: '1',
        name: 'Server 1',
        url: 'https://server1.com',
        isDefault: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastUsedAt: '2025-01-01T00:00:00.000Z',
      };

      serverStore.setState((state) => ({
        ...state,
        servers: [server],
        activeServerId: '1',
      }));

      // When
      await removeServer('1');

      // Then
      expect(serverStore.state.servers).toHaveLength(0);
      expect(serverStore.state.activeServerId).toBeNull();
      expect(persistence.saveServers).toHaveBeenCalledWith([]);
    });

    it('should fallback to first server when active server is deleted', async () => {
      // Given
      const server1: ServerConfig = {
        id: '1',
        name: 'Server 1',
        url: 'https://server1.com',
        isDefault: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastUsedAt: '2025-01-01T00:00:00.000Z',
      };
      const server2: ServerConfig = {
        id: '2',
        name: 'Server 2',
        url: 'https://server2.com',
        isDefault: false,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastUsedAt: '2025-01-01T00:00:00.000Z',
      };

      serverStore.setState((state) => ({
        ...state,
        servers: [server1, server2],
        activeServerId: '1',
      }));

      // When
      await removeServer('1');

      // Then
      expect(serverStore.state.servers).toHaveLength(1);
      expect(serverStore.state.activeServerId).toBe('2');
      expect(serverStore.state.servers[0].isDefault).toBe(true); // Server 2 is now default
    });

    it('should set activeServerId to null when last server is deleted', async () => {
      // Given
      const server: ServerConfig = {
        id: '1',
        name: 'Server 1',
        url: 'https://server1.com',
        isDefault: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastUsedAt: '2025-01-01T00:00:00.000Z',
      };

      serverStore.setState((state) => ({
        ...state,
        servers: [server],
        activeServerId: '1',
      }));

      // When
      await removeServer('1');

      // Then
      expect(serverStore.state.servers).toHaveLength(0);
      expect(serverStore.state.activeServerId).toBeNull();
    });
  });

  describe('hydrateServerStore()', () => {
    it('should load servers from storage and set default server active', async () => {
      // Given
      const servers: ServerConfig[] = [
        {
          id: '1',
          name: 'Server 1',
          url: 'https://server1.com',
          isDefault: false,
          createdAt: '2025-01-01T00:00:00.000Z',
          lastUsedAt: '2025-01-01T00:00:00.000Z',
        },
        {
          id: '2',
          name: 'Server 2',
          url: 'https://server2.com',
          isDefault: true,
          createdAt: '2025-01-01T00:00:00.000Z',
          lastUsedAt: '2025-01-01T00:00:00.000Z',
        },
      ];

      vi.mocked(persistence.loadServers).mockResolvedValue(servers);

      // When
      await hydrateServerStore();

      // Then
      expect(serverStore.state.servers).toEqual(servers);
      expect(serverStore.state.activeServerId).toBe('2');
      expect(serverStore.state.isHydrated).toBe(true);
    });

    it('should skip hydration if already hydrated (race condition protection)', async () => {
      // Given
      serverStore.setState((state) => ({
        ...state,
        isHydrated: true,
      }));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // When
      await hydrateServerStore();

      // Then
      expect(consoleWarnSpy).toHaveBeenCalledWith('[ServerStore] Already hydrated, skipping...');
      expect(persistence.loadServers).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle empty storage gracefully', async () => {
      // Given
      vi.mocked(persistence.loadServers).mockResolvedValue([]);

      // When
      await hydrateServerStore();

      // Then
      expect(serverStore.state.servers).toEqual([]);
      expect(serverStore.state.activeServerId).toBeNull();
      expect(serverStore.state.isHydrated).toBe(true);
    });

    it('should handle storage errors gracefully', async () => {
      // Given
      vi.mocked(persistence.loadServers).mockRejectedValue(new Error('Storage error'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // When
      await hydrateServerStore();

      // Then
      expect(consoleWarnSpy).toHaveBeenCalledWith('[ServerStore] Hydration failed:', expect.any(Error));
      expect(serverStore.state.servers).toEqual([]);
      expect(serverStore.state.isHydrated).toBe(false); // Bleibt false bei Fehler

      consoleWarnSpy.mockRestore();
    });
  });

  describe('updateConnectionStatus()', () => {
    it('should update connection status synchronously', () => {
      // Given
      const server: ServerConfig = {
        id: '1',
        name: 'Server 1',
        url: 'https://server1.com',
        isDefault: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastUsedAt: '2025-01-01T00:00:00.000Z',
      };

      serverStore.setState((state) => ({
        ...state,
        servers: [server],
      }));

      // When
      updateConnectionStatus('1', 'checking');

      // Then
      expect(serverStore.state.connectionStatus.get('1')).toBe('checking');

      // When
      updateConnectionStatus('1', 'connected');

      // Then
      expect(serverStore.state.connectionStatus.get('1')).toBe('connected');
    });

    it('should not persist to storage (in-memory only)', () => {
      // Given
      const server: ServerConfig = {
        id: '1',
        name: 'Server 1',
        url: 'https://server1.com',
        isDefault: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        lastUsedAt: '2025-01-01T00:00:00.000Z',
      };

      serverStore.setState((state) => ({
        ...state,
        servers: [server],
      }));

      // When
      updateConnectionStatus('1', 'connected');

      // Then
      expect(persistence.saveServers).not.toHaveBeenCalled();
    });
  });
});
