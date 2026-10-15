import {
  captureSessionLocalSchemaV1,
  createEmptySchnellzaehler,
  type CaptureSessionLocal,
  type CaptureSessionStatus,
  type CapturePlatform,
  type PatientLocal,
  type PendingPatientEvent,
  type SkCode,
} from '../schemas/capture-session.schema';
import { createCaptureSessionId } from './cuid';
import { getCaptureStorage } from './standalone-storage';

/**
 * CRUD- und Mutations-Helper für `CaptureSessionLocal`. Trennt I/O
 * (Persistenz) von reinen, stateless Aggregat-Mutationen — Tests können beide
 * Schichten unabhängig validieren.
 *
 * **Race-Condition-Hinweis:** `markStatus` und alle anderen Read-Modify-Write
 * Helper sind nicht atomar. Bei konkurrierenden Schreibern gewinnt der letzte
 * Aufruf. Für MVP akzeptabel (Story 2.1); konkurrierende Mutationen sind
 * Folge-Stories (2.4 PIN-Lock / 2.7 Attach-Use-Case) als Concern markiert.
 */

export interface CreateSessionInput {
  readonly deviceId: string;
  readonly deviceLabel?: string;
  readonly appVersion: string;
  readonly platform: CapturePlatform;
  readonly startedAt?: string;
}

export function createSession(input: CreateSessionInput): CaptureSessionLocal {
  return {
    sessionId: createCaptureSessionId(),
    schemaVersion: 1,
    deviceId: input.deviceId,
    deviceLabel: input.deviceLabel,
    appVersion: input.appVersion,
    platform: input.platform,
    startedAt: input.startedAt ?? new Date().toISOString(),
    schnellzaehler: createEmptySchnellzaehler(),
    patients: [],
    pendingEvents: [],
    status: 'open',
  };
}

export async function saveSession(session: CaptureSessionLocal): Promise<void> {
  const validated = captureSessionLocalSchemaV1.parse(session);
  await getCaptureStorage().saveSession(validated);
}

export async function loadSession(sessionId: string): Promise<CaptureSessionLocal | null> {
  return getCaptureStorage().loadSession(sessionId);
}

export async function loadAllSessions(): Promise<CaptureSessionLocal[]> {
  return getCaptureStorage().loadAllSessions();
}

export async function markStatus(sessionId: string, status: CaptureSessionStatus): Promise<CaptureSessionLocal | null> {
  const current = await loadSession(sessionId);
  if (!current) return null;
  const next: CaptureSessionLocal = { ...current, status };
  await saveSession(next);
  return next;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getCaptureStorage().deleteSession(sessionId);
}

/**
 * Inkrementiert den Schnellzähler für eine SK-Kategorie und hängt ein
 * `'sichtung'`-PendingEvent an. Entscheidung gem. AC8: Schnellzähler-Tap mapt
 * im MVP auf `'sichtung'` mit `sk = tappedSk`, da `'sk-upgrade'` ein
 * nicht-nullbares `fromSk` verlangt (Vor-Sichtung unbekannt).
 */
export function withIncrementedSk(session: CaptureSessionLocal, sk: SkCode, capturedAt: string = new Date().toISOString()): CaptureSessionLocal {
  const nextSchnellzaehler = { ...session.schnellzaehler, [sk]: session.schnellzaehler[sk] + 1 };
  const event: PendingPatientEvent = { type: 'sichtung', capturedAt, sk };
  return {
    ...session,
    schnellzaehler: nextSchnellzaehler,
    pendingEvents: [...session.pendingEvents, event],
  };
}

export function withAppendedPatient(session: CaptureSessionLocal, patient: PatientLocal): CaptureSessionLocal {
  return { ...session, patients: [...session.patients, patient] };
}

export function withAppendedPendingEvent(session: CaptureSessionLocal, patientId: string, event: PendingPatientEvent): CaptureSessionLocal {
  // Wirft bei unbekannter patientId, statt das Event still zu verwerfen: ein
  // stilles No-Op (map ohne Treffer) würde in der MANV-Triage klinische Events
  // verlieren, während jede Schicht Erfolg meldet (analog `requireSession`).
  if (!session.patients.some((p) => p.patientId === patientId)) {
    throw new Error(`[capture:session-repository] Patient ${patientId} in Session ${session.sessionId} unbekannt`);
  }
  return {
    ...session,
    patients: session.patients.map((p) => (p.patientId === patientId ? { ...p, pendingEvents: [...p.pendingEvents, event] } : p)),
  };
}

export function withAttached(session: CaptureSessionLocal, attachedTo: NonNullable<CaptureSessionLocal['attachedTo']>): CaptureSessionLocal {
  return { ...session, status: 'attached', attachedTo };
}

export function withFailureContext(session: CaptureSessionLocal, failureContext: NonNullable<CaptureSessionLocal['failureContext']>): CaptureSessionLocal {
  return { ...session, status: 'failed', failureContext };
}
