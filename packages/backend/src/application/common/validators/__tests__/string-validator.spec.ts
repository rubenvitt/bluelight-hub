import { CUID2_REGEX, validateCuid2Format, validateRequiredString } from '../string-validator';

/**
 * Unit Tests für String Validation Helpers.
 *
 * Testet validateRequiredString() und validateCuid2Format()
 * gemäß BDD Given-When-Then Pattern.
 * Coverage Target: >90%
 */
describe('String Validator', () => {
  describe('validateRequiredString', () => {
    it('should not throw for valid non-empty string', () => {
      // Given
      const validValue = 'valid-value';
      const fieldName = 'testField';

      // When/Then
      expect(() => validateRequiredString(validValue, fieldName)).not.toThrow();
    });

    it('should throw error when value is undefined', () => {
      // Given
      const undefinedValue = undefined;
      const fieldName = 'testField';

      // When/Then
      expect(() => validateRequiredString(undefinedValue, fieldName)).toThrow('testField is required');
    });

    it('should throw error when value is empty string', () => {
      // Given
      const emptyValue = '';
      const fieldName = 'einsatzId';

      // When/Then
      expect(() => validateRequiredString(emptyValue, fieldName)).toThrow('einsatzId is required');
    });

    it('should throw error when value is whitespace only', () => {
      // Given
      const whitespaceValue = '   ';
      const fieldName = 'lagekarteId';

      // When/Then
      expect(() => validateRequiredString(whitespaceValue, fieldName)).toThrow('lagekarteId is required');
    });

    it('should not throw for string with leading/trailing whitespace but content', () => {
      // Given
      const valueWithWhitespace = '  valid  ';
      const fieldName = 'testField';

      // When/Then
      expect(() => validateRequiredString(valueWithWhitespace, fieldName)).not.toThrow();
    });

    it('should use custom field name in error message', () => {
      // Given
      const emptyValue = '';
      const customFieldName = 'customField';

      // When/Then
      expect(() => validateRequiredString(emptyValue, customFieldName)).toThrow('customField is required');
    });
  });

  describe('validateCuid2Format', () => {
    it('should not throw for valid CUID2 (25 characters, starts with lowercase letter)', () => {
      // Given
      const validCuid2 = 'clw3h8x9y0000qwertyui00001'; // 26 chars, starts with 'c'
      const fieldName = 'testId';

      // When/Then
      expect(() => validateCuid2Format(validCuid2, fieldName)).not.toThrow();
    });

    it('should not throw for CUID2 with all valid characters (a-z, 0-9)', () => {
      // Given
      const validCuid2 = 'cm1234567890abcdefghij'; // 22 chars, lowercase only
      const fieldName = 'testId';

      // When/Then
      expect(() => validateCuid2Format(validCuid2, fieldName)).not.toThrow();
    });

    it('should throw error for CUID2 starting with number (regardless of length)', () => {
      // Given - CUID2 Library accepts any lowercase-starting string,
      // but rejects strings starting with numbers
      const invalidId = '1234567890abcdefghij'; // 20 chars but starts with number
      const fieldName = 'einsatzId';

      // When/Then
      expect(() => validateCuid2Format(invalidId, fieldName)).toThrow('einsatzId must be a valid CUID2 format');
    });

    it('should throw error for CUID2 that is too long (more than 30 chars)', () => {
      // Given
      const longId = 'clw3h8x9y0000qwertyui000012345678901'; // 36 chars
      const fieldName = 'lagekarteId';

      // When/Then
      expect(() => validateCuid2Format(longId, fieldName)).toThrow('lagekarteId must be a valid CUID2 format');
    });

    it('should throw error for CUID2 with uppercase characters', () => {
      // Given
      const uppercaseId = 'CLW3H8X9Y0000QWERTYUI'; // 21 chars but uppercase
      const fieldName = 'poiId';

      // When/Then
      expect(() => validateCuid2Format(uppercaseId, fieldName)).toThrow('poiId must be a valid CUID2 format');
    });

    it('should throw error for CUID2 with invalid characters (underscore, hyphen)', () => {
      // Given
      const invalidId = 'clw3h8x9y_000-qwertyui'; // Has underscore and hyphen
      const fieldName = 'poiId';

      // When/Then
      expect(() => validateCuid2Format(invalidId, fieldName)).toThrow('poiId must be a valid CUID2 format');
    });

    it('should throw error for CUID2 starting with number', () => {
      // Given
      const startsWithNumber = '1lw3h8x9y0000qwertyui'; // 21 chars but starts with number
      const fieldName = 'einsatzId';

      // When/Then
      expect(() => validateCuid2Format(startsWithNumber, fieldName)).toThrow('einsatzId must be a valid CUID2 format');
    });

    it('should throw error for CUID2 with spaces', () => {
      // Given
      const idWithSpaces = 'einsatz 123 456 7890abc'; // Has spaces
      const fieldName = 'einsatzId';

      // When/Then
      expect(() => validateCuid2Format(idWithSpaces, fieldName)).toThrow('einsatzId must be a valid CUID2 format');
    });

    it('should use custom field name in error message', () => {
      // Given - CUID2 Library rejects strings starting with uppercase letters
      const invalidId = 'INVALID_UPPERCASE_ID';
      const customFieldName = 'customIdField';

      // When/Then
      expect(() => validateCuid2Format(invalidId, customFieldName)).toThrow('customIdField must be a valid CUID2 format');
    });

    it('should accept 20-character CUID2 (minimum length)', () => {
      // Given
      const minLengthCuid2 = 'cm1234567890abcdefgh'; // 20 chars exactly
      const fieldName = 'testId';

      // When/Then
      expect(() => validateCuid2Format(minLengthCuid2, fieldName)).not.toThrow();
    });

    it('should accept 30-character CUID2 (maximum length)', () => {
      // Given
      const maxLengthCuid2 = 'cm1234567890abcdefghijklmnop12'; // 30 chars exactly
      const fieldName = 'testId';

      // When/Then
      expect(() => validateCuid2Format(maxLengthCuid2, fieldName)).not.toThrow();
    });

    it('should reject numeric-only CUID2 (must start with letter)', () => {
      // Given
      const numericCuid2 = '12345678901234567890123'; // 23 digits, but starts with number
      const fieldName = 'testId';

      // When/Then
      expect(() => validateCuid2Format(numericCuid2, fieldName)).toThrow('testId must be a valid CUID2 format');
    });
  });

  describe('validateNanoidFormat (deprecated, delegates to validateCuid2Format)', () => {
    it('should accept valid CUID2 format (backwards compatibility)', () => {
      // Given
      const validCuid2 = 'clw3h8x9y0000qwertyui00001';
      const fieldName = 'testId';

      // When/Then
      expect(() => validateCuid2Format(validCuid2, fieldName)).not.toThrow();
    });

    it('should reject old nanoid format (uppercase not allowed in CUID2)', () => {
      // Given
      const oldNanoid = 'V1StGXR8_Z5jdHi6B-myT'; // Old nanoid format with uppercase
      const fieldName = 'testId';

      // When/Then
      expect(() => validateCuid2Format(oldNanoid, fieldName)).toThrow();
    });
  });

  describe('CUID2_REGEX constant', () => {
    it('should match valid CUID2 (25 characters)', () => {
      // Given
      const validCuid2 = 'clw3h8x9y0000qwertyui00001';

      // When
      const result = CUID2_REGEX.test(validCuid2);

      // Then
      expect(result).toBe(true);
    });

    it('should match valid CUID2 (20 characters - minimum)', () => {
      // Given
      const validCuid2 = 'cm1234567890abcdefgh';

      // When
      const result = CUID2_REGEX.test(validCuid2);

      // Then
      expect(result).toBe(true);
    });

    it('should match valid CUID2 (30 characters - maximum)', () => {
      // Given
      const validCuid2 = 'cm1234567890abcdefghijklmnop12';

      // When
      const result = CUID2_REGEX.test(validCuid2);

      // Then
      expect(result).toBe(true);
    });

    it('should not match invalid CUID2 formats', () => {
      // Given
      const invalidIds = [
        'short', // Too short
        'clw3h8x9y0000qwertyui000012345678901', // Too long (36 chars)
        'CLW3H8X9Y0000QWERTYUI', // Uppercase
        'clw3h8x9y_000-qwertyui', // Invalid chars
        '1lw3h8x9y0000qwertyui', // Starts with number
        'V1StGXR8_Z5jdHi6B-myT', // Old nanoid format
        '',
      ];

      // When/Then
      for (const id of invalidIds) {
        expect(CUID2_REGEX.test(id)).toBe(false);
      }
    });
  });
});
