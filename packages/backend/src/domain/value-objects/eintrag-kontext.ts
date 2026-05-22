import type { FunkPrioritaetValue } from './funk-prioritaet';

/**
 * Discriminated Union für ETB-Eintrag-Kontextvarianten.
 *
 * Der EintragKontext modelliert typisierte Zusatz-Informationen eines
 * ETB-Eintrags jenseits des reinen Texts. Aktuell drei Varianten:
 * - `standard`: Gewöhnlicher ETB-Eintrag ohne spezifischen Kontext
 * - `funkspruch`: Eintrag, der aus einem Funkspruch entstanden ist (mit
 *   referenziertem Funkkanal und Priorität)
 * - `patient`: Eintrag, der aus einem Patient-Lifecycle-Event entstanden ist
 *   (Story 1.2 löst ausschließlich `kind === 'patient.erfasst'` aus; weitere
 *   `kind`-Werte liefern Folge-Stories 1.3 / 1.4 / 2.7)
 *
 * Serialisiert in DB als `kontextType` (Discriminator) + `kontextData` (JSONB Payload).
 */
export type EintragKontextType = 'standard' | 'funkspruch' | 'patient';

/**
 * Diskriminator für Patient-Kontext-Varianten (Architecture §D-6).
 *
 * Story 1.2 emittiert ausschließlich `patient.erfasst`. Die übrigen Kinds sind
 * reserviert für Stories 1.3 (Sichtung), 1.4 (Behandlung/Transport), 2.7
 * (Standalone-Attach) und werden in deren Implementierung freigeschaltet.
 */
export type PatientKontextKind =
  | 'patient.erfasst'
  | 'patient.gesichtet'
  | 'patient.sichtung-aktualisiert'
  | 'patient.behandlung-begonnen'
  | 'patient.behandlung-abgeschlossen'
  | 'patient.transport-gestartet'
  | 'patient.transport-abgeschlossen'
  | 'patient.korrigiert';

/** Persistierte Form eines StandardKontext (nur type). */
export interface StandardKontextPersisted {
  type: 'standard';
}

/** Persistierte Form eines FunkKontext (alle Felder). */
export interface FunkKontextPersisted {
  type: 'funkspruch';
  kanalId: string;
  funkPrioritaet: FunkPrioritaetValue;
}

/** Persistierte Form eines PatientKontext (Architecture §D-6 / Story 1.2). */
export interface PatientKontextPersisted {
  type: 'patient';
  kind: PatientKontextKind;
  patientId: string;
  patientennummer: string;
  payload: Record<string, unknown>;
}

export type EintragKontextPersisted = StandardKontextPersisted | FunkKontextPersisted | PatientKontextPersisted;

export interface StandardKontext {
  readonly type: 'standard';
  toPersistence(): StandardKontextPersisted;
}

export interface FunkKontext {
  readonly type: 'funkspruch';
  readonly kanalId: string;
  readonly funkPrioritaet: FunkPrioritaetValue;
  toPersistence(): FunkKontextPersisted;
}

export interface PatientKontext {
  readonly type: 'patient';
  readonly kind: PatientKontextKind;
  readonly patientId: string;
  readonly patientennummer: string;
  readonly payload: Record<string, unknown>;
  toPersistence(): PatientKontextPersisted;
}

export type EintragKontextShape = StandardKontext | FunkKontext | PatientKontext;

const PATIENT_KONTEXT_KIND_VALUES = new Set<PatientKontextKind>([
  'patient.erfasst',
  'patient.gesichtet',
  'patient.sichtung-aktualisiert',
  'patient.behandlung-begonnen',
  'patient.behandlung-abgeschlossen',
  'patient.transport-gestartet',
  'patient.transport-abgeschlossen',
  'patient.korrigiert',
]);

function isPatientKontextKind(value: unknown): value is PatientKontextKind {
  return typeof value === 'string' && PATIENT_KONTEXT_KIND_VALUES.has(value as PatientKontextKind);
}

/**
 * Factory-Namespace für EintragKontext-Varianten.
 */
export const EintragKontext = {
  standard(): StandardKontext {
    return {
      type: 'standard',
      toPersistence: () => ({ type: 'standard' }),
    };
  },

  funkspruch(args: { kanalId: string; funkPrioritaet: FunkPrioritaetValue }): FunkKontext {
    return {
      type: 'funkspruch',
      kanalId: args.kanalId,
      funkPrioritaet: args.funkPrioritaet,
      toPersistence: () => ({
        type: 'funkspruch',
        kanalId: args.kanalId,
        funkPrioritaet: args.funkPrioritaet,
      }),
    };
  },

  patient(args: { kind: PatientKontextKind; patientId: string; patientennummer: string; payload: Record<string, unknown> }): PatientKontext {
    return {
      type: 'patient',
      kind: args.kind,
      patientId: args.patientId,
      patientennummer: args.patientennummer,
      payload: args.payload,
      toPersistence: () => ({
        type: 'patient',
        kind: args.kind,
        patientId: args.patientId,
        patientennummer: args.patientennummer,
        payload: args.payload,
      }),
    };
  },

  /**
   * Rekonstruiert einen EintragKontext aus persistierter Form
   * (kontextType + kontextData aus der DB).
   *
   * Bei unbekanntem type oder Type-Mismatch wird defensiv der Standard-Kontext
   * zurückgegeben.
   */
  fromPersistence(type: string, data: unknown): EintragKontextShape {
    if (type === 'funkspruch' && data && typeof data === 'object') {
      const d = data as Partial<FunkKontextPersisted>;
      if (typeof d.kanalId === 'string' && typeof d.funkPrioritaet === 'string') {
        return EintragKontext.funkspruch({
          kanalId: d.kanalId,
          funkPrioritaet: d.funkPrioritaet as FunkPrioritaetValue,
        });
      }
    }
    if (type === 'patient' && data && typeof data === 'object') {
      const d = data as Partial<PatientKontextPersisted>;
      if (
        isPatientKontextKind(d.kind) &&
        typeof d.patientId === 'string' &&
        d.patientId.length > 0 &&
        typeof d.patientennummer === 'string' &&
        d.patientennummer.length > 0 &&
        d.payload &&
        typeof d.payload === 'object' &&
        !Array.isArray(d.payload)
      ) {
        return EintragKontext.patient({
          kind: d.kind,
          patientId: d.patientId,
          patientennummer: d.patientennummer,
          payload: d.payload as Record<string, unknown>,
        });
      }
    }
    return EintragKontext.standard();
  },
};
