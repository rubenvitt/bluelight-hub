import { useMemo } from 'react';
import { useStore } from '@tanstack/react-store';
import { serverStore } from '../stores/server.store';
import type { ServerConfig } from '../types/server-config';

/**
 * Hook für sortierte Server-Liste (nach lastUsedAt, neueste zuerst).
 *
 * Nutzt useMemo um Sorting zu optimieren - nur neu-sortieren wenn
 * servers Array sich ändert.
 *
 * @returns Sortiertes Array aller Server-Konfigurationen
 *
 * @example
 * ```typescript
 * function ServerList() {
 *   const servers = useServerList();
 *
 *   if (servers.length === 0) {
 *     return <div>Keine Server konfiguriert</div>;
 *   }
 *
 *   return (
 *     <ul>
 *       {servers.map(server => (
 *         <li key={server.id}>
 *           {server.name} - {server.url}
 *           {server.isDefault && <Badge>Default</Badge>}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useServerList(): ServerConfig[] {
  const servers = useStore(serverStore, (state) => state.servers);

  // Memoize sorting - only re-sort when servers array reference changes
  return useMemo(() => {
    return [...servers].sort((a, b) => {
      const aTime = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bTime = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [servers]);
}
