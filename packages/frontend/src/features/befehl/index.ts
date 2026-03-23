/**
 * Befehl Feature - Public API
 *
 * Zentrale Export-Datei für das gesamte Befehl-Feature.
 */

// ============================================
// API Layer (Queries & Mutations)
// ============================================
export {
  // Query Keys & Utilities
  BEFEHL_QUERY_KEYS,
  calculateRetryDelay,
  hasActiveQueryFilters,
  toQueryFilters,
  type BefehleQueryFilters,
  // Query Hooks
  useBefehlHistorie,
  useBefehleByEinsatz,
  useEmpfaengerSuche,
  useMeineBefehle,
  // Filtered Query Hooks
  useOffeneRueckfragen,
  // Mutation Hooks
  useAddBefehlKommentar,
  useAendereEmpfaengerStatus,
  type AendereEmpfaengerStatusInput,
  useCreateBefehl,
  useKorrigiereBefehl,
  useQuittierenBefehl,
  // WebSocket Hook & Types
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
  // Notification Hook
  useBefehlNotifications,
  // Export Hook
  useExportBefehle,
  // Integration Status Store & Types (Story 5.3)
  useDegradedIntegrations,
  useHasDegradedIntegrations,
  integrationStatusStore,
  updateIntegrationStatus,
  resetIntegrationStatus,
  type CircuitState,
  type IntegrationStatus,
  type IntegrationStatusStoreState,
  // Integration Health Query Hook (Story 5.3 AC4)
  useIntegrationHealth,
  INTEGRATION_HEALTH_KEY,
  type IntegrationStatusEntry,
  type IntegrationHealthResponse,
  // Einsatz-Rolle Query Hook (Story 4.2)
  useMyEinsatzRolle,
  MEINE_EINSATZ_ROLLE_KEY,
} from './api';

// ============================================
// Hooks
// ============================================
export {
  useDelayedLoading,
  useBefehlNotificationNavigation,
  useBefehlPermissions,
  type BefehlPermissions,
  useBefehlTabelle,
  useHandlungsbedarf,
  getKritischGrund,
  getRueckfrageInfo,
  type HandlungsbedarfResult,
  useKanbanGruppierung,
  type KanbanBefehl,
  type KanbanGruppierung,
  useBefehleView,
  useCurrentBefehleView,
  setBefehleView,
  toggleBefehleView,
  befehleViewStore,
  type BefehleView,
  type BefehleViewStoreState,
  // Filter Store
  useBefehleFilter,
  useActiveFilterCount,
  useHasActiveFilters,
  setStatusFilter,
  setEmpfaengerName,
  setBefehlsgeberName,
  setSearchText,
  setVon,
  setBis,
  resetBefehleFilter,
  befehleFilterStore,
  type BefehleFilterState,
  // Befehl-Alerts (Quittierung + Korrektur, persistent bei Login)
  useMissedBefehlAlerts,
  markAlertSeen,
  // Unquittierte Befehle Badge Counter
  useUnquittierteBefehleCount,
  // Meine Befehle Filter
  useMeineBefehleFilter,
  useShowMeineBefehle,
  toggleMeineBefehle,
  setShowMeineBefehle,
  useOffeneRueckfragenFilter,
  useShowOffeneRueckfragen,
  toggleOffeneRueckfragen,
  setShowOffeneRueckfragen,
  resetMeineBefehleFilterStore,
  meineBefehleFilterStore,
  type MeineBefehleFilterStoreState,
} from './hooks';

// ============================================
// Schemas (Zod Validation)
// ============================================
export {
  addBefehlKommentarSchema,
  type AddBefehlKommentarFormData,
  createBefehlSchema,
  type CreateBefehlFormData,
  korrigiereBefehlSchema,
  type KorrigiereBefehlFormData,
  quittierenBefehlSchema,
  type QuittierenBefehlFormData,
} from './schemas';

// ============================================
// Lib (Offline Queue & Utilities)
// ============================================
export {
  befehlOfflineQueue,
  useOfflineSync,
  type OfflineQueueEntry,
} from './lib/offline-queue';

export {
  getEigenerEmpfaengerStatus,
  getEmpfaengerQuittierungStatus,
  getKanbanSpalte,
  getOffeneRueckfragenCount,
  getQuittierungsfortschritt,
  getZustellHaekchenFarbe,
  EMPFAENGER_STATUS_FARBEN,
  type EmpfaengerChipStatus,
  type EmpfaengerStatus,
  type EigenerEmpfaengerStatus,
  type KanbanSpalteKey,
  type Quittierungsfortschritt,
  type QuittierungHaekchenStatus,
} from './lib/befehl-utils';

export {
  parseZeitvorgabe,
  isBefehlUeberfaellig,
  getBefehlKritikalitaet,
  getSortWeight,
  sortByPriority,
  type Kritikalitaet,
} from './lib/befehl-priority';

// ============================================
// UI Components
// ============================================
export {
  AlarmDot,
  BefehlAlertRow,
  BefehlCompactCard,
  BefehlDetailPanel,
  BefehlExportDialog,
  BefehlHistorieTimeline,
  HandlungsbedarfSection,
  BefehlEingabeRow,
  BefehlFilterRow,
  BefehlKanbanView,
  BefehlKommentarThread,
  BefehlPagination,
  BefehlQuittierenDialog,
  KorrekturBefehlDialog,
  BefehlsListeMitEingabe,
  BefehlStatusBadge,
  BefehlTabellenView,
  BefehleViewToggle,
  BefehlWorkspace,
  BefehlWorkspaceSkeleton,
  ConnectionStatusBanner,
  EmpfaengerCombobox,
  IntegrationStatusBanner,
  KanbanSpalte,
  KritikalitaetBadge,
  KritischeBefehleCounter,
  ZustellHaekchen,
  ZustellstatusAnzeige,
} from './ui';
export type { EmpfaengerSelection, KanbanSpalteConfig, KritikalitaetBadgeType } from './ui';
