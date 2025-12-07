import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'error';
  textareaSize?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, variant = 'default', textareaSize = 'md', fullWidth = false, ...props }, ref) => {
  const baseStyles =
    'block w-full rounded-lg border-2 bg-white font-medium text-gray-900 transition-colors duration-200 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-opacity-20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 resize-none';

  const variants = {
    default:
      'border-gray-300 hover:border-gray-400 focus:border-primary-500 focus:bg-white focus:ring-primary-500 dark:border-gray-700 dark:hover:border-gray-600 dark:focus:border-primary-400 dark:focus:bg-gray-900 dark:focus:ring-primary-400',
    error: 'border-red-300 hover:border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-700 dark:hover:border-red-600 dark:focus:border-red-400 dark:focus:ring-red-400',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm min-h-[80px]',
    md: 'px-4 py-2.5 text-base min-h-[100px]',
    lg: 'px-4 py-3.5 text-base min-h-[120px]',
  };

  const textareaClasses = cn(baseStyles, variants[variant], sizes[textareaSize], fullWidth && 'w-full', className);

  return <textarea ref={ref} className={textareaClasses} {...props} />;
});

Textarea.displayName = 'Textarea';
