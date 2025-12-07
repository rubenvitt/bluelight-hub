import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Architecture Rules Test Suite
 *
 * Validates Hexagonal Architecture layer dependencies:
 * - Domain Layer: Pure, no Application/Infrastructure imports
 * - Application Layer: Only Domain imports (except @infrastructure/di-tokens)
 *
 * Story 5-7 (AC5): CLAUDE.md Code Review Checklist automation
 */
describe('Architecture Rules', () => {
  // Patterns to detect violations
  const applicationImportPattern = /from\s+['"].*@application/;
  const infrastructureImportPattern = /from\s+['"].*@infrastructure(?!\/di-tokens)/;
  const prismaImportPattern = /from\s+['"]@prisma\/client['"]/;

  // Files with legacy exceptions (documented with biome-ignore or planned for Epic 6 migration)
  const legacyExceptions = [
    'get-all-einsaetze.query.ts',
    'get-all-einsaetze.handler.ts',
    'add-eintrag.command.ts',
    // DTOs importing Prisma enums - planned for Epic 6 migration to Domain enums
    'einsatz-query.dto.ts',
    'einsatz-response.dto.ts',
    'update-einsatz.dto.ts',
    'add-eintrag.dto.ts',
    'eintrag.dto.ts',
    // CQRS Query-Side Pattern: Read-only queries for reference data without domain logic
    'get-textbausteine.handler.ts',
    // User Management - migrated from legacy, needs cleanup
    'delete-user.handler.ts',
    'update-user.command.ts',
    'create-user.dto.ts',
    'update-user.dto.ts',
    'user-response.dto.ts',
  ];

  /**
   * Recursively find all TypeScript files in a directory
   *
   * @param dir - Directory to search
   * @param fileList - Accumulated file list
   * @returns Array of file paths
   */
  function findTypeScriptFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip test directories
        if (file !== '__tests__' && file !== 'node_modules') {
          findTypeScriptFiles(filePath, fileList);
        }
      } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.test.ts')) {
        fileList.push(filePath);
      }
    }

    return fileList;
  }

  describe('Domain Layer Import Restrictions', () => {
    let domainFiles: string[];

    beforeAll(() => {
      // Given: All TypeScript files in Domain layer
      const domainDir = path.join(__dirname, '../domain');
      domainFiles = findTypeScriptFiles(domainDir);
    });

    it('should not import from Application layer', () => {
      // When: Checking each Domain file for Application imports
      // Then: No imports from @application/* should exist
      const violations: string[] = [];

      for (const file of domainFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (applicationImportPattern.test(content)) {
          violations.push(file);
        }
      }

      expect(violations).toEqual([]);
    });

    it('should not import from Infrastructure layer', () => {
      // When: Checking each Domain file for Infrastructure imports
      // Then: No imports from @infrastructure/* should exist
      const violations: string[] = [];

      for (const file of domainFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (infrastructureImportPattern.test(content)) {
          violations.push(file);
        }
      }

      expect(violations).toEqual([]);
    });

    it('should not import from Prisma', () => {
      // When: Checking each Domain file for Prisma imports
      // Then: No imports from @prisma/client should exist
      const violations: string[] = [];

      for (const file of domainFiles) {
        const content = fs.readFileSync(file, 'utf8');
        if (prismaImportPattern.test(content)) {
          violations.push(file);
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Application Layer Import Restrictions', () => {
    let applicationFiles: string[];

    beforeAll(() => {
      // Given: All TypeScript files in Application layer (excluding tests)
      const applicationDir = path.join(__dirname, '../application');
      applicationFiles = findTypeScriptFiles(applicationDir).filter((file) => {
        // Exclude module files (they can import infrastructure for DI setup)
        return !file.endsWith('.module.ts');
      });
    });

    it('should not import from Infrastructure layer (except di-tokens)', () => {
      // When: Checking each Application file for Infrastructure imports
      // Then: Only @infrastructure/di-tokens imports are allowed
      const violations: string[] = [];

      for (const file of applicationFiles) {
        // Skip legacy exceptions
        if (legacyExceptions.some((exc) => file.includes(exc))) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf8');
        if (infrastructureImportPattern.test(content)) {
          violations.push(file);
        }
      }

      expect(violations).toEqual([]);
    });

    it('should not import Prisma directly (except documented legacy)', () => {
      // When: Checking Application files for Prisma imports
      // Then: No direct Prisma imports (legacy exceptions documented)
      const violations: string[] = [];

      for (const file of applicationFiles) {
        if (legacyExceptions.some((exc) => file.includes(exc))) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf8');
        if (prismaImportPattern.test(content)) {
          violations.push(file);
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
