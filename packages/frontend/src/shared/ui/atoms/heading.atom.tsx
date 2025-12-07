import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

interface HeadingProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children: ReactNode;
  className?: string;
}

/**
 * Heading-Komponente für Überschriften
 *
 * Bietet verschiedene Größen und semantische HTML-Elemente.
 */
export function Heading({ size = 'md', as: Component = 'h2', children, className }: HeadingProps) {
  const sizeClasses = {
    xs: 'text-xs font-semibold',
    sm: 'text-sm font-semibold',
    md: 'text-base font-semibold',
    lg: 'text-lg font-semibold',
    xl: 'text-xl font-bold',
    '2xl': 'text-2xl font-bold',
    '3xl': 'text-3xl font-bold',
  };

  return <Component className={cn('text-gray-900 dark:text-white', sizeClasses[size], className)}>{children}</Component>;
}
