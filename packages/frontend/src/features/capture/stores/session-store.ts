import { Store, useStore } from '@tanstack/react-store';
import type { CaptureSessionLocal, CapturePlatform, PatientLocal, PendingPatientEvent, SkCode } from '../schemas/capture-session.schema';
import { createSession, loadAllSessions, saveSession, withAppendedPatient, withAppendedPendingEvent, withFailureContext, withIncrementedSk } from '../lib/session-repository';

/**
 * In-Memory State der aktiven Capture-Sessions. Bridge zum Persistenz-Layer:
 * Mutationen aktualisieren synchron den Store (UI rendert in ≤ 100 ms,
 * NFR-P3), persistieren danach im Hintergrund (UX-DR23 ≤ 200 ms).
 *
 * Die Persistenz-Aufrufe sind sequentiell durch eine Promise-Chain, damit
 * konkurrierende `saveSession`-Calls nicht in Race-Conditions kippen. Aus
 * Sicht der UI bleibt das Fire-and-Forget — der Store ist die Source of Truth
 * für den Render-Pfad.
 */

export interface CaptureSessionsStoreState {
  readonly sessions: ReadonlyMap<string, CaptureSessionLocal>;
  readonly activeSessionId: string | null;
  readonly isHydrated: boolean;
  /**
   * Letzter Persist-Fehler pro Session (sessionId → Fehlermeldung). Wird gesetzt,
   * wenn `saveSession` fehlschlägt, und bei erfolgreichem Re-Persist geleert. So
   * wird ein fehlgeschlagener Disk-Write für die UI beobachtbar, ohne den
   * fire-and-forget-Render-Pfad zu brechen (AC7).
   */
  readonly persistErrors: ReadonlyMap<string, string>;
}

const initialState: CaptureSessionsStoreState = {
  sessions: new Map(),
  activeSessionId: null,
  isHydrated: false,
  persistErrors: new Map(),
};

export const captureSessionsStore = new Store<CaptureSessionsStoreState>(initialState);

let persistChain: Promise<void> = Promise.resolve();

/**
 * Erzwingt, dass alle bisher in der Chain enthaltenen Persist-Aufrufe
 * abgeschlossen sind. Wird in Tests gebraucht; in Production nicht notwendig.
 */
export function flushCapturePersist(): Promise<void> {
  return persistChain;
}

/**
 * Setzt oder löscht den Persist-Fehler einer Session im Store-State.
 * `message === null` löscht einen ggf. vorhandenen Eintrag.
 */
function setPersistError(sessionId: string, message: string | null): void {
  captureSessionsStore.setState((state) => {
    const nextErrors = new Map(state.persistErrors);
    if (message === null) {
      if (!nextErrors.has(sessionId)) return state;
      nextErrors.delete(sessionId);
    } else {
      nextErrors.set(sessionId, message);
    }
    return { ...state, persistErrors: nextErrors };
  });
}

function schedulePersist(session: CaptureSessionLocal): Promise<void> {
  const next = persistChain
    .then(() => saveSession(session))
    .then(() => {
      // Erfolgreicher Write löscht einen evtl. vorherigen Fehler dieser Session.
      setPersistError(session.sessionId, null);
    })
    .catch((error) => {
      // Der Fehler wird NICHT verschluckt: Aus Render-Sicht bleibt der Aufruf
      // fire-and-forget (das Promise resolved, damit die Persist-Chain weiter-
      // läuft), aber der Fehler wird im Store-State sichtbar gemacht. Damit ist
      // ein fehlgeschlagener Disk-Write für die UI beobachtbar (Banner/Retry),
      // statt still "gespeichert" zu suggerieren (AC2/AC7).
      console.error('[capture:session-store] saveSession fehlgeschlagen', {
        sessionId: session.sessionId,
        error,
      });
      setPersistError(session.sessionId, error instanceof Error ? error.message : String(error));
    });
  persistChain = next;
  return next;
}

function setSession(session: CaptureSessionLocal): void {
  captureSessionsStore.setState((state) => {
    const nextSessions = new Map(state.sessions);
    nextSessions.set(session.sessionId, session);
    return { ...state, sessions: nextSessions };
  });
}

function removeSession(sessionId: string): void {
  captureSessionsStore.setState((state) => {
    const nextSessions = new Map(state.sessions);
    nextSessions.delete(sessionId);
    return {
      ...state,
      sessions: nextSessions,
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    };
  });
}

let bootstrapPromise: Promise<void> | null = null;

