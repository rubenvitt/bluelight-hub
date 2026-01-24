/**
 * Team-Filter Store fuer Team-Erinnerungen Filterung
 *
 * Verwaltet den Filter-State fuer die Team-Erinnerungsliste mit TanStack Store.
 * Ermoeglicht Filterung nach Zuweisung: Alle, Meine, Unzugewiesen, spezifischer Teilnehmer.
 *
 * **Story 3.6 Task 1:**
 * - State: { selectedFilter, availableTeilnehmer }
 * - Filter-Types: 'all' | 'mine' | 'unassigned' | string (userId)
 * - Actions: setTeamFilter, setAvailableTeilnehmer, resetTeamFilter
 * - Hooks: useTeamFilter, useAvailableTeilnehmer
 *
 * **Story 3.8:**
 * - State: { selectedSort }
 * - Sort-Types: 'faelligkeit' | 'erstellt' | 'status'
 */

import { Store, useStore } from '@tanstack/react-store';

/**
 * Team-Filter Type (Tagged Union)
 *
 * Discriminated Union fuer typsichere Filter-Handhabung.
 * Jeder Filter-Typ hat ein eindeutiges `type` Feld.
 *
 * - { type: 'all' }: Alle Team-Erinnerungen (AC5)
 * - { type: 'mine' }: Meine Erinnerungen (Ersteller ODER Zugewiesener) (AC3)
 * - { type: 'unassigned' }: Erinnerungen ohne Zuweisung (AC4)
 * - { type: 'user', userId: string }: Spezifische User-ID fuer Filterung auf Teilnehmer (AC2)
 */
export type TeamFilterType = { type: 'all' } | { type: 'mine' } | { type: 'unassigned' } | { type: 'user'; userId: string };

/**
 * Team-Sort Type (Story 3.8)
 *
 * - 'faelligkeit': Standard-Sortierung nach Faelligkeit (überfällige zuerst)
 * - 'erstellt': Sortierung nach Erstellungsdatum (neueste zuerst)
 * - 'status': Gruppierung nach Status (Acknowledge-Pflicht zuerst)
 */
export type TeamSortType = 'faelligkeit' | 'erstellt' | 'status';

/**
 * Teilnehmer-Typ fuer die Dropdown-Auswahl (AC1)
 */
export interface Teilnehmer {
  /** Eindeutige Benutzer-ID */
  id: string;
  /** Anzeigename des Teilnehmers */
  name: string;
}

/**
 * Team-Filter Store State Interface
 */
export interface TeamFilterStoreState {
  /** Aktuell ausgewaehlter Filter */
  selectedFilter: TeamFilterType;
  /** Aktuell ausgewaehlte Sortierung (Story 3.8) */
  selectedSort: TeamSortType;
  /** Liste der verfuegbaren Einsatz-Teilnehmer fuer das Dropdown */
  availableTeilnehmer: Teilnehmer[];
}

/**
 * Initial Store State
 */
const initialState: TeamFilterStoreState = {
  selectedFilter: { type: 'all' },
  selectedSort: 'faelligkeit',
  availableTeilnehmer: [],
};

/**
 * Team-Filter Store Instance
 */
export const teamFilterStore = new Store<TeamFilterStoreState>(initialState);

// ============================================
// Store Actions (Helper Functions)
// ============================================

/**
 * Setzt den Team-Filter
 *
 * Wird aufgerufen wenn der User einen Filter im Dropdown auswaehlt.
 *
 * @param filter - Neuer Filter-Wert ('all', 'mine', 'unassigned' oder userId)
 */
export const setTeamFilter = (filter: TeamFilterType): void => {
  teamFilterStore.setState((state) => ({
    ...state,
    selectedFilter: filter,
  }));
};

/**
 * Setzt die Team-Sortierung (Story 3.8)
 *
 * @param sort - Neuer Sortier-Modus
 */
export const setTeamSort = (sort: TeamSortType): void => {
  teamFilterStore.setState((state) => ({
    ...state,
    selectedSort: sort,
  }));
};

/**
 * Setzt die verfuegbaren Teilnehmer fuer das Filter-Dropdown
 *
 * Wird aufgerufen wenn Einsatz-Teilnehmer geladen wurden oder sich aendern.
 *
 * @param teilnehmer - Array von Teilnehmern mit id und name
 */
export const setAvailableTeilnehmer = (teilnehmer: Teilnehmer[]): void => {
  teamFilterStore.setState((state) => ({
    ...state,
    availableTeilnehmer: teilnehmer,
  }));
};

