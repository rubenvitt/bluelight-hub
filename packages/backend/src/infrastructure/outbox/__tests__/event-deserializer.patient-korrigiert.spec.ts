import { EventSerializer, type SerializedEvent } from '../event-serializer';
import { EventDeserializer } from '../event-deserializer';
import type { ILogger } from '@domain/ports/i-logger.port';
import { PatientKorrigiert } from '@domain/patienten/events/patient-korrigiert.event';

/**
 * Round-Trip-Test (Story 1.4, FR42, Architecture §D-6 / AR6).
 *
 * Stellt sicher, dass `PatientKorrigiert` für alle drei `feld`-Werte
 * (sichtung, behandlungsstatus, transportstatus) korrekt durch die
 * 4-Punkt-Registry läuft und der `grund`-Pflicht-Audit-Eintrag erhalten bleibt.
 */
describe('PatientKorrigiert — 4-Punkt-Registry Round-Trip (Story 1.4)', () => {
  let serializer: EventSerializer;
  let deserializer: EventDeserializer;
  let mockLogger: jest.Mocked<ILogger>;

  function roundTripPayload(event: PatientKorrigiert): SerializedEvent {
    const serialized = serializer.serialize(event);
    expect(serialized.eventName).toBe('patient.korrigiert');
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

  it('feld=sichtung: bewahrt vorher/neu/grund (TOT → SK_II Rückführung)', () => {
    const original = new PatientKorrigiert('einsatz-1', 'patient-1', 4, 'sichtung', 'TOT', 'SK_II', 'Patient lebt — Falschmeldung Team A', 'arzt-1');
    const payload = roundTripPayload(original);
    expect((payload.payload as Record<string, unknown>).feld).toBe('sichtung');
    expect((payload.payload as Record<string, unknown>).grund).toBe('Patient lebt — Falschmeldung Team A');

    const rehydrated = deserializer.deserialize(payload);
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientKorrigiert;
    expect(event).toBeInstanceOf(PatientKorrigiert);
    expect(event.feld).toBe('sichtung');
    expect(event.vorher).toBe('TOT');
    expect(event.neu).toBe('SK_II');
    expect(event.grund).toBe('Patient lebt — Falschmeldung Team A');
  });

  it('feld=behandlungsstatus: bewahrt vorher/neu/grund', () => {
    const original = new PatientKorrigiert('einsatz-1', 'patient-1', 5, 'behandlungsstatus', 'VERSORGT', 'IN_BEHANDLUNG', 'Falschmeldung Team C');
    const rehydrated = deserializer.deserialize(roundTripPayload(original));
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientKorrigiert;
    expect(event.feld).toBe('behandlungsstatus');
    expect(event.vorher).toBe('VERSORGT');
    expect(event.neu).toBe('IN_BEHANDLUNG');
  });

  it('feld=transportstatus: bewahrt vorher/neu/grund', () => {
    const original = new PatientKorrigiert('einsatz-1', 'patient-1', 6, 'transportstatus', 'IM_KRANKENHAUS', 'WARTEND', 'Patient war noch nicht abgefahren');
    const rehydrated = deserializer.deserialize(roundTripPayload(original));
    expect(rehydrated.isSuccess).toBe(true);
    const event = rehydrated.value as PatientKorrigiert;
    expect(event.feld).toBe('transportstatus');
    expect(event.vorher).toBe('IM_KRANKENHAUS');
    expect(event.neu).toBe('WARTEND');
  });

  it('Rehydration weist unbekannten feld-Wert ab', () => {
    const serialized: SerializedEvent = {
      eventId: 'evt-1',
      eventName: 'patient.korrigiert',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateId: 'patient-1',
      payload: {
        einsatzId: 'einsatz-1',
        patientId: 'patient-1',
        eventVersion: 2,
        feld: 'foobar',
        vorher: 'SK_I',
        neu: 'SK_II',
        grund: 'Korrektur',
      },
    };
    const result = deserializer.deserialize(serialized);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('feld invalid');
  });

  it('Rehydration weist diskriminierten Feld/Wert-Mismatch ab (feld=behandlungsstatus + neu=SK_II)', () => {
    // Poison-Pill-Schutz: Outbox-Zeile darf nicht mit BehandlungsStatus-Feld
    // aber SK-Code-Werten rehydriert werden (Architecture §D-6, ADR-006).
    const serialized: SerializedEvent = {
      eventId: 'evt-mismatch',
      eventName: 'patient.korrigiert',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateId: 'patient-1',
      payload: {
        einsatzId: 'einsatz-1',
        patientId: 'patient-1',
        eventVersion: 2,
        feld: 'behandlungsstatus',
        vorher: 'UNVERSORGT',
        neu: 'SK_II',
        grund: 'Korrektur',
      },
    };
    const result = deserializer.deserialize(serialized);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid:PatientKorrigiertPayloadFeldMismatch:behandlungsstatus:SK_II');
  });

  it('Rehydration weist Mismatch ab (feld=sichtung + vorher=VERSORGT)', () => {
    const serialized: SerializedEvent = {
      eventId: 'evt-mismatch-2',
      eventName: 'patient.korrigiert',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateId: 'patient-1',
      payload: {
        einsatzId: 'einsatz-1',
        patientId: 'patient-1',
        eventVersion: 2,
        feld: 'sichtung',
        vorher: 'VERSORGT',
        neu: 'SK_II',
        grund: 'Korrektur',
      },
    };
    const result = deserializer.deserialize(serialized);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid:PatientKorrigiertPayloadFeldMismatch:sichtung:VERSORGT');
  });

  it('Rehydration weist Mismatch ab (feld=transportstatus + neu=SK_II)', () => {
    const serialized: SerializedEvent = {
      eventId: 'evt-mismatch-3',
      eventName: 'patient.korrigiert',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateId: 'patient-1',
      payload: {
        einsatzId: 'einsatz-1',
        patientId: 'patient-1',
        eventVersion: 2,
        feld: 'transportstatus',
        vorher: 'WARTEND',
        neu: 'SK_II',
        grund: 'Korrektur',
      },
    };
    const result = deserializer.deserialize(serialized);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('Invalid:PatientKorrigiertPayloadFeldMismatch:transportstatus:SK_II');
  });

  describe('feld=notiz (Story 1.7, AC9)', () => {
    it('Round-Trip mit vorher=null + neu=String', () => {
      const original = new PatientKorrigiert('einsatz-1', 'patient-1', 7, 'notiz', null, 'Verdacht SHT', 'Erstaufnahme', 'arzt-1');
      const payload = roundTripPayload(original);
      expect((payload.payload as Record<string, unknown>).feld).toBe('notiz');
      expect((payload.payload as Record<string, unknown>).vorher).toBeNull();
      expect((payload.payload as Record<string, unknown>).neu).toBe('Verdacht SHT');

      const rehydrated = deserializer.deserialize(payload);
      expect(rehydrated.isSuccess).toBe(true);
      const event = rehydrated.value as PatientKorrigiert;
      expect(event.feld).toBe('notiz');
      expect(event.vorher).toBeNull();
      expect(event.neu).toBe('Verdacht SHT');
    });

    it('Round-Trip mit vorher=String + neu=null (Notiz löschen)', () => {
      const original = new PatientKorrigiert('einsatz-1', 'patient-1', 8, 'notiz', 'Alte Notiz', null, 'Nicht mehr relevant');
      const rehydrated = deserializer.deserialize(roundTripPayload(original));
      expect(rehydrated.isSuccess).toBe(true);
      const event = rehydrated.value as PatientKorrigiert;
      expect(event.feld).toBe('notiz');
      expect(event.vorher).toBe('Alte Notiz');
      expect(event.neu).toBeNull();
    });

    it('weist neu > 500 Zeichen ab', () => {
      const serialized: SerializedEvent = {
        eventId: 'evt-too-long',
        eventName: 'patient.korrigiert',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateId: 'patient-1',
        payload: {
          einsatzId: 'einsatz-1',
          patientId: 'patient-1',
          eventVersion: 2,
          feld: 'notiz',
          vorher: null,
          neu: 'x'.repeat(501),
          grund: 'Korrektur',
        },
      };
      const result = deserializer.deserialize(serialized);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('neu invalid');
    });
  });

  it('Rehydration weist fehlenden/leeren grund ab', () => {
    const serialized: SerializedEvent = {
      eventId: 'evt-2',
      eventName: 'patient.korrigiert',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateId: 'patient-1',
      payload: {
        einsatzId: 'einsatz-1',
        patientId: 'patient-1',
        eventVersion: 2,
        feld: 'sichtung',
        vorher: 'SK_I',
        neu: 'SK_II',
        grund: '   ',
      },
    };
    const result = deserializer.deserialize(serialized);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('grund invalid');
  });
});
