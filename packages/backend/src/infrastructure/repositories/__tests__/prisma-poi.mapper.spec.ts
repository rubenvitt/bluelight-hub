/**
 * Unit Tests für PrismaPoiMapper (Infrastructure Layer).
 *
 * Diese Tests validieren die bidirektionale Transformation zwischen:
 * - Domain Layer: Poi Entity mit MGRS-Koordinaten und PoiCategory Enum
 * - Infrastructure Layer: Prisma LagekartePoi mit Lat/Lng + MGRS und PoiType Enum
 *
 * **Test Strategy:**
 * - Round-Trip Tests: Domain → Prisma → Domain = equal
 * - Enum Mapping Tests: PoiCategory ↔ PoiType (explizite Konvertierung)
 * - MGRS NULL Handling: Fallback auf Lat/Lng wenn MGRS = NULL
 * - Field Mapping: beschreibung ↔ adresse
 *
 * Epic 2 Story 2.3 | Task 2
 */

import { PrismaPoiMapper } from '../mappers/prisma-poi.mapper';
import { Poi } from '@domain/entities/poi.entity';
import { MgrsCoordinate } from '@domain/value-objects/mgrs-coordinate';
import { PoiCategory } from '@domain/value-objects/poi-category';
import { UserId } from '@domain/value-objects/user-id';
import type { LagekartePoi, PoiType } from '@prisma/client';

