// Schemas & Types
export {
  ALARM_LEVEL_LABELS,
  ALARM_LEVELS,
  audioLevelConfigSchema,
  audioSettingsSchema,
  DEFAULT_AUDIO_SETTINGS,
  isValidAudioSettings,
  SOUND_FILES,
  SOUND_OPTION_LABELS,
  SOUND_OPTIONS,
  toAudioVolume,
  toVolumePercent,
  validateAudioSettings,
} from './schemas';

export type { AlarmLevel, AudioLevelConfig, AudioSettings, SoundOption } from './schemas';

// Hooks
export {
  AUDIO_SETTINGS_STORE_KEY,
  getAudioLevelConfig,
  getAudioSettings,
  isAudioEnabled,
  resetAudioSettings,
  setAudioSettings,
  useAudioSettings,
} from './hooks';

// UI Components
export {
  AudioLevelConfig as AudioLevelConfigComponent,
  AudioToggle,
  AudioSettingsPage,
} from './ui';

export type { AudioLevelConfigProps, AudioToggleProps, AudioSettingsPageProps } from './ui';