/**
 * Lädt persistierte Sessions in den Store. `discarded`-Sessions werden
 * übersprungen (keine Recovery für verworfene Erfassungen).
 *
 * Ein In-Flight-Guard verhindert, dass zwei parallele Aufrufer (z. B. zwei
 * Komponenten beim Mount) sich gegenseitig den State clobbern. Schlägt die
 * Hydration fehl (Key-Fehler, DB blockiert), bleibt `isHydrated` false und der
 * In-Flight-Cache wird geleert, damit ein Retry möglich ist — statt dauerhaft
 * am rejected Promise zu hängen.
 */
export function bootstrapCaptureSessions(): Promise<void> {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    const persisted = await loadAllSessions();
    const sessions = new Map<string, CaptureSessionLocal>();
    for (const session of persisted) {
      if (session.status === 'discarded') continue;
      sessions.set(session.sessionId, session);
    }
    captureSessionsStore.setState((state) => ({
      ...state,
      sessions,
      isHydrated: true,
    }));
  })();

  bootstrapPromise.catch(() => {
    bootstrapPromise = null;
  });

  return bootstrapPromise;
}

export interface StartSessionInput {
  readonly deviceId: string;
  readonly deviceLabel?: string;
  readonly appVersion: string;
  readonly platform: CapturePlatform;
  readonly startedAt?: string;
}

export async function startSession(input: StartSessionInput): Promise<string> {
  const session = createSession(input);
  setSession(session);
  captureSessionsStore.setState((state) => ({ ...state, activeSessionId: session.sessionId }));
  await schedulePersist(session);
  return session.sessionId;
}

function requireSession(sessionId: string): CaptureSessionLocal {
  const session = captureSessionsStore.state.sessions.get(sessionId);
  if (!session) {
    throw new Error(`[capture:session-store] Session ${sessionId} unbekannt`);
  }
  return session;
}

export function incrementSk(sessionId: string, sk: SkCode, capturedAt: string = new Date().toISOString()): Promise<void> {
  const current = requireSession(sessionId);
  const next = withIncrementedSk(current, sk, capturedAt);
  setSession(next);
  return schedulePersist(next);
}

export function appendPatient(sessionId: string, patient: PatientLocal): Promise<void> {
  const next = withAppendedPatient(requireSession(sessionId), patient);
  setSession(next);
  return schedulePersist(next);
}

export function appendPendingEventForPatient(sessionId: string, patientId: string, event: PendingPatientEvent): Promise<void> {
  const next = withAppendedPendingEvent(requireSession(sessionId), patientId, event);
  setSession(next);
  return schedulePersist(next);
}

export function selectSession(sessionId: string | null): void {
  captureSessionsStore.setState((state) => ({ ...state, activeSessionId: sessionId }));
}

export function markFailureContext(sessionId: string, failureContext: NonNullable<CaptureSessionLocal['failureContext']>): Promise<void> {
  const next = withFailureContext(requireSession(sessionId), failureContext);
  setSession(next);
  return schedulePersist(next);
}

export async function discardSession(sessionId: string): Promise<void> {
  const current = requireSession(sessionId);
  const next: CaptureSessionLocal = { ...current, status: 'discarded' };
  setSession(next);
  await schedulePersist(next);
  // Erst aus dem Memory entfernen, wenn der `discarded`-Status wirklich
  // persistiert wurde. Wird der Persist-Fehler gesetzt, behält der Disk-Record
  // noch den alten Status — würden wir hier blind entfernen, hydrierte der
  // nächste Bootstrap die "verworfene" Session wieder (stille Wiederauferstehung).
  if (!captureSessionsStore.state.persistErrors.has(sessionId)) {
    removeSession(sessionId);
  }
}

/**
 * Test-Helper: Resettet den Store-Zustand. Production nutzt das nicht.
 */
export function __resetCaptureSessionsStoreForTests(): void {
  persistChain = Promise.resolve();
  bootstrapPromise = null;
  captureSessionsStore.setState(() => ({
    sessions: new Map(),
    activeSessionId: null,
    isHydrated: false,
    persistErrors: new Map(),
  }));
}

export function useCaptureSessions(): readonly CaptureSessionLocal[] {
  return useStore(captureSessionsStore, (state) => Array.from(state.sessions.values()));
}

export function useActiveCaptureSession(): CaptureSessionLocal | null {
  return useStore(captureSessionsStore, (state) => (state.activeSessionId ? (state.sessions.get(state.activeSessionId) ?? null) : null));
}

export function useCaptureSessionsHydrated(): boolean {
  return useStore(captureSessionsStore, (state) => state.isHydrated);
}

/**
 * Liefert den letzten Persist-Fehler einer Session (oder `null`). Die UI nutzt
 * das, um einen fehlgeschlagenen Disk-Write sichtbar zu machen / Retry anzubieten.
 */
export function useCapturePersistError(sessionId: string): string | null {
  return useStore(captureSessionsStore, (state) => state.persistErrors.get(sessionId) ?? null);
}
