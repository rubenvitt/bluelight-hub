import { PatientBehandlungBegonnen } from '../patient-behandlung-begonnen.event';
import { PatientErfasst } from '../patient-erfasst.event';
import { PatientGesichtet } from '../patient-gesichtet.event';
import { PatientSichtungAktualisiert } from '../patient-sichtung-aktualisiert.event';
import { PatientTransportGestartet } from '../patient-transport-gestartet.event';

describe('Patient Domain Events', () => {
  describe('PatientErfasst', () => {
    it('eventName folgt dot-Notation (Architecture §D-6, Story 1.2)', () => {
      expect(PatientErfasst.eventName()).toBe('patient.erfasst');
    });

    it('mapt User-Erfasser auf actorUserId', () => {
      const event = new PatientErfasst('einsatz-1', 'patient-1', 'P-001', 'SK_III', { type: 'user', userId: 'u-1' });
      expect(event.actorUserId).toBe('u-1');
      expect(event.actorDeviceId).toBeUndefined();
      expect(event.eventVersion).toBe(1);
    });

    it('mapt Device-Erfasser auf actorDeviceId + originSessionId', () => {
      const event = new PatientErfasst('einsatz-1', 'patient-1', 'P-001', 'SK_III', {
        type: 'device',
        deviceId: 'd-1',
        captureSessionId: 'cs_9',
      });
      expect(event.actorDeviceId).toBe('d-1');
      expect(event.originSessionId).toBe('cs_9');
      expect(event.actorUserId).toBeUndefined();
    });

    it('ist serialisierbar (JSON roundtrip)', () => {
      const event = new PatientErfasst('einsatz-1', 'patient-1', 'P-001', 'SK_III', { type: 'user', userId: 'u-1' });
      const json = JSON.parse(JSON.stringify(event));
      expect(json.patientennummer).toBe('P-001');
      expect(json.initialeSk).toBe('SK_III');
    });
  });

  describe('PatientGesichtet', () => {
    it('eventName folgt dot-Notation (Architecture §D-6, Story 1.3 Registry-Vervollständigung)', () => {
      expect(PatientGesichtet.eventName()).toBe('patient.gesichtet');
    });

    it('trägt Pflicht-Payload', () => {
      const event = new PatientGesichtet('einsatz-1', 'patient-1', 2, 'SK_I', 'aerztlich', { type: 'user', userId: 'arzt-1' });
      expect(event.sk).toBe('SK_I');
      expect(event.sichtungArt).toBe('aerztlich');
      expect(event.eventVersion).toBe(2);
    });
  });

  describe('PatientSichtungAktualisiert', () => {
    it('eventName folgt dot-Notation (Story 1.3, Architecture §D-6)', () => {
      expect(PatientSichtungAktualisiert.eventName()).toBe('patient.sichtung-aktualisiert');
    });

    it('trägt vorher/neu/sichtungArt/sichter + optionalen grund', () => {
      const event = new PatientSichtungAktualisiert('einsatz-1', 'patient-1', 2, 'SK_II', 'SK_I', 'aerztlich', { type: 'user', userId: 'arzt-1' }, 'Vitalwerte verschlechtert');
      expect(event.vorher).toBe('SK_II');
      expect(event.neu).toBe('SK_I');
      expect(event.sichtungArt).toBe('aerztlich');
      expect(event.grund).toBe('Vitalwerte verschlechtert');
      expect(event.eventVersion).toBe(2);
      expect(event.actorUserId).toBe('arzt-1');
    });

    it('mapt Device-Sichter auf actorDeviceId + originSessionId', () => {
      const event = new PatientSichtungAktualisiert('einsatz-1', 'patient-1', 3, 'SK_III', 'SK_II', 'vorsichtung', {
        type: 'device',
        deviceId: 'tablet-7',
        captureSessionId: 'cs_42',
      });
      expect(event.actorDeviceId).toBe('tablet-7');
      expect(event.originSessionId).toBe('cs_42');
      expect(event.actorUserId).toBeUndefined();
      expect(event.grund).toBeUndefined();
    });

    it('ist serialisierbar (JSON roundtrip)', () => {
      const event = new PatientSichtungAktualisiert('einsatz-1', 'patient-1', 4, 'SK_I', 'TOT', 'aerztlich', { type: 'user', userId: 'arzt-1' });
      const json = JSON.parse(JSON.stringify(event));
      expect(json.vorher).toBe('SK_I');
      expect(json.neu).toBe('TOT');
    });
  });

  describe('PatientBehandlungBegonnen', () => {
    it('eventName ist past tense und Payload ist Marker-Event', () => {
      const event = new PatientBehandlungBegonnen('einsatz-1', 'patient-1', 3, 'u-1');
      expect(PatientBehandlungBegonnen.eventName()).toBe('PatientBehandlungBegonnen');
      expect(event.eventVersion).toBe(3);
      expect(event.actorUserId).toBe('u-1');
    });
  });

  describe('PatientTransportGestartet', () => {
    it('eventName ist past tense und Payload ist Marker-Event', () => {
      const event = new PatientTransportGestartet('einsatz-1', 'patient-1', 4);
      expect(PatientTransportGestartet.eventName()).toBe('PatientTransportGestartet');
      expect(event.eventVersion).toBe(4);
    });
  });
});
