import { cn } from '@/utils/cn';
import { ProgressBar } from '@atoms/progress-bar.atom';
import { Text, type TextProps } from '@atoms/text.atom';
import { PASSWORD_MIN_SCORE } from '@bluelight-hub/shared';
import { useMemo } from 'react';
import { PiCheck } from 'react-icons/pi';
import zxcvbn from 'zxcvbn';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
  showLabel?: boolean;
  showCriteria?: boolean;
  minScore?: number;
}

interface PasswordCriterion {
  label: string;
  regex: RegExp;
  met: boolean;
}

/**
 * Konstanten für die Passwort-Stärke-Bewertung
 */
const STRENGTH_THRESHOLDS = {
  STRONG: 4,
  MEDIUM: 2,
  WEAK: 0,
} as const;

const STRENGTH_LABELS = {
  STRONG: 'Stark',
  MEDIUM: 'Mittel',
  WEAK: 'Schwach',
} as const;

const VARIANT_TO_COLOR: Record<'error' | 'warning' | 'success', TextProps['color']> = {
  error: 'error',
  warning: 'warning',
  success: 'success',
};

/**
 * Berechnet die Stärke eines Passworts basierend auf zxcvbn
 *
 * @param password - Das zu prüfende Passwort
 * @returns Objekt mit Score, Kriterien, Label und Variant
 */
function calculatePasswordStrength(password: string): {
  score: number;
  criteria: PasswordCriterion[];
  label: string;
  variant: 'error' | 'warning' | 'success';
} {
  // Performance-Optimierung: Regex nur einmal pro Kriterium ausführen
  const minLengthRegex = /.{8,}/;
  const lowercaseRegex = /[a-z]/;
  const uppercaseRegex = /[A-Z]/;
  const numberRegex = /[0-9]/;
  const symbolRegex = /[^a-zA-Z0-9]/;

  const hasMinLength = minLengthRegex.test(password);
  const hasLowercase = lowercaseRegex.test(password);
  const hasUppercase = uppercaseRegex.test(password);
  const hasNumber = numberRegex.test(password);
  const hasSymbol = symbolRegex.test(password);

  // Immutable Pattern: Kriterien mit vorberechneten met-Werten
  const criteria: PasswordCriterion[] = [
    {
      label: 'Mindestens 8 Zeichen',
      regex: minLengthRegex,
      met: hasMinLength,
    },
    {
      label: 'Kleinbuchstaben',
      regex: lowercaseRegex,
      met: hasLowercase,
    },
    {
      label: 'Großbuchstaben',
      regex: uppercaseRegex,
      met: hasUppercase,
    },
    {
      label: 'Zahl',
      regex: numberRegex,
      met: hasNumber,
    },
    {
      label: 'Sonderzeichen',
      regex: symbolRegex,
      met: hasSymbol,
    },
  ];

  // zxcvbn Score (0-4)
  const { score: zxScore } = zxcvbn(password);

  // Mapping gemäß Akzeptanzkriterien mit Konstanten
  let label: string;
  let variant: 'error' | 'warning' | 'success';

  if (zxScore >= STRENGTH_THRESHOLDS.STRONG) {
    label = STRENGTH_LABELS.STRONG;
    variant = 'success';
  } else if (zxScore >= STRENGTH_THRESHOLDS.MEDIUM) {
    label = STRENGTH_LABELS.MEDIUM;
    variant = 'warning';
  } else {
    label = STRENGTH_LABELS.WEAK;
    variant = 'error';
  }

  return {
    score: zxScore,
    criteria,
    label,
    variant,
  };
}

/**
 * Password Strength Indicator Komponente
 *
 * Zeigt die Stärke eines Passworts visuell mit einem Fortschrittsbalken an.
 * Verwendet zxcvbn für die Bewertung und zeigt Passwort-Kriterien an.
 */
export function PasswordStrengthIndicator({ password, className, showLabel = true, showCriteria = false, minScore = PASSWORD_MIN_SCORE }: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  // Verstecke den Indikator wenn kein Passwort eingegeben wurde
  if (!password) {
    return null;
  }

  const progressValue = (strength.score / 4) * 100;
  const meetsMinimum = strength.score >= minScore;

  return (
    <div className={cn('w-full space-y-2', className)}>
      <div className="space-y-1">
        <ProgressBar value={progressValue} max={100} variant={strength.variant} size="sm" animated aria-label={`Passwort-Stärke: ${strength.label}`} />

        {showLabel && (
          <div className="flex items-center justify-between">
            <Text size="xs" color={VARIANT_TO_COLOR[strength.variant]} className="font-medium">
              {strength.label}
            </Text>
            {minScore > 0 && (
              <Text size="xs" color={meetsMinimum ? 'success' : 'muted'}>
                {meetsMinimum ? '✓ Erfüllt' : `Min. Score: ${minScore}/4`}
              </Text>
            )}
          </div>
        )}
      </div>

      {showCriteria && (
        <ul className="space-y-1 rounded-md bg-gray-50 p-3 dark:bg-gray-800" aria-label="Passwort-Kriterien">
          {strength.criteria.map((criterion) => (
            <li key={criterion.label} className="flex items-center gap-2 text-xs">
              <span
                className={cn('flex h-4 w-4 items-center justify-center rounded-full text-white', criterion.met ? 'bg-green-500 dark:bg-green-600' : 'bg-gray-300 dark:bg-gray-600')}
                aria-hidden="true"
              >
                {criterion.met && <PiCheck className="h-2.5 w-2.5" aria-label="Erfüllt" />}
              </span>
              <Text size="xs" color={criterion.met ? 'default' : 'muted'} className={cn('transition-colors', criterion.met && 'font-medium')}>
                {criterion.label}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
