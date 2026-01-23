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
} from './audio-settings.schema';

export type {
  AlarmLevel,
  AudioLevelConfig,
  AudioSettings,
  SoundOption,
} from './audio-settings.schema';
