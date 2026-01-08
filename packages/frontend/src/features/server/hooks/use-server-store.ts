import { useStore } from '@tanstack/react-store';
import { addServer, hydrateServerStore, removeServer, serverStore, setActiveServer, updateConnectionStatus } from '../stores/server.store';

/**
 * Wrapper Hook für den kompletten Server Store.
 *
 * ⚠️ WARNUNG: Dieser Hook subscribt den GESAMTEN Store-State!
 * Komponente re-rendert bei JEDER Store-Änderung (auch connectionStatus).
 *
 * **Performance:** Für optimierte Re-Renders nutze spezialisierte Hooks:
 * - `useActiveServer()` - Nur bei aktivem Server Änderung
 * - `useServerList()` - Nur bei Server-Liste Änderung
 * - `useConnectionStatus(id)` - Nur bei Status-Änderung des EINEN Servers
 *
 * **Verwendung:** Nur für Settings-Seiten oder Komponenten die ALLE
 * Server-Daten benötigen.
 *
 * @returns Server Store State mit allen Actions
 *
 * @example
 * ```typescript
 * // ❌ SCHLECHT: In Listen-Item (re-rendert bei jedem Server)
 * function ServerItem({ id }) {
 *   const { servers } = useServerStore(); // Re-renders für ALLE servers
 *   const server = servers.find(s => s.id === id);
 * }
 *
 * // ✅ GUT: Nutze spezialisierten Hook
 * function ServerItem({ id }) {
 *   const server = useServerById(id); // Nur bei DIESEM Server
 * }
 *
 * // ✅ GUT: Settings-Page benötigt alles
 * function ServerSettingsPage() {
 *   const {
 *     servers,
 *     activeServer,
 *     addServer,
 *     setActiveServer,
 *     removeServer
 *   } = useServerStore();
 *
 *   const handleAddServer = async () => {
 *     await addServer({
 *       name: 'Neuer Server',
 *       url: 'https://api.example.com',
 *       isDefault: false
 *     });
 *   };
 *
 *   const handleSelectServer = async (serverId: string) => {
 *     await setActiveServer(serverId);
 *   };
 *
 *   return (
 *     <div>
 *       <h2>Aktiver Server: {activeServer?.name ?? 'Keiner'}</h2>
 *       <ul>
 *         {servers.map(server => (
 *           <li key={server.id}>
 *             {server.name}
 *             <button onClick={() => handleSelectServer(server.id)}>
 *               Aktivieren
 *             </button>
 *             <button onClick={() => removeServer(server.id)}>
 *               Löschen
 *             </button>
 *           </li>
 *         ))}
 *       </ul>
 *       <button onClick={handleAddServer}>Server hinzufügen</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useServerStore() {
  const state = useStore(serverStore);

  return {
    // State Selectors
    servers: state.servers,
    activeServerId: state.activeServerId,
    activeServer: state.servers.find((s) => s.id === state.activeServerId) ?? null,
    connectionStatus: state.connectionStatus,
    isHydrated: state.isHydrated,

    // Actions
    addServer,
    setActiveServer,
    removeServer,
    hydrateServerStore,
    updateConnectionStatus,
  };
}
