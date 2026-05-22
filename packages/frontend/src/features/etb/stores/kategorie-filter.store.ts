/**
 * Kategorie-Filter Store
 *
 * Verwaltet die ausgeblendeten Kategorien fuer die ETB-Ansicht.
 * Nutzt Exclude-Logik: Kategorien im Set werden NICHT angezeigt.
 *
 * **Story 5.6:** ETB-Filter nach Kategorie (Multiselect)
 *
 * Standard: SYSTEM-Meldungen sind ausgeblendet.
 */

import { createStore, useStore } from '@tanstack/react-store';
import type { EintragDtoKategorieEnum as EtbKategorie } from '@/shared';

/**
 * Kategorie-Filter Store State
 */
export interface KategorieFilterState {
  /** Ausgeblendete Kategorien - Eintraege dieser Kategorien werden NICHT angezeigt */
  excludedKategorien: Set<EtbKategorie>;
  /** Erinnerungs-Filter: Zeigt nur Eintraege MIT verknuepfter Erinnerung */
  erinnerungFilterActive: boolean;
  /** Inklusions-Filter für den Kontexttyp (z. B. 'patient') */
  includedKontextType: 'patient' | null;
}

/**
 * Standard-Ausblendungen: SYSTEM-Meldungen
 * Hinweis: String-Literal statt Enum-Referenz um zirkulaere Imports zu vermeiden
 */
const DEFAULT_EXCLUDED: Set<EtbKategorie> = new Set(['SYSTEM' as EtbKategorie]);

/**
 * Alle verfuegbaren Kategorien fuer ETB-Filterung. Erinnerungs-Events nutzen SYSTEM (Story 5.6).
 */
export const ALLE_KATEGORIEN: EtbKategorie[] = [
  'ALARMIERUNG' as EtbKategorie,
  'ANKUNFT' as EtbKategorie,
  'BEFEHL' as EtbKategorie,
  'ERKUNDUNG' as EtbKategorie,
  'LAGE' as EtbKategorie,
  'MASSNAHME' as EtbKategorie,
  'PERSONAL' as EtbKategorie,
  'FAHRZEUG' as EtbKategorie,
  'MATERIAL' as EtbKategorie,
  'KOMMUNIKATION' as EtbKategorie,
  'WETTER' as EtbKategorie,
  'DOKUMENTATION' as EtbKategorie,
  'SONSTIGES' as EtbKategorie,
  'SYSTEM' as EtbKategorie,
];

/**
 * TanStack Store fuer Kategorie-Filter State
 */
