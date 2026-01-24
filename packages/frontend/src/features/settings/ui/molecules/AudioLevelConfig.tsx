import { useCallback, useEffect, useMemo, useState } from 'react';
import { PiBell, PiPlay, PiSiren, PiWarning } from 'react-icons/pi';
import { useDebouncedCallback } from 'use-debounce';
import { Select } from '@/shared/ui/atoms/select.atom';
import { Label } from '@/shared/ui/atoms/label.atom';
import { Button } from '@/shared/ui/atoms/button.atom';
import { RangeSlider } from '@/shared/ui/molecules/form/RangeSlider.molecule';
import { cn } from '@/shared/ui/cn';
import { ALARM_LEVEL_LABELS, SOUND_OPTION_LABELS, SOUND_OPTIONS, type AlarmLevel, type AudioLevelConfig as AudioLevelConfigType, type SoundOption } from '../../schemas';
import { soundService } from '@/features/reminders/services/sound.service';

/**
 * Props für AudioLevelConfig Komponente
 */
export interface AudioLevelConfigProps {
  /** Alarm-Level ('info' | 'warning' | 'urgent') */
  level: AlarmLevel;
  /** Aktuelle Konfiguration für dieses Level */
  config: AudioLevelConfigType;
  /** Callback wenn Konfiguration geändert wird */
  onChange: (config: AudioLevelConfigType) => void;
  /** Ob Komponente deaktiviert ist (z.B. wenn Audio global aus) */
  disabled?: boolean;
  /** Zusätzliche CSS-Klassen */
  className?: string;
}

/**
 * Icon-Mapping für Alarm-Level
 */
const LEVEL_ICONS: Record<AlarmLevel, React.ElementType> = {
  info: PiBell,
  warning: PiWarning,
  urgent: PiSiren,
};

/**
 * Farb-Mapping für Alarm-Level (für visuelles Feedback)
 */
const LEVEL_COLORS: Record<AlarmLevel, string> = {
  info: 'text-blue-500 dark:text-blue-400',
  warning: 'text-yellow-500 dark:text-yellow-400',
  urgent: 'text-red-500 dark:text-red-400',
};

/**
 * AudioLevelConfig - Konfiguration für ein einzelnes Alarm-Level
 *
 * Ermöglicht die Auswahl des Sounds und der Lautstärke für ein
 * bestimmtes Alarm-Level (info, warning, urgent).
 *
 * **Story 2.7 AC2:** Ton-Auswahl pro Stufe
 * **Story 2.7 AC3:** Lautstärke-Einstellung pro Stufe
 * **Story 2.7 AC4:** Vorschau-Funktion
 */
export function AudioLevelConfig({ level, config, onChange, disabled = false, className }: AudioLevelConfigProps) {
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  // Lokaler Volume-State für sofortiges UI-Feedback (Issue 2 Fix)
  const [localVolume, setLocalVolume] = useState(config.volume);

  const Icon = LEVEL_ICONS[level];
  const levelLabel = ALARM_LEVEL_LABELS[level];
  const levelColor = LEVEL_COLORS[level];

  // Sync lokalen State bei externem Change (z.B. Reset)
  useEffect(() => {
    setLocalVolume(config.volume);
  }, [config.volume]);

  // Sound-Optionen für Select
  const soundOptions = useMemo(
    () =>
      SOUND_OPTIONS.map((sound) => ({
        value: sound,
        label: SOUND_OPTION_LABELS[sound],
      })),
    [],
  );

  // Sound-Änderung Handler
  const handleSoundChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({
        ...config,
        sound: e.target.value as SoundOption,
      });
    },
    [config, onChange],
  );

  // Debounced Persistierung (separiert von UI-Update)
  const debouncedPersist = useDebouncedCallback((volume: number) => {
    onChange({
      ...config,
      volume,
    });
  }, 300);

  // Volume-Änderung Handler: Sofort lokal, debounced persistieren
  const handleVolumeChange = useCallback(
    (volume: number) => {
      setLocalVolume(volume);
      debouncedPersist(volume);
    },
    [debouncedPersist],
  );

  // Vorschau abspielen
  const handlePreview = useCallback(async () => {
    if (isPreviewPlaying || disabled) return;

    setIsPreviewPlaying(true);
    try {
      await soundService.playPreview(level, config.sound, config.volume);
    } finally {
      // Kurze Verzögerung bevor Button wieder aktiviert wird
      setTimeout(() => setIsPreviewPlaying(false), 500);
    }
  }, [level, config.sound, config.volume, isPreviewPlaying, disabled]);

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50', disabled && 'opacity-50', className)}>
      {/* Header mit Icon und Level-Name */}
      <div className="mb-4 flex items-center gap-2">
        <Icon className={cn('h-5 w-5', levelColor)} aria-hidden="true" />
        <span className="font-medium text-gray-900 dark:text-white">{levelLabel}</span>
      </div>

      {/* Konfigurationsfelder */}
      <div className="space-y-4">
        {/* Sound-Auswahl */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor={`sound-${level}`}>Ton</Label>
            <Select id={`sound-${level}`} options={soundOptions} value={config.sound} onChange={handleSoundChange} disabled={disabled} selectSize="md" fullWidth />
          </div>

          {/* Preview Button */}
          <Button type="button" appearance="ghost" size="md" onClick={handlePreview} disabled={disabled || isPreviewPlaying} aria-label={`${levelLabel} Vorschau abspielen`} className="shrink-0">
            <PiPlay className={cn('h-5 w-5', isPreviewPlaying && 'animate-pulse')} />
            <span className="sr-only">Vorschau</span>
          </Button>
        </div>

        {/* Lautstärke-Slider */}
        <RangeSlider id={`volume-${level}`} label="Lautstärke: {value}%" value={localVolume} min={0} max={100} step={5} onChange={handleVolumeChange} disabled={disabled} />
      </div>
    </div>
  );
}
