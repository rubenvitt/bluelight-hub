/**
 * Befehl API Feature - Public Exports
 *
 * Zentrale Export-Datei für alle Befehl-API-Funktionen.
 */

// Query Keys & Utilities
export { BEFEHL_QUERY_KEYS, calculateRetryDelay, hasActiveQueryFilters, toQueryFilters, type BefehleQueryFilters } from './queries';

// Query Hooks
export { useBefehlHistorie } from './use-befehl-historie';
export { useBefehleByEinsatz } from './use-befehle-by-einsatz';
export { useEmpfaengerSuche } from './use-empfaenger-suche';
export { useBefehlsgeberSuche } from './use-befehlsgeber-suche';
export { useMeineBefehle } from './use-meine-befehle';

// Filtered Query Hooks
export { useOffeneRueckfragen } from './use-offene-rueckfragen';

// Einsatz-Rolle Query Hook (Story 4.2)
export { useMyEinsatzRolle, MEINE_EINSATZ_ROLLE_KEY } from './use-my-einsatz-rolle';

// Mutation Hooks
export { useAddBefehlKommentar } from './use-add-befehl-kommentar';
export { useAendereEmpfaengerStatus, type AendereEmpfaengerStatusInput } from './use-aendere-empfaenger-status';
export { useCreateBefehl } from './use-create-befehl';
export { useKorrigiereBefehl } from './use-korrigiere-befehl';
export { useQuittierenBefehl } from './use-quittieren-befehl';

// WebSocket Hook & Types
export {
  useBefehlWebSocket,
  useBefehlWebSocketStatus,
  type BefehlErstelltPayload,
  type BefehlZugestelltPayload,
  type BefehlKommentarHinzugefuegtPayload,
  type BefehlQuittiertPayload,
  type BefehlStatusGeaendertPayload,
  type WebSocketStatus,
  type UseBefehlWebSocketOptions,
  type UseBefehlWebSocketReturn,
} from './use-befehl-websocket';

// Notification Hook
export { useBefehlNotifications } from './use-befehl-notifications';

// Export Hook
export { useExportBefehle } from './use-export-befehle';

// Integration Status Store & Types (Story 5.3)
export {
  useDegradedIntegrations,
  useHasDegradedIntegrations,
  integrationStatusStore,
  updateIntegrationStatus,
  resetIntegrationStatus,
  type CircuitState,
  type IntegrationStatus,
  type IntegrationStatusStoreState,
} from './use-integration-status';

// Integration Health Query Hook (Story 5.3 AC4)
export {
  useIntegrationHealth,
  INTEGRATION_HEALTH_KEY,
  type IntegrationStatusEntry,
  type IntegrationHealthResponse,
} from './use-integration-health';
