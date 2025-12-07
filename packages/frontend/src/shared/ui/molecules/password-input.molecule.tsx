import { cn } from '@/utils/cn';
import { IconButton } from '@atoms/icon-button.atom';
import type { InputProps } from '@atoms/input.atom';
import { Input } from '@atoms/input.atom';
import * as React from 'react';
import { useState } from 'react';
import { PiEye, PiEyeClosed, PiLock } from 'react-icons/pi';

interface PasswordInputProps extends Omit<InputProps, 'type' | 'leftIcon' | 'rightElement'> {
  showLockIcon?: boolean;
  shouldShake?: boolean;
  wrapperClassName?: string;
}

/**
 * PasswordInput Molecule Component
 *
 * Kombination aus Input und IconButton für Passwort-Eingaben mit Show/Hide-Funktionalität
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(({ showLockIcon = true, shouldShake = false, wrapperClassName, className, ...props }, ref) => {
  const [showPassword, setShowPassword] = useState(false);

  const shakeStyles = shouldShake ? 'animate-shake' : '';

  return (
    <div className={cn(shakeStyles, wrapperClassName)}>
      <Input
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        className={className}
        leftIcon={showLockIcon ? <PiLock size={18} /> : undefined}
        rightElement={
          <IconButton
            type="button"
            aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
            onClick={() => setShowPassword(!showPassword)}
            appearance="ghost"
            size="sm"
            className="mr-1"
            disabled={props.disabled}
          >
            {showPassword ? <PiEyeClosed size={18} /> : <PiEye size={18} />}
          </IconButton>
        }
        {...props}
      />
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';
