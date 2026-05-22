import { TRANSPORTSTATUS_CODES, Transportstatus } from '../transportstatus.vo';

describe('Transportstatus ValueObject', () => {
  it('akzeptiert alle definierten Codes', () => {
    for (const code of TRANSPORTSTATUS_CODES) {
      const result = Transportstatus.create(code);
      expect(result.isSuccess).toBe(true);
      expect(result.value?.code).toBe(code);
    }
  });

  it('rejected ungültige Codes', () => {
    expect(Transportstatus.create('EINGETROFFEN').isFailure).toBe(true);
  });

  it('initial()-Factory liefert WARTEND', () => {
    expect(Transportstatus.initial().code).toBe('WARTEND');
  });

  it('erlaubt nur den nächsten linearen Übergang', () => {
    expect(Transportstatus.initial().canTransitionTo('IM_TRANSPORT')).toBe(true);
    expect(Transportstatus.initial().canTransitionTo('IM_KRANKENHAUS')).toBe(false);

    const imTransport = Transportstatus.create('IM_TRANSPORT').value!;
    expect(imTransport.canTransitionTo('IM_KRANKENHAUS')).toBe(true);
    expect(imTransport.canTransitionTo('WARTEND')).toBe(false);

    const imKrankenhaus = Transportstatus.create('IM_KRANKENHAUS').value!;
    expect(imKrankenhaus.canTransitionTo('IM_TRANSPORT')).toBe(false);
  });
});
