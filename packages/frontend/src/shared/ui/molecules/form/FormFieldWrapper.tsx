import type { AnyFieldApi } from '@tanstack/react-form';
import type { ReactNode } from 'react';

interface FormFieldWrapperProps {
  field: AnyFieldApi;
  label: string;
  required?: boolean;
  optional?: boolean;
  helpText?: string;
  className?: string;
  children: ReactNode;
}

export function FormFieldWrapper({ field, label, required = false, optional = false, helpText, className = '', children }: FormFieldWrapperProps) {
  return (
    <div className={className}>
      <label htmlFor={field.name} className="block font-medium text-gray-700 text-sm dark:text-gray-200">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
        {optional && !required && <span className="ml-2 text-gray-500 text-xs dark:text-gray-400">(optional)</span>}
      </label>

      {helpText && <p className="mt-0.5 text-gray-500 text-xs dark:text-gray-400">{helpText}</p>}

      {children}

      {field.state.meta.errors.length > 0 && <p className="mt-1 text-red-600 text-sm dark:text-red-400">{field.state.meta.errors.join(', ')}</p>}
    </div>
  );
}
