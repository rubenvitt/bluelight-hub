/**
 * Hook für Tray-Click Navigation - Story 1.9 AC3
 *
 * Lauscht auf tray-click Events von Tauri und navigiert zur ersten
 * ausgelösten Erinnerung wenn vorhanden.
 *
 * AC3: Tray-Click öffnet App mit Fokus auf fällige Erinnerung
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from '@tauri-apps/api/core';
import { useNavigate } from '@tanstack/react-router';
import { logger } from '@/shared/lib/logger';
import { useTriggeredTimerIds } from '../stores/timer.store';

/**
 * Hook der auf Tray-Clicks reagiert und zur ersten ausgelösten Erinnerung navigiert.
 *
 * Wird in der App-Root oder ErinnerungenProvider eingebunden.
 *
 * @param einsatzId - Aktuelle Einsatz-ID für Navigation
 */
export function useTrayClickNavigation(einsatzId: string | undefined) {
  const navigate = useNavigate();
  const triggeredIds = useTriggeredTimerIds();

  useEffect(() => {
    // Web-Fallback: Kein Tray-Event im Browser
    if (!isTauri()) {
      return;
    }

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen('tray-click', () => {
          logger.info('[TrayClickNavigation] Tray-click event empfangen');

          // AC3: Navigiere zur ersten ausgelösten Erinnerung
          if (triggeredIds.length > 0 && einsatzId) {
            const firstTriggeredId = triggeredIds[0];
            logger.info(`[TrayClickNavigation] Navigiere zu Erinnerung: ${firstTriggeredId}`);

            // Navigation zur Erinnerung im Einsatz-Kontext
            navigate({
              to: '/einsatz/$einsatzId/erinnerungen',
              params: { einsatzId },
              search: { highlight: firstTriggeredId },
            });
          } else {
            logger.debug('[TrayClickNavigation] Keine ausgelösten Erinnerungen - keine Navigation');
          }
        });

        logger.info('[TrayClickNavigation] Event Listener registriert');
      } catch (error) {
        logger.error('[TrayClickNavigation] Fehler beim Registrieren des Event Listeners:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
        logger.debug('[TrayClickNavigation] Event Listener entfernt');
      }
    };
  }, [navigate, triggeredIds, einsatzId]);
}
