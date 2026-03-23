import { useNavigationPermissions } from './use-navigation-permissions';

/**
 * Convenience-Hook zur Pruefung ob ein Navigationsbereich zugaenglich ist.
 *
 * Story 5.1 AC1/AC2: Nutzt den Cache von useNavigationPermissions()
 * und gibt fuer einen spezifischen Bereich den Zugang zurueck.
 *
 * @param area - Identifikator des Navigationsbereichs (z.B. 'stammdaten')
 * @returns Zugangs-Information mit isLoading, accessible und reason
 */
export function useCanAccess(area: string) {
  const { data, isLoading } = useNavigationPermissions();

  if (isLoading || !data) {
    return { accessible: false, reason: null, isLoading };
  }

  const permission = data.find((p) => p.area === area);

  return {
    accessible: permission?.accessible ?? false,
    reason: (permission?.reason as string | null) ?? null,
    isLoading: false,
  };
}