export const kategorieFilterStore = createStore<KategorieFilterState>({
  excludedKategorien: new Set(DEFAULT_EXCLUDED),
  erinnerungFilterActive: false,
  includedKontextType: null,
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Toggled eine Kategorie (ein-/ausblenden).
 * Wenn Kategorie ausgeblendet ist, wird sie eingeblendet und umgekehrt.
 *
 * @param kategorie - Die zu togglende Kategorie
 */
export function toggleKategorie(kategorie: EtbKategorie): void {
  kategorieFilterStore.setState((state) => {
    const newExcluded = new Set(state.excludedKategorien);
    if (newExcluded.has(kategorie)) {
      newExcluded.delete(kategorie);
    } else {
      newExcluded.add(kategorie);
    }
    return { ...state, excludedKategorien: newExcluded };
  });
}

/**
 * Blendet eine Kategorie aus (fuegt sie zum Exclude-Set hinzu).
 *
 * @param kategorie - Die auszublendende Kategorie
 */
export function excludeKategorie(kategorie: EtbKategorie): void {
  kategorieFilterStore.setState((state) => {
    const newExcluded = new Set(state.excludedKategorien);
    newExcluded.add(kategorie);
    return { ...state, excludedKategorien: newExcluded };
  });
}

/**
 * Blendet eine Kategorie ein (entfernt sie aus dem Exclude-Set).
 *
 * @param kategorie - Die einzublendende Kategorie
 */
export function includeKategorie(kategorie: EtbKategorie): void {
  kategorieFilterStore.setState((state) => {
    const newExcluded = new Set(state.excludedKategorien);
    newExcluded.delete(kategorie);
    return { ...state, excludedKategorien: newExcluded };
  });
}

/**
 * Zeigt alle Kategorien an (leert das Exclude-Set).
 */
export function showAllKategorien(): void {
  kategorieFilterStore.setState((state) => ({
    ...state,
    excludedKategorien: new Set(),
  }));
}

/**
 * Setzt den Filter auf Standard zurueck (nur SYSTEM ausgeblendet).
 */
export function resetKategorieFilter(): void {
  kategorieFilterStore.setState(() => ({
    excludedKategorien: new Set(DEFAULT_EXCLUDED),
    erinnerungFilterActive: false,
    includedKontextType: null,
  }));
}

/**
 * Setzt den Inklusions-Filter für einen Kontexttyp.
 *
 * @param value - Der Kontexttyp oder null zum Zurücksetzen
 */
export function setIncludedKontextType(value: 'patient' | null): void {
  kategorieFilterStore.setState((state) => ({
    ...state,
    includedKontextType: value,
  }));
}

/**
 * Toggled den Inklusions-Filter für einen bestimmten Kontexttyp.
 *
 * @param value - Der zu togglende Kontexttyp
 */
export function toggleIncludedKontextType(value: 'patient'): void {
  kategorieFilterStore.setState((state) => ({
    ...state,
    includedKontextType: state.includedKontextType === value ? null : value,
  }));
}

/**
 * Blendet ALLE Kategorien aus ("Keine" Filter).
 */
export function hideAllKategorien(): void {
  kategorieFilterStore.setState((state) => ({
    ...state,
    excludedKategorien: new Set(ALLE_KATEGORIEN),
  }));
}

/**
 * Toggled den Erinnerungs-Filter.
 * Zeigt nur Eintraege mit verknuepfter Erinnerung (metadata.erinnerungId oder linkedErinnerung).
 */
export function toggleErinnerungFilter(): void {
  kategorieFilterStore.setState((state) => ({
    ...state,
    erinnerungFilterActive: !state.erinnerungFilterActive,
  }));
}

/**
 * Aktiviert den Erinnerungs-Filter.
 */
export function setErinnerungFilterActive(active: boolean): void {
  kategorieFilterStore.setState((state) => ({
    ...state,
    erinnerungFilterActive: active,
  }));
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook fuer die ausgeblendeten Kategorien (reactive).
 * Re-rendert die Komponente bei Store-Aenderungen.
 *
 * Fuer non-reactive Zugriff (ausserhalb von Komponenten): getExcludedKategorien()
 *
 * @returns Set der ausgeblendeten Kategorien
 */
export function useExcludedKategorien(): Set<EtbKategorie> {
  return useStore(kategorieFilterStore, (state) => state.excludedKategorien);
}

/**
 * Hook um zu pruefen ob eine Kategorie sichtbar ist.
 *
 * @param kategorie - Die zu pruefende Kategorie
 * @returns true wenn Kategorie sichtbar (nicht ausgeblendet)
 */
export function useIsKategorieVisible(kategorie: EtbKategorie): boolean {
  return useStore(kategorieFilterStore, (state) => !state.excludedKategorien.has(kategorie));
}

/**
 * Hook um zu pruefen ob irgendein Filter aktiv ist (reactive).
 *
 * HINWEIS: Gibt true zurueck wenn:
 * - Mindestens eine Kategorie ausgeblendet ist (inkl. Standard-SYSTEM)
 * - ODER Erinnerungs-Filter aktiv ist
 *
 * @returns true wenn mindestens ein Filter aktiv ist
 */
export function useHasActiveFilter(): boolean {
  return useStore(kategorieFilterStore, (state) => state.excludedKategorien.size > 0 || state.erinnerungFilterActive || state.includedKontextType !== null);
}

/**
 * Hook für den aktiven Inklusions-Kontexttyp (reactive).
 *
 * @returns Der aktive Kontexttyp oder null
 */
export function useIncludedKontextType(): 'patient' | null {
  return useStore(kategorieFilterStore, (state) => state.includedKontextType);
}

/**
 * Hook fuer den Erinnerungs-Filter Status.
 *
 * @returns true wenn Erinnerungs-Filter aktiv (nur Eintraege mit Erinnerung anzeigen)
 */
export function useErinnerungFilterActive(): boolean {
  return useStore(kategorieFilterStore, (state) => state.erinnerungFilterActive);
}

// ============================================================================
// Selectors (non-reactive)
// ============================================================================

/**
 * Prueft ob eine Kategorie sichtbar ist (nicht im Store-Hook-Kontext).
 *
 * @param kategorie - Die zu pruefende Kategorie
 * @returns true wenn Kategorie sichtbar
 */
export function isKategorieVisible(kategorie: EtbKategorie): boolean {
  return !kategorieFilterStore.state.excludedKategorien.has(kategorie);
}

/**
 * Gibt eine Kopie der ausgeblendeten Kategorien zurueck (non-reactive).
 * Nutze useExcludedKategorien() fuer reaktive Updates in Komponenten.
 *
 * @returns Kopie des Sets der ausgeblendeten Kategorien
 */
export function getExcludedKategorien(): Set<EtbKategorie> {
  return new Set(kategorieFilterStore.state.excludedKategorien);
}

// ============================================================================
// Legacy API (fuer Kompatibilitaet)
// ============================================================================

/**
 * @deprecated Nutze resetKategorieFilter()
 */
export function clearKategorieFilter(): void {
  resetKategorieFilter();
}
