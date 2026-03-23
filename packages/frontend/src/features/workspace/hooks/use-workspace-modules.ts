import { EINSATZ_WORKSPACE_MODULES } from '../registry';
import type { WorkspaceModuleDefinition } from '../types';
import { useMemo } from 'react';
import { useNavigationPermissions } from '@/features/auth/hooks';

/**
 * Mappt Workspace-Modul-IDs auf Backend Navigation-Permission Areas.
 * Module ohne Mapping sind fuer alle authentifizierten Benutzer zugaenglich.
 *
 * `führung` mappt auf `etb` weil das Fuehrungsmodul aktuell als Ganzes
 * ueber die ETB-Permission gesteuert wird.
 */
// TODO: Test-Abdeckung für Permission-Integration ergänzen
const MODULE_PERMISSION_MAP: Record<string, string> = {
  übersicht: 'ueberblick',
  führung: 'etb',
};

export function useWorkspaceModules(): WorkspaceModuleDefinition[] {
  const { data: permissions } = useNavigationPermissions();

  return useMemo(() => {
    const sorted = [...EINSATZ_WORKSPACE_MODULES].sort((left, right) => left.priority - right.priority);

    if (!permissions) return sorted;

    return sorted.map((module) => {
      const permissionArea = MODULE_PERMISSION_MAP[module.id];
      if (!permissionArea) return module;

      const permission = permissions.find((p) => p.area === permissionArea);
      if (permission && !permission.accessible) {
        return {
          ...module,
          visibility: {
            default: 'disabled' as const,
            reason: (permission.reason as string) ?? 'Dieser Bereich ist für Ihre Rolle nicht freigegeben',
          },
        };
      }

      return module;
    });
  }, [permissions]);
}
