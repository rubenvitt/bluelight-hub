import { describe, it, expect } from 'vitest';
import type { PatientListItemDto } from '@bluelight-hub/shared/client';
import { getPatientPhase } from '../utils/get-patient-phase';

describe('getPatientPhase', () => {
  const basePatient: PatientListItemDto = {
    id: 'p1',
    patientennummer: 'P-001',
    name: 'Test Patient',
    zeit: new Date().toISOString(),
    aktuelleSk: null,
    behandlungsstatus: 'UNVERSORGT',
    transportstatus: 'WARTEND',
  };

  it('sollte standardmäßig "eintreffend" zurückgeben, wenn Patient neu erfasst ist', () => {
    const patient: PatientListItemDto = {
      ...basePatient,
      aktuelleSk: null,
      behandlungsstatus: 'UNVERSORGT',
      transportstatus: 'WARTEND',
    };
    expect(getPatientPhase(patient)).toBe('eintreffend');
  });

  it('sollte "sichtung" zurückgeben, wenn der Patient gesichtet (aktuelleSk vorhanden), aber noch UNVERSORGT ist', () => {
    const patient: PatientListItemDto = {
      ...basePatient,
      aktuelleSk: 'SK_III',
      behandlungsstatus: 'UNVERSORGT',
      transportstatus: 'WARTEND',
    };
    expect(getPatientPhase(patient)).toBe('sichtung');
  });

  it('sollte "behandlung" zurückgeben, wenn der Patient IN_BEHANDLUNG ist', () => {
    const patient: PatientListItemDto = {
      ...basePatient,
      aktuelleSk: 'SK_I',
      behandlungsstatus: 'IN_BEHANDLUNG',
      transportstatus: 'WARTEND',
    };
    expect(getPatientPhase(patient)).toBe('behandlung');
  });

  it('sollte "transport-wartend" zurückgeben, wenn der Patient VERSORGT und WARTEND ist', () => {
    const patient: PatientListItemDto = {
      ...basePatient,
      aktuelleSk: 'SK_II',
      behandlungsstatus: 'VERSORGT',
      transportstatus: 'WARTEND',
    };
    expect(getPatientPhase(patient)).toBe('transport-wartend');
  });

  it('sollte "transport-wartend" zurückgeben, wenn der Patient TRANSPORTBEREIT und WARTEND ist', () => {
    const patient: PatientListItemDto = {
      ...basePatient,
      aktuelleSk: 'SK_II',
      behandlungsstatus: 'TRANSPORTBEREIT',
      transportstatus: 'WARTEND',
    };
    expect(getPatientPhase(patient)).toBe('transport-wartend');
  });

  it('sollte "im-transport" zurückgeben, wenn der Transportstatus IM_TRANSPORT ist', () => {
    const patient: PatientListItemDto = {
      ...basePatient,
      aktuelleSk: 'SK_II',
      behandlungsstatus: 'VERSORGT',
      transportstatus: 'IM_TRANSPORT',
    };
    expect(getPatientPhase(patient)).toBe('im-transport');
  });

  it('sollte "abtransportiert" zurückgeben, wenn der Transportstatus IM_KRANKENHAUS ist', () => {
    const patient: PatientListItemDto = {
      ...basePatient,
      aktuelleSk: 'SK_II',
      behandlungsstatus: 'VERSORGT',
      transportstatus: 'IM_KRANKENHAUS',
    };
    expect(getPatientPhase(patient)).toBe('abtransportiert');
  });

  it('sollte "transport-wartend" zurückgeben, wenn VERSORGT und transportstatus === undefined (defensive default)', () => {
    const patient = {
      ...basePatient,
      aktuelleSk: 'SK_II',
      behandlungsstatus: 'VERSORGT',
      transportstatus: undefined,
    } as unknown as PatientListItemDto;
    expect(getPatientPhase(patient)).toBe('transport-wartend');
  });

  it('sollte "transport-wartend" zurückgeben, wenn TRANSPORTBEREIT und transportstatus === null (defensive default)', () => {
    const patient = {
      ...basePatient,
      aktuelleSk: 'SK_II',
      behandlungsstatus: 'TRANSPORTBEREIT',
      transportstatus: null,
    } as unknown as PatientListItemDto;
    expect(getPatientPhase(patient)).toBe('transport-wartend');
  });

  it('sollte "behandlung" zurückgeben, wenn IN_BEHANDLUNG und transportstatus === undefined', () => {
    const patient = {
      ...basePatient,
      aktuelleSk: 'SK_I',
      behandlungsstatus: 'IN_BEHANDLUNG',
      transportstatus: undefined,
    } as unknown as PatientListItemDto;
    expect(getPatientPhase(patient)).toBe('behandlung');
  });

  it('sollte bei TOT Patienten in der natürlichen Workflow-Phase verbleiben', () => {
    const patient: PatientListItemDto = {
      ...basePatient,
      aktuelleSk: 'TOT',
      behandlungsstatus: 'UNVERSORGT',
      transportstatus: 'WARTEND',
    };
    // Ist als Sichtung eingestuft
    expect(getPatientPhase(patient)).toBe('sichtung');

    const patient2: PatientListItemDto = {
      ...basePatient,
      aktuelleSk: 'TOT',
      behandlungsstatus: 'VERSORGT',
      transportstatus: 'IM_KRANKENHAUS',
    };
    // Bereits abtransportiert
    expect(getPatientPhase(patient2)).toBe('abtransportiert');
  });
});
