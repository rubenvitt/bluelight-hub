import { Patient } from '@domain/patienten/aggregates/patient.aggregate';
import { ErfasserRef } from '@domain/patienten/value-objects/erfasser-ref.vo';
import { Patientennummer } from '@domain/patienten/value-objects/patientennummer.vo';
import type { PatientEventRow } from '@domain/patienten/repositories/patient.repository';
import { PatientMapper } from '../patient.mapper';
import { PatientDetailMapper } from '../patient-detail.mapper';

function buildPatient() {
  const patientennummer = Patientennummer.fromSequence(3).value!;
  const erfasserRef = ErfasserRef.user('usr-42').value!;
  const result = Patient.create({
    einsatzId: 'ein-A',
    patientennummer,
    erfasserRef,
    erfasstAm: new Date('2026-05-20T14:21:01.234Z'),
    clockDriftSeconds: 5,
  });
  return result.value!;
}

function makeEventRow(overrides: Partial<PatientEventRow> = {}): PatientEventRow {
  return {
    id: 'evt-1',
    patientId: 'pat-1',
    einsatzId: 'ein-A',
    eventType: 'patient.erfasst',
    eventVersion: 1,
    payload: { kind: 'patient.erfasst', patientId: 'pat-1', patientennummer: 'P-003', initialeSk: 'SK_II', erfasserRef: { type: 'user', userId: 'usr-42' } },
    occurredAt: new Date('2026-05-20T14:21:01.234Z'),
    recordedAt: new Date('2026-05-20T14:21:01.500Z'),
    actorUserId: 'usr-42',
    actorDeviceId: null,
    originSessionId: null,
    clockDriftSeconds: null,
    ...overrides,
  };
}

describe('PatientDetailMapper (Story 1.7)', () => {
  let mapper: PatientDetailMapper;

  beforeEach(() => {
    mapper = new PatientDetailMapper(new PatientMapper());
  });

  it('komponiert Snapshot-Felder + chronologische Event-Liste', () => {
    const patient = buildPatient();
    const rows: PatientEventRow[] = [
      makeEventRow({ id: 'evt-1', eventVersion: 1, eventType: 'patient.erfasst' }),
      makeEventRow({ id: 'evt-2', eventVersion: 2, eventType: 'patient.gesichtet', payload: { kind: 'patient.gesichtet', sk: 'SK_II' } }),
      makeEventRow({ id: 'evt-3', eventVersion: 3, eventType: 'patient.sichtung-aktualisiert', payload: { kind: 'patient.sichtung-aktualisiert', vorher: 'SK_II', neu: 'SK_III' } }),
    ];

    const dto = mapper.toDto(patient, rows);

    expect(dto.id).toBe(patient.id.value);
    expect(dto.einsatzId).toBe('ein-A');
    expect(dto.patientennummer).toBe('P-003');
    expect(dto.aktuelleSk).toBe('SK_III');
    expect(dto.eventVersion).toBe(1);
    expect(dto.clockDriftSeconds).toBe(5);
    expect(dto.events).toHaveLength(3);
    expect(dto.events[0]?.id).toBe('evt-1');
    expect(dto.events[2]?.eventType).toBe('patient.sichtung-aktualisiert');
  });

  it('serialisiert occurredAt/recordedAt als ISO-8601-UTC-Strings', () => {
    const dto = mapper.toDto(buildPatient(), [makeEventRow()]);
    expect(dto.events[0]?.occurredAt).toBe('2026-05-20T14:21:01.234Z');
    expect(dto.events[0]?.recordedAt).toBe('2026-05-20T14:21:01.500Z');
  });

  it('reicht payload 1:1 als Record<string, unknown> durch (kein Strip)', () => {
    const payload = { kind: 'patient.korrigiert', feld: 'sichtung', vorher: 'SK_II', neu: 'SK_III', grund: 'Stabilisiert' };
    const dto = mapper.toDto(buildPatient(), [makeEventRow({ payload })]);
    expect(dto.events[0]?.payload).toEqual(payload);
  });

  it('liefert leere events-Liste, wenn keine Events übergeben werden', () => {
    const dto = mapper.toDto(buildPatient(), []);
    expect(dto.events).toEqual([]);
  });

  it('reicht clockDriftSeconds=null bzw. > 30 unverändert durch (Frontend rendert Drift-Indikator)', () => {
    const dto = mapper.toDto(buildPatient(), [makeEventRow({ id: 'evt-no-drift', clockDriftSeconds: null }), makeEventRow({ id: 'evt-with-drift', clockDriftSeconds: 42 })]);
    expect(dto.events[0]?.clockDriftSeconds).toBeNull();
    expect(dto.events[1]?.clockDriftSeconds).toBe(42);
  });

  it('reicht Akteur-Varianten (User/Device/Session) korrekt durch', () => {
    const dto = mapper.toDto(buildPatient(), [
      makeEventRow({ id: 'evt-user', actorUserId: 'usr-1', actorDeviceId: null, originSessionId: null }),
      makeEventRow({ id: 'evt-device', actorUserId: null, actorDeviceId: 'tablet-3a', originSessionId: null }),
      makeEventRow({ id: 'evt-session', actorUserId: null, actorDeviceId: 'tablet-3a', originSessionId: 'sess-456' }),
    ]);
    expect(dto.events[0]?.actorUserId).toBe('usr-1');
    expect(dto.events[1]?.actorDeviceId).toBe('tablet-3a');
    expect(dto.events[2]?.originSessionId).toBe('sess-456');
  });

  it('reicht unbekannte eventType-Strings unverändert durch (Frontend-Fallback rendert "Unbekanntes Ereignis")', () => {
    const dto = mapper.toDto(buildPatient(), [makeEventRow({ id: 'evt-future', eventType: 'patient.zukunfts-event-9000' })]);
    expect(dto.events[0]?.eventType).toBe('patient.zukunfts-event-9000');
  });

  it('reicht patient.notiz in den Detail-DTO durch (Story 1.7 AC9 Round-Trip)', () => {
    const patient = buildPatient();
    const korrigierResult = patient.korrigieren('notiz', 'Übergabe an LNA-Schicht 2', 'Schichtwechsel', { actorUserId: 'usr-42' });
    expect(korrigierResult.isSuccess).toBe(true);

    const dto = mapper.toDto(patient, []);

    expect(dto.notiz).toBe('Übergabe an LNA-Schicht 2');
  });

  it('mapped alle 9 bekannten patient-Event-Typen ohne Verlust', () => {
    const types = [
      'patient.erfasst',
      'patient.gesichtet',
      'patient.sichtung-aktualisiert',
      'patient.behandlung-begonnen',
      'patient.behandlung-abgeschlossen',
      'patient.transport-gestartet',
      'patient.transport-abgeschlossen',
      'patient.korrigiert',
    ];
    const dto = mapper.toDto(
      buildPatient(),
      types.map((t, idx) => makeEventRow({ id: `evt-${idx}`, eventVersion: idx + 1, eventType: t })),
    );
    expect(dto.events.map((e) => e.eventType)).toEqual(types);
  });
});
