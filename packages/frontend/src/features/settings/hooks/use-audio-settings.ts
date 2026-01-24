import { useCallback, useMemo, useState } from 'react';
import { useStore } from '@/shared/hooks/use-store';
import { getStoreValue, setStoreValue, deleteStoreKey } from '@/shared/lib/store.service';
import { DEFAULT_AUDIO_SETTINGS, isValidAudioSettings, type AlarmLevel, type AudioLevelConfig, type AudioSettings } from '../schemas';

/**
 * Tauri Store Schlüssel für Audio-Einstellungen.
 * Wird konsistent in Hook und Helper-Funktionen verwendet.
 */
export const AUDIO_SETTINGS_STORE_KEY = 'audio.settings';

/**
 * React Hook für Audio-Einstellungen mit Tauri Store Persistenz.
 *
 * Nutzt den useStore Hook für automatische Synchronisation mit dem
 * persistenten Tauri Store. Änderungen werden sofort gespeichert
 * und überleben App-Neustarts.
 *
 * @returns Tuple mit [settings, setSettings, resetSettings, isLoading, error]
 *
 * @example
 * ```tsx
 * const [settings, setSettings, resetSettings, isLoading, error] = useAudioSettings();
 *
 * // Alle Einstellungen aktualisieren
 * await setSettings({ ...settings, enabled: false });
 *
 * // Auf Defaults zurücksetzen
 * await resetSettings();
 *
 * // Fehlerbehandlung
 * if (error) {
 *   console.error('Settings error:', error.message);
 * }
 * ```
 */
export function useAudioSettings() {
  const [settings, setSettingsInternal, resetSettingsInternal, isLoading] = useStore<AudioSettings>(AUDIO_SETTINGS_STORE_KEY, DEFAULT_AUDIO_SETTINGS);
  const [error, setError] = useState<Error | null>(null);

  // Validiere Settings mit Zod Schema, fallback auf Defaults bei ungültigen Daten
  const validatedSettings = useMemo(() => {
    const current = settings ?? DEFAULT_AUDIO_SETTINGS;
    if (!isValidAudioSettings(current)) {
      console.warn('[useAudioSettings] Invalid settings in store, using defaults');
      return DEFAULT_AUDIO_SETTINGS;
    }
    return current;
  }, [settings]);

  // Wrap setSettings mit Error-Handling
  const setSettings = useCallback(
    async (newSettings: AudioSettings) => {
      setError(null);
      try {
        await setSettingsInternal(newSettings);
      } catch (err) {
        const saveError = err instanceof Error ? err : new Error('Failed to save audio settings');
        setError(saveError);
        throw saveError;
      }
    },
    [setSettingsInternal],
  );

  // Wrap resetSettings mit Error-Handling
  const resetSettings = useCallback(async () => {
    setError(null);
    try {
      await resetSettingsInternal();
    } catch (err) {
      const resetError = err instanceof Error ? err : new Error('Failed to reset audio settings');
      setError(resetError);
      throw resetError;
    }
  }, [resetSettingsInternal]);

  return [validatedSettings, setSettings, resetSettings, isLoading, error] as const;
}

/**
 * Liest Audio-Einstellungen direkt aus dem Tauri Store.
 *
 * Für Verwendung außerhalb von React Komponenten (z.B. in Services).
 * Validiert die gespeicherten Daten und gibt bei ungültigen Werten
 * die Default-Einstellungen zurück.
 *
 * @returns AudioSettings (nie undefined)
 *
 * @example
 * ```ts
 * // In SoundService
 * const settings = await getAudioSettings();
 * if (!settings.enabled) return { success: true, skipped: true };
 * ```
 */
export async function getAudioSettings(): Promise<AudioSettings> {
  try {
    const stored = await getStoreValue<AudioSettings>(AUDIO_SETTINGS_STORE_KEY);

    if (!stored) {
      return DEFAULT_AUDIO_SETTINGS;
    }

    // Validiere gespeicherte Daten
    if (!isValidAudioSettings(stored)) {
      console.warn('[AudioSettings] Invalid stored data, using defaults');
      return DEFAULT_AUDIO_SETTINGS;
    }

    return stored;
  } catch (error) {
    console.error('[AudioSettings] Failed to get settings:', error);
    return DEFAULT_AUDIO_SETTINGS;
  }
}

/**
 * Speichert Audio-Einstellungen im Tauri Store.
 *
 * Für Verwendung außerhalb von React Komponenten.
 * Validiert die Daten vor dem Speichern.
 *
 * @param settings - Vollständige Audio-Einstellungen
 *
 * @example
 * ```ts
 * await setAudioSettings({
 *   enabled: true,
 *   levels: {
 *     info: { sound: 'chime', volume: 70 },
 *     warning: { sound: 'default', volume: 85 },
 *     urgent: { sound: 'alert', volume: 100 },
 *   },
 * });
 * ```
 */
export async function setAudioSettings(settings: AudioSettings): Promise<void> {
  if (!isValidAudioSettings(settings)) {
    throw new Error('[AudioSettings] Invalid settings provided');
  }

  await setStoreValue(AUDIO_SETTINGS_STORE_KEY, settings);
}

/**
 * Setzt Audio-Einstellungen auf Default-Werte zurück.
 *
 * Löscht den Store-Eintrag, sodass beim nächsten Lesen
 * die Default-Werte verwendet werden.
 *
 * @example
 * ```ts
 * // In Settings Page "Zurücksetzen" Button
 * const handleReset = async () => {
 *   await resetAudioSettings();
 *   showToast('Einstellungen zurückgesetzt');
 * };
 * ```
 */
export async function resetAudioSettings(): Promise<void> {
  await deleteStoreKey(AUDIO_SETTINGS_STORE_KEY);
}

/**
 * Liest Konfiguration für ein bestimmtes Alarm-Level.
 *
 * Convenience-Funktion für SoundService.
 *
 * @param level - Alarm-Level ('info' | 'warning' | 'urgent')
 * @returns AudioLevelConfig für das Level
 */
export async function getAudioLevelConfig(level: AlarmLevel): Promise<AudioLevelConfig> {
  const settings = await getAudioSettings();
  return settings.levels[level];
}

/**
 * Prüft ob Audio aktiviert ist.
 *
 * Convenience-Funktion für SoundService.
 *
 * @returns true wenn Audio aktiviert, false wenn stummgeschaltet
 */
export async function isAudioEnabled(): Promise<boolean> {
  const settings = await getAudioSettings();
  return settings.enabled;
}