// Mock nanoid for Jest compatibility (ESM module issue)
jest.mock('nanoid/non-secure', () => ({
  nanoid: jest.fn((length?: number) => {
    // Generate valid nanoid format with specified length
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
    const len = length ?? 21;
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

describe('PrismaPoiMapper', () => {
  // Test Data Setup (use valid nanoid format - 21 characters)
  const testUserId = UserId.create('test-user-id-12345678').value as UserId;
  const berlinMgrs = MgrsCoordinate.fromLatLng(52.52, 13.4, 5).value as MgrsCoordinate; // Berlin Brandenburger Tor
  const validPoiId = 'poi-test-id-123456789'; // Exactly 21 characters
  const validLagekarteId = 'lk-id-123456789012345'; // Exactly 21 characters

  describe('toEntity', () => {
    it('should convert Prisma POI to Domain Entity with MGRS', () => {
      // Given: Prisma POI with MGRS coordinate
      const prismaPoi: LagekartePoi = {
        id: validPoiId,
        lagekarteId: validLagekarteId,
        type: 'EINSATZORT',
        name: 'Brandenburger Tor',
        adresse: 'Haupteinsatzort',
        mgrs: berlinMgrs.value, // MGRS vorhanden
        latitude: 52.52,
        longitude: 13.4,
        icon: null,
        metadata: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      };

      // When: Convert to Domain Entity
      const poi = PrismaPoiMapper.toEntity(prismaPoi);

      // Then: Entity properties correct
      expect(poi.id.value).toBe(validPoiId);
      expect(poi.name).toBe('Brandenburger Tor');
      expect(poi.coordinate.value).toBe(berlinMgrs.value);
      expect(poi.category.value).toBe('EINSATZSTELLE'); // EINSATZORT → EINSATZSTELLE
      expect(poi.beschreibung).toBe('Haupteinsatzort'); // adresse → beschreibung
    });

    it('should convert Prisma POI with NULL MGRS via Lat/Lng fallback', () => {
      // Given: Prisma POI with NULL MGRS (Legacy Data)
      const prismaPoi: LagekartePoi = {
        id: validPoiId,
        lagekarteId: validLagekarteId,
        type: 'GEFAHRENQUELLE',
        name: 'Gasleck',
        adresse: null,
        mgrs: null, // NULL MGRS (Legacy)
        latitude: 53.55, // Hamburg
        longitude: 10.0,
        icon: null,
        metadata: null,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      };

      // When: Convert to Domain Entity (should calculate MGRS from Lat/Lng)
      const poi = PrismaPoiMapper.toEntity(prismaPoi);

      // Then: MGRS calculated from Lat/Lng (Zone 32U Hamburg)
      expect(poi.coordinate).toBeDefined();
      expect(poi.coordinate.gridZone).toBe('32U'); // Hamburg ist Zone 32U
      expect(poi.category.value).toBe('GEFAHRENSTELLE'); // GEFAHRENQUELLE → GEFAHRENSTELLE
    });

    it('should map all PoiType variants to PoiCategory', () => {
      // Test Cases: Prisma PoiType → Domain PoiCategory
      const testCases: Array<{ prismaType: PoiType; domainCategory: string }> = [
        { prismaType: 'EINSATZORT', domainCategory: 'EINSATZSTELLE' },
        { prismaType: 'GEFAHRENQUELLE', domainCategory: 'GEFAHRENSTELLE' },
        { prismaType: 'VERSORGUNGSPUNKT', domainCategory: 'WASSERENTNAHMESTELLE' },
        { prismaType: 'BEREITSTELLUNGSRAUM', domainCategory: 'BEREITSTELLUNGSRAUM' },
        { prismaType: 'SONSTIGES', domainCategory: 'SONSTIGES' },
        // Fallback für andere PoiTypes
        { prismaType: 'EINSATZABSCHNITT', domainCategory: 'SONSTIGES' },
        { prismaType: 'FAHRZEUG', domainCategory: 'SONSTIGES' },
      ];

      for (const { prismaType, domainCategory } of testCases) {
        // Given: Prisma POI with specific type
        const prismaPoi: LagekartePoi = {
          id: validPoiId,
          lagekarteId: validLagekarteId,
          type: prismaType,
          name: `POI ${prismaType}`,
          adresse: null,
          mgrs: berlinMgrs.value,
          latitude: 52.52,
          longitude: 13.4,
          icon: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // When: Convert to Domain
        const poi = PrismaPoiMapper.toEntity(prismaPoi);

        // Then: Category mapped correctly
        expect(poi.category.value).toBe(domainCategory);
      }
    });
  });

  describe('toPersistence', () => {
    it('should convert Domain POI to Prisma CreateInput', () => {
      // Given: Domain POI Entity
      const poi = Poi.create('Brandenburger Tor', berlinMgrs, PoiCategory.EINSATZSTELLE(), testUserId, 'Haupteinsatzort');

      // When: Convert to Prisma CreateInput
      const prismaData = PrismaPoiMapper.toPersistence(poi);

      // Then: Prisma data correct
      expect(prismaData.id).toBe(poi.id.value);
      expect(prismaData.type).toBe('EINSATZORT'); // EINSATZSTELLE → EINSATZORT
      expect(prismaData.name).toBe('Brandenburger Tor');
      expect(prismaData.adresse).toBe('Haupteinsatzort'); // beschreibung → adresse
      expect(prismaData.mgrs).toBe(berlinMgrs.value);
      expect(prismaData.latitude).toBeCloseTo(52.52, 1);
      expect(prismaData.longitude).toBeCloseTo(13.4, 1);
    });

    it('should convert POI without beschreibung to NULL adresse', () => {
      // Given: Domain POI without beschreibung
      const poi = Poi.create('Einsatzstelle', berlinMgrs, PoiCategory.EINSATZSTELLE(), testUserId);

      // When: Convert to Prisma
      const prismaData = PrismaPoiMapper.toPersistence(poi);

      // Then: adresse = null
      expect(prismaData.adresse).toBeNull();
    });

    it('should map all PoiCategory variants to PoiType', () => {
      // Test Cases: Domain PoiCategory → Prisma PoiType
      const testCases: Array<{ category: PoiCategory; expectedType: PoiType }> = [
        { category: PoiCategory.EINSATZSTELLE(), expectedType: 'EINSATZORT' },
        { category: PoiCategory.GEFAHRENSTELLE(), expectedType: 'GEFAHRENQUELLE' },
        { category: PoiCategory.WASSERENTNAHMESTELLE(), expectedType: 'VERSORGUNGSPUNKT' },
        { category: PoiCategory.BEREITSTELLUNGSRAUM(), expectedType: 'BEREITSTELLUNGSRAUM' },
        { category: PoiCategory.SONSTIGES(), expectedType: 'SONSTIGES' },
      ];

      for (const { category, expectedType } of testCases) {
        // Given: Domain POI with specific category
        const poi = Poi.create(`POI ${category.value}`, berlinMgrs, category, testUserId);

        // When: Convert to Prisma
        const prismaData = PrismaPoiMapper.toPersistence(poi);

        // Then: Type mapped correctly
        expect(prismaData.type).toBe(expectedType);
      }
    });

    it('should calculate Lat/Lng from MGRS coordinate', () => {
      // Given: Domain POI with Hamburg MGRS
      const hamburgMgrs = MgrsCoordinate.fromLatLng(53.55, 10.0, 5).value as MgrsCoordinate;
      const poi = Poi.create('Rathaus Hamburg', hamburgMgrs, PoiCategory.BEREITSTELLUNGSRAUM(), testUserId);

      // When: Convert to Prisma
      const prismaData = PrismaPoiMapper.toPersistence(poi);

      // Then: Lat/Lng calculated correctly (with small precision tolerance)
      expect(prismaData.latitude).toBeCloseTo(53.55, 1);
      expect(prismaData.longitude).toBeCloseTo(10.0, 1);
      expect(prismaData.mgrs).toBe(hamburgMgrs.value);
    });
  });

  describe('Round-Trip Tests', () => {
    it('should preserve POI data in Domain → Prisma → Domain conversion', () => {
      // Given: Original Domain POI
      const originalPoi = Poi.create('Brandenburger Tor', berlinMgrs, PoiCategory.EINSATZSTELLE(), testUserId, 'Haupteinsatzort');
      const originalId = originalPoi.id.value;
      const originalName = originalPoi.name;
      const originalMgrs = originalPoi.coordinate.value;
      const originalCategory = originalPoi.category.value;
      const originalBeschreibung = originalPoi.beschreibung;

      // When: Convert Domain → Prisma → Domain
      const prismaData = PrismaPoiMapper.toPersistence(originalPoi);
      const prismaPoi: LagekartePoi = {
        id: prismaData.id,
        lagekarteId: 'lk-id-123456789012345',
        type: prismaData.type,
        name: prismaData.name ?? 'Unnamed',
        adresse: prismaData.adresse,
        mgrs: prismaData.mgrs,
        latitude: prismaData.latitude,
        longitude: prismaData.longitude,
        icon: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const reconstructedPoi = PrismaPoiMapper.toEntity(prismaPoi);

      // Then: Reconstructed POI equals original (core properties)
      expect(reconstructedPoi.id.value).toBe(originalId);
      expect(reconstructedPoi.name).toBe(originalName);
      expect(reconstructedPoi.coordinate.value).toBe(originalMgrs);
      expect(reconstructedPoi.category.value).toBe(originalCategory);
      expect(reconstructedPoi.beschreibung).toBe(originalBeschreibung);
    });

    it('should handle round-trip with NULL beschreibung', () => {
      // Given: POI without beschreibung
      const originalPoi = Poi.create('Einsatzstelle', berlinMgrs, PoiCategory.GEFAHRENSTELLE(), testUserId);

      // When: Round-trip
      const prismaData = PrismaPoiMapper.toPersistence(originalPoi);
      const prismaPoi: LagekartePoi = {
        id: prismaData.id,
        lagekarteId: 'lk-id-123456789012345',
        type: prismaData.type,
        name: prismaData.name ?? 'Unnamed',
        adresse: prismaData.adresse,
        mgrs: prismaData.mgrs,
        latitude: prismaData.latitude,
        longitude: prismaData.longitude,
        icon: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const reconstructedPoi = PrismaPoiMapper.toEntity(prismaPoi);

      // Then: beschreibung = undefined (NULL → undefined)
      expect(reconstructedPoi.beschreibung).toBeUndefined();
    });

    it('should handle round-trip with NULL MGRS (Legacy Fallback)', () => {
      // Given: Prisma POI with NULL MGRS
      const prismaPoi: LagekartePoi = {
        id: 'test-poi-id-123456789',
        lagekarteId: 'lk-id-123456789012345',
        type: 'EINSATZORT',
        name: 'Einsatzstelle',
        adresse: null,
        mgrs: null, // NULL MGRS
        latitude: 52.52,
        longitude: 13.4,
        icon: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // When: Convert to Domain (should calculate MGRS)
      const poi = PrismaPoiMapper.toEntity(prismaPoi);

      // Then: Convert back to Prisma (should have MGRS now)
      const prismaData = PrismaPoiMapper.toPersistence(poi);
      expect(prismaData.mgrs).toBeDefined();
      expect(prismaData.mgrs).not.toBeNull();
      expect(prismaData.latitude).toBeCloseTo(52.52, 1);
      expect(prismaData.longitude).toBeCloseTo(13.4, 1);
    });
  });
});
