import type { BadgeVariant } from '@/components/atoms/badge.atom';
import { Badge } from '@/components/atoms/badge.atom';
import { Text } from '@/components/atoms/text.atom';

interface StatusBadge {
  label: string;
  variant?: BadgeVariant;
  dotColor?: 'green' | 'blue' | 'red' | 'yellow';
}

interface AuthFooterProps {
  badges?: Array<StatusBadge>;
  version?: string;
  copyright?: string;
}

/**
 * Footer-Komponente für Auth-Seiten
 *
 * Zeigt Status-Badges und Versionsinformationen
 * in einem konsistenten Layout.
 */
export function AuthFooter({ badges = [{ label: 'System online', variant: 'default', dotColor: 'green' }], version, copyright }: AuthFooterProps) {
  return (
    <div className="w-full space-y-4 border-gray-200 border-t pt-6 dark:border-gray-700">
      {/* Status Pills */}
      {badges.length > 0 && (
        <div className="flex justify-center gap-4">
          {badges.map((badge) => (
            <Badge key={`${badge.label}-${badge.variant || 'default'}`} variant={badge.variant || 'default'} dot dotColor={badge.dotColor}>
              {badge.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Version/Copyright Text */}
      {(version || copyright) && (
        <Text size="xs" color="muted" className="text-center">
          {version && `Version ${version}`}
          {version && copyright && ' | '}
          {copyright}
        </Text>
      )}
    </div>
  );
}
