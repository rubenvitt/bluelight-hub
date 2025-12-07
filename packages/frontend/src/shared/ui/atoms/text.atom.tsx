import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

export interface TextProps {
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'default' | 'muted' | 'success' | 'error' | 'warning';
  className?: string;
  as?: 'p' | 'span' | 'div';
}

/**
 * Text-Komponente für typografische Inhalte
 *
 * Bietet konsistente Text-Stile und Farben.
 */
export function Text({ children, size = 'md', color = 'default', className, as: Component = 'p' }: TextProps) {
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  const colorClasses = {
    default: 'text-gray-900 dark:text-white',
    muted: 'text-gray-500 dark:text-gray-400',
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
  };

  return <Component className={cn(sizeClasses[size], colorClasses[color], className)}>{children}</Component>;
}
