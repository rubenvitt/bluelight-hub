// @ts-nocheck
import { EventSerializer, type SerializedEvent } from '../event-serializer';
import { EventDeserializer } from '../event-deserializer';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PatientTransportAbgeschlossen } from '@domain/patienten/events/patient-transport-abgeschlossen.event';
import { PatientTransportGestartet } from '@domain/patienten/events/patient-transport-gestartet.event';

/**
 * Round-Trip-Test (Story 1.4, Architecture §D-6 / AR6).
 *
 * Stellt sicher, dass `PatientTransportGestartet` und
 * `PatientTransportAbgeschlossen` vollständig durch die 4-Punkt-Registry
 * laufen. Naming-Boyscout aus `deferred-work.md`: dot-Notation + vorher/neu.
 */
describe('Patient-Transport-Events — 4-Punkt-Registry Round-Trip (Story 1.4)', () => {
  let serializer: EventSerializer;
  let deserializer: EventDeserializer;
  let mockLogger: jest.Mocked<ILogger>;

  function roundTripPayload(event: PatientTransportGestartet | PatientTransportAbgeschlossen, eventName: string): SerializedEvent {
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

  it('PatientTransportGestartet: Serialize → Deserialize bewahrt vorher/neu', () => {
    const original = new PatientTransportGestartet('einsatz-1', 'patient-1', 5, 'WARTEND', 'IM_TRANSPORT', 'u-1');
    const payload = roundTripPayload(original, 'patient.transport-gestartet');
    expect((payload.payload as Record<string, unknown>).vorher).toBe('WARTEND');
    expect((payload.payload as Record<string, unknown>).neu).toBe('IM_TRANSPORT');

    const rehydrated = deserializer.deserialize(payload);
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientTransportGestartet;
    expect(event).toBeInstanceOf(PatientTransportGestartet);
    expect(event.vorher).toBe('WARTEND');
    expect(event.neu).toBe('IM_TRANSPORT');
    expect(event.actorUserId).toBe('u-1');
  });

  it('PatientTransportAbgeschlossen: Serialize → Deserialize bewahrt vorher/neu + Drift', () => {
    const original = new PatientTransportAbgeschlossen('einsatz-1', 'patient-1', 6, 'IM_TRANSPORT', 'IM_KRANKENHAUS', undefined, 'tablet-7', 'cs_42', -3);
    const rehydrated = deserializer.deserialize(roundTripPayload(original, 'patient.transport-abgeschlossen'));
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientTransportAbgeschlossen;
    expect(event).toBeInstanceOf(PatientTransportAbgeschlossen);
    expect(event.vorher).toBe('IM_TRANSPORT');
    expect(event.neu).toBe('IM_KRANKENHAUS');
    expect(event.actorDeviceId).toBe('tablet-7');
    expect(event.originSessionId).toBe('cs_42');
    expect(event.clockDriftSeconds).toBe(-3);
  });

  it('Rehydration weist ungültigen Transportstatus ab', () => {
    const serialized: SerializedEvent = {
      eventId: 'evt-1',
      eventName: 'patient.transport-gestartet',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateId: 'patient-1',
      payload: {
        einsatzId: 'einsatz-1',
        patientId: 'patient-1',
        eventVersion: 2,
        vorher: 'WARTEND',
        neu: 'ABGESCHLOSSEN',
      },
    };
    const result = deserializer.deserialize(serialized);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('neu invalid');
  });
});
