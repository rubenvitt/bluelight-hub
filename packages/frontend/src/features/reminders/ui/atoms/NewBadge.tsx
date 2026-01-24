import { cn } from '@/shared/ui/cn';

interface NewBadgeProps {
  className?: string;
  /**
   * For testing/storybook: force a specific state
   */
  reducedMotion?: boolean;
}

/**
 * Story 3.7 AC3: "Neu" Badge
 * Visuelle Markierung für neu zugewiesene Erinnerungen.
 * Verwendet Primary-Color (Blue) um hervorzustechen.
 *
 * Story 3.7 AC3: ...sie sticht aus der Liste hervor
 * Story 3.2 AC2: ...respektiert reduced-motion (keine Animation bei Bedarf)
 */
export function NewBadge({ className, reducedMotion }: NewBadgeProps) {
  // Check prefers-reduced-motion only if not overridden by props
  const systemReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  const isReducedMotion = reducedMotion ?? systemReducedMotion;

  return (
    <output
      aria-label="Neue Zuweisung"
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 font-bold text-[10px] text-white uppercase tracking-wider shadow-sm dark:bg-blue-500',
        // Sanfte Pulse Animation nur wenn reduced-motion NICHT aktiv ist
        !isReducedMotion && 'animate-pulse',
        className,
      )}
      title="Neu zugewiesen"
    >
      NEU
    </output>
  );
}
