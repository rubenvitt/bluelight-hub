import type { ColorMode, UseColorModeReturn } from '@/components/ui/color-mode';
import { logger } from '@/utils/logger';
import { useTheme } from 'next-themes';

/**
 * Hook zum Verwalten des Farbmodus (Hell/Dunkel/System-Theme).
 *
 * Bietet eine einfache API zum Lesen und Ändern des aktuellen Themes.
 * Unterstützt automatische Anpassung an Systemeinstellungen.
 * Validiert die Theme-Werte und stellt sicher, dass nur gültige
 * Farbmodi verwendet werden.
 *
 * @returns Objekt mit colorMode, resolvedColorMode, setColorMode und toggleColorMode Funktionen
 */
export function useColorMode(): UseColorModeReturn {
  const { theme, resolvedTheme, setTheme, forcedTheme } = useTheme();

  // Validierung der Theme-Werte
  const isValidColorMode = (mode: unknown): mode is ColorMode => {
    return mode === 'light' || mode === 'dark' || mode === 'system';
  };

  const isValidResolvedMode = (mode: unknown): mode is 'light' | 'dark' => {
    return mode === 'light' || mode === 'dark';
  };

  // Der aktuelle Modus (kann 'system' sein)
  const rawColorMode = forcedTheme || theme;
  const colorMode: ColorMode = isValidColorMode(rawColorMode) ? rawColorMode : 'system';

  // Der tatsächlich angezeigte Modus (immer 'light' oder 'dark')
  const resolvedColorMode: 'light' | 'dark' = isValidResolvedMode(resolvedTheme) ? resolvedTheme : 'light';

  // Warnung bei ungültigem Theme-Wert
  if (rawColorMode && !isValidColorMode(rawColorMode)) {
    logger.warn(`Ungültiger Theme-Wert: "${rawColorMode}". Verwende "system" als Fallback.`);
  }

  const toggleColorMode = () => {
    // Zyklus: light -> dark -> system -> light
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  return {
    colorMode,
    resolvedColorMode,
    setColorMode: setTheme as (mode: ColorMode) => void,
    toggleColorMode,
  };
}

/**
 * Hook zum Auswählen von Werten basierend auf dem aktuellen Farbmodus.
 *
 * Ermöglicht die bedingte Verwendung von Werten abhängig vom
 * Hell- oder Dunkel-Modus. Verwendet den tatsächlich angezeigten Modus,
 * auch wenn 'system' ausgewählt ist.
 *
 * @param light - Wert für den hellen Modus
 * @param dark - Wert für den dunklen Modus
 * @returns Der entsprechende Wert basierend auf dem aktuellen Farbmodus
 *
 * @example
 * const backgroundColor = useColorModeValue('white', 'gray.800');
 * const textColor = useColorModeValue('gray.900', 'white');
 */
export function useColorModeValue<T>(light: T, dark: T) {
  const { resolvedColorMode } = useColorMode();
  return resolvedColorMode === 'dark' ? dark : light;
}
