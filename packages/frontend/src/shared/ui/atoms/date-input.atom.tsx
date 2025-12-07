import { cn } from '@/utils/cn';
import { forwardRef, type ComponentRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { PiCalendar } from 'react-icons/pi';

export interface DateInputProps {
  value?: string | Date | null;
  onChange?: (date: Date | null) => void;
  onBlur?: () => void;
  showIcon?: boolean;
  includeTime?: boolean;
  showNatoFormat?: boolean;
  min?: Date;
  max?: Date;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

/**
 * DateInput Atom Component
 *
 * Advanced date/time picker with NATO DateTime format support
 * Uses react-datepicker with custom styling
 */
export const DateInput = forwardRef<ComponentRef<typeof DatePicker>, DateInputProps>(
  ({ value, onChange, onBlur, showIcon = true, includeTime = false, showNatoFormat = false, min, max, placeholder, className, id, disabled = false, ...props }, ref) => {
    // Convert string value to Date object if needed
    const dateValue = value ? (typeof value === 'string' ? new Date(value) : value) : null;

    return (
      <div className="relative">
        <DatePicker
          ref={ref}
          id={id}
          selected={dateValue}
          onChange={onChange}
          onBlur={onBlur}
          // customInput={<CustomInput />}
          className={cn(
            'block w-full rounded-lg border-2 bg-gray-50 font-medium text-gray-900',
            'transition-all duration-200 placeholder:text-gray-400',
            'focus:outline-none focus:ring-4 focus:ring-opacity-20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500',
            'border-gray-200 focus:border-blue-500 focus:bg-white focus:ring-blue-500',
            'dark:border-gray-700 dark:focus:border-blue-400 dark:focus:bg-gray-800 dark:focus:ring-blue-400',
            'px-4 py-3 text-base',
            showIcon && 'pr-12',
            className,
          )}
          dateFormat={showNatoFormat ? 'dd HHmm MMM yy' : includeTime ? 'dd.MM.yyyy, HH:mm' : 'dd.MM.yyyy'}
          showTimeSelect={includeTime}
          timeFormat="HHmm"
          timeIntervals={15}
          minDate={min}
          maxDate={max}
          disabled={disabled}
          locale="de"
          placeholderText={placeholder}
          wrapperClassName="w-full"
          timeCaption="Zeit"
          timeInputLabel="Zeit:"
          showTimeInput
          showDateSelect
          showMonthDropdown
          showYearDropdown
          showWeekNumbers
          autoComplete="off"
          popperClassName="z-50"
          popperPlacement="bottom-start"
          {...props}
        />
        {showIcon && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <PiCalendar className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
        )}
      </div>
    );
  },
);

DateInput.displayName = 'DateInput';
