/**
 * Round-Trip-Tests für Patient-Events durch Serializer → JSON → Deserializer.
 *
 * Story 1.2, AC3, Architecture §D-6:
 * Stellt sicher, dass `PatientErfasst` ohne Datenverlust durch die Outbox-Pipeline geht
 * und der Constructor-Tag (instanceof) nach dem Roundtrip erhalten bleibt.
 */

import { EventDeserializer } from '../event-deserializer';
import { EventSerializer } from '../event-serializer';
import { PatientErfasst } from '@domain/patienten/events/patient-erfasst.event';

const noopLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('Patient Events Round-Trip', () => {
  let serializer: EventSerializer;
  let deserializer: EventDeserializer;

  beforeEach(() => {
    serializer = new EventSerializer();
    deserializer = new EventDeserializer(noopLogger as never);
  });

  it('PatientErfasst (User-Erfasser) — Round-Trip erhält alle Felder', () => {
    const original = new PatientErfasst('einsatz-1', 'pat-001', 'P-001', 'SK_II', { type: 'user', userId: 'user-7' }, undefined, new Date('2026-05-19T10:15:00.000Z'));

    const serialized = serializer.serialize(original);
    expect(serialized.eventName).toBe('patient.erfasst');

    const restored = deserializer.deserialize(JSON.parse(JSON.stringify(serialized)));
    expect(restored.isSuccess).toBe(true);
    expect(restored.value).toBeInstanceOf(PatientErfasst);

    const event = restored.value as PatientErfasst;
    expect(event.einsatzId).toBe('einsatz-1');
    expect(event.patientId).toBe('pat-001');
    expect(event.patientennummer).toBe('P-001');
    expect(event.initialeSk).toBe('SK_II');
    expect(event.erfasserRef).toEqual({ type: 'user', userId: 'user-7' });
    expect(event.actorUserId).toBe('user-7');
    expect(event.actorDeviceId).toBeUndefined();
    expect(event.originSessionId).toBeUndefined();
    expect(event.eventVersion).toBe(1);
    expect(event.occurredAt.toISOString()).toBe('2026-05-19T10:15:00.000Z');
  });

  it('PatientErfasst (Device-Erfasser mit captureSessionId + clockDrift) — Round-Trip erhält alle Felder', () => {
    const original = new PatientErfasst('einsatz-2', 'pat-002', 'P-007', 'SK_I', { type: 'device', deviceId: 'tab-3', captureSessionId: 'sess-99' }, 42, new Date('2026-05-19T11:30:00.000Z'));

    const serialized = serializer.serialize(original);
    const restored = deserializer.deserialize(JSON.parse(JSON.stringify(serialized)));
    expect(restored.isSuccess).toBe(true);

    const event = restored.value as PatientErfasst;
    expect(event.erfasserRef).toEqual({ type: 'device', deviceId: 'tab-3', captureSessionId: 'sess-99' });
    expect(event.actorDeviceId).toBe('tab-3');
    expect(event.originSessionId).toBe('sess-99');
    expect(event.actorUserId).toBeUndefined();
    expect(event.clockDriftSeconds).toBe(42);
    expect(event.initialeSk).toBe('SK_I');
  });

  it('PatientErfasst eventName folgt dot-Notation (Architecture §D-6)', () => {
    expect(PatientErfasst.eventName()).toBe('patient.erfasst');
  });

  it('PatientErfasst — eventVersion=1 überlebt serialize → deserialize', () => {
    // Append-only-Vertrag (Architecture §D-1): patient.erfasst hat immer
    // eventVersion=1. Der Round-Trip muss diese Identität propagieren — sonst
    // ist ein silent re-map gegen den Audit-Trail-Vertrag möglich.
    const original = new PatientErfasst('einsatz-3', 'pat-003', 'P-010', 'SK_III', { type: 'user', userId: 'user-1' });
    const serialized = serializer.serialize(original);
    expect((serialized.payload as Record<string, unknown>).eventVersion).toBe(1);

    const restored = deserializer.deserialize(JSON.parse(JSON.stringify(serialized)));
    expect(restored.isSuccess).toBe(true);
    expect((restored.value as PatientErfasst).eventVersion).toBe(1);
  });

  it('PatientErfasst — abweichende eventVersion (≠1) wird rejected', () => {
    const result = deserializer.deserialize({
      eventId: 'evt-bad-version',
      eventName: 'patient.erfasst',
      eventVersion: 1,
      occurredAt: '2026-05-19T10:00:00.000Z',
      aggregateId: 'pat-1',
      payload: {
        einsatzId: 'e-1',
        patientId: 'pat-1',
        patientennummer: 'P-001',
        initialeSk: 'SK_II',
        erfasserRef: { type: 'user', userId: 'u-1' },
        eventVersion: 2,
      },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/eventVersion must be 1/);
  });

  it('Deserialize lehnt invalide patientennummer ab', () => {
    const result = deserializer.deserialize({
      eventId: 'evt-1',
      eventName: 'patient.erfasst',
      eventVersion: 1,
      occurredAt: '2026-05-19T10:00:00.000Z',
      aggregateId: 'pat-1',
      payload: {
        einsatzId: 'e-1',
        patientId: 'pat-1',
        patientennummer: '001',
        initialeSk: 'SK_II',
        erfasserRef: { type: 'user', userId: 'u-1' },
      },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/patientennummer/);
  });

  it('Deserialize lehnt unbekannten SK-Code ab', () => {
    const result = deserializer.deserialize({
      eventId: 'evt-1',
      eventName: 'patient.erfasst',
      eventVersion: 1,
      occurredAt: '2026-05-19T10:00:00.000Z',
      aggregateId: 'pat-1',
      payload: {
        einsatzId: 'e-1',
        patientId: 'pat-1',
        patientennummer: 'P-001',
        initialeSk: 'SK_VI',
        erfasserRef: { type: 'user', userId: 'u-1' },
      },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/initialeSk/);
  });

  it('Deserialize lehnt invalide erfasserRef-Struktur ab', () => {
    const result = deserializer.deserialize({
      eventId: 'evt-1',
      eventName: 'patient.erfasst',
      eventVersion: 1,
      occurredAt: '2026-05-19T10:00:00.000Z',
      aggregateId: 'pat-1',
      payload: {
        einsatzId: 'e-1',
        patientId: 'pat-1',
        patientennummer: 'P-001',
        initialeSk: 'SK_II',
        eventVersion: 1,
        erfasserRef: { type: 'admin' },
      },
    });
    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/erfasserRef/);
  });
});
