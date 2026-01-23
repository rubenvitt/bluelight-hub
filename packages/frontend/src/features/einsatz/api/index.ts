/**
 * Einsatz API Feature - Public Exports
 *
 * Zentrale Export-Datei für alle Einsatz-API-Funktionen.
 * Vereinfacht Imports und definiert die öffentliche API des Features.
 */

// Query Keys & Utilities
export { EINSATZ_QUERY_KEYS, calculateRetryDelay, type EinsatzQueryFilters } from './queries';

// Query Hooks
export { useEinsaetzeQuery } from './use-einsaetze-query';
export { useEinsaetzeInfiniteQuery } from './use-einsaetze-infinite-query';
export { useEinsatzDetail } from './use-einsatz-detail';
export { useActiveEinsaetzeWithCounts } from './use-active-einsaetze-with-counts';
export { useEinsatzStatusCounts } from './use-einsatz-status-counts';

// Mutation Hooks
export { useCreateEinsatz } from './use-create-einsatz';
export { useUpdateEinsatz } from './use-update-einsatz';
export { useArchiveEinsatz } from './use-archive-einsatz';

// EinsatzFahrzeuge Hooks (Story 3-1, 3-2 & 3-3)
export { useEinsatzFahrzeuge } from './use-einsatz-fahrzeuge';
export { useErfasseFahrzeugAusStammdaten } from './use-erfasse-fahrzeug-aus-stammdaten';
export { useErfasseTemporalesFahrzeug } from './use-erfasse-temporales-fahrzeug';
export { useUpdateFmsStatus } from './use-update-fms-status';
export { useStammFahrzeuge, STAMM_FAHRZEUGE_QUERY_KEYS } from './use-stamm-fahrzeuge';
export { useFahrzeugtypen, FAHRZEUGTYP_QUERY_KEYS } from './use-fahrzeugtypen';

// EinsatzPersonen Hooks (Story 4-1)
export { useEinsatzPersonen, useRegistrierePerson } from './use-einsatz-personen';
export { useStammPersonenSuche } from './use-stamm-personen-suche';

// EinsatzPersonen QR Hooks (Story 4-2)
export { useRegistrierePersonViaQr, isDuplicatePersonError, type RegistrierePersonQrInput } from './use-registriere-person-qr';

// EinsatzPersonen Fahrzeug-Zuweisung Hooks (Story 4-3)
export { useWeisePersonZuFahrzeugZu, useEntfernePersonVonFahrzeug } from './use-weise-person-zu-fahrzeug';

// EinsatzTeilnehmer Hooks (Story 115 - ETB Absender Auto-Fill)
export { useMyEinsatzTeilnahme, useJoinEinsatz, useUpdateFunkrufname, useEinsatzTeilnehmer, TEILNAHME_QUERY_KEYS } from './use-einsatz-teilnahme';

// Aktive Teilnehmer Hooks (Story 3.3 - Erinnerung zuweisen)
export { useAktiveEinsatzTeilnehmer, AKTIVE_TEILNEHMER_QUERY_KEYS } from './use-aktive-einsatz-teilnehmer';
