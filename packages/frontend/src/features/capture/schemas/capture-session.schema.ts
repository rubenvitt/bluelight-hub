import { z } from 'zod';
import { SK_CODE_VALUES, type SkCode } from '../constants/sk-codes';

/**
 * Zod-Schemas + TypeScript-Typen für das lokale `CaptureSessionLocal`-Aggregat.
 *
 * Gilt als Single Source of Truth für FE-/BE-DTO-Mapping (ADR-017).
 * **Wichtig:** SK-Werte werden ausschließlich als kanonische DIN-Codes
 * (`SK_I | SK_II | SK_III | SK_IV | TOT`) persistiert. Farb-Strings sind
 * reines UI-Mapping (`features/patienten/constants/sk-color-map.ts`).
 *
 * ADR-017 listet im Original Farb-Strings — Story 2.1 setzt das hier
 * bewusst auf DIN-Codes um (siehe Memory `manv_sichtungskategorien_farben`).
 * ADR-Update folgt in Story 4.6.
 */

export const skCodeSchema = z.enum(SK_CODE_VALUES);
export type { SkCode };

const isoTimestamp = z.string().datetime({ offset: true });

// AC4: ID-Body 24–32 alphanumerisch (CUID2-kompatibel; cuid2 createId() liefert
// per Default 24 Zeichen). Der Range deckt spätere Längen-Konfigurationen mit ab.
const cuidIdRegex = (prefix: string): RegExp => new RegExp(`^${prefix}_[a-z0-9]{24,32}$`);

export const sessionIdSchema = z.string().regex(cuidIdRegex('cs'));
export const patientLocalIdSchema = z.string().regex(cuidIdRegex('pl'));
export const deviceIdSchema = z.string().regex(cuidIdRegex('dev'));

/**
 * Diskriminator-Werte gemäß ADR-017 Storage-Vertrag.
 *
 * Schnellzähler-Tap mapt im MVP auf `'sichtung'` mit `sk = tappedSk`.
 * Begründung: AC8 fixiert die Diskriminator-Liste; `'sk-upgrade'` verlangt
 * `fromSk: SkCode` (nicht nullable), passt also nicht für initiale Erfassung.
 */
export const pendingPatientEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('sichtung'),
    capturedAt: isoTimestamp,
    sk: skCodeSchema,
  }),
  z.object({
    type: z.literal('sk-upgrade'),
    capturedAt: isoTimestamp,
    fromSk: skCodeSchema,
    toSk: skCodeSchema,
  }),
  z.object({
    type: z.literal('observation'),
    capturedAt: isoTimestamp,
    data: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal('note-updated'),
    capturedAt: isoTimestamp,
    notiz: z.string(),
  }),
]);

export type PendingPatientEvent = z.infer<typeof pendingPatientEventSchema>;

const observationSchema = z.object({
  kind: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  capturedAt: isoTimestamp,
});

export const patientLocalSchema = z.object({
  patientId: patientLocalIdSchema,
  sk: skCodeSchema,
  capturedAt: isoTimestamp,
  pseudonym: z.string().optional(),
  notiz: z.string().optional(),
  observations: z.array(observationSchema).optional(),
  pendingEvents: z.array(pendingPatientEventSchema),
});

export type PatientLocal = z.infer<typeof patientLocalSchema>;

export const schnellzaehlerSchema = z.object({
  SK_I: z.number().int().nonnegative(),
  SK_II: z.number().int().nonnegative(),
  SK_III: z.number().int().nonnegative(),
  SK_IV: z.number().int().nonnegative(),
  TOT: z.number().int().nonnegative(),
});

export type Schnellzaehler = z.infer<typeof schnellzaehlerSchema>;

const attachedToSchema = z.object({
  einsatzId: z.string().min(1),
  attachedAt: isoTimestamp,
  attachedByUserId: z.string().min(1),
  backendPatientIds: z.record(z.string(), z.string()),
});

const failureContextSchema = z.object({
  errorCode: z.string().min(1),
  lastTriedAt: isoTimestamp,
  retryCount: z.number().int().nonnegative(),
});

const startedAtLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracyMeters: z.number().nonnegative(),
  capturedAt: isoTimestamp,
});

export const captureSessionStatusValues = ['open', 'attaching', 'attached', 'failed', 'discarded'] as const;
export const captureSessionStatusSchema = z.enum(captureSessionStatusValues);
export type CaptureSessionStatus = z.infer<typeof captureSessionStatusSchema>;

export const capturePlatformValues = ['tauri', 'browser'] as const;
export const capturePlatformSchema = z.enum(capturePlatformValues);
export type CapturePlatform = z.infer<typeof capturePlatformSchema>;

export const captureSessionLocalSchemaV1 = z.object({
  sessionId: sessionIdSchema,
  schemaVersion: z.literal(1),
  deviceId: deviceIdSchema,
  deviceLabel: z.string().optional(),
  appVersion: z.string().min(1),
  platform: capturePlatformSchema,
  startedAt: isoTimestamp,
  startedAtDriftMarker: z.number().optional(),
  startedAtLocation: startedAtLocationSchema.optional(),
  schnellzaehler: schnellzaehlerSchema,
  patients: z.array(patientLocalSchema),
  pendingEvents: z.array(pendingPatientEventSchema),
  status: captureSessionStatusSchema,
  attachedTo: attachedToSchema.optional(),
  failureContext: failureContextSchema.optional(),
  retentionMarkedForDeletionAt: isoTimestamp.optional(),
});

export type CaptureSessionLocal = z.infer<typeof captureSessionLocalSchemaV1>;

/**
 * Initial-Zustand für den Schnellzähler (alle Kategorien auf 0).
 */
export function createEmptySchnellzaehler(): Schnellzaehler {
  return { SK_I: 0, SK_II: 0, SK_III: 0, SK_IV: 0, TOT: 0 };
}
