/**
 * Unit Tests fuer den Kategorie-Filter Store
 *
 * Story 5.6: ETB-Filter nach Kategorie (Multiselect mit Exclude-Logik)
 *
 * Testet die Store-Funktionen fuer das Aus-/Einblenden von ETB-Kategorien.
 * Standard: SYSTEM ist ausgeblendet.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  kategorieFilterStore,
  toggleKategorie,
  excludeKategorie,
  includeKategorie,
  showAllKategorien,
  resetKategorieFilter,
  isKategorieVisible,
  getExcludedKategorien,
  clearKategorieFilter,
  toggleErinnerungFilter,
  setErinnerungFilterActive,
  hideAllKategorien,
  ALLE_KATEGORIEN,
  setIncludedKontextType,
  toggleIncludedKontextType,
  useIncludedKontextType,
  useHasActiveFilter,
} from '../kategorie-filter.store';

// String-Konstanten fuer Kategorien (vermeidet zirkulaere Import-Probleme)
const EtbKategorie = {
  Alarmierung: 'ALARMIERUNG',
  System: 'SYSTEM',
  Lage: 'LAGE',
  Personal: 'PERSONAL',
} as const;
type EtbKategorieType = (typeof EtbKategorie)[keyof typeof EtbKategorie];

describe('kategorieFilterStore', () => {
  // Reset vor jedem Test auf Standard (SYSTEM ausgeblendet)
  beforeEach(() => {
    resetKategorieFilter();
  });

  describe('Initial State (AC5 - Standard)', () => {
    it('should have SYSTEM excluded by default', () => {
      // Given: Store im Initial-State

      // When: Wir pruefen den State

      // Then: SYSTEM sollte ausgeblendet sein
      expect(kategorieFilterStore.state.excludedKategorien.has(EtbKategorie.System as EtbKategorieType)).toBe(true);
    });

    it('should have only SYSTEM excluded initially (size = 1)', () => {
      // Given: Store im Initial-State

      // Then: Nur eine Kategorie ist ausgeblendet
      expect(kategorieFilterStore.state.excludedKategorien.size).toBe(1);
    });

    it('should show LAGE by default', () => {
      // Given: Store im Initial-State

      // Then: LAGE sollte sichtbar sein
      expect(isKategorieVisible(EtbKategorie.Lage as EtbKategorieType)).toBe(true);
    });

    it('should show ALARMIERUNG by default', () => {
      // Given: Store im Initial-State

      // Then: ALARMIERUNG sollte sichtbar sein
      expect(isKategorieVisible(EtbKategorie.Alarmierung as EtbKategorieType)).toBe(true);
    });

    it('should have erinnerungFilterActive false by default', () => {
      // Given: Store im Initial-State

      // Then: Erinnerungs-Filter sollte deaktiviert sein
      expect(kategorieFilterStore.state.erinnerungFilterActive).toBe(false);
    });
  });

  describe('toggleKategorie()', () => {
    it('should hide ALARMIERUNG when toggled (add to excluded)', () => {
      // Given: ALARMIERUNG ist sichtbar
      expect(isKategorieVisible(EtbKategorie.Alarmierung as EtbKategorieType)).toBe(true);

      // When: Toggle ALARMIERUNG
      toggleKategorie(EtbKategorie.Alarmierung as EtbKategorieType);

      // Then: ALARMIERUNG sollte ausgeblendet sein
      expect(isKategorieVisible(EtbKategorie.Alarmierung as EtbKategorieType)).toBe(false);
    });

    it('should show SYSTEM when toggled (remove from excluded)', () => {
      // Given: SYSTEM ist ausgeblendet (Standard)
      expect(isKategorieVisible(EtbKategorie.System as EtbKategorieType)).toBe(false);

      // When: Toggle SYSTEM
      toggleKategorie(EtbKategorie.System as EtbKategorieType);

      // Then: SYSTEM sollte sichtbar sein
      expect(isKategorieVisible(EtbKategorie.System as EtbKategorieType)).toBe(true);
    });

    it('should toggle back and forth correctly', () => {
      // Given: LAGE ist sichtbar
      expect(isKategorieVisible(EtbKategorie.Lage as EtbKategorieType)).toBe(true);

      // When: Zweimal togglen
      toggleKategorie(EtbKategorie.Lage as EtbKategorieType);
      expect(isKategorieVisible(EtbKategorie.Lage as EtbKategorieType)).toBe(false);

      toggleKategorie(EtbKategorie.Lage as EtbKategorieType);
      expect(isKategorieVisible(EtbKategorie.Lage as EtbKategorieType)).toBe(true);
    });
  });

  describe('excludeKategorie()', () => {
    it('should add kategorie to excluded set', () => {
      // Given: PERSONAL ist sichtbar
      expect(isKategorieVisible(EtbKategorie.Personal as EtbKategorieType)).toBe(true);

      // When: Exclude PERSONAL
      excludeKategorie(EtbKategorie.Personal as EtbKategorieType);

      // Then: PERSONAL sollte ausgeblendet sein
      expect(isKategorieVisible(EtbKategorie.Personal as EtbKategorieType)).toBe(false);
    });

    it('should be idempotent (calling twice has same effect)', () => {
      // Given: LAGE ist sichtbar
      expect(isKategorieVisible(EtbKategorie.Lage as EtbKategorieType)).toBe(true);

      // When: Zweimal excluden
      excludeKategorie(EtbKategorie.Lage as EtbKategorieType);
      excludeKategorie(EtbKategorie.Lage as EtbKategorieType);

      // Then: LAGE sollte ausgeblendet sein, Set-Size nicht doppelt
      expect(isKategorieVisible(EtbKategorie.Lage as EtbKategorieType)).toBe(false);
      // SYSTEM + LAGE = 2
      expect(kategorieFilterStore.state.excludedKategorien.size).toBe(2);
    });
  });

  describe('includeKategorie()', () => {
    it('should remove kategorie from excluded set', () => {
      // Given: SYSTEM ist ausgeblendet (Standard)
      expect(isKategorieVisible(EtbKategorie.System as EtbKategorieType)).toBe(false);

      // When: Include SYSTEM
      includeKategorie(EtbKategorie.System as EtbKategorieType);

      // Then: SYSTEM sollte sichtbar sein
      expect(isKategorieVisible(EtbKategorie.System as EtbKategorieType)).toBe(true);
    });

    it('should be idempotent', () => {
      // When: Zweimal includen (obwohl schon sichtbar)
      includeKategorie(EtbKategorie.Alarmierung as EtbKategorieType);
      includeKategorie(EtbKategorie.Alarmierung as EtbKategorieType);

      // Then: Alarmierung sollte weiterhin sichtbar sein
      expect(isKategorieVisible(EtbKategorie.Alarmierung as EtbKategorieType)).toBe(true);
    });
  });

  describe('showAllKategorien()', () => {
    it('should clear all excludes (show everything)', () => {
      // Given: Mehrere Kategorien ausgeblendet
      excludeKategorie(EtbKategorie.Lage as EtbKategorieType);
      excludeKategorie(EtbKategorie.Alarmierung as EtbKategorieType);
      expect(kategorieFilterStore.state.excludedKategorien.size).toBe(3); // SYSTEM + 2

      // When: Alle anzeigen
      showAllKategorien();

      // Then: Keine Kategorie ausgeblendet
      expect(kategorieFilterStore.state.excludedKategorien.size).toBe(0);
      expect(isKategorieVisible(EtbKategorie.System as EtbKategorieType)).toBe(true);
      expect(isKategorieVisible(EtbKategorie.Lage as EtbKategorieType)).toBe(true);
    });
  });

  describe('resetKategorieFilter() (AC4)', () => {
    it('should reset to default (only SYSTEM excluded)', () => {
      // Given: Alle Kategorien angezeigt
      showAllKategorien();
      expect(kategorieFilterStore.state.excludedKategorien.size).toBe(0);

      // When: Reset
      resetKategorieFilter();

      // Then: Nur SYSTEM ausgeblendet
      expect(kategorieFilterStore.state.excludedKategorien.size).toBe(1);
      expect(isKategorieVisible(EtbKategorie.System as EtbKategorieType)).toBe(false);
    });

    it('should reset after multiple changes', () => {
      // Given: Viele Aenderungen
      excludeKategorie(EtbKategorie.Alarmierung as EtbKategorieType);
      excludeKategorie(EtbKategorie.Lage as EtbKategorieType);
      includeKategorie(EtbKategorie.System as EtbKategorieType);

      // When: Reset
      resetKategorieFilter();

      // Then: Nur SYSTEM ausgeblendet
      expect(kategorieFilterStore.state.excludedKategorien.size).toBe(1);
      expect(getExcludedKategorien().has(EtbKategorie.System as EtbKategorieType)).toBe(true);
    });

    it('should reset erinnerungFilterActive to false', () => {
      // Given: Erinnerungs-Filter aktiv
      toggleErinnerungFilter();
      expect(kategorieFilterStore.state.erinnerungFilterActive).toBe(true);

      // When: Reset
      resetKategorieFilter();

      // Then: Deaktiviert
      expect(kategorieFilterStore.state.erinnerungFilterActive).toBe(false);
    });

    it('should reset includedKontextType to null', () => {
      // Given: Inklusions-Filter aktiv
      setIncludedKontextType('patient');
      expect(kategorieFilterStore.state.includedKontextType).toBe('patient');

      // When: Reset
      resetKategorieFilter();

      // Then: includedKontextType ist null
      expect(kategorieFilterStore.state.includedKontextType).toBeNull();
    });
  });

  describe('Inklusions-Filter (includedKontextType)', () => {
    describe('setIncludedKontextType()', () => {
      it("should set includedKontextType to 'patient'", () => {
        // Given: includedKontextType ist null (default)
        expect(kategorieFilterStore.state.includedKontextType).toBeNull();

        // When
        setIncludedKontextType('patient');

        // Then
        expect(kategorieFilterStore.state.includedKontextType).toBe('patient');
      });

      it('should reset includedKontextType to null', () => {
        // Given: 'patient' gesetzt
        setIncludedKontextType('patient');
        expect(kategorieFilterStore.state.includedKontextType).toBe('patient');

        // When
        setIncludedKontextType(null);

        // Then
        expect(kategorieFilterStore.state.includedKontextType).toBeNull();
      });

      it('should not affect excludedKategorien', () => {
        // Given: Standard exclusion (SYSTEM)
        const beforeSize = kategorieFilterStore.state.excludedKategorien.size;

        // When
        setIncludedKontextType('patient');

        // Then: excludedKategorien unveraendert
        expect(kategorieFilterStore.state.excludedKategorien.size).toBe(beforeSize);
      });
    });

    describe('toggleIncludedKontextType()', () => {
      it("should toggle from null to 'patient'", () => {
        // Given: Default null
        expect(kategorieFilterStore.state.includedKontextType).toBeNull();

        // When
        toggleIncludedKontextType('patient');

        // Then
        expect(kategorieFilterStore.state.includedKontextType).toBe('patient');
      });

      it("should toggle from 'patient' back to null", () => {
        // Given: 'patient' gesetzt
        setIncludedKontextType('patient');

        // When: Toggle mit gleichem Wert
        toggleIncludedKontextType('patient');

        // Then: Zurueck auf null
        expect(kategorieFilterStore.state.includedKontextType).toBeNull();
      });

      it('should toggle back and forth correctly', () => {
        // When: Mehrmals togglen
        toggleIncludedKontextType('patient');
        expect(kategorieFilterStore.state.includedKontextType).toBe('patient');

        toggleIncludedKontextType('patient');
        expect(kategorieFilterStore.state.includedKontextType).toBeNull();

        toggleIncludedKontextType('patient');
        expect(kategorieFilterStore.state.includedKontextType).toBe('patient');
      });
    });

    describe('useIncludedKontextType()', () => {
      it('should return null by default', () => {
        // When
        const { result } = renderHook(() => useIncludedKontextType());

        // Then
        expect(result.current).toBeNull();
      });

      it("should return 'patient' when set", () => {
        // Given
        setIncludedKontextType('patient');

        // When
        const { result } = renderHook(() => useIncludedKontextType());

        // Then
        expect(result.current).toBe('patient');
      });

      it('should update reactively when store changes', () => {
        // Given
        const { result } = renderHook(() => useIncludedKontextType());
        expect(result.current).toBeNull();

        // When
        act(() => {
          setIncludedKontextType('patient');
        });

        // Then
        expect(result.current).toBe('patient');

        // When toggled back
        act(() => {
          setIncludedKontextType(null);
        });

        // Then
        expect(result.current).toBeNull();
      });
    });

    describe('useHasActiveFilter() (Inklusions-Filter)', () => {
      it('should return true when includedKontextType is set, even without other filters', () => {
        // Given: Alle Kategorien sichtbar, kein Erinnerungs-Filter
        showAllKategorien();
        setErinnerungFilterActive(false);
        expect(kategorieFilterStore.state.excludedKategorien.size).toBe(0);

        // When: Inklusions-Filter aktivieren
        setIncludedKontextType('patient');

        // Then: useHasActiveFilter sollte true liefern
        const { result } = renderHook(() => useHasActiveFilter());
        expect(result.current).toBe(true);
      });

      it('should return false when no filters active (no exclusions, no Erinnerung, no includedKontextType)', () => {
        // Given
        showAllKategorien();
        setErinnerungFilterActive(false);
        setIncludedKontextType(null);

        // When
        const { result } = renderHook(() => useHasActiveFilter());

        // Then
        expect(result.current).toBe(false);
      });

      it('should reflect inclusion filter changes reactively', () => {
        // Given: Alle Filter aus
        showAllKategorien();
        setErinnerungFilterActive(false);

        const { result } = renderHook(() => useHasActiveFilter());
        expect(result.current).toBe(false);

        // When: Inklusions-Filter aktivieren
        act(() => {
          setIncludedKontextType('patient');
        });

        // Then
        expect(result.current).toBe(true);

        // When: Inklusions-Filter zuruecksetzen
        act(() => {
          setIncludedKontextType(null);
        });

        // Then
        expect(result.current).toBe(false);
      });
    });
  });

  describe('clearKategorieFilter() (Legacy API)', () => {
    it('should reset to default (alias for resetKategorieFilter)', () => {
      // Given: Filter geaendert
      showAllKategorien();

      // When: Legacy clear
      clearKategorieFilter();

      // Then: Standard wieder aktiv
      expect(kategorieFilterStore.state.excludedKategorien.size).toBe(1);
      expect(isKategorieVisible(EtbKategorie.System as EtbKategorieType)).toBe(false);
    });
  });

  describe('getExcludedKategorien()', () => {
    it('should return current excluded set', () => {
      // Given: Standard-State

      // When: Excluded Kategorien abrufen
      const excluded = getExcludedKategorien();

      // Then: Sollte SYSTEM enthalten
      expect(excluded.has(EtbKategorie.System as EtbKategorieType)).toBe(true);
      expect(excluded.size).toBe(1);
    });
  });

  describe('toggleErinnerungFilter()', () => {
    it('should toggle erinnerungFilterActive from false to true', () => {
      // Given: Store im Initial-State (erinnerungFilterActive: false)
      expect(kategorieFilterStore.state.erinnerungFilterActive).toBe(false);

      // When: Toggle
      toggleErinnerungFilter();

      // Then: Aktiv
      expect(kategorieFilterStore.state.erinnerungFilterActive).toBe(true);
    });

    it('should toggle erinnerungFilterActive from true to false', () => {
      // Given: Filter aktiv
      toggleErinnerungFilter();
      expect(kategorieFilterStore.state.erinnerungFilterActive).toBe(true);

      // When: Toggle wieder
      toggleErinnerungFilter();

      // Then: Inaktiv
      expect(kategorieFilterStore.state.erinnerungFilterActive).toBe(false);
    });

    it('should not affect excludedKategorien', () => {
      // Given: Standard excludedKategorien
      const beforeSize = kategorieFilterStore.state.excludedKategorien.size;

      // When: Toggle Erinnerung
      toggleErinnerungFilter();

      // Then: excludedKategorien unveraendert
      expect(kategorieFilterStore.state.excludedKategorien.size).toBe(beforeSize);
    });
  });

  describe('setErinnerungFilterActive()', () => {
    it('should set erinnerungFilterActive to true', () => {
      // When
      setErinnerungFilterActive(true);

      // Then
      expect(kategorieFilterStore.state.erinnerungFilterActive).toBe(true);
    });

    it('should set erinnerungFilterActive to false', () => {
      // Given: Aktiv
      setErinnerungFilterActive(true);

      // When
      setErinnerungFilterActive(false);

      // Then
      expect(kategorieFilterStore.state.erinnerungFilterActive).toBe(false);
    });

    it('should be idempotent', () => {
      // When: Zweimal true setzen
      setErinnerungFilterActive(true);
      setErinnerungFilterActive(true);

      // Then: Immer noch true
      expect(kategorieFilterStore.state.erinnerungFilterActive).toBe(true);
    });
  });

  describe('hideAllKategorien()', () => {
    it('should exclude all categories', () => {
      // Given: Standard (nur SYSTEM)
      expect(kategorieFilterStore.state.excludedKategorien.size).toBe(1);

      // When: Alle ausblenden
      hideAllKategorien();

      // Then: Alle 14 Kategorien ausgeblendet
      expect(kategorieFilterStore.state.excludedKategorien.size).toBe(ALLE_KATEGORIEN.length);
    });

    it('should make all categories invisible', () => {
      // When
      hideAllKategorien();

      // Then: Keine Kategorie sichtbar
      expect(isKategorieVisible(EtbKategorie.Alarmierung as EtbKategorieType)).toBe(false);
      expect(isKategorieVisible(EtbKategorie.Lage as EtbKategorieType)).toBe(false);
      expect(isKategorieVisible(EtbKategorie.System as EtbKategorieType)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid changes correctly', () => {
      // Given: Standard-State

      // When: Viele schnelle Aenderungen
      toggleKategorie(EtbKategorie.Alarmierung as EtbKategorieType);
      toggleKategorie(EtbKategorie.Lage as EtbKategorieType);
      toggleKategorie(EtbKategorie.Personal as EtbKategorieType);
      toggleKategorie(EtbKategorie.Alarmierung as EtbKategorieType); // zurueck

      // Then: Konsistenter State
      expect(isKategorieVisible(EtbKategorie.Alarmierung as EtbKategorieType)).toBe(true);
      expect(isKategorieVisible(EtbKategorie.Lage as EtbKategorieType)).toBe(false);
      expect(isKategorieVisible(EtbKategorie.Personal as EtbKategorieType)).toBe(false);
      expect(isKategorieVisible(EtbKategorie.System as EtbKategorieType)).toBe(false);
    });
  });
});
