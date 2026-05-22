import {
  Patient,
  PATIENT_BUSINESS_RULE_EINSATZ_ID_ERFORDERLICH,
  PATIENT_BUSINESS_RULE_ERFASST_AM_UNGUELTIG,
  PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG,
  PATIENT_BUSINESS_RULE_SICHTUNG_VON_TOT_NICHT_ERLAUBT,
  PATIENT_BUSINESS_RULE_SICHTUNG_UNVERAENDERT,
  PATIENT_BUSINESS_RULE_SICHTUNG_UNGUELTIG,
  PATIENT_BUSINESS_RULE_GRUND_UNGUELTIG,
  PATIENT_BUSINESS_RULE_BEHANDLUNG_UNGUELTIGER_UEBERGANG,
  PATIENT_BUSINESS_RULE_TRANSPORT_UNGUELTIGER_UEBERGANG,
} from '../patient.aggregate';
import { ErfasserRef } from '../../value-objects/erfasser-ref.vo';
import { Patientennummer } from '../../value-objects/patientennummer.vo';
import { Sichtung } from '../../value-objects/sichtung.vo';
import { Sichtungskategorie } from '../../value-objects/sichtungskategorie.vo';
import { PatientErfasst } from '../../events/patient-erfasst.event';
import { PatientGesichtet } from '../../events/patient-gesichtet.event';
import { PatientSichtungAktualisiert } from '../../events/patient-sichtung-aktualisiert.event';
import { PatientBehandlungBegonnen } from '../../events/patient-behandlung-begonnen.event';
import { PatientTransportGestartet } from '../../events/patient-transport-gestartet.event';

function buildPatient(overrides: Partial<Parameters<typeof Patient.create>[0]> = {}) {
  return Patient.create({
    einsatzId: 'einsatz-A',
    patientennummer: Patientennummer.fromSequence(1).value!,
    erfasserRef: ErfasserRef.user('user-001').value!,
    erfasstAm: new Date('2026-05-19T10:00:00Z'),
    ...overrides,
  });
}

