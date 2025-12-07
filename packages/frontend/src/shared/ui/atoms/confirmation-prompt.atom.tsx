import { Button } from '@atoms/button.atom';

interface ConfirmationPromptProps {
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
  intent?: 'warning' | 'danger' | 'primary';
}

/**
 * Reusable confirmation prompt component
 */
export function ConfirmationPrompt({ message, confirmLabel, cancelLabel, onConfirm, onCancel, disabled = false, intent = 'warning' }: ConfirmationPromptProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5">
      <span className="text-sm text-yellow-700">{message}</span>
      <Button type="button" size="sm" intent={intent} onClick={onConfirm} disabled={disabled}>
        {confirmLabel}
      </Button>
      <Button type="button" size="sm" intent="secondary" onClick={onCancel} disabled={disabled}>
        {cancelLabel}
      </Button>
    </div>
  );
}
