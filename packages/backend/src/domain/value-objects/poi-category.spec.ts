import { PoiCategory } from '@domain/value-objects/poi-category';

describe('PoiCategory', () => {
  describe('create() - Factory Method', () => {
    it('should create PoiCategory for EINSATZSTELLE', () => {
      // Given: Valid category string
      const category = 'EINSATZSTELLE';

      // When: Creating PoiCategory
      const result = PoiCategory.create(category);

      // Then: Success with correct value
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.value).toBe('EINSATZSTELLE');
      expect(result.error).toBeUndefined();
    });

    it('should create PoiCategory for BEREITSTELLUNGSRAUM', () => {
      // Given: Valid category string
      const category = 'BEREITSTELLUNGSRAUM';

      // When: Creating PoiCategory
      const result = PoiCategory.create(category);

      // Then: Success with correct value
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('BEREITSTELLUNGSRAUM');
    });

    it('should create PoiCategory for GEFAHRENSTELLE', () => {
      // Given: Valid category string
      const category = 'GEFAHRENSTELLE';

      // When: Creating PoiCategory
      const result = PoiCategory.create(category);

      // Then: Success with correct value
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('GEFAHRENSTELLE');
    });

    it('should create PoiCategory for WASSERENTNAHMESTELLE', () => {
      // Given: Valid category string
      const category = 'WASSERENTNAHMESTELLE';

      // When: Creating PoiCategory
      const result = PoiCategory.create(category);

      // Then: Success with correct value
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('WASSERENTNAHMESTELLE');
    });

    it('should create PoiCategory for SONSTIGES', () => {
      // Given: Valid category string
      const category = 'SONSTIGES';

      // When: Creating PoiCategory
      const result = PoiCategory.create(category);

      // Then: Success with correct value
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('SONSTIGES');
    });

    it('should normalize lowercase input to uppercase', () => {
      // Given: Lowercase category string
      const category = 'einsatzstelle';

      // When: Creating PoiCategory
      const result = PoiCategory.create(category);

      // Then: Success with normalized uppercase
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('EINSATZSTELLE');
    });

    it('should normalize mixed case input to uppercase', () => {
      // Given: Mixed case category string
      const category = 'BeReItStElLuNgSrAuM';

      // When: Creating PoiCategory
      const result = PoiCategory.create(category);

      // Then: Success with normalized uppercase
      expect(result.isSuccess).toBe(true);
      expect(result.value?.value).toBe('BEREITSTELLUNGSRAUM');
    });

    it('should fail with invalid category', () => {
      // Given: Invalid category string
      const invalidCategory = 'INVALID_CATEGORY';

      // When: Creating PoiCategory
      const result = PoiCategory.create(invalidCategory);

      // Then: Failure with error message listing allowed values
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toContain('Invalid POI category: INVALID_CATEGORY');
      expect(result.error).toContain('EINSATZSTELLE');
      expect(result.error).toContain('BEREITSTELLUNGSRAUM');
      expect(result.error).toContain('GEFAHRENSTELLE');
      expect(result.error).toContain('WASSERENTNAHMESTELLE');
      expect(result.error).toContain('SONSTIGES');
    });

    it('should fail with empty string', () => {
      // Given: Empty string
      const emptyCategory = '';

      // When: Creating PoiCategory
      const result = PoiCategory.create(emptyCategory);

      // Then: Failure
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid POI category');
    });
  });

  describe('Static Factories', () => {
    it('should create EINSATZSTELLE via static factory', () => {
      // Given: Static factory method
      // When: Creating PoiCategory
      const category = PoiCategory.EINSATZSTELLE();

      // Then: Correct value
      expect(category.value).toBe('EINSATZSTELLE');
    });

    it('should create BEREITSTELLUNGSRAUM via static factory', () => {
      // Given: Static factory method
      // When: Creating PoiCategory
      const category = PoiCategory.BEREITSTELLUNGSRAUM();

      // Then: Correct value
      expect(category.value).toBe('BEREITSTELLUNGSRAUM');
    });

    it('should create GEFAHRENSTELLE via static factory', () => {
      // Given: Static factory method
      // When: Creating PoiCategory
      const category = PoiCategory.GEFAHRENSTELLE();

      // Then: Correct value
      expect(category.value).toBe('GEFAHRENSTELLE');
    });

    it('should create WASSERENTNAHMESTELLE via static factory', () => {
      // Given: Static factory method
      // When: Creating PoiCategory
      const category = PoiCategory.WASSERENTNAHMESTELLE();

      // Then: Correct value
      expect(category.value).toBe('WASSERENTNAHMESTELLE');
    });

    it('should create SONSTIGES via static factory', () => {
      // Given: Static factory method
      // When: Creating PoiCategory
      const category = PoiCategory.SONSTIGES();

      // Then: Correct value
      expect(category.value).toBe('SONSTIGES');
    });
  });

  describe('getColor() - Color Mapping', () => {
    it('should return red (#FF0000) for EINSATZSTELLE', () => {
      // Given: EINSATZSTELLE category
      const category = PoiCategory.EINSATZSTELLE();

      // When: Getting color
      const color = category.getColor();

      // Then: Red color
      expect(color).toBe('#FF0000');
    });

    it('should return blue (#0000FF) for BEREITSTELLUNGSRAUM', () => {
      // Given: BEREITSTELLUNGSRAUM category
      const category = PoiCategory.BEREITSTELLUNGSRAUM();

      // When: Getting color
      const color = category.getColor();

      // Then: Blue color
      expect(color).toBe('#0000FF');
    });

    it('should return yellow (#FFFF00) for GEFAHRENSTELLE', () => {
      // Given: GEFAHRENSTELLE category
      const category = PoiCategory.GEFAHRENSTELLE();

      // When: Getting color
      const color = category.getColor();

      // Then: Yellow color
      expect(color).toBe('#FFFF00');
    });

    it('should return cyan (#00FFFF) for WASSERENTNAHMESTELLE', () => {
      // Given: WASSERENTNAHMESTELLE category
      const category = PoiCategory.WASSERENTNAHMESTELLE();

      // When: Getting color
      const color = category.getColor();

      // Then: Cyan color
      expect(color).toBe('#00FFFF');
    });

    it('should return gray (#808080) for SONSTIGES', () => {
      // Given: SONSTIGES category
      const category = PoiCategory.SONSTIGES();

      // When: Getting color
      const color = category.getColor();

      // Then: Gray color
      expect(color).toBe('#808080');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for same category value', () => {
      // Given: Two EINSATZSTELLE categories
      const category1 = PoiCategory.EINSATZSTELLE();
      const category2 = PoiCategory.EINSATZSTELLE();

      // When: Comparing for equality
      const areEqual = category1.equals(category2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
      expect(category1).not.toBe(category2); // Different instances
    });

    it('should return false for different category values', () => {
      // Given: Different categories
      const category1 = PoiCategory.EINSATZSTELLE();
      const category2 = PoiCategory.BEREITSTELLUNGSRAUM();

      // When: Comparing for equality
      const areEqual = category1.equals(category2);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });
  });

  describe('ValueObject Integration', () => {
    it('should inherit from ValueObject with immutable props', () => {
      // Given: PoiCategory instance
      const category = PoiCategory.EINSATZSTELLE();

      // When: Accessing props
      const props = category.props;

      // Then: Props are readonly and frozen
      expect(Object.isFrozen(props)).toBe(true);
      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        props.value = 'BEREITSTELLUNGSRAUM';
      }).toThrow();
    });
  });
});
