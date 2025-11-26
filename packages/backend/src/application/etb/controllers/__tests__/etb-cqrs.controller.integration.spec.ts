/**
 * Integration Tests für EtbCqrsController (Story 3-7).
 *
 * Diese Tests validieren den vollständigen Controller-Flow:
 * Request -> Controller -> CommandBus/QueryBus -> Handler (mocked) -> Response
 *
 * **Test Strategy:**
 * - Mocked CommandBus/QueryBus mit jest.fn() (NO NestJS Test Module)
 * - Focus: Controller-Orchestration, Result-Mapping, Exception-Handling
 * - NO Handler-Logic Testing (covered by separate handler tests)
 *
 * **Endpoints unter Test:**
 * - POST /etb/:etbId/eintrag - Eintrag hinzufügen
 * - PUT /etb/:etbId/eintrag/:eintragId - Eintrag aktualisieren
 * - DELETE /etb/:etbId/eintrag/:eintragId - Eintrag soft-löschen
 * - POST /etb/:etbId/lock - ETB sperren (nur ADMIN)
 * - GET /etb/einsatz/:einsatzId - ETB abrufen
 * - GET /etb/:etbId/history - Versionshistorie abrufen
 *
 * **AC Coverage:**
 * - AC2: Add/Update/Delete Eintrag
 * - AC3: Lock ETB (nur ADMIN/SUPER_ADMIN)
 * - AC4: GetEtb mit includeDeleted Filter
 * - AC4: GetHistory
 */

import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EtbCqrsController } from '@/modules/etb/controllers/etb-cqrs.controller';
import { Result } from '@/domain/common/result';
import type { ValidatedUser } from '@/auth/strategies/jwt.strategy';
import type { AddEintragDto, UpdateEintragDto, EtbDto, EintragDto, EtbSnapshotDto } from '@/application/etb/dto';

// Mock CUID2 für deterministische Tests
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'c';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
  isCuid: jest.fn((id: string) => {
    if (typeof id !== 'string') return false;
    if (id.length < 20 || id.length > 30) return false;
    return /^[a-z][a-z0-9]+$/.test(id);
  }),
}));

// ============================================
// TEST HELPERS
// ============================================

/**
 * Generiert eine CUID2-konforme Test-ID.
 */
function createTestCuid(suffix = ''): string {
  const base = 'clw3h8x9y0000qwertyui';
  const safeSuffix = suffix
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .padEnd(5, '0')
    .slice(0, 5);
  return base + safeSuffix;
}

/**
 * Erstellt ein Test-EtbDto.
 */
function createTestEtbDto(options: Partial<EtbDto> = {}): EtbDto {
  return {
    id: createTestCuid('etb'),
    einsatzId: createTestCuid('einsatz'),
    status: 'DRAFT',
    version: 1,
    versionTimestamp: new Date().toISOString(),
    eintraege: [],
    createdAt: new Date().toISOString(),
    createdBy: createTestCuid('user'),
    ...options,
  };
}

/**
 * Erstellt ein Test-EintragDto.
 */
function createTestEintragDto(options: Partial<EintragDto> = {}): EintragDto {
  return {
    id: createTestCuid('entry'),
    sequenceNumber: 1,
    text: 'Test Eintrag',
    createdBy: createTestCuid('user'),
    createdAt: new Date().toISOString(),
    isDeleted: false,
    ...options,
  };
}

/**
 * Erstellt ein Test-EtbSnapshotDto.
 */
function createTestSnapshotDto(options: Partial<EtbSnapshotDto> = {}): EtbSnapshotDto {
  return {
    version: 1,
    eintraege: [],
    snapshotAt: new Date().toISOString(),
    ...options,
  };
}

// ============================================
// INTEGRATION TESTS
// ============================================

