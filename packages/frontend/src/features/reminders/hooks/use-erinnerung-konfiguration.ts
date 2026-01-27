import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBaseUrl } from '@/shared/api/api';
import { fetchWithRefresh } from '@/shared/api/fetchWithRefresh';

// Temporary local DTOs until API generation works
export interface ErinnerungKonfigurationDto {
  eskalationsTimeoutSeconds: number;
  eskalationsTimeoutMinutes: number;
}

export interface UpdateEskalationsTimeoutDto {
  timeoutMinutes: number;
}

const QUERY_KEY = ['erinnerung-konfiguration'];

export function useErinnerungKonfiguration() {
  const queryClient = useQueryClient();

  const fetchConfig = async (): Promise<ErinnerungKonfigurationDto> => {
    // TODO: Refactor to generated client once api is regenerated
    const url = `${getBaseUrl()}/api/v-alpha/erinnerung/config`;
    const response = await fetchWithRefresh(url);

    if (!response.ok) throw new Error('Failed to fetch config');
    const json = await response.json();
    return json;
  };

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchConfig,
  });

  const updateTimeoutMutation = useMutation({
    mutationFn: async (dto: UpdateEskalationsTimeoutDto) => {
      // TODO: Refactor to generated client once api is regenerated
      const url = `${getBaseUrl()}/api/v-alpha/erinnerung/config/timeout`;
      const response = await fetchWithRefresh(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dto),
      });
      if (!response.ok) throw new Error('Failed to update timeout');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  return {
    config: query.data,
    isLoading: query.isLoading,
    updateTimeout: updateTimeoutMutation.mutate,
    isUpdating: updateTimeoutMutation.isPending,
  };
}
