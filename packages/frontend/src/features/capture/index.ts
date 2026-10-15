/**
 * Public-API der Capture-Domäne (Standalone-Erfassung, ADR-017, Story 2.1).
 *
 * Folge-Stories (2.2 UI, 2.3 Patient-Form, 2.4 PIN-Lock, 2.5–2.8 Discovery/
 * Attach/Cleanup) konsumieren ausschließlich diese Re-Exports. Interne Helper
 * (`crypto-key-store`, `aes-gcm`, IDB-Wrapper) bleiben encapsuliert.
 */

export {
  captureSessionLocalSchemaV1,
  captureSessionStatusSchema,
  capturePlatformSchema,
  patientLocalSchema,
  pendingPatientEventSchema,
  schnellzaehlerSchema,
  skCodeSchema,
  createEmptySchnellzaehler,
} from './schemas/capture-session.schema';

export type { CaptureSessionLocal, CaptureSessionStatus, CapturePlatform, PatientLocal, PendingPatientEvent, Schnellzaehler, SkCode } from './schemas/capture-session.schema';

export { SK_CODE_VALUES } from './constants/sk-codes';

export {
  appendPatient,
  appendPendingEventForPatient,
  bootstrapCaptureSessions,
  captureSessionsStore,
  discardSession,
  flushCapturePersist,
  incrementSk,
  markFailureContext,
  selectSession,
  startSession,
  useActiveCaptureSession,
  useCapturePersistError,
  useCaptureSessions,
  useCaptureSessionsHydrated,
} from './stores/session-store';

export {
  createSession,
  deleteSession,
  loadAllSessions,
  loadSession,
  markStatus,
  saveSession,
  withAppendedPatient,
  withAppendedPendingEvent,
  withAttached,
  withFailureContext,
  withIncrementedSk,
} from './lib/session-repository';

export { getOrCreateDeviceId, DEVICE_ID_STORAGE_KEY } from './lib/device-id';

export { createCaptureSessionId, createPatientLocalId, createDeviceId } from './lib/cuid';

/**
 * Side-Effect-Import (Browser-Pfad): `indexeddb-capture-storage.ts` registriert
 * beim Import seine Factory als Capture-Storage-Adapter. Der Bootstrap läuft
 * über die öffentliche `bootstrapCaptureSessions()`-Funktion — die IDB-Wrapper
 * selbst (`createIndexedDbCaptureStorage`, Test-Reset-Helper) bleiben gemäß AC8
 * intern und werden NICHT re-exportiert (Encapsulation). Tauri-Runtime nutzt den
 * eingebauten Tauri-Pfad und ignoriert diese Registrierung.
 */
import './lib/indexeddb-capture-storage';
