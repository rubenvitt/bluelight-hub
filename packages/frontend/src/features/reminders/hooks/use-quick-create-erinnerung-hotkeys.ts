/**
 * Quick-Create Erinnerung Hotkeys Hook
 *
 * **Story 1.1 AC1:** "When ich Cmd/Ctrl+Shift+R drücke [...] öffnet sich das Quick-Create Formular"
 *
 * Registriert globale Keyboard-Shortcuts für Erinnerungs-Erstellung.
 */

import { useHotkeys } from 'react-hotkeys-hook';
import { openQuickCreateDialog } from '../stores';

interface UseQuickCreateErinnerungHotkeysOptions {
  /**
   * Einsatz-ID für den Dialog-Kontext
   */
  einsatzId: string;
  /**
   * Ob der Hotkey aktiviert ist (z.B. deaktivieren wenn ein anderer Dialog offen ist)
   * @default true
   */
  enabled?: boolean;
}

/**
 * Hook für Quick-Create Erinnerung Keyboard-Shortcuts.
 *
 * Registriert `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows/Linux) zum Öffnen
 * des Quick-Create Dialogs.
 *
 * @param options - Optionen für den Hook
 *
 * @example
 * ```tsx
 * // In SingleEinsatzLayout.tsx
 * useQuickCreateErinnerungHotkeys({
 *   einsatzId: 'abc-123',
 *   enabled: !commandPaletteOpen && !otherDialogOpen,
 * });
 * ```
 */
export function useQuickCreateErinnerungHotkeys({ einsatzId, enabled = true }: UseQuickCreateErinnerungHotkeysOptions) {
  // Cmd/Ctrl+Shift+R zum Öffnen des Quick-Create Dialogs
  useHotkeys(
    'mod+shift+r',
    (event) => {
      // Prevent browser refresh (Cmd+Shift+R is sometimes used for hard refresh)
      event.preventDefault();
      openQuickCreateDialog(einsatzId);
    },
    {
      enabled,
      enableOnFormTags: ['INPUT', 'TEXTAREA', 'SELECT'],
      preventDefault: true,
    },
  );
}
