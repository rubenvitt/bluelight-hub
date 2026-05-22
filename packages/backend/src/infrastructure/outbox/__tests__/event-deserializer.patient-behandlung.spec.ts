// @ts-nocheck
import { EventSerializer, type SerializedEvent } from '../event-serializer';
import { EventDeserializer } from '../event-deserializer';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PatientBehandlungAbgeschlossen } from '@domain/patienten/events/patient-behandlung-abgeschlossen.event';
import { PatientBehandlungBegonnen } from '@domain/patienten/events/patient-behandlung-begonnen.event';

/**
 * Round-Trip-Test (Story 1.4, Architecture §D-6 / AR6).
 *
 * Stellt sicher, dass `PatientBehandlungBegonnen` und
 * `PatientBehandlungAbgeschlossen` vollständig durch die 4-Punkt-Registry
 * laufen (Serialize → Persistenz-Shape → Deserialize → DeepEqual). Schließt
 * den Naming-Boyscout aus `deferred-work.md` ab: beide Events nutzen jetzt
 * Dot-Notation und tragen `vorher`/`neu`.
 */
describe('Patient-Behandlungs-Events — 4-Punkt-Registry Round-Trip (Story 1.4)', () => {
  let serializer: EventSerializer;
  let deserializer: EventDeserializer;
  let mockLogger: jest.Mocked<ILogger>;

  function roundTripPayload(event: PatientBehandlungBegonnen | PatientBehandlungAbgeschlossen, eventName: string): SerializedEvent {
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

  it('PatientBehandlungBegonnen: Serialize → Deserialize bewahrt vorher/neu/Actor', () => {
    const original = new PatientBehandlungBegonnen('einsatz-1', 'patient-1', 2, 'UNVERSORGT', 'IN_BEHANDLUNG', 'u-1', undefined, undefined, 5, new Date('2026-05-19T10:30:00Z'));
    const payload = roundTripPayload(original, 'patient.behandlung-begonnen');
    expect((payload.payload as Record<string, unknown>).vorher).toBe('UNVERSORGT');
    expect((payload.payload as Record<string, unknown>).neu).toBe('IN_BEHANDLUNG');

    const rehydrated = deserializer.deserialize(payload);
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientBehandlungBegonnen;
    expect(event).toBeInstanceOf(PatientBehandlungBegonnen);
    expect(event.vorher).toBe('UNVERSORGT');
    expect(event.neu).toBe('IN_BEHANDLUNG');
    expect(event.actorUserId).toBe('u-1');
    expect(event.clockDriftSeconds).toBe(5);
    expect(event.eventVersion).toBe(2);
  });

  it('PatientBehandlungAbgeschlossen: VERSORGT als Ziel überlebt Round-Trip', () => {
    const original = new PatientBehandlungAbgeschlossen('einsatz-1', 'patient-1', 3, 'IN_BEHANDLUNG', 'VERSORGT', 'u-1');
    const rehydrated = deserializer.deserialize(roundTripPayload(original, 'patient.behandlung-abgeschlossen'));
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientBehandlungAbgeschlossen;
    expect(event).toBeInstanceOf(PatientBehandlungAbgeschlossen);
    expect(event.neu).toBe('VERSORGT');
  });

  it('PatientBehandlungAbgeschlossen: TRANSPORTBEREIT als Ziel überlebt Round-Trip (operative Realität bei MANV)', () => {
    const original = new PatientBehandlungAbgeschlossen('einsatz-1', 'patient-1', 4, 'IN_BEHANDLUNG', 'TRANSPORTBEREIT');
    const rehydrated = deserializer.deserialize(roundTripPayload(original, 'patient.behandlung-abgeschlossen'));
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientBehandlungAbgeschlossen;
    expect(event.vorher).toBe('IN_BEHANDLUNG');
    expect(event.neu).toBe('TRANSPORTBEREIT');
  });

  it('Rehydration weist ungültigen Behandlungsstatus in vorher/neu ab', () => {
    const serialized: SerializedEvent = {
      eventId: 'evt-1',
      eventName: 'patient.behandlung-begonnen',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateId: 'patient-1',
      payload: {
        einsatzId: 'einsatz-1',
        patientId: 'patient-1',
        eventVersion: 2,
        vorher: 'FOOBAR',
        neu: 'IN_BEHANDLUNG',
      },
    };
    const result = deserializer.deserialize(serialized);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('vorher invalid');
  });
});