describe('Patient Aggregate', () => {
  describe('create (Happy Path)', () => {
    it('erstellt ein Aggregate und emittiert PatientErfasst (eventVersion=1)', () => {
      const result = buildPatient();
      expect(result.isSuccess).toBe(true);
      const patient = result.value!;
      expect(patient.einsatzId).toBe('einsatz-A');
      expect(patient.patientennummer.value).toBe('P-001');
      expect(patient.aktuelleSk.code).toBe('SK_III');
      expect(patient.behandlungsstatus.code).toBe('UNVERSORGT');
      expect(patient.transportstatus.code).toBe('WARTEND');
      expect(patient.eventVersion).toBe(1);

      const events = patient.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(PatientErfasst);
      expect((events[0] as PatientErfasst).patientennummer).toBe('P-001');
      expect((events[0] as PatientErfasst).initialeSk).toBe('SK_III');
      expect((events[0] as PatientErfasst).eventVersion).toBe(1);
    });

    it('nutzt die explizit übergebene initiale SK', () => {
      const result = buildPatient({ initialeSk: Sichtungskategorie.create('SK_I').value! });
      expect(result.value!.aktuelleSk.code).toBe('SK_I');
    });

    it('akzeptiert Device-Erfassung (Standalone-Capture)', () => {
      const result = buildPatient({ erfasserRef: ErfasserRef.device('tablet-1', 'cs_42').value! });
      expect(result.isSuccess).toBe(true);
      const event = result.value!.getDomainEvents()[0] as PatientErfasst;
      expect(event.erfasserRef.type).toBe('device');
    });
  });

  describe('create (Validation Errors)', () => {
    it('rejected leere einsatzId', () => {
      const result = buildPatient({ einsatzId: '' });
      expect(result.error).toBe(PATIENT_BUSINESS_RULE_EINSATZ_ID_ERFORDERLICH);
    });

    it('rejected fehlerhafte ErfasstAm', () => {
      const result = buildPatient({ erfasstAm: new Date('invalid') });
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(PATIENT_BUSINESS_RULE_ERFASST_AM_UNGUELTIG);
    });

    it('rejected ungültige PatientId', () => {
      const result = buildPatient({ id: 'not-a-cuid' });
      expect(result.isFailure).toBe(true);
    });

    it('rejected NaN/Infinity in clockDriftSeconds', () => {
      const nanResult = buildPatient({ clockDriftSeconds: Number.NaN });
      expect(nanResult.isFailure).toBe(true);
      expect(nanResult.error).toBe(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);

      const infResult = buildPatient({ clockDriftSeconds: Number.POSITIVE_INFINITY });
      expect(infResult.isFailure).toBe(true);
      expect(infResult.error).toBe(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);

      const floatResult = buildPatient({ clockDriftSeconds: 1.5 });
      expect(floatResult.isFailure).toBe(true);
      expect(floatResult.error).toBe(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);
    });
  });

  describe('Status-Übergänge', () => {
    it('gesichtet ändert aktuelle SK und emittiert PatientGesichtet (eventVersion=2)', () => {
      const patient = buildPatient().value!;
      const sichtung = Sichtung.create({
        sk: Sichtungskategorie.create('SK_I').value!,
        sichter: ErfasserRef.user('arzt-1').value!.data,
        sichtungArt: 'aerztlich',
        gesichtetAm: new Date('2026-05-19T10:05:00Z'),
      }).value!;
      const result = patient.gesichtet(sichtung);
      expect(result.isSuccess).toBe(true);
      expect(patient.aktuelleSk.code).toBe('SK_I');
      expect(patient.eventVersion).toBe(2);
      const events = patient.getDomainEvents();
      expect(events[1]).toBeInstanceOf(PatientGesichtet);
      expect((events[1] as PatientGesichtet).eventVersion).toBe(2);
    });

    it('behandlungBeginnen erfordert UNVERSORGT als Startzustand', () => {
      const patient = buildPatient().value!;
      const result = patient.behandlungBeginnen();
      expect(result.isSuccess).toBe(true);
      expect(patient.behandlungsstatus.code).toBe('IN_BEHANDLUNG');
      const events = patient.getDomainEvents();
      expect(events.find((e) => e instanceof PatientBehandlungBegonnen)).toBeDefined();
    });

    it('behandlungBeginnen scheitert, wenn bereits IN_BEHANDLUNG', () => {
      const patient = buildPatient().value!;
      patient.behandlungBeginnen();
      const result = patient.behandlungBeginnen();
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(PATIENT_BUSINESS_RULE_BEHANDLUNG_UNGUELTIGER_UEBERGANG);
    });

    it('transportStarten erfordert WARTEND als Startzustand', () => {
      const patient = buildPatient().value!;
      const result = patient.transportStarten();
      expect(result.isSuccess).toBe(true);
      expect(patient.transportstatus.code).toBe('IM_TRANSPORT');
      const events = patient.getDomainEvents();
      expect(events.find((e) => e instanceof PatientTransportGestartet)).toBeDefined();
    });

    it('transportStarten scheitert, wenn bereits IM_TRANSPORT', () => {
      const patient = buildPatient().value!;
      patient.transportStarten();
      const result = patient.transportStarten();
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(PATIENT_BUSINESS_RULE_TRANSPORT_UNGUELTIGER_UEBERGANG);
    });

    it('gesichtet blockt Rücksprung TOT → SK_*', () => {
      const patient = buildPatient({ initialeSk: Sichtungskategorie.create('TOT').value! }).value!;
      const sichtung = Sichtung.create({
        sk: Sichtungskategorie.create('SK_I').value!,
        sichter: ErfasserRef.user('arzt-1').value!.data,
        sichtungArt: 'aerztlich',
        gesichtetAm: new Date('2026-05-19T10:05:00Z'),
      }).value!;
      const result = patient.gesichtet(sichtung);
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(PATIENT_BUSINESS_RULE_SICHTUNG_VON_TOT_NICHT_ERLAUBT);
      expect(patient.aktuelleSk.code).toBe('TOT');
    });

    it('gesichtet erlaubt TOT → TOT (wiederholte Bestätigung)', () => {
      const patient = buildPatient({ initialeSk: Sichtungskategorie.create('TOT').value! }).value!;
      const sichtung = Sichtung.create({
        sk: Sichtungskategorie.create('TOT').value!,
        sichter: ErfasserRef.user('arzt-1').value!.data,
        sichtungArt: 'aerztlich',
        gesichtetAm: new Date('2026-05-19T10:05:00Z'),
      }).value!;
      const result = patient.gesichtet(sichtung);
      expect(result.isSuccess).toBe(true);
    });

    it('eventVersion ist monoton', () => {
      const patient = buildPatient().value!;
      patient.gesichtet(
        Sichtung.create({
          sk: Sichtungskategorie.create('SK_II').value!,
          sichter: ErfasserRef.user('arzt-1').value!.data,
          sichtungArt: 'aerztlich',
          gesichtetAm: new Date('2026-05-19T10:05:00Z'),
        }).value!,
      );
      patient.behandlungBeginnen();
      patient.transportStarten();
      const versions = patient.getDomainEvents().map((e) => (e as PatientErfasst).eventVersion);
      expect(versions).toEqual([1, 2, 3, 4]);
    });
  });

  describe('sichtungAktualisieren (Story 1.3 — Reevaluierung)', () => {
    function sichtung(sk: string, art: 'aerztlich' | 'vorsichtung' = 'aerztlich') {
      return Sichtung.create({
        sk: Sichtungskategorie.create(sk as never).value!,
        sichter: ErfasserRef.user('arzt-1').value!.data,
        sichtungArt: art,
        gesichtetAm: new Date('2026-05-19T10:10:00Z'),
      }).value!;
    }

    it('Happy-Path: SK_III → SK_II emittiert PatientSichtungAktualisiert mit korrekten vorher/neu', () => {
      const patient = buildPatient().value!;
      patient.clearDomainEvents();
      const result = patient.sichtungAktualisieren(sichtung('SK_II'));
      expect(result.isSuccess).toBe(true);
      expect(patient.aktuelleSk.code).toBe('SK_II');
      expect(patient.eventVersion).toBe(2);
      const events = patient.getDomainEvents();
      expect(events).toHaveLength(1);
      const event = events[0] as PatientSichtungAktualisiert;
      expect(event).toBeInstanceOf(PatientSichtungAktualisiert);
      expect(event.vorher).toBe('SK_III');
      expect(event.neu).toBe('SK_II');
      expect(event.sichtungArt).toBe('aerztlich');
      expect(event.eventVersion).toBe(2);
      // Boundary: emittiert NICHT mehr PatientGesichtet (fachliche Trennung)
      expect(events.some((e) => e instanceof PatientGesichtet)).toBe(false);
    });

    it('No-Op (vorher === neu) liefert SICHTUNG_UNVERAENDERT, kein Event-Spam', () => {
      const patient = buildPatient({ initialeSk: Sichtungskategorie.create('SK_II').value! }).value!;
      patient.clearDomainEvents();
      const result = patient.sichtungAktualisieren(sichtung('SK_II'));
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(PATIENT_BUSINESS_RULE_SICHTUNG_UNVERAENDERT);
      expect(patient.getDomainEvents()).toHaveLength(0);
      expect(patient.eventVersion).toBe(1);
    });

    it('TOT-Block: TOT → SK_I liefert SICHTUNG_VON_TOT_NICHT_ERLAUBT (Sentinel mit Übergang)', () => {
      const patient = buildPatient({ initialeSk: Sichtungskategorie.create('TOT').value! }).value!;
      patient.clearDomainEvents();
      const result = patient.sichtungAktualisieren(sichtung('SK_I'));
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(`${PATIENT_BUSINESS_RULE_SICHTUNG_VON_TOT_NICHT_ERLAUBT}:TOT->SK_I`);
      expect(patient.aktuelleSk.code).toBe('TOT');
      expect(patient.getDomainEvents()).toHaveLength(0);
    });

    it('Param-Validierung greift bei Non-Sichtung-Input', () => {
      const patient = buildPatient().value!;
      const result = patient.sichtungAktualisieren({} as unknown as Sichtung);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(PATIENT_BUSINESS_RULE_SICHTUNG_UNGUELTIG);
    });

    it('eventVersion inkrementiert um 1 (monoton, append-only)', () => {
      const patient = buildPatient().value!;
      patient.sichtungAktualisieren(sichtung('SK_II'));
      patient.sichtungAktualisieren(sichtung('SK_I'));
      const versions = patient.getDomainEvents().map((e) => (e as PatientErfasst).eventVersion);
      expect(versions).toEqual([1, 2, 3]);
      expect(patient.eventVersion).toBe(3);
    });

    it('optionaler grund wird getrimmt und im Event persistiert', () => {
      const patient = buildPatient().value!;
      patient.clearDomainEvents();
      const result = patient.sichtungAktualisieren(sichtung('SK_II'), { grund: '  Vitalwerte verschlechtert  ' });
      expect(result.isSuccess).toBe(true);
      const event = patient.getDomainEvents()[0] as PatientSichtungAktualisiert;
      expect(event.grund).toBe('Vitalwerte verschlechtert');
    });

    it('lehnt leeren/zu langen grund ab', () => {
      const patient = buildPatient().value!;
      const empty = patient.sichtungAktualisieren(sichtung('SK_II'), { grund: '   ' });
      expect(empty.isFailure).toBe(true);
      expect(empty.error).toBe(PATIENT_BUSINESS_RULE_GRUND_UNGUELTIG);
      const tooLong = patient.sichtungAktualisieren(sichtung('SK_II'), { grund: 'x'.repeat(501) });
      expect(tooLong.isFailure).toBe(true);
      expect(tooLong.error).toBe(PATIENT_BUSINESS_RULE_GRUND_UNGUELTIG);
    });

    it('lehnt fehlerhafte clockDriftSeconds ab', () => {
      const patient = buildPatient().value!;
      const result = patient.sichtungAktualisieren(sichtung('SK_II'), { clockDriftSeconds: Number.NaN });
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(PATIENT_BUSINESS_RULE_CLOCK_DRIFT_UNGUELTIG);
    });
  });

  describe('applyEvent (Replay-Vertrag)', () => {
    it('synchronisiert Snapshot aus PatientGesichtet', () => {
      const patient = buildPatient().value!;
      const event = new PatientGesichtet('einsatz-A', patient.id.value, 5, 'SK_I', 'aerztlich', {
        type: 'user',
        userId: 'arzt-1',
      });
      patient.applyEvent(event);
      expect(patient.aktuelleSk.code).toBe('SK_I');
      expect(patient.eventVersion).toBe(5);
    });

    it('synchronisiert Snapshot aus PatientSichtungAktualisiert (Story 1.3)', () => {
      const patient = buildPatient().value!;
      const event = new PatientSichtungAktualisiert('einsatz-A', patient.id.value, 6, 'SK_III', 'SK_II', 'aerztlich', {
        type: 'user',
        userId: 'arzt-1',
      });
      patient.applyEvent(event);
      expect(patient.aktuelleSk.code).toBe('SK_II');
      expect(patient.eventVersion).toBe(6);
    });
  });
});
