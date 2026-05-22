import { z } from 'zod';
import { SK_CODES } from '../value-objects/sichtungskategorie.vo';
import { SICHTUNG_ARTEN } from '../value-objects/sichtung.vo';

/**
 * Zod-Schema für ETB-`kontextData` der Patient-Events (Architecture §D-6).
 *
 * Story 1.2 löst ausschließlich `patient.erfasst` produktiv aus; die übrigen
 * `kind`-Diskriminatoren sind reserviert und werden von Folge-Stories
 * (1.3 Sichtung, 1.4 Behandlung/Transport, 2.7 Standalone-Attach) freigeschaltet.
 *
 * Die Schemas validieren die JSONB-Payload, die mit `kontextType = 'patient'`
 * im ETB-Eintrag persistiert wird. Der Command-Handler ruft `parse()` vor dem
 * `EtbAppendService.append(...)`-Aufruf, um Type-Drift zu vermeiden.
 */

const erfasserUserSchema = z.object({
  type: z.literal('user'),
  userId: z.string().min(1),
});

const erfasserDeviceSchema = z.object({
  type: z.literal('device'),
  deviceId: z.string().min(1),
  captureSessionId: z.string().min(1).optional(),
});

const erfasserRefSchema = z.discriminatedUnion('type', [erfasserUserSchema, erfasserDeviceSchema]);

const patientennummerSchema = z.string().regex(/^P-\d{3,}$/);

const patientIdSchema = z.string().min(1);

export const patientErfasstContextSchema = z.object({
  kind: z.literal('patient.erfasst'),
  patientId: patientIdSchema,
  patientennummer: patientennummerSchema,
  initialeSk: z.enum(SK_CODES),
  erfasserRef: erfasserRefSchema,
  diviVakNummer: z.string().min(1).max(64).optional(),
  notiz: z.string().min(1).max(500).optional(),
});

export const patientGesichtetContextSchema = z.object({
  kind: z.literal('patient.gesichtet'),
  patientId: patientIdSchema,
  patientennummer: patientennummerSchema,
  sk: z.enum(SK_CODES),
  sichtungArt: z.enum(SICHTUNG_ARTEN),
  sichter: erfasserRefSchema,
});

/**
 * Story 1.3 (Reevaluierung): vollständiges Payload-Schema für
 * `patient.sichtung-aktualisiert`. `vorher`/`neu` ersetzen die Story-1.2-Stub-
 * Form (`sk`) und entsprechen 1:1 dem `PatientSichtungAktualisiert`-Event;
 * `grund` ist optional und ≤ 500 Zeichen.
 */
export const patientSichtungAktualisiertContextSchema = z.object({
  kind: z.literal('patient.sichtung-aktualisiert'),
  patientId: patientIdSchema,
  patientennummer: patientennummerSchema,
  vorher: z.enum(SK_CODES),
  neu: z.enum(SK_CODES),
  sichter: erfasserRefSchema,
  sichtungArt: z.enum(SICHTUNG_ARTEN),
  grund: z.string().trim().min(1).max(500).optional(),
});

export const patientBehandlungBegonnenContextSchema = z.object({
  kind: z.literal('patient.behandlung-begonnen'),
  patientId: patientIdSchema,
  patientennummer: patientennummerSchema,
});

export const patientBehandlungAbgeschlossenContextSchema = z.object({
  kind: z.literal('patient.behandlung-abgeschlossen'),
  patientId: patientIdSchema,
  patientennummer: patientennummerSchema,
});

export const patientTransportGestartetContextSchema = z.object({
  kind: z.literal('patient.transport-gestartet'),
  patientId: patientIdSchema,
  patientennummer: patientennummerSchema,
});

export const patientTransportAbgeschlossenContextSchema = z.object({
  kind: z.literal('patient.transport-abgeschlossen'),
  patientId: patientIdSchema,
  patientennummer: patientennummerSchema,
});

export const patientKorrigiertContextSchema = z.object({
  kind: z.literal('patient.korrigiert'),
  patientId: patientIdSchema,
  patientennummer: patientennummerSchema,
});

/**
 * Vollständige Discriminated-Union über alle Patient-Kontext-Kinds (Story 1.2).
 *
 * Story 1.2 löst nur `patient.erfasst` produktiv aus; die übrigen Kinds
 * existieren als Vertrag, damit Folge-Stories ihre Payload-Shapes nicht
 * nachträglich definieren müssen.
 */
export const PatientEtbContextSchema = z.discriminatedUnion('kind', [
  patientErfasstContextSchema,
  patientGesichtetContextSchema,
  patientSichtungAktualisiertContextSchema,
  patientBehandlungBegonnenContextSchema,
  patientBehandlungAbgeschlossenContextSchema,
  patientTransportGestartetContextSchema,
  patientTransportAbgeschlossenContextSchema,
  patientKorrigiertContextSchema,
]);

export type PatientEtbContext = z.infer<typeof PatientEtbContextSchema>;
export type PatientErfasstContext = z.infer<typeof patientErfasstContextSchema>;

/**
 * Story-1.1-Discriminator-Union — Backwards-Compat-Alias auf das vollständige
 * Schema. Story 1.2 verdrahtet die Validierung im Command-Handler über
 * `PatientEtbContextSchema`; die V1-Union bleibt nur als Read-Alias bestehen,
 * damit bestehende Imports nicht brechen.
 *
 * @deprecated Story 1.2: nutze `PatientEtbContextSchema` direkt.
 */
export const patientEtbContextStorySchemaV1 = PatientEtbContextSchema;

/**
 * @deprecated Story 1.2: nutze `PatientEtbContext` direkt.
 */
export type PatientEtbContextStoryV1 = PatientEtbContext;
