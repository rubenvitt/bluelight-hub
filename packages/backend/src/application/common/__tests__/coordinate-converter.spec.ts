import { CoordinateConverter } from '../coordinate-converter';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';

describe('CoordinateConverter', () => {
  describe('toMgrs', () => {
    describe('with MGRS input', () => {
      it('should return success with valid MGRS string', () => {
        // Given
        const input = { mgrs: '33UXP1234567890' };

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeInstanceOf(MgrsCoordinate);
      });

      it('should return failure with invalid MGRS string', () => {
        // Given
        const input = { mgrs: 'INVALID' };

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBeDefined();
      });

      it('should return failure with empty MGRS string', () => {
        // Given
        const input = { mgrs: '' };

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        expect(result.isFailure).toBe(true);
        expect(result.error).toBeDefined();
      });

      it('should return failure for MGRS string with internal spaces', () => {
        // Given - MGRS strings should not have internal spaces
        const input = { mgrs: '33UUU 8990317936' };

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        // Internal spaces are not valid MGRS format (only leading/trailing whitespace is trimmed)
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid MGRS format');
      });

      it('should return failure with malformed MGRS string', () => {
        // Given
        const input = { mgrs: '33U' }; // Incomplete MGRS

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        expect(result.isFailure).toBe(true);
      });
    });

    describe('with Lat/Lng input', () => {
      it('should convert valid Lat/Lng to MGRS (Berlin, Zone 33U)', () => {
        // Given
        const input = { lat: 52.52, lng: 13.405 }; // Berlin

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeInstanceOf(MgrsCoordinate);
        expect(result.value?.gridZone).toBe('33U');
      });

      it('should convert valid Lat/Lng to MGRS (Hamburg, Zone 32U)', () => {
        // Given - Hamburg coordinates that map to valid MGRS square
        const input = { lat: 53.55, lng: 10.0 }; // Hamburg

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeInstanceOf(MgrsCoordinate);
        expect(result.value?.gridZone).toBe('32U');
      });

      it('should convert valid Lat/Lng to MGRS (Dresden, Zone 33U)', () => {
        // Given
        const input = { lat: 51.05, lng: 13.74 }; // Dresden

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeInstanceOf(MgrsCoordinate);
        expect(result.value?.gridZone).toBe('33U');
      });

      it('should return failure with out-of-range latitude (> 90)', () => {
        // Given
        const input = { lat: 91, lng: 8.6821 };

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        expect(result.isFailure).toBe(true);
      });

      it('should return failure with out-of-range latitude (< -90)', () => {
        // Given
        const input = { lat: -91, lng: 8.6821 };

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        expect(result.isFailure).toBe(true);
      });

      it('should return failure with out-of-range longitude (> 180)', () => {
        // Given
        const input = { lat: 50.1109, lng: 181 };

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        expect(result.isFailure).toBe(true);
      });

      it('should return failure with out-of-range longitude (< -180)', () => {
        // Given
        const input = { lat: 50.1109, lng: -181 };

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        expect(result.isFailure).toBe(true);
      });

      it('should return failure for coordinates at North Pole', () => {
        // Given
        const input = { lat: 90, lng: 0 };

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        // MGRS doesn't support poles (above 84°N or below 80°S), so this should fail
        expect(result.isFailure).toBe(true);
      });

      it('should return failure for coordinates outside German zones (equator)', () => {
        // Given
        const input = { lat: 0, lng: 0 };

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        // Equator is not in German zones (32U, 33U, 33N)
        expect(result.isFailure).toBe(true);
      });

      it('should return failure for coordinates outside German zones (Southern Hemisphere)', () => {
        // Given
        const input = { lat: -33.8688, lng: 151.2093 }; // Sydney

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        // Sydney is not in German zones
        expect(result.isFailure).toBe(true);
      });

      it('should return failure for coordinates outside German zones (zero)', () => {
        // Given
        const input = { lat: 0, lng: 0 };

        // When
        const result = CoordinateConverter.toMgrs(input);

        // Then
        // Zero coordinates are not in German zones
        expect(result.isFailure).toBe(true);
      });
    });

    describe('result consistency', () => {
      it('should produce equal Results for same MGRS coordinate converted twice', () => {
        // Given
        const input = { mgrs: '33UXP1234567890' };

        // When
        const result1 = CoordinateConverter.toMgrs(input);
        const result2 = CoordinateConverter.toMgrs(input);

        // Then
        expect(result1.isSuccess).toBe(true);
        expect(result2.isSuccess).toBe(true);
        expect(result1.value?.toString()).toBe(result2.value?.toString());
      });

      it('should produce equal Results for same Lat/Lng coordinate converted twice (Berlin)', () => {
        // Given
        const input = { lat: 52.52, lng: 13.405 }; // Berlin

        // When
        const result1 = CoordinateConverter.toMgrs(input);
        const result2 = CoordinateConverter.toMgrs(input);

        // Then
        expect(result1.isSuccess).toBe(true);
        expect(result2.isSuccess).toBe(true);
        expect(result1.value?.toString()).toBe(result2.value?.toString());
      });
    });
  });
});
