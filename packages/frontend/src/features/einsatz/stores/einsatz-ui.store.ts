/**
 * Einsatz UI State Store
 *
 * Globaler UI-State für Einsatz-Feature mit TanStack Store.
 * Verwaltet UI-spezifische Zustände wie Filter, Sorting, Selected Items.
 */

import type { EinsatzControllerFindAllVAlphaOrderByEnum, EinsatzControllerFindAllVAlphaOrderDirectionEnum, EinsatzControllerFindAllVAlphaStatusEnum } from '@bluelight-hub/shared/client';
import { Store } from '@tanstack/react-store';

/**
 * Einsatz UI State Interface
 */
export interface EinsatzUIState {
  // Selection State
  selectedEinsatzId: string | null;

  // Filter State
  filters: {
    status?: EinsatzControllerFindAllVAlphaStatusEnum;
    search?: string;
    page: number;
    limit: number;
  };

  // Sorting State
  sorting: {
    orderBy?: EinsatzControllerFindAllVAlphaOrderByEnum;
    orderDirection?: EinsatzControllerFindAllVAlphaOrderDirectionEnum;
  };

  // View Mode State
  viewMode: 'list' | 'grid' | 'infinite';
}

/**
 * Initial State
 */
const initialState: EinsatzUIState = {
  selectedEinsatzId: null,
  filters: {
    page: 1,
    limit: 20,
  },
  sorting: {},
  viewMode: 'list',
};

/**
 * Einsatz UI Store
 *
 * Zentrale Store-Instanz für Einsatz-UI-State.
 * Nutze die bereitgestellten Helper-Funktionen für State-Updates.
 */
export const einsatzUIStore = new Store<EinsatzUIState>(initialState);

// ============================================
// Store Actions (Helper Functions)
// ============================================

/**
 * Setzt die ausgewählte Einsatz-ID
 */
export const setSelectedEinsatzId = (id: string | null) => {
  einsatzUIStore.setState((state) => ({
    ...state,
    selectedEinsatzId: id,
  }));
};

/**
 * Setzt den Status-Filter
 */
export const setStatusFilter = (status?: EinsatzControllerFindAllVAlphaStatusEnum) => {
  einsatzUIStore.setState((state) => ({
    ...state,
    filters: {
      ...state.filters,
      status,
      page: 1, // Reset page bei Filter-Änderung
    },
  }));
};

/**
 * Setzt den Such-Filter
 */
export const setSearchFilter = (search?: string) => {
  einsatzUIStore.setState((state) => ({
    ...state,
    filters: {
      ...state.filters,
      search,
      page: 1, // Reset page bei Filter-Änderung
    },
  }));
};

/**
 * Setzt die Seite (Pagination)
 */
export const setPage = (page: number) => {
  einsatzUIStore.setState((state) => ({
    ...state,
    filters: {
      ...state.filters,
      page,
    },
  }));
};

/**
 * Setzt das Limit (Items pro Seite)
 */
export const setLimit = (limit: number) => {
  einsatzUIStore.setState((state) => ({
    ...state,
    filters: {
      ...state.filters,
      limit,
      page: 1, // Reset page bei Limit-Änderung
    },
  }));
};

/**
 * Setzt Sorting-Optionen
 */
export const setSorting = (orderBy?: EinsatzControllerFindAllVAlphaOrderByEnum, orderDirection?: EinsatzControllerFindAllVAlphaOrderDirectionEnum) => {
  einsatzUIStore.setState((state) => ({
    ...state,
    sorting: {
      orderBy,
      orderDirection,
    },
  }));
};

/**
 * Setzt den View Mode
 */
export const setViewMode = (viewMode: 'list' | 'grid' | 'infinite') => {
  einsatzUIStore.setState((state) => ({
    ...state,
    viewMode,
  }));
};

/**
 * Setzt alle Filter zurück
 */
export const resetFilters = () => {
  einsatzUIStore.setState((state) => ({
    ...state,
    filters: initialState.filters,
    sorting: initialState.sorting,
  }));
};

/**
 * Setzt den kompletten Store zurück
 */
export const resetEinsatzUIStore = () => {
  einsatzUIStore.setState(initialState);
};

// ============================================
// Store Selectors (Helper Functions)
// ============================================

/**
 * Holt alle Filter-Werte kombiniert für TanStack Query
 */
export const getEinsatzQueryFilters = () => {
  const state = einsatzUIStore.state;
  return {
    ...state.filters,
    ...state.sorting,
  };
};