/**
 * Setzt den kompletten Store zurueck auf Initial-State
 *
 * Wird aufgerufen bei Einsatz-Wechsel oder App Cleanup.
 * Setzt sowohl den Filter auf 'all' als auch die Teilnehmer-Liste.
 *
 * **Note:** Fuer Reset nur des Filters nutze `setTeamFilter({ type: 'all' })`.
 */
export const resetTeamFilterStore = (): void => {
  teamFilterStore.setState(initialState);
};

// ============================================
// Selector Functions (Non-React)
// ============================================

/**
 * Holt den aktuellen Filter-Wert
 *
 * @returns Aktueller Filter ('all', 'mine', 'unassigned' oder userId)
 */
export const getTeamFilter = (): TeamFilterType => {
  return teamFilterStore.state.selectedFilter;
};

/**
 * Holt den aktuellen Sortier-Wert (Story 3.8)
 *
 * @returns Aktueller Sortier-Modus
 */
export const getTeamSort = (): TeamSortType => {
  return teamFilterStore.state.selectedSort;
};

/**
 * Holt die verfuegbaren Teilnehmer
 *
 * @returns Array von Teilnehmern
 */
export const getAvailableTeilnehmer = (): Teilnehmer[] => {
  return teamFilterStore.state.availableTeilnehmer;
};

// ============================================
// React Hooks
// ============================================

/**
 * Hook fuer den aktuellen Team-Filter
 *
 * @returns Aktueller Filter-Wert
 */
export const useTeamFilter = (): TeamFilterType => {
  return useStore(teamFilterStore, (state) => state.selectedFilter);
};

/**
 * Hook fuer die aktuelle Team-Sortierung (Story 3.8)
 *
 * @returns Aktueller Sortier-Modus
 */
export const useTeamSort = (): TeamSortType => {
  return useStore(teamFilterStore, (state) => state.selectedSort);
};

/**
 * Hook fuer die verfuegbaren Teilnehmer
 *
 * @returns Array von Teilnehmern
 */
export const useAvailableTeilnehmer = (): Teilnehmer[] => {
  return useStore(teamFilterStore, (state) => state.availableTeilnehmer);
};

/**
 * Hook fuer den kompletten Store State
 *
 * @returns Kompletter Store State
 */
export const useTeamFilterStoreState = (): TeamFilterStoreState => {
  return useStore(teamFilterStore, (state) => state);
};

/**
 * Hook der prueft ob ein bestimmter Filter-Typ aktiv ist
 *
 * Vergleicht den Typ des Filters. Bei 'user'-Typ wird auch die userId verglichen.
 *
 * @param filter - Filter zum Pruefen
 * @returns true wenn dieser Filter aktiv ist
 */
export const useIsFilterActive = (filter: TeamFilterType): boolean => {
  return useStore(teamFilterStore, (state) => {
    if (state.selectedFilter.type !== filter.type) return false;
    if (filter.type === 'user' && state.selectedFilter.type === 'user') {
      return state.selectedFilter.userId === filter.userId;
    }
    return true;
  });
};

/**
 * Hook fuer die Anzahl verfuegbarer Teilnehmer
 *
 * @returns Anzahl der Teilnehmer
 */
export const useTeilnehmerCount = (): number => {
  return useStore(teamFilterStore, (state) => state.availableTeilnehmer.length);
};

// ============================================
// Helper Functions (Type Guards & Constructors)
// ============================================

/**
 * Prueft ob der Filter vom Typ 'user' ist (Teilnehmer-Filter)
 *
 * @param filter - Der zu pruefende Filter
 * @returns true wenn filter.type === 'user'
 */
export const isUserFilter = (filter: TeamFilterType): filter is { type: 'user'; userId: string } => {
  return filter.type === 'user';
};

/**
 * Erstellt einen TeamFilterType aus einem Filter-String (fuer Migration/Kompatibilitaet)
 *
 * Konvertiert alte String-basierte Filter ('all', 'mine', 'unassigned', userId)
 * zum neuen Tagged Union Format.
 *
 * @param value - Filter-Wert als String
 * @returns TeamFilterType im Tagged Union Format
 */
export const createTeamFilter = (value: string): TeamFilterType => {
  switch (value) {
    case 'all':
      return { type: 'all' };
    case 'mine':
      return { type: 'mine' };
    case 'unassigned':
      return { type: 'unassigned' };
    default:
      return { type: 'user', userId: value };
  }
};

/**
 * Konvertiert einen TeamFilterType zu einem String-Wert (fuer Dropdowns, etc.)
 *
 * @param filter - TeamFilterType im Tagged Union Format
 * @returns String-Repraesentation des Filters
 */
export const teamFilterToValue = (filter: TeamFilterType): string => {
  if (filter.type === 'user') {
    return filter.userId;
  }
  return filter.type;
};
