import { BEHANDLUNGSSTATUS_CODES, Behandlungsstatus } from '../behandlungsstatus.vo';

describe('Behandlungsstatus ValueObject', () => {
  it('akzeptiert alle definierten Codes', () => {
    for (const code of BEHANDLUNGSSTATUS_CODES) {
      const result = Behandlungsstatus.create(code);
      expect(result.isSuccess).toBe(true);
      expect(result.value?.code).toBe(code);
    }
  });

  it('rejected ungültige Codes', () => {
    expect(Behandlungsstatus.create('ABGESCHLOSSEN').isFailure).toBe(true);
  });

  it('initial()-Factory liefert UNVERSORGT', () => {
    expect(Behandlungsstatus.initial().code).toBe('UNVERSORGT');
  });

  it('erlaubt nur den nächsten linearen Übergang', () => {
    expect(Behandlungsstatus.initial().canTransitionTo('IN_BEHANDLUNG')).toBe(true);
    expect(Behandlungsstatus.initial().canTransitionTo('VERSORGT')).toBe(false);

    const inBehandlung = Behandlungsstatus.create('IN_BEHANDLUNG').value!;
    expect(inBehandlung.canTransitionTo('VERSORGT')).toBe(true);
    expect(inBehandlung.canTransitionTo('UNVERSORGT')).toBe(false);

    const transportbereit = Behandlungsstatus.create('TRANSPORTBEREIT').value!;
    expect(transportbereit.canTransitionTo('IN_BEHANDLUNG')).toBe(false);
  });

  it('Story 1.4: erlaubt IN_BEHANDLUNG → TRANSPORTBEREIT (operative Realität bei MANV)', () => {
    const inBehandlung = Behandlungsstatus.create('IN_BEHANDLUNG').value!;
    expect(inBehandlung.canTransitionTo('TRANSPORTBEREIT')).toBe(true);
    expect(inBehandlung.canTransitionTo('VERSORGT')).toBe(true);
  });
});
