import { cn } from '@/shared/ui/cn';

/**
 * Props für AvatarInitials Komponente
 */
interface AvatarInitialsProps {
  /** Name aus dem die Initialen extrahiert werden */
  name: string | null | undefined;
  /** Größenvariante */
  size?: 'sm' | 'md' | 'lg';
  /** Zusätzliche CSS-Klassen */
  className?: string;
}

/**
 * Größen-Mapping für Avatar-Container und Text
 */
const SIZE_CLASSES = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

/**
 * Extrahiert die ersten 2 Initialen aus einem Namen
 *
 * - "Markus Schmidt" → "MS"
 * - "Anna" → "A"
 * - null/undefined/leer → "?"
 *
 * @param name - Vollständiger Name
 * @returns Initialen (maximal 2 Zeichen)
 */
function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) {
    return '?';
  }

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    // Nur ein Wort: ersten Buchstaben nehmen
    return parts[0].charAt(0).toUpperCase();
  }

  // Mehrere Wörter: ersten Buchstaben der ersten beiden Wörter
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

/**
 * AvatarInitials - Runder Badge mit Initialen eines Namens
 *
 * Zeigt die ersten 2 Buchstaben eines Namens als Initialen in einem
 * runden Badge. Unterstützt Dark Mode.
 *
 * @example
 * <AvatarInitials name="Markus Schmidt" />
 * <AvatarInitials name="Anna" size="lg" />
 * <AvatarInitials name={null} />
 */
export function AvatarInitials({ name, size = 'md', className }: AvatarInitialsProps) {
  const initials = getInitials(name);

  return (
    <div
      role="img"
      aria-label={name ? `Avatar für ${name}` : 'Unbekannter Benutzer'}
      className={cn(
        // Base styles
        'inline-flex items-center justify-center rounded-full font-medium',
        // Colors: Light + Dark Mode
        'bg-blue-100 text-blue-700',
        'dark:bg-blue-900/40 dark:text-blue-300',
        // Size
        SIZE_CLASSES[size],
        // Custom classes
        className,
      )}
    >
      {initials}
    </div>
  );
}
