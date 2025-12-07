import { cn } from '@/utils/cn';
import { IconButton } from '@atoms/icon-button.atom';
import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { PiX } from 'react-icons/pi';

export interface CloseButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  size?: 'sm' | 'md' | 'lg';
  appearance?: 'minimal' | 'ghost' | 'outline';
  intent?: 'secondary';
  label?: string;
}

/**
 * Close Button Atom Component
 *
 * Spezialisierte Button-Komponente für Close/Cancel-Aktionen
 * Nutzt IconButton mit konsistenten Defaults
 */
export const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(({ size = 'md', appearance = 'minimal', intent = 'secondary', label = 'Schließen', className, ...props }, ref) => {
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  return (
    <IconButton
      ref={ref}
      size={size}
      appearance={appearance}
      intent={intent}
      className={cn('text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300', className)}
      aria-label={label}
      {...props}
    >
      <PiX className={iconSizes[size]} />
    </IconButton>
  );
});

CloseButton.displayName = 'CloseButton';
