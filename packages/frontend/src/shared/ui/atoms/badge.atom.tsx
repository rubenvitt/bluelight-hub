import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

export type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  dot?: boolean;
  dotColor?: 'green' | 'red' | 'yellow' | 'blue';
}

/**
 * Badge-Komponente für Status-Anzeigen und Labels
 *
 * Kann optional mit einem animierten Punkt versehen werden.
 */
export function Badge({ children, variant = 'default', size = 'md', className, dot = false, dotColor = 'green' }: BadgeProps) {
  const variantClasses = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2 text-sm',
  };

  const dotColors = {
    green: 'bg-green-400',
    red: 'bg-red-400',
    yellow: 'bg-yellow-400',
    blue: 'bg-blue-400',
  };

  return (
    <div className={cn('inline-flex items-center rounded-full font-medium', variantClasses[variant], sizeClasses[size], className)}>
      {dot && (
        <span className="relative mr-2 flex h-1.5 w-1.5">
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', dotColors[dotColor])} />
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dotColors[dotColor])} />
        </span>
      )}
      {children}
    </div>
  );
}
