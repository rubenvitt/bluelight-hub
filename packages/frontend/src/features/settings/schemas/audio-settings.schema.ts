import { z } from 'zod';

/**
 * Verfügbare Sound-Optionen für Alarm-Töne.
 * Jede Option entspricht einer Sound-Datei pro Level.
 */
export const SOUND_OPTIONS = ['default', 'chime', 'bell', 'alert'] as const;
export type SoundOption = (typeof SOUND_OPTIONS)[number];

/**
 * Alarm-Stufen für Erinnerungen.
 * Entspricht den Intensivierungs-Leveln aus Story 2.3/2.4.
 */
export const ALARM_LEVELS = ['info', 'warning', 'urgent'] as const;
export type AlarmLevel = (typeof ALARM_LEVELS)[number];

/**
 * Zod Schema für eine einzelne Level-Konfiguration.
 * Validiert Sound-Auswahl und Lautstärke (0-100%).
 */
export const audioLevelConfigSchema = z.object({
  sound: z.enum(SOUND_OPTIONS),
  volume: z.number().min(0).max(100).int(),
});

export type AudioLevelConfig = z.infer<typeof audioLevelConfigSchema>;

/**
 * Zod Schema für die gesamten Audio-Einstellungen.
 * Wird im Tauri Store unter 'audio.settings' persistiert.
 */
export const audioSettingsSchema = z.object({
  enabled: z.boolean(),
  levels: z.object({
    info: audioLevelConfigSchema,
    warning: audioLevelConfigSchema,
    urgent: audioLevelConfigSchema,
  }),
});

export type AudioSettings = z.infer<typeof audioSettingsSchema>;

/**
 * Default-Werte für Audio-Einstellungen.
 * Werden bei erstem App-Start oder nach Reset angewendet.
 *
 * - Info: 70% Lautstärke (dezent für normale Erinnerungen)
 * - Warning: 85% Lautstärke (auffälliger nach 30s ohne Reaktion)
 * - Urgent: 100% Lautstärke (maximale Aufmerksamkeit nach 60s)
 */
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  enabled: true,
  levels: {
    info: { sound: 'default', volume: 70 },
    warning: { sound: 'default', volume: 85 },
    urgent: { sound: 'default', volume: 100 },
  },
};

/**
 * Sound-Datei Mapping für alle Kombinationen aus Level und Sound-Option.
 * Pfade sind relativ zum public-Verzeichnis.
 */
export const SOUND_FILES: Record<AlarmLevel, Record<SoundOption, string>> = {
  info: {
    default: '/sounds/alarm-info-default.mp3',
    chime: '/sounds/alarm-info-chime.mp3',
    bell: '/sounds/alarm-info-bell.mp3',
    alert: '/sounds/alarm-info-alert.mp3',
  },
  warning: {
    default: '/sounds/alarm-warning-default.mp3',
    chime: '/sounds/alarm-warning-chime.mp3',
    bell: '/sounds/alarm-warning-bell.mp3',
    alert: '/sounds/alarm-warning-alert.mp3',
  },
  urgent: {
    default: '/sounds/alarm-urgent-default.mp3',
    chime: '/sounds/alarm-urgent-chime.mp3',
    bell: '/sounds/alarm-urgent-bell.mp3',
    alert: '/sounds/alarm-urgent-alert.mp3',
  },
};

/**
 * Labels für Sound-Optionen (für UI-Anzeige).
 */
export const SOUND_OPTION_LABELS: Record<SoundOption, string> = {
  default: 'Standard',
  chime: 'Glockenspiel',
  bell: 'Klingel',
  alert: 'Signalton',
};

/**
 * Labels für Alarm-Level (für UI-Anzeige).
 */
export const ALARM_LEVEL_LABELS: Record<AlarmLevel, string> = {
  info: 'Info-Alarm',
  warning: 'Warning-Alarm',
  urgent: 'Urgent-Alarm',
};

/**
 * Konvertiert Volume-Prozent (0-100) zu Audio-API-Wert (0.0-1.0).
 * Clamps ungültige Werte auf gültigen Bereich.
 */
export const toAudioVolume = (percent: number): number => {
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, percent)) / 100;
};

/**
 * Konvertiert Audio-API-Wert (0.0-1.0) zu Volume-Prozent (0-100).
 * Clamps ungültige Werte auf gültigen Bereich.
 */
export const toVolumePercent = (audioVolume: number): number => {
  if (!Number.isFinite(audioVolume)) return 0;
  return Math.round(Math.max(0, Math.min(1, audioVolume)) * 100);
};

/**
 * Validiert AudioSettings mit Zod Schema.
 * Gibt validierte Settings zurück oder wirft bei Fehlern.
 */
export const validateAudioSettings = (data: unknown): AudioSettings => {
  return audioSettingsSchema.parse(data);
};

/**
 * Prüft ob Daten valide AudioSettings sind.
 * Gibt boolean zurück ohne zu werfen.
 */
export const isValidAudioSettings = (data: unknown): data is AudioSettings => {
  return audioSettingsSchema.safeParse(data).success;
};
