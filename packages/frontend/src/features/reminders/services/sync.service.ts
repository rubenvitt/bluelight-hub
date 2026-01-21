/**
 * Sync Service fuer Offline-Synchronisation
 *
 * Verwaltet die Synchronisation von offline erstellten/geaenderten Erinnerungen
 * mit dem Server bei Wiederherstellung der Verbindung.
 *
 * **Story 1.8 AC3:**
 * - Sync Queue Processing bei Reconnect
 * - ID-Mapping von temp_ zu Server-IDs
 * - Last-Write-Wins Conflict Resolution
 * - Retry-Logik mit max 3 Versuchen
 */

import { api } from '@/shared';
import { logger } from '@/shared/lib/logger';
import {
  offlineStore,
  addPendingErinnerung,
  removePendingErinnerung,
  queueSyncAction,
  clearProcessedActions,
  updateActionRetryCount,
  replaceIdInQueue,
  setLastSync,
  type PendingErinnerung,
  type SyncQueueAction,
} from '../stores/offline.store';
import { offlineDetectionService } from './offline-detection.service';

/** Maximale Anzahl Retry-Versuche */
const MAX_RETRY_COUNT = 3;

/**
 * Sync Result fuer eine einzelne Aktion
 */
export interface SyncActionResult {
  /** Action-ID */
  actionId: string;
  /** Ob die Aktion erfolgreich war */
  success: boolean;
  /** Fehler-Nachricht falls fehlgeschlagen */
  error?: string;
  /** Server-ID falls eine temp_ ID ersetzt wurde */
  serverId?: string;
}

/**
 * Sync Result fuer den gesamten Sync-Prozess
 */
export interface SyncResult {
  /** Anzahl erfolgreicher Aktionen */
  successCount: number;
  /** Anzahl fehlgeschlagener Aktionen */
  failureCount: number;
  /** Details zu jeder Aktion */
  results: SyncActionResult[];
}

/**
 * Sync Service Klasse
 *
 * Singleton-Service der die Synchronisation von Offline-Aenderungen
 * mit dem Server verwaltet.
 *
 * @example
 * ```typescript
 * // Bei Reconnect
 * if (syncService.hasPendingSync()) {
 *   const result = await syncService.syncAll();
 *   console.log(`Synced ${result.successCount} actions`);
 * }
 * ```
 */
export class SyncService {
  /** Mapping von temp_ IDs zu Server-IDs */
  private idMapping: Map<string, string> = new Map();

  /** Flag ob gerade synchronisiert wird */
  private isSyncing = false;

  /**
   * Generiert eine temporaere ID fuer offline erstellte Erinnerungen
   *
   * @returns Temporaere ID mit `temp_` Prefix
   */
  generateTempId(): string {
    return `temp_${crypto.randomUUID()}`;
  }

  /**
   * Prueft ob eine ID eine temporaere ID ist
   *
   * @param id - Zu pruefende ID
   * @returns true wenn ID mit `temp_` beginnt
   */
  isTempId(id: string): boolean {
    return id.startsWith('temp_');
  }

  /**
   * Prueft ob es ausstehende Sync-Aktionen gibt
   *
   * @returns true wenn pending Erinnerungen oder Queue-Aktionen existieren
   */
  hasPendingSync(): boolean {
    const state = offlineStore.state;
    return state.pendingErinnerungen.length > 0 || state.syncQueue.length > 0;
  }

  /**
   * Gibt die Anzahl ausstehender Sync-Aktionen zurueck
   *
   * @returns Gesamtzahl pending Erinnerungen + Queue-Aktionen
   */
  getPendingCount(): number {
    const state = offlineStore.state;
    return state.pendingErinnerungen.length + state.syncQueue.length;
  }

  /**
   * Prueft ob gerade synchronisiert wird
   *
   * @returns true wenn Sync-Prozess laeuft
   */
  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Gibt das ID-Mapping zurueck (temp_ -> Server-ID)
   *
   * @returns Map von temporaeren zu Server-IDs
   */
  getIdMapping(): Map<string, string> {
    return new Map(this.idMapping);
  }

  /**
   * Loescht das ID-Mapping
   */
  clearIdMapping(): void {
    this.idMapping.clear();
  }

