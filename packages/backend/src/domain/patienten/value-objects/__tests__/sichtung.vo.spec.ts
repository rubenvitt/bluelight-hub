import { ErfasserRef } from '../erfasser-ref.vo';
import { Sichtung } from '../sichtung.vo';
import { Sichtungskategorie } from '../sichtungskategorie.vo';

describe('Sichtung ValueObject', () => {
  const validSk = Sichtungskategorie.create('SK_II').value!;
  const validSichter = ErfasserRef.user('arzt-001').value!.data;
  const validDate = new Date('2026-05-19T10:00:00Z');

  it('akzeptiert eine valide ärztliche Sichtung', () => {
    const result = Sichtung.create({
      sk: validSk,
      sichter: validSichter,
      sichtungArt: 'aerztlich',
      gesichtetAm: validDate,
    });
    expect(result.isSuccess).toBe(true);
    expect(result.value?.sichtungArt).toBe('aerztlich');
    expect(result.value?.sk.code).toBe('SK_II');
  });

  it('akzeptiert Vorsichtung durch Device', () => {
    const device = ErfasserRef.device('tablet-12', 'cs_99').value!.data;
    const result = Sichtung.create({ sk: validSk, sichter: device, sichtungArt: 'vorsichtung', gesichtetAm: validDate });
    expect(result.isSuccess).toBe(true);
  });

  it('rejected falsche sichtungArt', () => {
    // @ts-expect-error — bewusster Falsch-Wert
    const result = Sichtung.create({ sk: validSk, sichter: validSichter, sichtungArt: 'foo', gesichtetAm: validDate });
    expect(result.isFailure).toBe(true);
  });

  it('rejected ungültiges Datum', () => {
    expect(Sichtung.create({ sk: validSk, sichter: validSichter, sichtungArt: 'aerztlich', gesichtetAm: new Date('invalid') }).isFailure).toBe(true);
  });

  it('rejected Sichter mit leerer ID', () => {
    expect(
      Sichtung.create({
        sk: validSk,
        sichter: { type: 'user', userId: '' },
        sichtungArt: 'aerztlich',
        gesichtetAm: validDate,
      }).isFailure,
    ).toBe(true);
  });

  it('rejected fehlenden Sichter (null/undefined) als Result.fail statt TypeError', () => {
    const nullResult = Sichtung.create({
      sk: validSk,
      // @ts-expect-error — bewusster Falsch-Wert
      sichter: null,
      sichtungArt: 'aerztlich',
      gesichtetAm: validDate,
    });
    expect(nullResult.isFailure).toBe(true);
    expect(nullResult.error).toContain('sichter erforderlich');

    const undefinedResult = Sichtung.create({
      sk: validSk,
      // @ts-expect-error — bewusster Falsch-Wert
      sichter: undefined,
      sichtungArt: 'aerztlich',
      gesichtetAm: validDate,
    });
    expect(undefinedResult.isFailure).toBe(true);
  });

  it('rejected Device-Sichter mit leerer captureSessionId-String', () => {
    expect(
      Sichtung.create({
        sk: validSk,
        sichter: { type: 'device', deviceId: 'tablet-1', captureSessionId: '   ' },
        sichtungArt: 'vorsichtung',
        gesichtetAm: validDate,
      }).isFailure,
    ).toBe(true);
  });
});
