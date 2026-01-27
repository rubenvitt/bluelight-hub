import { EskalationsTimeout } from '../eskalations-timeout';

describe('EskalationsTimeout', () => {
  it('should create a valid timeout', () => {
    const result = EskalationsTimeout.create(10);
    expect(result.isSuccess).toBe(true);
    expect(result.value?.value).toBe(10);
    expect(result.value?.seconds).toBe(600);
  });

  it('should return error for non-integer values', () => {
    const result = EskalationsTimeout.create(5.5);
    expect(result.isFailure).toBe(true);
    expect(result.error).toBe('ESKALATIONS_TIMEOUT_MUST_BE_INTEGER');
  });

  it('should return error for values below minimum', () => {
    const result = EskalationsTimeout.create(0);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('ESKALATIONS_TIMEOUT_TOO_LOW');
  });

  it('should return error for values above maximum', () => {
    const result = EskalationsTimeout.create(61);
    expect(result.isFailure).toBe(true);
    expect(result.error).toContain('ESKALATIONS_TIMEOUT_TOO_HIGH');
  });

  it('should create default timeout', () => {
    const timeout = EskalationsTimeout.default();
    expect(timeout.value).toBe(5);
  });
});
