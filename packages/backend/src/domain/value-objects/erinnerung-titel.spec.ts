import { ErinnerungTitel } from '@domain/value-objects/erinnerung-titel';

describe('ErinnerungTitel', () => {
  describe('create() - Factory Method', () => {
    it('should create ErinnerungTitel with valid title', () => {
      // Given: Valid title
      const validTitle = 'Lagebesprechung';

      // When: Creating ErinnerungTitel
      const result = ErinnerungTitel.create(validTitle);

      // Then: Success with correct value
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('Lagebesprechung');
    });

    it('should trim whitespace from title', () => {
      // Given: Title with whitespace
      const titleWithWhitespace = '  Lagebesprechung  ';

      // When: Creating ErinnerungTitel
      const result = ErinnerungTitel.create(titleWithWhitespace);

      // Then: Whitespace is trimmed
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('Lagebesprechung');
    });

    it('should allow title with exactly 100 characters', () => {
      // Given: Title with exactly MAX_LENGTH characters
      const maxLengthTitle = 'a'.repeat(100);

      // When: Creating ErinnerungTitel
      const result = ErinnerungTitel.create(maxLengthTitle);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value.length).toBe(100);
    });

    it('should fail with empty title', () => {
      // Given: Empty string
      const emptyTitle = '';

      // When: Creating ErinnerungTitel
      const result = ErinnerungTitel.create(emptyTitle);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ERINNERUNG_TITEL_REQUIRED');
    });

    it('should fail with whitespace-only title', () => {
      // Given: Only whitespace
      const whitespaceTitle = '   ';

      // When: Creating ErinnerungTitel
      const result = ErinnerungTitel.create(whitespaceTitle);

      // Then: Failure (after trim it's empty)
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ERINNERUNG_TITEL_REQUIRED');
    });

    it('should fail with title exceeding 100 characters', () => {
      // Given: Title with 101 characters
      const tooLongTitle = 'a'.repeat(101);

      // When: Creating ErinnerungTitel
      const result = ErinnerungTitel.create(tooLongTitle);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('ERINNERUNG_TITEL_TOO_LONG');
      expect(result.error).toContain('101');
    });

    it('should fail with null value', () => {
      // When: Creating with null
      const result = ErinnerungTitel.create(null as unknown as string);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ERINNERUNG_TITEL_REQUIRED');
    });

    it('should fail with undefined value', () => {
      // When: Creating with undefined
      const result = ErinnerungTitel.create(undefined as unknown as string);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('ERINNERUNG_TITEL_REQUIRED');
    });
  });

  describe('MAX_LENGTH constant', () => {
    it('should have MAX_LENGTH of 100', () => {
      expect(ErinnerungTitel.MAX_LENGTH).toBe(100);
    });
  });

  describe('isShorterThan() - Length Check', () => {
    it('should return true for shorter titles', () => {
      // Given: Short title
      const titel = ErinnerungTitel.create('Kurz').value!;

      // When/Then: Check length
      expect(titel.isShorterThan(10)).toBe(true);
      expect(titel.isShorterThan(4)).toBe(false); // "Kurz" has 4 chars
    });

    it('should return false for titles at or above threshold', () => {
      // Given: Title with 10 characters
      const titel = ErinnerungTitel.create('0123456789').value!;

      // When/Then
      expect(titel.isShorterThan(10)).toBe(false);
      expect(titel.isShorterThan(11)).toBe(true);
    });
  });

  describe('toString() - String Representation', () => {
    it('should return title value as string', () => {
      // Given: ErinnerungTitel
      const titel = ErinnerungTitel.create('Test Titel').value!;

      // When: Converting to string
      const stringValue = titel.toString();

      // Then: Returns title value
      expect(stringValue).toBe('Test Titel');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for same title values', () => {
      // Given: Two titles with same value
      const titel1 = ErinnerungTitel.create('Gleicher Titel').value!;
      const titel2 = ErinnerungTitel.create('Gleicher Titel').value!;

      // When/Then
      expect(titel1.equals(titel2)).toBe(true);
    });

    it('should return false for different title values', () => {
      // Given: Two titles with different values
      const titel1 = ErinnerungTitel.create('Titel A').value!;
      const titel2 = ErinnerungTitel.create('Titel B').value!;

      // When/Then
      expect(titel1.equals(titel2)).toBe(false);
    });
  });

  describe('Real-World Use Cases', () => {
    it('should handle typical reminder titles', () => {
      // Given: Realistic reminder titles
      const titles = ['Lagebesprechung', 'Nachbearbeitung Einsatzdokumentation', 'Ablösung vorbereiten', 'Funkcheck durchführen', 'Mittagessen bestellen'];

      // When/Then: All should succeed
      for (const title of titles) {
        const result = ErinnerungTitel.create(title);
        expect(result.isSuccess).toBe(true);
      }
    });

    it('should handle special characters in titles', () => {
      // Given: Title with special characters
      const specialTitle = 'Einsatz #123 - Lagebesprechung (dringend!)';

      // When: Creating ErinnerungTitel
      const result = ErinnerungTitel.create(specialTitle);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(specialTitle);
    });

    it('should handle German umlauts', () => {
      // Given: Title with umlauts
      const umlautTitle = 'Überprüfung der Ausrüstung';

      // When: Creating ErinnerungTitel
      const result = ErinnerungTitel.create(umlautTitle);

      // Then: Success
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe(umlautTitle);
    });
  });
});
