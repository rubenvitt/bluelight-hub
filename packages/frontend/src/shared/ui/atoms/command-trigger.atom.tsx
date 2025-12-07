import { cn } from '@/utils/cn';
import { Button } from '@atoms/button.atom';
import { PiMagnifyingGlass } from 'react-icons/pi';

interface CommandTriggerProps {
  onClick: () => void;
  className?: string;
  variant?: 'default' | 'compact';
}

export function CommandTrigger({ onClick, className, variant = 'default' }: CommandTriggerProps) {
  return (
    <Button
      intent="info"
      appearance="outline"
      kbd="cmd+K"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 font-medium text-sm',
        'text-gray-700 dark:text-gray-200',
        'rounded-lg bg-white dark:bg-gray-800',
        'border border-gray-200 dark:border-gray-700',
        'hover:bg-gray-50 dark:hover:bg-gray-700/50',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        'transition-colors',
        className,
      )}
    >
      <PiMagnifyingGlass className="h-4 w-4" />
      {variant === 'default' && <span className="hidden sm:inline">Befehle & Navigation</span>}
    </Button>
  );
}
