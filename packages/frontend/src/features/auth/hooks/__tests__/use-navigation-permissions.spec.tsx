/**
 * Unit Tests fuer useNavigationPermissions Hook
 *
 * Verifiziert:
 * - Query-Key Konfiguration
 * - StaleTime (5 Minuten)
 * - Retry-Logik (kein Retry bei 4xx Client-Fehlern)
 * - API-Aufruf und Response-Extraktion (.data)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock fuer API
const { mockGetPermissions } = vi.hoisted(() => ({
  mockGetPermissions: vi.fn(),
}));

// Mock API Client
vi.mock('@/shared', () => ({
  api: {
    navigation: () => ({
      navigationPermissionsControllerGetPermissionsVAlpha: mockGetPermissions,
    }),
  },
}));

import { NAVIGATION_PERMISSIONS_KEY, useNavigationPermissions } from '../use-navigation-permissions';

describe('useNavigationPermissions query configuration', () => {
  it('exportiert den korrekten Query-Key', () => {
    expect(NAVIGATION_PERMISSIONS_KEY).toEqual(['navigation', 'permissions']);
  });

  it('Query-Key ist readonly (as const)', () => {
    // TypeScript Compile-Check: Key ist readonly Tuple
    const key: readonly ['navigation', 'permissions'] = NAVIGATION_PERMISSIONS_KEY;
    expect(key).toEqual(['navigation', 'permissions']);
  });
});

describe('useNavigationPermissions Hook', () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    return ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

  const mockPermissions = [
    { area: 'stammdaten', accessible: true, reason: null },
    { area: 'einsaetze', accessible: true, reason: null },
    { area: 'admin', accessible: false, reason: 'Nur fuer Administratoren' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('ruft die API auf und gibt die Permissions zurueck', async () => {
    mockGetPermissions.mockResolvedValue({ data: mockPermissions });

    const { result } = renderHook(() => useNavigationPermissions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockPermissions);
    expect(mockGetPermissions).toHaveBeenCalledTimes(1);
  });

  it('extrahiert .data aus der Response', async () => {
    const wrappedResponse = { data: mockPermissions, meta: { extraField: true } };
    mockGetPermissions.mockResolvedValue(wrappedResponse);

    const { result } = renderHook(() => useNavigationPermissions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Gibt nur .data zurueck, nicht die gesamte Response
    expect(result.current.data).toEqual(mockPermissions);
  });

  it('cacht Daten unter dem korrekten Key', async () => {
    mockGetPermissions.mockResolvedValue({ data: mockPermissions });

    const { result } = renderHook(() => useNavigationPermissions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const cachedData = queryClient.getQueryData(NAVIGATION_PERMISSIONS_KEY);
    expect(cachedData).toEqual(mockPermissions);
  });

  it('konfiguriert staleTime von 5 Minuten', async () => {
    mockGetPermissions.mockResolvedValue({ data: mockPermissions });

    const { result } = renderHook(() => useNavigationPermissions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Pruefe den tatsaechlichen staleTime-Wert ueber die Query-Cache-Observers
    const queries = queryClient.getQueryCache().findAll({
      queryKey: NAVIGATION_PERMISSIONS_KEY,
    });
    expect(queries).toHaveLength(1);

    const observers = queries[0].observers;
    expect(observers).toHaveLength(1);
    expect(observers[0].options.staleTime).toBe(5 * 60 * 1000);
  });

  it('retried nicht bei Client-Fehlern (4xx)', async () => {
    // Erstelle einen QueryClient der die Retry-Logik des Hooks respektiert
    const retryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Kein globaler retry-override, damit der Hook-eigene retry greift
        },
      },
    });

    const createRetryWrapper = () => {
      return ({ children }: PropsWithChildren) => <QueryClientProvider client={retryClient}>{children}</QueryClientProvider>;
    };

    // Simuliere ResponseError mit 403 Status
    const { ResponseError } = await import('@bluelight-hub/shared/client');
    const mockResponse = new Response(null, { status: 403 });
    const error = new ResponseError(mockResponse, 'Forbidden');

    mockGetPermissions.mockRejectedValue(error);

    const { result } = renderHook(() => useNavigationPermissions(), {
      wrapper: createRetryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Nur 1 Aufruf = kein Retry bei 4xx
    expect(mockGetPermissions).toHaveBeenCalledTimes(1);

    retryClient.clear();
  });

  it('retried bei Server-Fehlern (5xx) bis zu 2 Mal', async () => {
    const retryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // Kein globaler retry-override, aber retryDelay=0 fuer schnelle Tests
          retryDelay: 0,
        },
      },
    });

    const createRetryWrapper = () => {
      return ({ children }: PropsWithChildren) => <QueryClientProvider client={retryClient}>{children}</QueryClientProvider>;
    };

    // Simuliere ResponseError mit 500 Status
    const { ResponseError } = await import('@bluelight-hub/shared/client');
    const mockResponse = new Response(null, { status: 500 });
    const error = new ResponseError(mockResponse, 'Internal Server Error');

    mockGetPermissions.mockRejectedValue(error);

    const { result } = renderHook(() => useNavigationPermissions(), {
      wrapper: createRetryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 5000 });

    // Initial + 2 Retries = 3 Aufrufe
    expect(mockGetPermissions).toHaveBeenCalledTimes(3);

    retryClient.clear();
  });
});
