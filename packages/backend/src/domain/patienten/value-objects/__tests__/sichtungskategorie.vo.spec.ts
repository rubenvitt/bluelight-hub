import { SK_CODES, Sichtungskategorie } from '../sichtungskategorie.vo';

describe('Sichtungskategorie ValueObject', () => {
  it('akzeptiert alle DIN-Codes (SK_I..SK_IV, TOT)', () => {
    for (const code of SK_CODES) {
      const result = Sichtungskategorie.create(code);
      expect(result.isSuccess).toBe(true);
      expect(result.value?.code).toBe(code);
    }
  });

  it('rejected ungültige Strings', () => {
    const result = Sichtungskategorie.create('SK_V');
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('ungültiger Code');
  });

  it('rejected nicht-string Input', () => {
    // @ts-expect-error — bewusster Falsch-Typ-Test
    const result = Sichtungskategorie.create(123);
    expect(result.isFailure).toBe(true);
  });

  it('markiert SK_I bis SK_IV als lebend, TOT als nicht-lebend', () => {
    expect(Sichtungskategorie.create('SK_I').value!.istLebend).toBe(true);
    expect(Sichtungskategorie.create('SK_IV').value!.istLebend).toBe(true);
    expect(Sichtungskategorie.create('TOT').value!.istLebend).toBe(false);
  });

  it('Equals-Semantik vergleicht strukturell', () => {
    const a = Sichtungskategorie.create('SK_II').value!;
    const b = Sichtungskategorie.create('SK_II').value!;
    const c = Sichtungskategorie.create('SK_III').value!;
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
