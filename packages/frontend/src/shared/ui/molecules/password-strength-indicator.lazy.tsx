import { lazy, Suspense } from 'react';

/**
 * Lazy-loaded Version des PasswordStrengthIndicator
 *
 * Reduziert die initiale Bundle-Größe durch verzögertes Laden von zxcvbn (~820KB)
 */
const PasswordStrengthIndicatorImpl = lazy(() =>
  import('./password-strength-indicator.molecule').then((module) => ({
    default: module.PasswordStrengthIndicator,
  })),
);

/**
 * Wrapper-Komponente mit Suspense für Lazy Loading
 */
export function PasswordStrengthIndicator(props: React.ComponentProps<typeof PasswordStrengthIndicatorImpl>) {
  return (
    <Suspense fallback={<div className="h-20 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />}>
      <PasswordStrengthIndicatorImpl {...props} />
    </Suspense>
  );
}
