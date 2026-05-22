// @ts-nocheck
import { EventSerializer, type SerializedEvent } from '../event-serializer';
import { EventDeserializer } from '../event-deserializer';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PatientGesichtet } from '@domain/patienten/events/patient-gesichtet.event';
import { PatientSichtungAktualisiert } from '@domain/patienten/events/patient-sichtung-aktualisiert.event';

/**
 * Round-Trip-Test (Story 1.3, Architecture §D-6 / AR6).
 *
 * Stellt sicher, dass `PatientGesichtet` und `PatientSichtungAktualisiert`
 * vollständig durch die 4-Punkt-Registry laufen — Serialize → Persistenz-Shape
 * → Deserialize → DeepEqual aller fachlich relevanten Felder.
 *
 * Smoke-Bedeutung: ein fehlender Branch in Serializer/Deserializer ergibt
 * **keinen** Compile-Fehler (silent-fail-Risiko §D-6). Diese Tests sind die
 * eigentliche Bremse.
 */
describe('Patient-Sichtungs-Events — 4-Punkt-Registry Round-Trip (Story 1.3)', () => {
  let serializer: EventSerializer;
  let deserializer: EventDeserializer;
  let mockLogger: jest.Mocked<ILogger>;

  function roundTripPayload(event: PatientGesichtet | PatientSichtungAktualisiert, eventName: string): SerializedEvent {
    const serialized = serializer.serialize(event);
    expect(serialized.eventName).toBe(eventName);
    return {
      eventId: serialized.eventId,
      eventName: serialized.eventName,
      eventVersion: serialized.eventVersion,
      occurredAt: serialized.occurredAt,
      aggregateId: serialized.aggregateId,
      payload: serialized.payload,
    };
  }

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<ILogger>;
    serializer = new EventSerializer();
    deserializer = new EventDeserializer(mockLogger);
  });

  it('PatientGesichtet: Serialize → Deserialize bewahrt alle Pflichtfelder (User-Sichter)', () => {
    const original = new PatientGesichtet('einsatz-1', 'patient-1', 2, 'SK_I', 'aerztlich', { type: 'user', userId: 'arzt-1' }, undefined, new Date('2026-05-19T10:05:00Z'));

    const rehydrated = deserializer.deserialize(roundTripPayload(original, 'patient.gesichtet'));
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientGesichtet;
    expect(event).toBeInstanceOf(PatientGesichtet);
    expect(event.sk).toBe('SK_I');
    expect(event.sichtungArt).toBe('aerztlich');
    expect(event.eventVersion).toBe(2);
    expect(event.sichter).toEqual({ type: 'user', userId: 'arzt-1' });
    expect(event.einsatzId).toBe('einsatz-1');
    expect(event.patientId).toBe('patient-1');
  });

  it('PatientGesichtet: Device-Sichter mit captureSessionId überlebt Round-Trip', () => {
    const original = new PatientGesichtet('einsatz-2', 'patient-2', 3, 'SK_III', 'vorsichtung', { type: 'device', deviceId: 'tablet-7', captureSessionId: 'cs_42' }, 15);

    const rehydrated = deserializer.deserialize(roundTripPayload(original, 'patient.gesichtet'));
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientGesichtet;
    expect(event.sichter).toEqual({ type: 'device', deviceId: 'tablet-7', captureSessionId: 'cs_42' });
    expect(event.clockDriftSeconds).toBe(15);
  });

  it('PatientSichtungAktualisiert: Serialize → Deserialize bewahrt vorher/neu/grund', () => {
    const original = new PatientSichtungAktualisiert(
      'einsatz-1',
      'patient-1',
      3,
      'SK_II',
      'SK_I',
      'aerztlich',
      { type: 'user', userId: 'arzt-1' },
      'Vitalwerte verschlechtert',
      undefined,
      new Date('2026-05-19T10:10:00Z'),
    );

    const payload = roundTripPayload(original, 'patient.sichtung-aktualisiert');
    expect((payload.payload as Record<string, unknown>).vorher).toBe('SK_II');
    expect((payload.payload as Record<string, unknown>).neu).toBe('SK_I');
    expect((payload.payload as Record<string, unknown>).grund).toBe('Vitalwerte verschlechtert');

    const rehydrated = deserializer.deserialize(payload);
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientSichtungAktualisiert;
    expect(event).toBeInstanceOf(PatientSichtungAktualisiert);
    expect(event.vorher).toBe('SK_II');
    expect(event.neu).toBe('SK_I');
    expect(event.sichtungArt).toBe('aerztlich');
    expect(event.sichter).toEqual({ type: 'user', userId: 'arzt-1' });
    expect(event.grund).toBe('Vitalwerte verschlechtert');
    expect(event.eventVersion).toBe(3);
  });

  it('PatientSichtungAktualisiert: ohne grund (null in Payload) → undefined nach Rehydration', () => {
    const original = new PatientSichtungAktualisiert('einsatz-1', 'patient-2', 4, 'SK_III', 'SK_II', 'vorsichtung', { type: 'device', deviceId: 'tablet-7' });

    const payload = roundTripPayload(original, 'patient.sichtung-aktualisiert');
    expect((payload.payload as Record<string, unknown>).grund).toBeNull();

    const rehydrated = deserializer.deserialize(payload);
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientSichtungAktualisiert;
    expect(event.grund).toBeUndefined();
    expect(event.sichter).toEqual({ type: 'device', deviceId: 'tablet-7' });
  });

  it('PatientSichtungAktualisiert: Rehydration weist ungültigen vorher-SK ab', () => {
    const serialized: SerializedEvent = {
      eventId: 'evt-1',
      eventName: 'patient.sichtung-aktualisiert',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateId: 'patient-1',
      payload: {
        einsatzId: 'einsatz-1',
        patientId: 'patient-1',
        eventVersion: 2,
        vorher: 'SK_V',
        neu: 'SK_I',
        sichtungArt: 'aerztlich',
        sichter: { type: 'user', userId: 'arzt-1' },
        grund: null,
      },
    };
    const result = deserializer.deserialize(serialized);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('vorher invalid');
  });

  it('PatientSichtungAktualisiert: Rehydration weist leeren grund ab', () => {
    const serialized: SerializedEvent = {
      eventId: 'evt-2',
      eventName: 'patient.sichtung-aktualisiert',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateId: 'patient-1',
      payload: {
        einsatzId: 'einsatz-1',
        patientId: 'patient-1',
        eventVersion: 2,
        vorher: 'SK_II',
        neu: 'SK_I',
        sichtungArt: 'aerztlich',
        sichter: { type: 'user', userId: 'arzt-1' },
        grund: '   ',
      },
    };
    const result = deserializer.deserialize(serialized);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('grund invalid');
  });
});