  /**
   * Queue eine Create-Aktion fuer Offline-Synchronisation
   *
   * Speichert die Erinnerung lokal und fuegt eine Sync-Aktion hinzu.
   *
   * @param erinnerung - Die offline erstellte Erinnerung
   */
  queueCreateAction(erinnerung: PendingErinnerung): void {
    // Speichere in pendingErinnerungen
    addPendingErinnerung(erinnerung);

    // Queue die Create-Aktion
    const action: SyncQueueAction = {
      id: crypto.randomUUID(),
      action: 'create',
      erinnerungId: erinnerung.id,
      payload: {
        einsatzId: erinnerung.einsatzId,
        titel: erinnerung.titel,
        beschreibung: erinnerung.beschreibung,
        faelligAm: erinnerung.faelligAm,
      },
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    queueSyncAction(action);
    logger.debug('[SyncService] Queued create action', { tempId: erinnerung.id });
  }

  /**
   * Queue eine Trigger-Aktion fuer Offline-Synchronisation
   *
   * @param erinnerungId - ID der zu triggernden Erinnerung
   * @param einsatzId - ID des zugehoerigen Einsatzes (fuer API-Aufruf)
   */
  queueTriggerAction(erinnerungId: string, einsatzId: string): void {
    const action: SyncQueueAction = {
      id: crypto.randomUUID(),
      action: 'trigger',
      erinnerungId,
      payload: { einsatzId },
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    queueSyncAction(action);
    logger.debug('[SyncService] Queued trigger action', { erinnerungId, einsatzId });
  }

  /**
   * Queue eine Acknowledge-Aktion fuer Offline-Synchronisation
   *
   * @param erinnerungId - ID der zu bestaetigenden Erinnerung
   * @param einsatzId - ID des zugehoerigen Einsatzes (fuer API-Aufruf)
   */
  queueAcknowledgeAction(erinnerungId: string, einsatzId: string): void {
    const action: SyncQueueAction = {
      id: crypto.randomUUID(),
      action: 'acknowledge',
      erinnerungId,
      payload: { einsatzId },
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    queueSyncAction(action);
    logger.debug('[SyncService] Queued acknowledge action', { erinnerungId, einsatzId });
  }

  /**
   * Queue eine Snooze-Aktion fuer Offline-Synchronisation (Story 2.1)
   *
   * @param erinnerungId - ID der zu snoozenden Erinnerung
   * @param einsatzId - ID des zugehoerigen Einsatzes (fuer API-Aufruf)
   * @param snoozeMinutes - Snooze-Dauer in Minuten (1, 5, oder 10)
   */
  queueSnoozeAction(erinnerungId: string, einsatzId: string, snoozeMinutes: 1 | 5 | 10): void {
    const action: SyncQueueAction = {
      id: crypto.randomUUID(),
      action: 'snooze',
      erinnerungId,
      payload: { einsatzId, snoozeMinutes },
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    queueSyncAction(action);
    logger.debug('[SyncService] Queued snooze action', { erinnerungId, einsatzId, snoozeMinutes });
  }

  /**
   * Synchronisiert alle ausstehenden Aktionen mit dem Server
   *
   * Verarbeitet zuerst pending Erinnerungen (Create), dann die Queue.
   * Bei Fehlern wird die Aktion mit erhoehtem retryCount behalten.
   *
   * @returns SyncResult mit Erfolgs- und Fehlerstatistiken
   */
  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      logger.warn('[SyncService] Sync already in progress');
      return { successCount: 0, failureCount: 0, results: [] };
    }

    // Issue #4 Fix: Check if still offline before attempting sync
    if (offlineDetectionService.isOffline()) {
      logger.info('[SyncService] Still offline, skipping sync');
      return { successCount: 0, failureCount: 0, results: [] };
    }

    this.isSyncing = true;
    const results: SyncActionResult[] = [];

    try {
      logger.info('[SyncService] Starting sync...');

      // 1. Sync pending Erinnerungen (Create-Aktionen)
      const pendingResults = await this.syncPendingErinnerungen();
      results.push(...pendingResults);

      // 2. Sync Queue-Aktionen (Trigger, Acknowledge, etc.)
      const queueResults = await this.processSyncQueue();
      results.push(...queueResults);

      // Update lastSync timestamp
      setLastSync(new Date().toISOString());

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      logger.info('[SyncService] Sync complete', { successCount, failureCount });

      return { successCount, failureCount, results };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Synchronisiert offline erstellte Erinnerungen mit dem Server
   *
   * @returns Array von SyncActionResult
   */
  private async syncPendingErinnerungen(): Promise<SyncActionResult[]> {
    const results: SyncActionResult[] = [];
    const pendingErinnerungen = [...offlineStore.state.pendingErinnerungen];

    for (const pending of pendingErinnerungen) {
      try {
        const response = await api.erinnerungen().erinnerungControllerCreateVAlpha({
          einsatzId: pending.einsatzId,
          createErinnerungDto: {
            titel: pending.titel,
            faelligAm: pending.faelligAm,
            beschreibung: pending.beschreibung ?? undefined,
          },
        });

        const tempId = pending.id;
        const serverId = response.data.id;

        // Issue #8 Fix: Atomic update - update queue FIRST, then mapping
        // This ensures no actions can reference the old temp ID during the window
        // between mapping update and queue update
        replaceIdInQueue(tempId, serverId);

        // Now update the ID mapping (for any future lookups)
        this.idMapping.set(tempId, serverId);

        // Finally remove from pendingErinnerungen
        removePendingErinnerung(tempId);

        results.push({
          actionId: pending.id,
          success: true,
          serverId: response.data.id,
        });

        logger.debug('[SyncService] Synced pending erinnerung', {
          tempId: pending.id,
          serverId: response.data.id,
        });
      } catch (error) {
        logger.error('[SyncService] Failed to sync pending erinnerung', error);
        results.push({
          actionId: pending.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Verarbeitet die Sync-Queue in chronologischer Reihenfolge
   *
   * @returns Array von SyncActionResult
   */
  private async processSyncQueue(): Promise<SyncActionResult[]> {
    const results: SyncActionResult[] = [];
    const queue = [...offlineStore.state.syncQueue];
    const processedIds: string[] = [];

    // Sortiere nach Timestamp (chronologisch)
    queue.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const action of queue) {
      // Skip Create-Aktionen (wurden bereits in syncPendingErinnerungen verarbeitet)
      if (action.action === 'create') {
        processedIds.push(action.id);
        results.push({ actionId: action.id, success: true });
        continue;
      }

      // Resolve temp_ ID zu Server-ID falls vorhanden
      const resolvedId = this.idMapping.get(action.erinnerungId) ?? action.erinnerungId;

      try {
        await this.executeAction(action, resolvedId);
        processedIds.push(action.id);
        results.push({ actionId: action.id, success: true });

        logger.debug('[SyncService] Processed queue action', {
          actionId: action.id,
          action: action.action,
          erinnerungId: resolvedId,
        });
      } catch (error) {
        // Pruefe ob max Retries erreicht
        if (action.retryCount >= MAX_RETRY_COUNT - 1) {
          // Entferne nach max Retries
          processedIds.push(action.id);
          results.push({
            actionId: action.id,
            success: false,
            error: `Max retries exceeded: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });

          logger.error('[SyncService] Max retries exceeded for action', {
            actionId: action.id,
            action: action.action,
          });
        } else {
          // Erhoehe Retry-Count
          updateActionRetryCount(action.id, action.retryCount + 1);
          results.push({
            actionId: action.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          logger.warn('[SyncService] Action failed, will retry', {
            actionId: action.id,
            retryCount: action.retryCount + 1,
          });
        }
      }
    }

    // Entferne verarbeitete Aktionen
    if (processedIds.length > 0) {
      clearProcessedActions(processedIds);
    }

    return results;
  }

  /**
   * Validiert das Payload einer Sync-Aktion
   *
   * Issue #9 Fix: Validate payload before use to prevent runtime errors
   *
   * @param payload - Das zu validierende Payload
   * @param requiredFields - Die erforderlichen Felder
   * @returns Validiertes Payload oder null wenn ungueltig
   */
  private validatePayload<T extends Record<string, unknown>>(payload: unknown, requiredFields: (keyof T)[]): T | null {
    if (!payload || typeof payload !== 'object') {
      logger.warn('[SyncService] Invalid payload: not an object', { payload });
      return null;
    }

    const payloadObj = payload as Record<string, unknown>;

    for (const field of requiredFields) {
      if (!(field in payloadObj)) {
        logger.warn('[SyncService] Missing required field in payload', {
          field,
          payload: payloadObj,
        });
        return null;
      }
    }

    return payloadObj as T;
  }

  /**
   * Extrahiert die einsatzId aus dem Payload mit Validierung
   *
   * @param payload - Das Payload der Aktion
   * @returns Die einsatzId oder null wenn nicht vorhanden/ungueltig
   */
  private extractEinsatzId(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const payloadObj = payload as Record<string, unknown>;
    const einsatzId = payloadObj.einsatzId;

    if (typeof einsatzId !== 'string' || einsatzId.trim() === '') {
      return null;
    }

    return einsatzId;
  }

  /**
   * Fuehrt eine einzelne Sync-Aktion aus
   *
   * @param action - Die auszufuehrende Aktion
   * @param erinnerungId - Die (aufgeloeste) Erinnerungs-ID
   * @throws Error wenn Payload ungueltig ist oder API-Aufruf fehlschlaegt
   */
  private async executeAction(action: SyncQueueAction, erinnerungId: string): Promise<void> {
    // Issue #9 Fix: Validate payload before use
    const einsatzId = this.extractEinsatzId(action.payload);

    if (!einsatzId) {
      throw new Error(`Invalid or missing einsatzId in payload for action ${action.action}`);
    }

    switch (action.action) {
      case 'trigger':
        await api.erinnerungen().erinnerungControllerTriggerVAlpha({
          einsatzId,
          id: erinnerungId,
        });
        break;

      case 'acknowledge':
        await api.erinnerungen().erinnerungControllerAcknowledgeVAlpha({
          einsatzId,
          id: erinnerungId,
        });
        break;

      case 'snooze': {
        // Story 2.1: Snooze-Aktion
        const snoozePayload = this.validatePayload<{ einsatzId: string; snoozeMinutes: 1 | 5 | 10 }>(action.payload, ['einsatzId', 'snoozeMinutes']);
        if (!snoozePayload) {
          throw new Error('Invalid snooze payload');
        }
        await api.erinnerungen().erinnerungControllerSnoozeVAlpha({
          einsatzId,
          id: erinnerungId,
          snoozeErinnerungDto: { snoozeMinutes: snoozePayload.snoozeMinutes },
        });
        break;
      }

      case 'update':
        // Update wuerde hier implementiert werden falls benoetigt
        logger.warn('[SyncService] Update action not yet implemented');
        break;

      default:
        logger.warn('[SyncService] Unknown action type', { action: action.action });
    }
  }
}

/**
 * Singleton-Instanz des Sync Service
 */
export const syncService = new SyncService();
