import { cn } from '@/utils/cn';
import * as React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

/**
 * Label Atom Component
 *
 * Basis-Label-Komponente für Formular-Felder mit Tailwind CSS Styling
 */
export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, required, children, ...props }, ref) => {
  return (
    <label htmlFor={props.htmlFor} ref={ref} className={cn('block font-medium text-gray-700 text-sm dark:text-gray-300', className)} {...props}>
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
});

Label.displayName = 'Label';
