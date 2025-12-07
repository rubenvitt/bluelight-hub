import { cn } from '@/utils/cn';
import type * as React from 'react';

interface FormFieldProps {
  label?: string | React.ReactNode;
  helperText?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * FormField Atom Component
 *
 * Wrapper für Formularfelder mit Label und Hilfetexten
 */
export function FormField({ label, helperText, error, required, className, children }: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="block font-medium text-gray-700 text-sm">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </div>
      )}
      {children}
      {(helperText || error) && <p className={cn('mt-1 text-sm', error ? 'text-red-600' : 'text-gray-500')}>{error || helperText}</p>}
    </div>
  );
}
