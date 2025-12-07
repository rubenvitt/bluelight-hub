import { cn } from '@/utils/cn';
import * as React from 'react';
import { PiCaretDown } from 'react-icons/pi';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  variant?: 'default' | 'error';
  selectSize?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  options: SelectOption[];
  placeholder?: string;
}

/**
 * Select Atom Component
 *
 * Basis-Select-Komponente mit Tailwind CSS Styling
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, variant = 'default', selectSize = 'md', fullWidth = false, options, placeholder, ...props }, ref) => {
  const baseStyles =
    'block w-full appearance-none rounded-lg border-2 bg-white font-medium text-gray-900 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-opacity-20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:text-white';

  const variants = {
    default:
      'border-gray-300 hover:border-gray-400 focus:border-primary-500 focus:bg-white focus:ring-primary-500 dark:border-gray-700 dark:hover:border-gray-600 dark:focus:border-primary-400 dark:focus:bg-gray-900 dark:focus:ring-primary-400',
    error: 'border-red-300 hover:border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-700 dark:hover:border-red-600 dark:focus:border-red-400 dark:focus:ring-red-400',
  };

  const sizes = {
    sm: 'px-3 pr-8 py-1.5 text-sm',
    md: 'px-4 pr-10 py-2.5 text-base',
    lg: 'px-4 pr-10 py-3.5 text-base',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-5 w-5',
  };

  const selectClasses = cn(baseStyles, variants[variant], sizes[selectSize], fullWidth && 'w-full', className);

  return (
    <div className="relative">
      <select ref={ref} className={selectClasses} {...props}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <PiCaretDown className={cn('-translate-y-1/2 pointer-events-none absolute top-1/2 right-2 text-gray-500 dark:text-gray-400', iconSizes[selectSize])} aria-hidden="true" />
    </div>
  );
});

Select.displayName = 'Select';