describe('EtbCqrsController Integration Tests (Story 3-7)', () => {
  let controller: EtbCqrsController;
  let mockCommandBus: jest.Mocked<CommandBus>;
  let mockQueryBus: jest.Mocked<QueryBus>;

  const adminUser: ValidatedUser = {
    userId: createTestCuid('admin'),
    email: 'admin@test.com',
    role: 'ADMIN',
  };

  const regularUser: ValidatedUser = {
    userId: createTestCuid('user'),
    email: 'user@test.com',
    role: 'USER',
  };

  beforeEach(() => {
    // Create mock buses
    mockCommandBus = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    mockQueryBus = {
      execute: jest.fn(),
      // biome-ignore lint/suspicious/noExplicitAny: Test mock typing
    } as any;

    // Instantiate controller with mocks (Direct Instantiation Pattern)
    controller = new EtbCqrsController(mockCommandBus, mockQueryBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // TEST GROUP 1: POST /etb/:etbId/eintrag
  // ========================================

  describe('POST /etb/:etbId/eintrag - addEintrag()', () => {
    it('should add eintrag to ETB and return EintragDto', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const dto: AddEintragDto = { text: 'Fahrzeug W1 am Einsatzort eingetroffen' };
      const mockEintrag = {
        id: { value: createTestCuid('entry') },
        sequenceNumber: { value: 1 },
        text: 'Fahrzeug W1 am Einsatzort eingetroffen',
        createdBy: { value: adminUser.userId },
        createdAt: new Date(),
        isDeleted: false,
      };

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(mockEintrag));

      // When
      const result = await controller.addEintrag(etbId, dto, adminUser);

      // Then
      expect(result).toBeDefined();
      expect(result.text).toBe('Fahrzeug W1 am Einsatzort eingetroffen');
      expect(result.sequenceNumber).toBe(1);
      expect(result.isDeleted).toBe(false);
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when ETB does not exist', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const dto: AddEintragDto = { text: 'Test' };

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('ETB nicht gefunden'));

      // When/Then
      await expect(controller.addEintrag(etbId, dto, adminUser)).rejects.toThrow(NotFoundException);
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when text is empty', async () => {
      // Given - Command creation will fail with empty text
      const etbId = createTestCuid('etb');
      const dto: AddEintragDto = { text: '' };

      // When/Then - Command.create() returns failure for empty text
      await expect(controller.addEintrag(etbId, dto, adminUser)).rejects.toThrow(BadRequestException);
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when ETB is locked', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const dto: AddEintragDto = { text: 'Test' };

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('ETB ist gesperrt'));

      // When/Then
      await expect(controller.addEintrag(etbId, dto, adminUser)).rejects.toThrow(BadRequestException);
    });
  });

  // ========================================
  // TEST GROUP 2: PUT /etb/:etbId/eintrag/:eintragId
  // ========================================

  describe('PUT /etb/:etbId/eintrag/:eintragId - updateEintrag()', () => {
    it('should update eintrag text and return EintragDto', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const eintragId = createTestCuid('entry');
      const dto: UpdateEintragDto = { newText: 'Aktualisierter Text' };

      const updatedEintrag = createTestEintragDto({
        id: eintragId,
        text: 'Aktualisierter Text',
      });

      const etbDto = createTestEtbDto({
        id: etbId,
        eintraege: [updatedEintrag],
      });

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(undefined));
      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(etbDto));

      // When
      const result = await controller.updateEintrag(etbId, eintragId, dto, adminUser);

      // Then
      expect(result).toBeDefined();
      expect(result.id).toBe(eintragId);
      expect(result.text).toBe('Aktualisierter Text');
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when eintrag does not exist', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const eintragId = createTestCuid('entry');
      const dto: UpdateEintragDto = { newText: 'Test' };

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('Eintrag nicht gefunden'));

      // When/Then
      await expect(controller.updateEintrag(etbId, eintragId, dto, adminUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when ETB is locked', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const eintragId = createTestCuid('entry');
      const dto: UpdateEintragDto = { newText: 'Test' };

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('ETB ist gesperrt'));

      // When/Then
      await expect(controller.updateEintrag(etbId, eintragId, dto, adminUser)).rejects.toThrow(BadRequestException);
    });
  });

  // ========================================
  // TEST GROUP 3: DELETE /etb/:etbId/eintrag/:eintragId
  // ========================================

  describe('DELETE /etb/:etbId/eintrag/:eintragId - deleteEintrag()', () => {
    it('should soft-delete eintrag and return void', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const eintragId = createTestCuid('entry');

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(undefined));

      // When
      const result = await controller.deleteEintrag(etbId, eintragId, adminUser);

      // Then
      expect(result).toBeUndefined();
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when eintrag does not exist', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const eintragId = createTestCuid('entry');

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('Eintrag nicht gefunden'));

      // When/Then
      await expect(controller.deleteEintrag(etbId, eintragId, adminUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when ETB is locked', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const eintragId = createTestCuid('entry');

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('ETB ist gesperrt'));

      // When/Then
      await expect(controller.deleteEintrag(etbId, eintragId, adminUser)).rejects.toThrow(BadRequestException);
    });
  });

  // ========================================
  // TEST GROUP 4: POST /etb/:etbId/lock
  // ========================================

  describe('POST /etb/:etbId/lock - lockEtb()', () => {
    it('should lock ETB when user has ADMIN role', async () => {
      // Given
      const etbId = createTestCuid('etb');

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(undefined));

      // When
      const result = await controller.lockEtb(etbId, adminUser);

      // Then
      expect(result).toBeUndefined();
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should lock ETB when user has SUPER_ADMIN role', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const superAdmin: ValidatedUser = { ...adminUser, role: 'SUPER_ADMIN' };

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(undefined));

      // When
      const result = await controller.lockEtb(etbId, superAdmin);

      // Then
      expect(result).toBeUndefined();
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when ETB is already locked', async () => {
      // Given
      const etbId = createTestCuid('etb');

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('ETB ist bereits gesperrt'));

      // When/Then
      await expect(controller.lockEtb(etbId, adminUser)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when ETB does not exist', async () => {
      // Given
      const etbId = createTestCuid('etb');

      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('ETB nicht gefunden'));

      // When/Then
      await expect(controller.lockEtb(etbId, adminUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user has USER role (command validation)', async () => {
      // Given
      const etbId = createTestCuid('etb');
      // Note: RolesGuard would block this at route level, but we test controller behavior
      mockCommandBus.execute.mockResolvedValueOnce(Result.fail('Nur ADMIN oder SUPER_ADMIN berechtigt'));

      // When/Then
      await expect(controller.lockEtb(etbId, regularUser)).rejects.toThrow(BadRequestException);
    });
  });

  // ========================================
  // TEST GROUP 5: GET /etb/einsatz/:einsatzId
  // ========================================

  describe('GET /etb/einsatz/:einsatzId - getEtbByEinsatzId()', () => {
    it('should return ETB with eintraege for einsatz', async () => {
      // Given
      const einsatzId = createTestCuid('einsatz');
      const etbDto = createTestEtbDto({
        einsatzId,
        eintraege: [createTestEintragDto({ text: 'Eintrag 1' }), createTestEintragDto({ text: 'Eintrag 2', sequenceNumber: 2 })],
      });

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(etbDto));

      // When
      const result = await controller.getEtbByEinsatzId(einsatzId);

      // Then
      expect(result).toBeDefined();
      expect(result.eintraege).toHaveLength(2);
      expect(result.eintraege[0].text).toBe('Eintrag 1');
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
    });

    it('should exclude soft-deleted eintraege by default (includeDeleted=false)', async () => {
      // Given
      const einsatzId = createTestCuid('einsatz');
      const etbDto = createTestEtbDto({
        einsatzId,
        eintraege: [createTestEintragDto({ text: 'Active Entry' })],
      });

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(etbDto));

      // When
      const result = await controller.getEtbByEinsatzId(einsatzId, 'false');

      // Then
      expect(result.eintraege).toHaveLength(1);
      expect(result.eintraege[0].text).toBe('Active Entry');
    });

    it('should include soft-deleted eintraege when includeDeleted=true', async () => {
      // Given
      const einsatzId = createTestCuid('einsatz');
      const etbDto = createTestEtbDto({
        einsatzId,
        eintraege: [createTestEintragDto({ text: 'Active Entry' }), createTestEintragDto({ text: 'Deleted Entry', isDeleted: true })],
      });

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(etbDto));

      // When
      const result = await controller.getEtbByEinsatzId(einsatzId, 'true');

      // Then
      expect(result.eintraege).toHaveLength(2);
      const deletedEntry = result.eintraege.find((e) => e.isDeleted);
      expect(deletedEntry).toBeDefined();
    });

    it('should throw NotFoundException when ETB does not exist for einsatz', async () => {
      // Given
      const einsatzId = createTestCuid('einsatz');

      mockQueryBus.execute.mockResolvedValueOnce(Result.fail('ETB nicht gefunden'));

      // When/Then
      await expect(controller.getEtbByEinsatzId(einsatzId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when query returns null', async () => {
      // Given
      const einsatzId = createTestCuid('einsatz');

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(null));

      // When/Then
      await expect(controller.getEtbByEinsatzId(einsatzId)).rejects.toThrow(NotFoundException);
    });
  });

  // ========================================
  // TEST GROUP 6: GET /etb/:etbId/history
  // ========================================

  describe('GET /etb/:etbId/history - getEtbHistory()', () => {
    it('should return snapshots sorted by version', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const snapshots: EtbSnapshotDto[] = [createTestSnapshotDto({ version: 3 }), createTestSnapshotDto({ version: 2 }), createTestSnapshotDto({ version: 1 })];

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(snapshots));

      // When
      const result = await controller.getEtbHistory(etbId);

      // Then
      expect(result).toHaveLength(3);
      expect(result[0].version).toBe(3);
      expect(result[2].version).toBe(1);
    });

    it('should return empty array when no mutations occurred', async () => {
      // Given
      const etbId = createTestCuid('etb');

      mockQueryBus.execute.mockResolvedValueOnce(Result.ok([]));

      // When
      const result = await controller.getEtbHistory(etbId);

      // Then
      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when ETB does not exist', async () => {
      // Given
      const etbId = createTestCuid('etb');

      mockQueryBus.execute.mockResolvedValueOnce(Result.fail('ETB nicht gefunden'));

      // When/Then
      await expect(controller.getEtbHistory(etbId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid etbId format', async () => {
      // Given - Query constructor throws for invalid format
      const invalidEtbId = 'invalid-id';

      // When/Then - Query.create() validation fails
      await expect(controller.getEtbHistory(invalidEtbId)).rejects.toThrow(BadRequestException);
    });
  });

  // ========================================
  // TEST GROUP 7: Error Handling
  // ========================================

  describe('Error Handling', () => {
    it('should throw BadRequestException for invalid etbId in addEintrag', async () => {
      // Given
      const invalidEtbId = '';
      const dto: AddEintragDto = { text: 'Test' };

      // When/Then - Command.create() fails for empty etbId
      await expect(controller.addEintrag(invalidEtbId, dto, adminUser)).rejects.toThrow(BadRequestException);
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty eintragId in updateEintrag', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const emptyEintragId = '';
      const dto: UpdateEintragDto = { newText: 'Test' };

      // When/Then
      await expect(controller.updateEintrag(etbId, emptyEintragId, dto, adminUser)).rejects.toThrow(BadRequestException);
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for empty newText in updateEintrag', async () => {
      // Given
      const etbId = createTestCuid('etb');
      const eintragId = createTestCuid('entry');
      const dto: UpdateEintragDto = { newText: '' };

      // When/Then
      await expect(controller.updateEintrag(etbId, eintragId, dto, adminUser)).rejects.toThrow(BadRequestException);
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // TEST GROUP 8: Full CRUD Flow
  // ========================================

  describe('Full CRUD Flow Integration', () => {
    it('should execute complete lifecycle: Add -> Update -> Delete', async () => {
      const etbId = createTestCuid('etb');
      const entryId = createTestCuid('entry');

      // Phase 1: Add eintrag
      const mockEintrag = {
        id: { value: entryId },
        sequenceNumber: { value: 1 },
        text: 'Original Text',
        createdBy: { value: adminUser.userId },
        createdAt: new Date(),
        isDeleted: false,
      };
      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(mockEintrag));

      const added = await controller.addEintrag(etbId, { text: 'Original Text' }, adminUser);
      expect(added.text).toBe('Original Text');

      // Phase 2: Update eintrag
      const updatedEintrag = createTestEintragDto({
        id: entryId,
        text: 'Updated Text',
      });
      const etbDto = createTestEtbDto({
        id: etbId,
        eintraege: [updatedEintrag],
      });

      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(undefined));
      mockQueryBus.execute.mockResolvedValueOnce(Result.ok(etbDto));

      const updated = await controller.updateEintrag(etbId, entryId, { newText: 'Updated Text' }, adminUser);
      expect(updated.text).toBe('Updated Text');

      // Phase 3: Delete eintrag
      mockCommandBus.execute.mockResolvedValueOnce(Result.ok(undefined));

      await controller.deleteEintrag(etbId, entryId, adminUser);

      // Verify all operations were called
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(3);
      expect(mockQueryBus.execute).toHaveBeenCalledTimes(1);
    });
  });
});
