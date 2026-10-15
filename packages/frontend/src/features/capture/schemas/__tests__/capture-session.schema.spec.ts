import { describe, expect, it } from 'vitest';
import {
  captureSessionLocalSchemaV1,
  createEmptySchnellzaehler,
  patientLocalSchema,
  pendingPatientEventSchema,
  schnellzaehlerSchema,
  skCodeSchema,
  type CaptureSessionLocal,
} from '../capture-session.schema';

const nowIso = '2026-05-22T12:00:00.000Z';

function makeValidSession(overrides: Partial<CaptureSessionLocal> = {}): CaptureSessionLocal {
  return {
    sessionId: 'cs_abcdefghijklmnopqrstuvwx',
    schemaVersion: 1,
    deviceId: 'dev_abcdefghijklmnopqrstuvwx',
    appVersion: '1.0.0',
    platform: 'browser',
    startedAt: nowIso,
    schnellzaehler: createEmptySchnellzaehler(),
    patients: [],
    pendingEvents: [],
    status: 'open',
    ...overrides,
  };
}

describe('skCodeSchema', () => {
  it('akzeptiert kanonische DIN-Codes', () => {
    for (const sk of ['SK_I', 'SK_II', 'SK_III', 'SK_IV', 'TOT']) {
      expect(skCodeSchema.safeParse(sk).success).toBe(true);
    }
  });

  it.each(['rot', 'gelb', 'gruen', 'blau', 'schwarz', 'I', 'II', 'IV', ''])('verwirft Farb-Strings und Lateinbuchstaben (%s)', (invalid) => {
    expect(skCodeSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('schnellzaehlerSchema', () => {
  it('verlangt alle fünf Kategorien als nicht-negative Integer', () => {
    expect(schnellzaehlerSchema.safeParse(createEmptySchnellzaehler()).success).toBe(true);
  });

  it('verwirft negative Werte', () => {
    expect(schnellzaehlerSchema.safeParse({ ...createEmptySchnellzaehler(), SK_I: -1 }).success).toBe(false);
  });

  it('verwirft fehlende Kategorien', () => {
    expect(schnellzaehlerSchema.safeParse({ SK_I: 0, SK_II: 0, SK_III: 0, SK_IV: 0 }).success).toBe(false);
  });
});

describe('pendingPatientEventSchema', () => {
  it('akzeptiert sichtung-Event mit kanonischem SK', () => {
    expect(pendingPatientEventSchema.safeParse({ type: 'sichtung', capturedAt: nowIso, sk: 'SK_II' }).success).toBe(true);
  });

  it('akzeptiert sk-upgrade-Event', () => {
    expect(
      pendingPatientEventSchema.safeParse({
        type: 'sk-upgrade',
        capturedAt: nowIso,
        fromSk: 'SK_II',
        toSk: 'SK_I',
      }).success,
    ).toBe(true);
  });

  it('akzeptiert observation-Event', () => {
    expect(
      pendingPatientEventSchema.safeParse({
        type: 'observation',
        capturedAt: nowIso,
        data: { vitalSigns: { hr: 80 } },
      }).success,
    ).toBe(true);
  });

  it('akzeptiert note-updated-Event', () => {
    expect(
      pendingPatientEventSchema.safeParse({
        type: 'note-updated',
        capturedAt: nowIso,
        notiz: 'Bewusst, ansprechbar',
      }).success,
    ).toBe(true);
  });

  it('verwirft Farb-Strings als SK', () => {
    expect(pendingPatientEventSchema.safeParse({ type: 'sichtung', capturedAt: nowIso, sk: 'rot' }).success).toBe(false);
  });

  it('verwirft unbekannten Diskriminator', () => {
    expect(pendingPatientEventSchema.safeParse({ type: 'counter', capturedAt: nowIso, sk: 'SK_I' }).success).toBe(false);
  });
});

describe('patientLocalSchema', () => {
  it('akzeptiert Minimal-Patient mit pl_-prefixed ID', () => {
    expect(
      patientLocalSchema.safeParse({
        patientId: 'pl_abcdefghijklmnopqrstuvwx',
        sk: 'SK_III',
        capturedAt: nowIso,
        pendingEvents: [],
      }).success,
    ).toBe(true);
  });

  it('verwirft Patient-ID ohne pl_-Prefix', () => {
    expect(
      patientLocalSchema.safeParse({
        patientId: 'abcdefghijklmnopqrstuvwx',
        sk: 'SK_III',
        capturedAt: nowIso,
        pendingEvents: [],
      }).success,
    ).toBe(false);
  });
});

describe('captureSessionLocalSchemaV1', () => {
  it('akzeptiert vollständiges Aggregat', () => {
    expect(captureSessionLocalSchemaV1.safeParse(makeValidSession()).success).toBe(true);
  });

  it('verwirft schemaVersion: 2', () => {
    const result = captureSessionLocalSchemaV1.safeParse({ ...makeValidSession(), schemaVersion: 2 });
    expect(result.success).toBe(false);
  });

  it('verwirft Session-ID ohne cs_-Prefix', () => {
    expect(captureSessionLocalSchemaV1.safeParse({ ...makeValidSession(), sessionId: 'invalid' }).success).toBe(false);
  });

  it('verwirft Farb-Strings im Schnellzähler', () => {
    expect(
      captureSessionLocalSchemaV1.safeParse({
        ...makeValidSession(),
        schnellzaehler: { rot: 0, gelb: 0, gruen: 0, blau: 0, schwarz: 0 } as unknown as ReturnType<typeof createEmptySchnellzaehler>,
      }).success,
    ).toBe(false);
  });

  it('akzeptiert attached-Status mit attachedTo', () => {
    expect(
      captureSessionLocalSchemaV1.safeParse({
        ...makeValidSession(),
        status: 'attached',
        attachedTo: {
          einsatzId: 'einsatz-123',
          attachedAt: nowIso,
          attachedByUserId: 'user-1',
          backendPatientIds: { pl_abcdefghijklmnopqrstuvwx: 'p-1' },
        },
      }).success,
    ).toBe(true);
  });

  it('verwirft unbekannten Status', () => {
    expect(
      captureSessionLocalSchemaV1.safeParse({
        ...makeValidSession(),
        status: 'unknown',
      } as unknown).success,
    ).toBe(false);
  });
});
