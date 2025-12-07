import { cn } from '@/utils/cn';
import { Button } from '@atoms/button.atom';
import type { ComponentProps } from 'react';
import { forwardRef } from 'react';

export interface IconButtonProps extends Omit<ComponentProps<typeof Button>, 'size' | 'fullWidth'> {
  size?: 'sm' | 'md' | 'lg';
  'aria-label': string;
}

/**
 * Icon-Button-Komponente für Aktionen mit Icons
 *
 * Wrapper um die Button-Komponente mit Icon-spezifischen Standardwerten
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(({ appearance = 'minimal', intent = 'secondary', size = 'md', className, children, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      appearance={appearance}
      intent={intent}
      size="icon"
      className={cn(
        // Icon-specific size adjustments
        size === 'sm' && 'h-8 w-8 p-1.5',
        size === 'md' && 'h-9 w-9 p-2',
        size === 'lg' && 'h-11 w-11 p-2.5',
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
});

IconButton.displayName = 'IconButton';
