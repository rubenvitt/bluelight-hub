import { GeoCoordinate } from '@domain/value-objects/geo-coordinate';
import { Result } from '@domain/common/result';

describe('GeoCoordinate', () => {
  describe('create() - Factory Method', () => {
    it('should create GeoCoordinate with valid Berlin coordinates', () => {
      // Given: Berlin coordinates
      const lat = 52.52;
      const lng = 13.4;

      // When: Creating GeoCoordinate
      const result = GeoCoordinate.create(lat, lng);

      // Then: Success with correct values
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value?.latitude).toBe(lat);
      expect(result.value?.longitude).toBe(lng);
      expect(result.error).toBeUndefined();
    });

    it('should create GeoCoordinate with valid Hamburg coordinates', () => {
      // Given: Hamburg coordinates
      const lat = 53.55;
      const lng = 10.0;

      // When: Creating GeoCoordinate
      const result = GeoCoordinate.create(lat, lng);

      // Then: Success with correct values
      expect(result.isSuccess).toBe(true);
      expect(result.value?.latitude).toBe(lat);
      expect(result.value?.longitude).toBe(lng);
    });

    it('should fail with latitude > 90', () => {
      // Given: Invalid latitude (too high)
      const lat = 91.0;
      const lng = 13.4;

      // When: Creating GeoCoordinate
      const result = GeoCoordinate.create(lat, lng);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error).toBe('Invalid latitude: 91. Must be between -90 and 90');
    });

    it('should fail with latitude < -90', () => {
      // Given: Invalid latitude (too low)
      const lat = -91.0;
      const lng = 13.4;

      // When: Creating GeoCoordinate
      const result = GeoCoordinate.create(lat, lng);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid latitude: -91. Must be between -90 and 90');
    });

    it('should fail with longitude > 180', () => {
      // Given: Invalid longitude (too high)
      const lat = 52.52;
      const lng = 181.0;

      // When: Creating GeoCoordinate
      const result = GeoCoordinate.create(lat, lng);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid longitude: 181. Must be between -180 and 180');
    });

    it('should fail with longitude < -180', () => {
      // Given: Invalid longitude (too low)
      const lat = 52.52;
      const lng = -181.0;

      // When: Creating GeoCoordinate
      const result = GeoCoordinate.create(lat, lng);

      // Then: Failure with error message
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Invalid longitude: -181. Must be between -180 and 180');
    });

    it('should accept edge case latitude values (-90, 0, 90)', () => {
      // Given: Edge case latitudes
      const southPole = GeoCoordinate.create(-90, 0);
      const equator = GeoCoordinate.create(0, 0);
      const northPole = GeoCoordinate.create(90, 0);

      // When: Creating GeoCoordinates
      // Then: All succeed
      expect(southPole.isSuccess).toBe(true);
      expect(equator.isSuccess).toBe(true);
      expect(northPole.isSuccess).toBe(true);
    });

    it('should accept edge case longitude values (-180, 0, 180)', () => {
      // Given: Edge case longitudes
      const dateLineWest = GeoCoordinate.create(0, -180);
      const primeMeridian = GeoCoordinate.create(0, 0);
      const dateLineEast = GeoCoordinate.create(0, 180);

      // When: Creating GeoCoordinates
      // Then: All succeed
      expect(dateLineWest.isSuccess).toBe(true);
      expect(primeMeridian.isSuccess).toBe(true);
      expect(dateLineEast.isSuccess).toBe(true);
    });
  });

  describe('distanceTo() - Haversine Distance', () => {
    it('should calculate Berlin to Hamburg distance ≈ 255km', () => {
      // Given: Berlin and Hamburg coordinates
      const berlin = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;
      const hamburg = GeoCoordinate.create(53.55, 10.0).value as GeoCoordinate;

      // When: Calculating distance
      const distanceMeters = berlin.distanceTo(hamburg);
      const distanceKm = distanceMeters / 1000;

      // Then: Approximately 255km (±5km tolerance)
      expect(distanceKm).toBeGreaterThan(250);
      expect(distanceKm).toBeLessThan(260);
    });

    it('should calculate distance from Berlin to Munich ≈ 504km', () => {
      // Given: Berlin and Munich coordinates
      const berlin = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;
      const munich = GeoCoordinate.create(48.14, 11.58).value as GeoCoordinate;

      // When: Calculating distance
      const distanceMeters = berlin.distanceTo(munich);
      const distanceKm = distanceMeters / 1000;

      // Then: Approximately 504km (±10km tolerance)
      expect(distanceKm).toBeGreaterThan(494);
      expect(distanceKm).toBeLessThan(514);
    });

    it('should return 0 for same coordinates', () => {
      // Given: Same coordinates
      const berlin1 = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;
      const berlin2 = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;

      // When: Calculating distance
      const distance = berlin1.distanceTo(berlin2);

      // Then: Distance is 0
      expect(distance).toBe(0);
    });

    it('should calculate symmetric distance (A→B = B→A)', () => {
      // Given: Two coordinates
      const berlin = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;
      const hamburg = GeoCoordinate.create(53.55, 10.0).value as GeoCoordinate;

      // When: Calculating both directions
      const berlinToHamburg = berlin.distanceTo(hamburg);
      const hamburgToBerlin = hamburg.distanceTo(berlin);

      // Then: Distance is symmetric
      expect(berlinToHamburg).toBe(hamburgToBerlin);
    });
  });

  describe('toString() - String Representation', () => {
    it('should format Berlin coordinates correctly with N/E', () => {
      // Given: Berlin coordinates (positive lat/lng)
      const berlin = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;

      // When: Converting to string
      const str = berlin.toString();

      // Then: Format "52.5200°N, 13.4000°E"
      expect(str).toBe('52.5200°N, 13.4000°E');
    });

    it('should format coordinates with S hemisphere correctly', () => {
      // Given: Southern hemisphere coordinates
      const capeTown = GeoCoordinate.create(-33.92, 18.42).value as GeoCoordinate;

      // When: Converting to string
      const str = capeTown.toString();

      // Then: Format "33.9200°S, 18.4200°E"
      expect(str).toBe('33.9200°S, 18.4200°E');
    });

    it('should format coordinates with W hemisphere correctly', () => {
      // Given: Western hemisphere coordinates (New York)
      const newYork = GeoCoordinate.create(40.71, -74.01).value as GeoCoordinate;

      // When: Converting to string
      const str = newYork.toString();

      // Then: Format "40.7100°N, 74.0100°W"
      expect(str).toBe('40.7100°N, 74.0100°W');
    });

    it('should format coordinates with S/W hemispheres correctly', () => {
      // Given: Southern + Western hemisphere (Buenos Aires)
      const buenosAires = GeoCoordinate.create(-34.6, -58.38).value as GeoCoordinate;

      // When: Converting to string
      const str = buenosAires.toString();

      // Then: Format "34.6000°S, 58.3800°W"
      expect(str).toBe('34.6000°S, 58.3800°W');
    });

    it('should format with 4 decimal places (≈11m precision)', () => {
      // Given: Coordinate with many decimal places
      const coord = GeoCoordinate.create(52.123456789, 13.987654321).value as GeoCoordinate;

      // When: Converting to string
      const str = coord.toString();

      // Then: Exactly 4 decimal places
      expect(str).toBe('52.1235°N, 13.9877°E');
    });
  });

  describe('equals() - Equality', () => {
    it('should return true for same coordinates', () => {
      // Given: Two GeoCoordinates with same values
      const coord1 = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;
      const coord2 = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;

      // When: Comparing for equality
      const areEqual = coord1.equals(coord2);

      // Then: Equals returns true
      expect(areEqual).toBe(true);
      expect(coord1).not.toBe(coord2); // Different instances
    });

    it('should return false for different coordinates', () => {
      // Given: Two different coordinates
      const berlin = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;
      const hamburg = GeoCoordinate.create(53.55, 10.0).value as GeoCoordinate;

      // When: Comparing for equality
      const areEqual = berlin.equals(hamburg);

      // Then: Equals returns false
      expect(areEqual).toBe(false);
    });
  });

  describe('ValueObject Integration', () => {
    it('should inherit from ValueObject with immutable props', () => {
      // Given: GeoCoordinate instance
      const coord = GeoCoordinate.create(52.52, 13.4).value as GeoCoordinate;

      // When: Accessing props
      const props = coord.props;

      // Then: Props are readonly and frozen
      expect(Object.isFrozen(props)).toBe(true);
      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        props.latitude = 0;
      }).toThrow();
    });
  });
});
