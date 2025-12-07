import { cn } from '@/utils/cn';
import { InlineSpinner } from '@atoms/spinner.atom.tsx';
import { Button as HeadlessButton } from '@headlessui/react';
import * as React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success' | 'info';
  appearance?: 'filled' | 'outline' | 'ghost' | 'minimal' | 'heavy';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  fullWidth?: boolean;
  loading?: boolean;
  kbd?: string; // Keyboard shortcut to display
  animate?: boolean; // Enable/disable hover animations
  children: React.ReactNode;
}

/**
 * Button Atom Component
 *
 * Basis-Button-Komponente mit Tailwind CSS Styling
 *
 * @param intent - Semantische Bedeutung des Buttons (primary, secondary, danger, warning, success, info)
 * @param appearance - Visueller Stil des Buttons (filled, outline, ghost, minimal, heavy)
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, type = 'button', intent = 'primary', appearance = 'filled', size = 'md', fullWidth = false, loading = false, disabled, kbd, animate = false, children, ...props }, ref) => {
    const baseStyles =
      'group cursor-pointer inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    // Animation classes only applied when animate=true
    const animationStyles = animate ? 'hover:-translate-y-0.5 active:translate-y-0 transition-transform' : '';

    // Intent-based color schemes - now more subtle by default
    const intentColors = {
      primary: {
        filled: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-500 dark:bg-primary-600 dark:hover:bg-primary-700',
        outline:
          'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:border-gray-600',
        ghost: 'bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-primary-500 dark:text-gray-200 dark:hover:bg-gray-800/50',
        minimal: 'bg-transparent text-gray-600 hover:text-gray-900 focus:ring-primary-500 dark:text-gray-400 dark:hover:text-gray-100',
        heavy:
          'bg-gradient-to-b from-primary-500 to-primary-600 text-white shadow-lg hover:from-primary-600 hover:to-primary-700 hover:shadow-xl focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 dark:from-primary-600 dark:to-primary-700 dark:hover:from-primary-700 dark:hover:to-primary-800',
      },
      secondary: {
        filled: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
        outline:
          'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:ring-gray-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:border-gray-600',
        ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800',
        minimal: 'bg-transparent text-gray-500 hover:text-gray-700 focus:ring-gray-500 dark:text-gray-400 dark:hover:text-gray-200',
        heavy:
          'bg-gradient-to-b from-gray-600 to-gray-700 text-white shadow-lg hover:from-gray-700 hover:to-gray-800 hover:shadow-xl focus:ring-4 focus:ring-gray-500 focus:ring-opacity-50 dark:from-gray-700 dark:to-gray-800 dark:hover:from-gray-800 dark:hover:to-gray-900',
      },
      danger: {
        filled: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700',
        outline:
          'bg-white border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 focus:ring-red-500 dark:bg-gray-900 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/20 dark:hover:border-red-800',
        ghost: 'bg-transparent text-red-600 hover:bg-red-50 focus:ring-red-500 dark:text-red-400 dark:hover:bg-red-950/20',
        minimal: 'bg-transparent text-red-600 hover:text-red-700 focus:ring-red-500 dark:text-red-400 dark:hover:text-red-300',
        heavy:
          'bg-gradient-to-b from-red-500 to-red-600 text-white shadow-lg hover:from-red-600 hover:to-red-700 hover:shadow-xl focus:ring-4 focus:ring-red-500 focus:ring-opacity-50 dark:from-red-600 dark:to-red-700 dark:hover:from-red-700 dark:hover:to-red-800',
      },
      warning: {
        filled: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 dark:bg-yellow-600 dark:hover:bg-yellow-700',
        outline:
          'bg-white border-yellow-200 text-yellow-700 hover:bg-yellow-50 hover:border-yellow-300 focus:ring-yellow-500 dark:bg-gray-900 dark:border-yellow-900 dark:text-yellow-400 dark:hover:bg-yellow-950/20 dark:hover:border-yellow-800',
        ghost: 'bg-transparent text-yellow-700 hover:bg-yellow-50 focus:ring-yellow-500 dark:text-yellow-400 dark:hover:bg-yellow-950/20',
        minimal: 'bg-transparent text-yellow-700 hover:text-yellow-800 focus:ring-yellow-500 dark:text-yellow-400 dark:hover:text-yellow-300',
        heavy:
          'bg-gradient-to-b from-yellow-500 to-yellow-600 text-white shadow-lg hover:from-yellow-600 hover:to-yellow-700 hover:shadow-xl focus:ring-4 focus:ring-yellow-500 focus:ring-opacity-50 dark:from-yellow-600 dark:to-yellow-700 dark:hover:from-yellow-700 dark:hover:to-yellow-800',
      },
      success: {
        filled: 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-500 dark:bg-green-600 dark:hover:bg-green-700',
        outline:
          'bg-white border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300 focus:ring-green-500 dark:bg-gray-900 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950/20 dark:hover:border-green-800',
        ghost: 'bg-transparent text-green-600 hover:bg-green-50 focus:ring-green-500 dark:text-green-400 dark:hover:bg-green-950/20',
        minimal: 'bg-transparent text-green-600 hover:text-green-700 focus:ring-green-500 dark:text-green-400 dark:hover:text-green-300',
        heavy:
          'bg-gradient-to-b from-green-500 to-green-600 text-white shadow-lg hover:from-green-600 hover:to-green-700 hover:shadow-xl focus:ring-4 focus:ring-green-500 focus:ring-opacity-50 dark:from-green-600 dark:to-green-700 dark:hover:from-green-700 dark:hover:to-green-800',
      },
      info: {
        filled: 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500 dark:bg-blue-600 dark:hover:bg-blue-700',
        outline:
          'bg-white border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 focus:ring-blue-500 dark:bg-gray-900 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950/20 dark:hover:border-blue-800',
        ghost: 'bg-transparent text-blue-600 hover:bg-blue-50 focus:ring-blue-500 dark:text-blue-400 dark:hover:bg-blue-950/20',
        minimal: 'bg-transparent text-blue-600 hover:text-blue-700 focus:ring-blue-500 dark:text-blue-400 dark:hover:text-blue-300',
        heavy:
          'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg hover:from-blue-600 hover:to-blue-700 hover:shadow-xl focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800',
      },
    };

    // Border styles based on appearance
    const borderStyles = {
      filled: 'border-0',
      outline: 'border',
      ghost: 'border-0',
      minimal: 'border-0',
      heavy: 'border-0',
    };

    const sizes = {
      sm: 'text-sm px-3 py-1.5 rounded-md',
      md: 'text-sm px-4 py-2 rounded-lg',
      lg: 'text-base px-5 py-2.5 rounded-lg',
      icon: 'p-2 rounded-lg', // Square padding for icon-only buttons
    };

    // Keyboard shortcut badge styles based on intent and appearance
    const getKbdStyles = () => {
      if (appearance === 'filled') {
        // For filled buttons, use a semi-transparent overlay
        if (intent === 'secondary') {
          return 'bg-gray-700/10 text-gray-700 group-hover:bg-gray-700/20 dark:bg-gray-100/10 dark:text-gray-100';
        }
        return 'bg-white/20 text-white/90 group-hover:bg-white/25';
      }

      // For outline/ghost/minimal, use intent-based colors
      const kbdIntentColors = {
        primary: 'bg-primary-100 text-primary-700 group-hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-200',
        secondary: 'bg-gray-100 text-gray-600 group-hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300',
        danger: 'bg-red-100 text-red-700 group-hover:bg-red-200 dark:bg-red-900/30 dark:text-red-200',
        warning: 'bg-yellow-100 text-yellow-700 group-hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200',
        success: 'bg-green-100 text-green-700 group-hover:bg-green-200 dark:bg-green-900/30 dark:text-green-200',
        info: 'bg-blue-100 text-blue-700 group-hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-200',
      };
      return kbdIntentColors[intent];
    };

    return (
      <HeadlessButton
        aria-busy={loading}
        aria-live={loading ? 'polite' : undefined}
        className={cn(baseStyles, borderStyles[appearance], intentColors[intent][appearance], sizes[size], animationStyles, fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        type={type}
        ref={ref}
        {...props}
      >
        {loading ? (
          <InlineSpinner />
        ) : (
          <>
            {children}
            {kbd && (
              <kbd className={cn('ml-2 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium text-xs', getKbdStyles())}>
                {kbd.split('+').map((key) => {
                  const normalizedKey = key.trim().toLowerCase();
                  const keyMap: Record<string, string> = {
                    cmd: '⌘',
                    ctrl: 'Ctrl',
                    shift: '⇧',
                    alt: '⌥',
                    option: '⌥',
                    enter: '↩︎',
                  };
                  const displayKey = keyMap[normalizedKey] || key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
                  return <span key={key}>{displayKey}</span>;
                })}
              </kbd>
            )}
          </>
        )}
      </HeadlessButton>
    );
  },
);

Button.displayName = 'Button';
