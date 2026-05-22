import { PatientEtbContextSchema, patientSichtungAktualisiertContextSchema } from '../etb-context.schema';

describe('PatientEtbContextSchema — patient.sichtung-aktualisiert (Story 1.3)', () => {
  const base = {
    kind: 'patient.sichtung-aktualisiert' as const,
    patientId: 'p-001',
    patientennummer: 'P-001',
    vorher: 'SK_II' as const,
    neu: 'SK_I' as const,
    sichter: { type: 'user' as const, userId: 'arzt-1' },
    sichtungArt: 'aerztlich' as const,
  };

  it('akzeptiert gültigen Sichtung-Aktualisiert-Kontext ohne grund', () => {
    const result = patientSichtungAktualisiertContextSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('akzeptiert gültigen Sichtung-Aktualisiert-Kontext mit grund (trim + max-500)', () => {
    const result = patientSichtungAktualisiertContextSchema.safeParse({ ...base, grund: '  Vitalwerte verschlechtert  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.grund).toBe('Vitalwerte verschlechtert');
    }
  });

  it('akzeptiert Vorsichtung als sichtungArt', () => {
    const result = patientSichtungAktualisiertContextSchema.safeParse({ ...base, sichtungArt: 'vorsichtung' });
    expect(result.success).toBe(true);
  });

  it('akzeptiert Device-Sichter mit captureSessionId', () => {
    const result = patientSichtungAktualisiertContextSchema.safeParse({
      ...base,
      sichter: { type: 'device', deviceId: 'tablet-7', captureSessionId: 'cs_42' },
    });
    expect(result.success).toBe(true);
  });

  it('weist unbekannte SK in vorher/neu ab', () => {
    expect(patientSichtungAktualisiertContextSchema.safeParse({ ...base, vorher: 'SK_V' as never }).success).toBe(false);
    expect(patientSichtungAktualisiertContextSchema.safeParse({ ...base, neu: 'EX' as never }).success).toBe(false);
  });

  it('weist zu langen grund (> 500 Zeichen) ab', () => {
    const result = patientSichtungAktualisiertContextSchema.safeParse({ ...base, grund: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('weist leeren grund nach Trim ab', () => {
    const result = patientSichtungAktualisiertContextSchema.safeParse({ ...base, grund: '   ' });
    expect(result.success).toBe(false);
  });

  it('weist falsche sichtungArt ab', () => {
    const result = patientSichtungAktualisiertContextSchema.safeParse({ ...base, sichtungArt: 'algorithmisch' as never });
    expect(result.success).toBe(false);
  });

  it('wird via Discriminator korrekt geroutet (PatientEtbContextSchema)', () => {
    const result = PatientEtbContextSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('patient.sichtung-aktualisiert');
    }
  });
});
