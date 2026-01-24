import { useCallback, useState } from 'react';
import { PiArrowLeft, PiArrowCounterClockwise } from 'react-icons/pi';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Dialog } from '@/shared/ui/molecules/dialog.molecule';
import { cn } from '@/shared/ui/cn';
import { useAudioSettings } from '../../hooks';
import { ALARM_LEVELS, DEFAULT_AUDIO_SETTINGS, type AlarmLevel, type AudioLevelConfig as AudioLevelConfigType, type AudioSettings } from '../../schemas';
import { AudioLevelConfig } from '../molecules/AudioLevelConfig';
import { AudioToggle } from '../molecules/AudioToggle';

/**
 * Props für AudioSettingsPage
 */
export interface AudioSettingsPageProps {
  /** Callback für Zurück-Navigation */
  onBack?: () => void;
  /** Zusätzliche CSS-Klassen */
  className?: string;
}

/**
 * AudioSettingsPage - Vollständige Audio-Einstellungsseite
 *
 * Ermöglicht die Konfiguration aller Audio-Einstellungen:
 * - Globale Stummschaltung
 * - Ton-Auswahl pro Alarm-Level
 * - Lautstärke pro Alarm-Level
 * - Zurücksetzen auf Standardwerte
 *
 * **Story 2.7 AC1:** Audio-Einstellungen UI
 * **Story 2.7 AC5:** Persistierung im Tauri Store
 */
export function AudioSettingsPage({ onBack, className }: AudioSettingsPageProps) {
  const [settings, setSettings, , isLoading] = useAudioSettings();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Handler für globalen Toggle
  const handleToggleChange = useCallback(
    async (enabled: boolean) => {
      try {
        await setSettings({ ...settings, enabled });
        toast.success(enabled ? 'Töne aktiviert' : 'Töne deaktiviert');
      } catch {
        toast.error('Einstellung konnte nicht gespeichert werden');
      }
    },
    [settings, setSettings],
  );

  // Handler für Level-Konfiguration
  const handleLevelChange = useCallback(
    async (level: AlarmLevel, config: AudioLevelConfigType) => {
      try {
        const updatedSettings: AudioSettings = {
          ...settings,
          levels: {
            ...settings.levels,
            [level]: config,
          },
        };
        await setSettings(updatedSettings);
        // Kein Toast bei jeder Änderung (zu viel Noise)
      } catch {
        toast.error('Einstellung konnte nicht gespeichert werden');
      }
    },
    [settings, setSettings],
  );

  // Handler für Reset
  // Direkt neue Settings schreiben, kein Delete nötig (vermeidet Race Condition)
  const handleReset = useCallback(async () => {
    setIsResetting(true);
    try {
      await setSettings(DEFAULT_AUDIO_SETTINGS);
      toast.success('Einstellungen zurückgesetzt');
      setShowResetDialog(false);
    } catch {
      toast.error('Zurücksetzen fehlgeschlagen');
    } finally {
      setIsResetting(false);
    }
  }, [setSettings]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={cn('mx-auto max-w-2xl space-y-6 p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button type="button" appearance="ghost" size="sm" onClick={onBack} aria-label="Zurück">
              <PiArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="font-semibold text-2xl text-gray-900 dark:text-white">Audio-Einstellungen</h1>
        </div>

        <Button type="button" appearance="ghost" size="sm" onClick={() => setShowResetDialog(true)} aria-label="Einstellungen zurücksetzen">
          <PiArrowCounterClockwise className="h-5 w-5" />
          <span className="ml-2 hidden sm:inline">Zurücksetzen</span>
        </Button>
      </div>

      {/* Globaler Toggle */}
      <AudioToggle enabled={settings.enabled} onChange={handleToggleChange} />

      {/* Level-Konfigurationen */}
      <div className="space-y-4">
        <h2 className="font-medium text-gray-900 text-lg dark:text-white">Alarm-Stufen konfigurieren</h2>

        {ALARM_LEVELS.map((level) => (
          <AudioLevelConfig key={level} level={level} config={settings.levels[level]} onChange={(config) => handleLevelChange(level, config)} disabled={!settings.enabled} />
        ))}
      </div>

      {/* Hinweis bei deaktiviertem Audio */}
      {!settings.enabled && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">Alarm-Töne sind deaktiviert. Erinnerungen werden nur visuell angezeigt.</p>
        </div>
      )}

      {/* Reset-Bestätigungsdialog */}
      <Dialog.Confirm
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleReset}
        title="Einstellungen zurücksetzen?"
        message="Alle Audio-Einstellungen werden auf die Standardwerte zurückgesetzt. Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Zurücksetzen"
        variant="danger"
        isProcessing={isResetting}
      />
    </div>
  );
}
