/**
 * Einsatz Feature - Public API
 *
 * Zentrale Export-Datei für das gesamte Einsatz-Feature.
 * Definiert die öffentliche API und kapselt interne Implementierungen.
 */

// ============================================
// API Layer (Queries & Mutations)
// ============================================
export {
  // Query Keys & Utilities
  EINSATZ_QUERY_KEYS,
  calculateRetryDelay,
  type EinsatzQueryFilters,
  // Query Hooks
  useEinsaetzeQuery,
  useEinsaetzeInfiniteQuery,
  useEinsatzDetail,
  useActiveEinsaetzeWithCounts,
  useEinsatzStatusCounts,
  // Mutation Hooks
  useCreateEinsatz,
  useUpdateEinsatz,
  useArchiveEinsatz,
  // EinsatzFahrzeuge (Story 3-1, 3-2 & 3-3)
  useEinsatzFahrzeuge,
  useErfasseFahrzeugAusStammdaten,
  useErfasseTemporalesFahrzeug,
  useUpdateFmsStatus,
  useStammFahrzeuge,
  STAMM_FAHRZEUGE_QUERY_KEYS,
  useFahrzeugtypen,
  FAHRZEUGTYP_QUERY_KEYS,
  // EinsatzTeilnehmer (Story 115 - ETB Absender Auto-Fill)
  useMyEinsatzTeilnahme,
  useJoinEinsatz,
  useUpdateFunkrufname,
  TEILNAHME_QUERY_KEYS,
  // Aktive Teilnehmer (Story 3.3 - Erinnerung zuweisen)
  useAktiveEinsatzTeilnehmer,
  AKTIVE_TEILNEHMER_QUERY_KEYS,
} from './api';

// ============================================
// Store Layer (UI State Management)
// ============================================
export * from './stores';

// ============================================
// Hooks
// ============================================
export {
  useActiveEinsatz,
  useEinsatzDetails,
  type UseEinsatzDetailsResult,
  useEinsatzModules,
  type Module,
} from './hooks';

// ============================================
// Schemas
// ============================================
export * from './schemas';

// ============================================
// Constants (Story 3-3 FMS-Status)
// ============================================
export {
  FMS_STATUS_LABELS,
  FMS_STATUS_COLORS,
  FMS_STATUS_OPTIONS,
  getStatusClasses,
  getStatusBgClasses,
  isFmsStatus,
  type FmsStatus,
} from './constants/fms-status.constants';

// ============================================
// Utils (Story 4-2 QR-Code)
// ============================================
export * from './utils';

// ============================================
// UI Components
// ============================================
export * from './ui';
