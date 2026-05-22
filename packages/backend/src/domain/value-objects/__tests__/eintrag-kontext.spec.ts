import { EintragKontext, FunkKontext, PatientKontext, StandardKontext } from '../eintrag-kontext';

describe('EintragKontext', () => {
  describe('standard()', () => {
    it('baut Standard-Kontext', () => {
      const k = EintragKontext.standard();
      expect(k.type).toBe('standard');
    });

    it('serialisiert zu { type: "standard" }', () => {
      const k = EintragKontext.standard();
      expect(k.toPersistence()).toEqual({ type: 'standard' });
    });
  });

  describe('funkspruch()', () => {
    it('baut FunkKontext mit kanalId und Priorität', () => {
      const k = EintragKontext.funkspruch({
        kanalId: 'k1',
        funkPrioritaet: 'notfall',
      });
      expect(k.type).toBe('funkspruch');
      expect((k as FunkKontext).kanalId).toBe('k1');
      expect((k as FunkKontext).funkPrioritaet).toBe('notfall');
    });

    it('serialisiert alle Felder', () => {
      const k = EintragKontext.funkspruch({
        kanalId: 'x',
        funkPrioritaet: 'prioritaet',
      });
      expect(k.toPersistence()).toEqual({
        type: 'funkspruch',
        kanalId: 'x',
        funkPrioritaet: 'prioritaet',
      });
    });
  });

  describe('fromPersistence()', () => {
    it('dekodiert Standard-Kontext', () => {
      const k = EintragKontext.fromPersistence('standard', null);
      expect(k.type).toBe('standard');
    });

    it('dekodiert FunkKontext aus JSONB', () => {
      const k = EintragKontext.fromPersistence('funkspruch', {
        kanalId: 'x',
        funkPrioritaet: 'routine',
      });
      expect(k.type).toBe('funkspruch');
      expect((k as FunkKontext).kanalId).toBe('x');
      expect((k as FunkKontext).funkPrioritaet).toBe('routine');
    });

    it('fällt bei unbekanntem type auf standard zurück', () => {
      const k = EintragKontext.fromPersistence('unknown', {});
      expect(k.type).toBe('standard');
    });

    it('Roundtrip: standard', () => {
      const original = EintragKontext.standard();
      const persisted = original.toPersistence();
      const restored: StandardKontext = EintragKontext.fromPersistence(persisted.type, null) as StandardKontext;
      expect(restored.type).toBe('standard');
    });

    it('Roundtrip: funkspruch', () => {
      const original = EintragKontext.funkspruch({
        kanalId: 'ch-42',
        funkPrioritaet: 'notfall',
      });
      const persisted = original.toPersistence();
      const restored = EintragKontext.fromPersistence(persisted.type, persisted.type === 'funkspruch' ? { kanalId: persisted.kanalId, funkPrioritaet: persisted.funkPrioritaet } : null) as FunkKontext;
      expect(restored.type).toBe('funkspruch');
      expect(restored.kanalId).toBe('ch-42');
      expect(restored.funkPrioritaet).toBe('notfall');
    });
  });

  describe('patient()', () => {
    it('baut PatientKontext mit kind, patientId, patientennummer, payload', () => {
      const k = EintragKontext.patient({
        kind: 'patient.erfasst',
        patientId: 'pat-1',
        patientennummer: 'P-001',
        payload: { initialeSk: 'SK_II', erfasserRef: { type: 'user', userId: 'u-1' } },
      });
      expect(k.type).toBe('patient');
      expect((k as PatientKontext).kind).toBe('patient.erfasst');
      expect((k as PatientKontext).patientId).toBe('pat-1');
      expect((k as PatientKontext).patientennummer).toBe('P-001');
      expect((k as PatientKontext).payload).toEqual({ initialeSk: 'SK_II', erfasserRef: { type: 'user', userId: 'u-1' } });
    });

    it('serialisiert alle Felder', () => {
      const k = EintragKontext.patient({
        kind: 'patient.erfasst',
        patientId: 'pat-1',
        patientennummer: 'P-007',
        payload: { initialeSk: 'SK_I', erfasserRef: { type: 'user', userId: 'u-1' }, diviVakNummer: 'DIVI-42', notiz: 'Reanimation läuft' },
      });
      expect(k.toPersistence()).toEqual({
        type: 'patient',
        kind: 'patient.erfasst',
        patientId: 'pat-1',
        patientennummer: 'P-007',
        payload: { initialeSk: 'SK_I', erfasserRef: { type: 'user', userId: 'u-1' }, diviVakNummer: 'DIVI-42', notiz: 'Reanimation läuft' },
      });
    });

    it('Roundtrip über fromPersistence', () => {
      const original = EintragKontext.patient({
        kind: 'patient.erfasst',
        patientId: 'pat-9',
        patientennummer: 'P-009',
        payload: { initialeSk: 'SK_III', erfasserRef: { type: 'device', deviceId: 'tab-3', captureSessionId: 'sess-1' }, notiz: 'für Triage markiert' },
      });
      const persisted = original.toPersistence();
      const restored = EintragKontext.fromPersistence(persisted.type, persisted) as PatientKontext;
      expect(restored.type).toBe('patient');
      expect(restored.kind).toBe('patient.erfasst');
      expect(restored.patientId).toBe('pat-9');
      expect(restored.patientennummer).toBe('P-009');
      expect(restored.payload).toEqual({ initialeSk: 'SK_III', erfasserRef: { type: 'device', deviceId: 'tab-3', captureSessionId: 'sess-1' }, notiz: 'für Triage markiert' });
    });

    it('fällt bei unbekanntem kind auf standard zurück', () => {
      const k = EintragKontext.fromPersistence('patient', {
        kind: 'patient.unbekannt',
        patientId: 'pat-1',
        patientennummer: 'P-001',
        payload: {},
      });
      expect(k.type).toBe('standard');
    });

    it('fällt bei fehlender patientennummer auf standard zurück', () => {
      const k = EintragKontext.fromPersistence('patient', {
        kind: 'patient.erfasst',
        patientId: 'pat-1',
        payload: {},
      });
      expect(k.type).toBe('standard');
    });

    it('fällt bei payload != object auf standard zurück', () => {
      const k = EintragKontext.fromPersistence('patient', {
        kind: 'patient.erfasst',
        patientId: 'pat-1',
        patientennummer: 'P-001',
        payload: 'kein-objekt',
      });
      expect(k.type).toBe('standard');
    });
  });
});
