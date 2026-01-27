import type React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useErinnerungKonfiguration } from '../use-erinnerung-konfiguration';
import { vi, type Mock, describe, beforeEach, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock fetchWithRefresh
vi.mock('@/shared/api/fetchWithRefresh', () => ({
  fetchWithRefresh: vi.fn(),
}));

import { fetchWithRefresh } from '@/shared/api/fetchWithRefresh';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

describe('useErinnerungKonfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it('should fetch configuration', async () => {
    const mockConfig = { eskalationsTimeoutMinutes: 10, eskalationsTimeoutSeconds: 600 };
    (fetchWithRefresh as Mock).mockResolvedValue({
      ok: true,
      json: async () => mockConfig,
    });

    const { result } = renderHook(() => useErinnerungKonfiguration(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.config).toEqual(mockConfig);
    expect(fetchWithRefresh).toHaveBeenCalledWith(expect.stringContaining('/api/v-alpha/erinnerung/config'));
  });

  it('should update timeout', async () => {
    const mockConfig = { eskalationsTimeoutMinutes: 10, eskalationsTimeoutSeconds: 600 };
    (fetchWithRefresh as Mock).mockResolvedValue({
      ok: true,
      json: async () => mockConfig,
    });

    const { result } = renderHook(() => useErinnerungKonfiguration(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    (fetchWithRefresh as Mock).mockResolvedValueOnce({
      ok: true,
    });

    await result.current.updateTimeout({ timeoutMinutes: 15 });

    await waitFor(() =>
      expect(fetchWithRefresh).toHaveBeenCalledWith(
        expect.stringContaining('/api/v-alpha/erinnerung/config/timeout'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ timeoutMinutes: 15 }),
        }),
      ),
    );
  });
});
