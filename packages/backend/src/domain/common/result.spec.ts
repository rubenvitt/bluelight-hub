import { Result } from './result';

describe('Result', () => {
  describe('ok()', () => {
    it('should create success case with correct value', () => {
      // Given: A value
      const value = 'success';

      // When: Creating Result.ok()
      const result = Result.ok(value);

      // Then: Result is success with value
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBe(value);
      expect(result.error).toBeUndefined();
    });
  });

  describe('fail()', () => {
    it('should create failure case with error message', () => {
      // Given: An error message
      const errorMessage = 'Something went wrong';

      // When: Creating Result.fail()
      const result = Result.fail(errorMessage);

      // Then: Result is failure with error
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(errorMessage);
      expect(result.value).toBeUndefined();
    });
  });

  describe('isFailure getter', () => {
    it('should return true for failed results', () => {
      // Given: A failed result
      const result = Result.fail('error');

      // When: Checking isFailure
      const isFailure = result.isFailure;

      // Then: isFailure is true
      expect(isFailure).toBe(true);
    });

    it('should return false for successful results', () => {
      // Given: A successful result
      const result = Result.ok('value');

      // When: Checking isFailure
      const isFailure = result.isFailure;

      // Then: isFailure is false
      expect(isFailure).toBe(false);
    });
  });
});
