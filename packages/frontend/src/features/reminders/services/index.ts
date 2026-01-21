/**
 * Reminders Services Module
 *
 * Exportiert alle Services für das Erinnerungen-Feature.
 */

export { SoundService, soundService, type SoundLevel } from './sound.service';

export {
  NotificationService,
  notificationService,
  checkNotificationPermission,
  requestNotificationPermission,
  sendNotification,
  sendErinnerungNotification,
  sendIntensifiedNotification,
  isNotificationSupported,
  type NotificationPermissionStatus,
  type SendNotificationOptions,
  type NotificationResult,
} from './notification.service';

export {
  TimerService,
  timerService,
  type OnTriggerCallback,
} from './timer.service';

export {
  notificationSetupService,
  initializeNotificationSetup,
  setNotificationNavigateCallback,
  ERINNERUNG_CHANNEL_ID,
  ERINNERUNG_ACTION_TYPE_ID,
  ERINNERUNG_ACTION_OPEN_ID,
  type NavigateToErinnerungCallback,
} from './notification-setup.service';

export {
  TrayService,
  trayService,
  type TrayResult,
} from './tray.service';

export {
  IntensificationService,
  intensificationService,
  type IntensificationCallback,
} from './intensification.service';
