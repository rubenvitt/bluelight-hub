import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';
import { forwardRef } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Card-Komponente für Container mit Hintergrund und Schatten
 *
 * Bietet eine konsistente Card-Darstellung mit verschiedenen Padding-Optionen.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(({ children, className, padding = 'md' }, ref) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6 sm:p-8',
    lg: 'p-8 sm:p-12',
    xl: 'p-10 sm:p-14',
  };

  return (
    <div ref={ref} className={cn('relative rounded-2xl bg-white shadow-xl dark:bg-gray-800', 'border border-gray-200 dark:border-gray-700', paddingClasses[padding], className)}>
      {children}
    </div>
  );
});

Card.displayName = 'Card';
