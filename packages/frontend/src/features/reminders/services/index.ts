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
