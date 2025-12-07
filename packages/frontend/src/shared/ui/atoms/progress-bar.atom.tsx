import { cn } from '@/utils/cn';
import { Transition } from '@headlessui/react';

export type ProgressBarVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: ProgressBarVariant;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showPercentage?: boolean;
  animated?: boolean;
  className?: string;
}

/**
 * ProgressBar-Komponente für Fortschrittsanzeigen
 *
 * Zeigt einen animierten Fortschrittsbalken mit verschiedenen Varianten und Größen.
 */
export function ProgressBar({ value, max = 100, variant = 'default', size = 'md', label, showPercentage = false, animated = true, className }: ProgressBarProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const percentage = Math.min(Math.max((value / safeMax) * 100, 0), 100);

  const variantClasses = {
    default: 'bg-primary-600 dark:bg-primary-400',
    success: 'bg-green-600 dark:bg-green-500',
    warning: 'bg-yellow-600 dark:bg-yellow-500',
    error: 'bg-red-600 dark:bg-red-500',
    info: 'bg-blue-600 dark:bg-blue-500',
  };

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const backgroundClasses = {
    default: 'bg-gray-200 dark:bg-gray-700',
    success: 'bg-green-100 dark:bg-green-900/30',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30',
    error: 'bg-red-100 dark:bg-red-900/30',
    info: 'bg-blue-100 dark:bg-blue-900/30',
  };

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="mb-1 flex items-center justify-between">
          {label && <span className="font-medium text-gray-700 text-sm dark:text-gray-300">{label}</span>}
          {showPercentage && <span className="font-medium text-gray-700 text-sm dark:text-gray-300">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={cn('w-full overflow-hidden rounded-full', backgroundClasses[variant], sizeClasses[size])} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <Transition show={true} appear={animated} enter="transition-transform duration-500 ease-out" enterFrom="scale-x-0" enterTo="scale-x-100">
          <div className={cn('h-full origin-left rounded-full transition-all duration-300 ease-out', variantClasses[variant], animated && 'animate-pulse')} style={{ width: `${percentage}%` }} />
        </Transition>
      </div>
    </div>
  );
}
