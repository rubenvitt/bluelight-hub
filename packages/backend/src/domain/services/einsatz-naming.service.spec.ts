import { EinsatzNamingService } from './einsatz-naming.service';

describe('EinsatzNamingService', () => {
  let service: EinsatzNamingService;

  beforeEach(() => {
    service = new EinsatzNamingService();
  });

  describe('generateEinsatzNummer', () => {
    it('should format number with zero-padding for single digit', () => {
      // Given
      const year = 2024;
      const sequence = 1;

      // When
      const result = service.generateEinsatzNummer(year, sequence);

      // Then
      expect(result).toBe('E2024-001');
    });

    it('should format number with zero-padding for two digits', () => {
      // Given
      const year = 2024;
      const sequence = 42;

      // When
      const result = service.generateEinsatzNummer(year, sequence);

      // Then
      expect(result).toBe('E2024-042');
    });

    it('should format number with zero-padding for three digits', () => {
      // Given
      const year = 2024;
      const sequence = 999;

      // When
      const result = service.generateEinsatzNummer(year, sequence);

      // Then
      expect(result).toBe('E2024-999');
    });

    it('should handle year boundary (different years, same sequence)', () => {
      // Given
      const sequence = 1;

      // When
      const result2024 = service.generateEinsatzNummer(2024, sequence);
      const result2025 = service.generateEinsatzNummer(2025, sequence);

      // Then
      expect(result2024).toBe('E2024-001');
      expect(result2025).toBe('E2025-001');
      expect(result2024).not.toBe(result2025); // Different years
    });

    it('should handle sequence number 0', () => {
      // Given
      const year = 2024;
      const sequence = 0;

      // When
      const result = service.generateEinsatzNummer(year, sequence);

      // Then
      expect(result).toBe('E2024-000');
    });

    it('should handle max sequence (999)', () => {
      // Given
      const year = 2024;
      const sequence = 999;

      // When
      const result = service.generateEinsatzNummer(year, sequence);

      // Then
      expect(result).toBe('E2024-999');
    });

    it('should handle sequence overflow (>999) without padding limit', () => {
      // Given (edge case: sequence > 999)
      const year = 2024;
      const sequence = 1000;

      // When
      const result = service.generateEinsatzNummer(year, sequence);

      // Then
      expect(result).toBe('E2024-1000'); // No truncation, just no extra padding
    });

    it('should handle negative year (edge case)', () => {
      // Given (unlikely but test for robustness)
      const year = -2024;
      const sequence = 1;

      // When
      const result = service.generateEinsatzNummer(year, sequence);

      // Then
      expect(result).toBe('E-2024-001'); // Graceful handling
    });

    it('should handle negative sequence (edge case)', () => {
      // Given (invalid input but test behavior)
      const year = 2024;
      const sequence = -1;

      // When
      const result = service.generateEinsatzNummer(year, sequence);

      // Then
      expect(result).toBe('E2024-0-1'); // Shows input is invalid (Application Layer should prevent)
    });

    it('should be deterministic (same inputs → same output)', () => {
      // Given
      const year = 2024;
      const sequence = 42;

      // When (call multiple times)
      const result1 = service.generateEinsatzNummer(year, sequence);
      const result2 = service.generateEinsatzNummer(year, sequence);
      const result3 = service.generateEinsatzNummer(year, sequence);

      // Then (all identical)
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      expect(result1).toBe('E2024-042');
    });
  });
});
