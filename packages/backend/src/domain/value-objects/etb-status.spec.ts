import { EtbStatus } from './etb-status';

describe('EtbStatus', () => {
  describe('create', () => {
    it('should create valid status DRAFT', () => {
      const result = EtbStatus.create('DRAFT');
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('DRAFT');
    });

    it('should create valid status ACTIVE', () => {
      const result = EtbStatus.create('ACTIVE');
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('ACTIVE');
    });

    it('should create valid status LOCKED', () => {
      const result = EtbStatus.create('LOCKED');
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('LOCKED');
    });

    it('should reject invalid status', () => {
      const result = EtbStatus.create('INVALID');
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Ungültiger Status');
    });
  });

  describe('static factories', () => {
    it('should create DRAFT via static factory', () => {
      const status = EtbStatus.DRAFT();
      expect(status.value).toBe('DRAFT');
    });

    it('should create ACTIVE via static factory', () => {
      const status = EtbStatus.ACTIVE();
      expect(status.value).toBe('ACTIVE');
    });

    it('should create LOCKED via static factory', () => {
      const status = EtbStatus.LOCKED();
      expect(status.value).toBe('LOCKED');
    });
  });

  describe('canTransitionTo - Valid Transitions', () => {
    it('should allow DRAFT → ACTIVE transition', () => {
      const draft = EtbStatus.DRAFT();
      const active = EtbStatus.ACTIVE();
      expect(draft.canTransitionTo(active)).toBe(true);
    });

    it('should allow DRAFT → LOCKED transition', () => {
      const draft = EtbStatus.DRAFT();
      const locked = EtbStatus.LOCKED();
      expect(draft.canTransitionTo(locked)).toBe(true);
    });

    it('should allow ACTIVE → LOCKED transition', () => {
      const active = EtbStatus.ACTIVE();
      const locked = EtbStatus.LOCKED();
      expect(active.canTransitionTo(locked)).toBe(true);
    });
  });

  describe('canTransitionTo - Invalid Transitions', () => {
    it('should reject ACTIVE → DRAFT (backward transition)', () => {
      const active = EtbStatus.ACTIVE();
      const draft = EtbStatus.DRAFT();
      expect(active.canTransitionTo(draft)).toBe(false);
    });

    it('should reject LOCKED → ACTIVE (no transitions from LOCKED)', () => {
      const locked = EtbStatus.LOCKED();
      const active = EtbStatus.ACTIVE();
      expect(locked.canTransitionTo(active)).toBe(false);
    });

    it('should reject LOCKED → DRAFT (final state)', () => {
      const locked = EtbStatus.LOCKED();
      const draft = EtbStatus.DRAFT();
      expect(locked.canTransitionTo(draft)).toBe(false);
    });

    it('should reject LOCKED → LOCKED (no self-transition from final state)', () => {
      const locked1 = EtbStatus.LOCKED();
      const locked2 = EtbStatus.LOCKED();
      expect(locked1.canTransitionTo(locked2)).toBe(false);
    });
  });
});
