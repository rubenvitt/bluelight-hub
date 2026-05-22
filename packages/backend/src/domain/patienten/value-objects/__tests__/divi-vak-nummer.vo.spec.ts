import { DiviVakNummer } from '../divi-vak-nummer.vo';

describe('DiviVakNummer ValueObject', () => {
  it('akzeptiert gültige Strings und trimmt Whitespace', () => {
    const result = DiviVakNummer.create('  VAK-12345  ');
    expect(result.isSuccess).toBe(true);
    expect(result.value?.value).toBe('VAK-12345');
  });

  it('rejected leere und whitespace-only Strings', () => {
    expect(DiviVakNummer.create('').isFailure).toBe(true);
    expect(DiviVakNummer.create('   ').isFailure).toBe(true);
  });

  it('rejected Strings über 64 Zeichen', () => {
    const long = 'A'.repeat(65);
    expect(DiviVakNummer.create(long).isFailure).toBe(true);
  });

  it('rejected nicht-string Input', () => {
    // @ts-expect-error — bewusster Falsch-Typ-Test
    expect(DiviVakNummer.create(null).isFailure).toBe(true);
  });
});
