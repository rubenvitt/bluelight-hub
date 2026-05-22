import { Patientennummer } from '../patientennummer.vo';

describe('Patientennummer ValueObject', () => {
  describe('fromSequence', () => {
    it('formatiert kleine Sequenzen dreistellig (P-001, P-042, P-999)', () => {
      expect(Patientennummer.fromSequence(1).value?.value).toBe('P-001');
      expect(Patientennummer.fromSequence(42).value?.value).toBe('P-042');
      expect(Patientennummer.fromSequence(999).value?.value).toBe('P-999');
    });

    it('behält bei Sequenzen ab 1000 die natürliche Stellenzahl', () => {
      expect(Patientennummer.fromSequence(1000).value?.value).toBe('P-1000');
      expect(Patientennummer.fromSequence(12345).value?.value).toBe('P-12345');
    });

    it('rejected Sequenzen < 1 und nicht-ganzzahlige Werte', () => {
      expect(Patientennummer.fromSequence(0).isFailure).toBe(true);
      expect(Patientennummer.fromSequence(-1).isFailure).toBe(true);
      expect(Patientennummer.fromSequence(1.5).isFailure).toBe(true);
      expect(Patientennummer.fromSequence(Number.NaN).isFailure).toBe(true);
    });
  });

  describe('fromString', () => {
    it('akzeptiert das kanonische Format P-NNN', () => {
      expect(Patientennummer.fromString('P-001').isSuccess).toBe(true);
      expect(Patientennummer.fromString('P-1000').isSuccess).toBe(true);
    });

    it('trimmt Whitespace', () => {
      expect(Patientennummer.fromString('  P-001  ').value?.value).toBe('P-001');
    });

    it('rejected falsche Formate', () => {
      for (const s of ['P-1', 'P-12', 'p-001', 'P_001', '001', 'P-abc', '']) {
        expect(Patientennummer.fromString(s).isFailure).toBe(true);
      }
    });

    it('rejected Sequenz-Anteil 0 (P-000 verletzt Sequenz-Konvention)', () => {
      expect(Patientennummer.fromString('P-000').isFailure).toBe(true);
      expect(Patientennummer.fromString('P-0000').isFailure).toBe(true);
    });

    it('rejected nicht-string Input', () => {
      // @ts-expect-error — bewusster Falsch-Typ-Test
      expect(Patientennummer.fromString(42).isFailure).toBe(true);
    });
  });

  it('toString liefert den value-String', () => {
    const nummer = Patientennummer.fromSequence(7).value!;
    expect(nummer.toString()).toBe('P-007');
  });
});
