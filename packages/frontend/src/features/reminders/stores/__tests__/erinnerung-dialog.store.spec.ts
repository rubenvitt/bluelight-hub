/**
 * Unit Tests fuer Erinnerung Dialog Store
 *
 * Test Pattern: AAA (Arrange-Act-Assert) mit Given-When-Then Kommentaren
 *
 * **Story 2.5:**
 * - State: { isMarkErledigtOpen, erinnerungToMarkErledigt }
 * - Actions: openMarkErledigtDialog, closeMarkErledigtDialog
 * - Hook: useMarkErledigtDialogState
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ErinnerungResponseDto } from '@/shared';
import {
  erinnerungDialogStore,
  openMarkErledigtDialog,
  closeMarkErledigtDialog,
  resetErinnerungDialogStore,
  openQuickCreateDialog,
  openEditDialog,
  openDeleteDialog,
} from '../erinnerung-dialog.store';

// Test-Daten
const createMockErinnerung = (overrides?: Partial<ErinnerungResponseDto>): ErinnerungResponseDto => ({
  id: 'test-erinnerung-id',
  einsatzId: 'test-einsatz-id',
  titel: 'Test Erinnerung',
  beschreibung: null,
  faelligAm: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  status: 'ACKNOWLEDGED',
  erstelltVon: 'test-user-id',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  acknowledgedAm: new Date().toISOString(),
  acknowledgedBy: 'test-user-id',
  ausgeloestAm: new Date().toISOString(),
  snoozeCount: 0,
  snoozedAt: null,
  snoozedBy: null,
  snoozedUntil: null,
  erledigtAm: null,
  erledigtBy: null,
  erledigungsNotiz: null,
  ...overrides,
});

describe('ErinnerungDialogStore - MarkErledigt (Story 2.5)', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    resetErinnerungDialogStore();
  });

  describe('initial state', () => {
    it('should have isMarkErledigtOpen=false on initialization', () => {
      // Given (Arrange)
      resetErinnerungDialogStore();

      // When (Act)
      const state = erinnerungDialogStore.state;

      // Then (Assert)
      expect(state.isMarkErledigtOpen).toBe(false);
      expect(state.erinnerungToMarkErledigt).toBeNull();
    });
  });

  describe('openMarkErledigtDialog()', () => {
    it('should set isMarkErledigtOpen to true', () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      const einsatzId = 'test-einsatz-123';

      // When (Act)
      openMarkErledigtDialog(mockErinnerung, einsatzId);

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      expect(state.isMarkErledigtOpen).toBe(true);
    });

    it('should store the erinnerung to mark as erledigt', () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung({ titel: 'Lagebesprechung' });
      const einsatzId = 'test-einsatz-123';

      // When (Act)
      openMarkErledigtDialog(mockErinnerung, einsatzId);

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      expect(state.erinnerungToMarkErledigt).toEqual(mockErinnerung);
      expect(state.erinnerungToMarkErledigt?.titel).toBe('Lagebesprechung');
    });

    it('should store the einsatzId', () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      const einsatzId = 'test-einsatz-456';

      // When (Act)
      openMarkErledigtDialog(mockErinnerung, einsatzId);

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      expect(state.einsatzId).toBe('test-einsatz-456');
    });

    it('should allow opening with ACKNOWLEDGED status', () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung({ status: 'ACKNOWLEDGED' });
      const einsatzId = 'test-einsatz-123';

      // When (Act)
      openMarkErledigtDialog(mockErinnerung, einsatzId);

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      expect(state.isMarkErledigtOpen).toBe(true);
      expect(state.erinnerungToMarkErledigt?.status).toBe('ACKNOWLEDGED');
    });

    it('should allow opening with ESKALIERT status', () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung({ status: 'ESKALIERT' });
      const einsatzId = 'test-einsatz-123';

      // When (Act)
      openMarkErledigtDialog(mockErinnerung, einsatzId);

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      expect(state.isMarkErledigtOpen).toBe(true);
      expect(state.erinnerungToMarkErledigt?.status).toBe('ESKALIERT');
    });

    it('should replace previous erinnerung when opening again', () => {
      // Given (Arrange)
      const firstErinnerung = createMockErinnerung({ id: 'first-id', titel: 'First' });
      const secondErinnerung = createMockErinnerung({ id: 'second-id', titel: 'Second' });
      const einsatzId = 'test-einsatz-123';

      openMarkErledigtDialog(firstErinnerung, einsatzId);

      // When (Act)
      openMarkErledigtDialog(secondErinnerung, einsatzId);

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      expect(state.erinnerungToMarkErledigt?.id).toBe('second-id');
      expect(state.erinnerungToMarkErledigt?.titel).toBe('Second');
    });
  });

  describe('closeMarkErledigtDialog()', () => {
    it('should set isMarkErledigtOpen to false', () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      openMarkErledigtDialog(mockErinnerung, 'test-einsatz-123');
      expect(erinnerungDialogStore.state.isMarkErledigtOpen).toBe(true);

      // When (Act)
      closeMarkErledigtDialog();

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      expect(state.isMarkErledigtOpen).toBe(false);
    });

    it('should clear erinnerungToMarkErledigt', () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      openMarkErledigtDialog(mockErinnerung, 'test-einsatz-123');
      expect(erinnerungDialogStore.state.erinnerungToMarkErledigt).not.toBeNull();

      // When (Act)
      closeMarkErledigtDialog();

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      expect(state.erinnerungToMarkErledigt).toBeNull();
    });

    it('should preserve einsatzId after close (for potential reuse)', () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      openMarkErledigtDialog(mockErinnerung, 'test-einsatz-123');

      // When (Act)
      closeMarkErledigtDialog();

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      // einsatzId bleibt erhalten fuer potentielle Wiederverwendung
      expect(state.einsatzId).toBe('test-einsatz-123');
    });

    it('should be idempotent (safe to call multiple times)', () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      openMarkErledigtDialog(mockErinnerung, 'test-einsatz-123');

      // When (Act)
      closeMarkErledigtDialog();
      closeMarkErledigtDialog();
      closeMarkErledigtDialog();

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      expect(state.isMarkErledigtOpen).toBe(false);
      expect(state.erinnerungToMarkErledigt).toBeNull();
    });
  });

  describe('resetErinnerungDialogStore()', () => {
    it('should reset all MarkErledigt state to initial values', () => {
      // Given (Arrange)
      const mockErinnerung = createMockErinnerung();
      openMarkErledigtDialog(mockErinnerung, 'test-einsatz-123');
      expect(erinnerungDialogStore.state.isMarkErledigtOpen).toBe(true);

      // When (Act)
      resetErinnerungDialogStore();

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      expect(state.isMarkErledigtOpen).toBe(false);
      expect(state.erinnerungToMarkErledigt).toBeNull();
      expect(state.einsatzId).toBeNull();
    });
  });

  describe('interaction with other dialogs', () => {
    it('should not affect QuickCreate dialog state', () => {
      // Given (Arrange)
      openQuickCreateDialog('quick-create-einsatz');
      expect(erinnerungDialogStore.state.isQuickCreateOpen).toBe(true);

      // When (Act)
      const mockErinnerung = createMockErinnerung();
      openMarkErledigtDialog(mockErinnerung, 'mark-erledigt-einsatz');

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      // QuickCreate sollte immer noch offen sein
      expect(state.isQuickCreateOpen).toBe(true);
      // MarkErledigt ist auch offen
      expect(state.isMarkErledigtOpen).toBe(true);
    });

    it('should not affect Edit dialog state', () => {
      // Given (Arrange)
      const editErinnerung = createMockErinnerung({ id: 'edit-id', status: 'GEPLANT' });
      openEditDialog(editErinnerung, 'edit-einsatz');
      expect(erinnerungDialogStore.state.isEditOpen).toBe(true);

      // When (Act)
      const mockErinnerung = createMockErinnerung();
      openMarkErledigtDialog(mockErinnerung, 'mark-erledigt-einsatz');

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      // Edit sollte immer noch offen sein
      expect(state.isEditOpen).toBe(true);
      // MarkErledigt ist auch offen
      expect(state.isMarkErledigtOpen).toBe(true);
    });

    it('should not affect Delete dialog state', () => {
      // Given (Arrange)
      const deleteErinnerung = createMockErinnerung({ id: 'delete-id' });
      openDeleteDialog(deleteErinnerung, 'delete-einsatz');
      expect(erinnerungDialogStore.state.isDeleteOpen).toBe(true);

      // When (Act)
      const mockErinnerung = createMockErinnerung();
      openMarkErledigtDialog(mockErinnerung, 'mark-erledigt-einsatz');

      // Then (Assert)
      const state = erinnerungDialogStore.state;
      // Delete sollte immer noch offen sein
      expect(state.isDeleteOpen).toBe(true);
      // MarkErledigt ist auch offen
      expect(state.isMarkErledigtOpen).toBe(true);
    });
  });
});
