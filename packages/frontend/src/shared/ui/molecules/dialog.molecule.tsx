import { cn } from '@/shared/ui/cn';
import { CloseButton } from '../atoms/close-button.atom';
import { Button } from '../atoms/button.atom';
import { InlineSpinner } from '../atoms/spinner.atom';
import { Dialog as HeadlessDialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import * as React from 'react';
import { PiCheckCircle, PiInfo, PiWarning, PiXCircle } from 'react-icons/pi';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnEscape?: boolean;
  closeOnClickOutside?: boolean;
  initialFocus?: React.RefObject<HTMLElement>;
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isProcessing?: boolean;
  requireConfirmation?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string | React.ReactNode;
  variant?: 'success' | 'error' | 'warning' | 'info';
  icon?: React.ComponentType<{ className?: string }>;
}

interface SlideInDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  position?: 'left' | 'right';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
}

/**
 * Dialog Molecule Component
 *
 * Wiederverwendbare Dialog-Komponente basierend auf Headless UI.
 *
 * WICHTIG: closeOnEscape und closeOnClickOutside kontrollieren, ob der Dialog
 * durch ESC-Taste bzw. Klick auf den Backdrop geschlossen werden kann.
 * Bei kritischen Dialogen (z.B. Token-Anzeige) sollten beide auf false gesetzt werden.
 */
export const Dialog = ({ isOpen, onClose, children, className, size = 'md', closeOnEscape = true, closeOnClickOutside = true, initialFocus }: DialogProps) => {
  const sizeClasses = {
    sm: 'max-w-md', // 448px (was 384px)
    md: 'max-w-lg', // 512px (was 448px)
    lg: 'max-w-xl', // 576px (was 512px)
    xl: 'max-w-2xl', // 672px (was 576px)
    full: 'max-w-4xl', // 896px (was 672px)
  };

  // Handler fuer Backdrop-Klick (wird von HeadlessDialog.onClose aufgerufen)
  // Bei Headless UI wird onClose sowohl bei ESC als auch bei Backdrop-Klick aufgerufen.
  // Wir verwenden diesen Handler nur fuer Backdrop-Klicks, ESC wird separat behandelt.
  const handleBackdropClose = React.useCallback(() => {
    if (closeOnClickOutside) {
      onClose();
    }
  }, [closeOnClickOutside, onClose]);

  // Separater Handler fuer ESC-Taste
  React.useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    // Event Listener mit capture:true um vor Headless UI zu feuern
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, closeOnEscape, onClose]);

  return (
    // __demoMode verhindert dass Headless UI ESC selbst behandelt
    <HeadlessDialog open={isOpen} as="div" className="relative z-50" onClose={handleBackdropClose} initialFocus={initialFocus} __demoMode>
      <DialogBackdrop transition className="fixed inset-0 bg-black/25 backdrop-blur-sm duration-300 ease-out data-[closed]:opacity-0" />

      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <DialogPanel
            transition
            className={cn(
              'w-full transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800',
              'duration-300 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
              sizeClasses[size],
              className,
            )}
          >
            {children}
          </DialogPanel>
        </div>
      </div>
    </HeadlessDialog>
  );
};

Dialog.Title = ({ children, className }: DialogTitleProps) => {
  return (
    <DialogTitle as="h3" className={cn('font-semibold text-gray-900 text-lg leading-6 dark:text-white', className)}>
      {children}
    </DialogTitle>
  );
};

Dialog.Body = ({ children, className }: DialogBodyProps) => {
  return <div className={cn('mt-4', className)}>{children}</div>;
};

Dialog.Footer = ({ children, className, loading }: DialogFooterProps) => {
  return (
    <div className={cn('mt-6 flex items-center justify-end gap-3', className)}>
      {loading && (
        <div className="mr-auto flex items-center gap-2 text-gray-500 text-sm dark:text-gray-400">
          <InlineSpinner size="sm" />
          <span>Verarbeitung...</span>
        </div>
      )}
      {children}
    </div>
  );
};

Dialog.CloseButton = ({ onClose }: { onClose: () => void }) => {
  return <CloseButton onClick={onClose} className="absolute -top-2 right-0" appearance="minimal" size="sm" />;
};

/**
 * Confirm Dialog Variant
 *
 * Vordefinierte Dialog-Variante für Bestätigungen
 */
Dialog.Confirm = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  variant = 'info',
  isProcessing = false,
  requireConfirmation = false,
  size = 'md',
}: ConfirmDialogProps) => {
  const [isConfirmed, setIsConfirmed] = React.useState(false);

  const variantConfig = {
    danger: {
      icon: PiWarning,
      iconColor: 'text-red-500',
      buttonIntent: 'danger' as const,
    },
    warning: {
      icon: PiWarning,
      iconColor: 'text-amber-500',
      buttonIntent: 'warning' as const,
    },
    info: {
      icon: PiInfo,
      iconColor: 'text-blue-500',
      buttonIntent: 'primary' as const,
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleClose = React.useCallback(() => {
    setIsConfirmed(false);
    onClose();
  }, [onClose]);

  const handleConfirm = React.useCallback(async () => {
    if (!requireConfirmation || isConfirmed) {
      await onConfirm();
      setIsConfirmed(false);
    }
  }, [onConfirm, requireConfirmation, isConfirmed]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (!requireConfirmation || isConfirmed)) {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleConfirm, requireConfirmation, isConfirmed]);

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} size={size}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Body>
        <div className="flex items-start space-x-3">
          <Icon className={cn('mt-0.5 h-6 w-6 flex-shrink-0', config.iconColor)} />
          <div className="flex-1">{typeof message === 'string' ? <p className="text-gray-700 dark:text-gray-300">{message}</p> : message}</div>
        </div>
        {requireConfirmation && (
          <div className="mt-4 border-t pt-4 dark:border-gray-700">
            <label className="flex cursor-pointer items-start space-x-3">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                disabled={isProcessing}
              />
              <span className="select-none text-gray-700 text-sm dark:text-gray-300">Ich bestätige diese Aktion</span>
            </label>
          </div>
        )}
      </Dialog.Body>
      <Dialog.Footer loading={isProcessing}>
        <Button intent="secondary" appearance="ghost" onClick={handleClose} disabled={isProcessing}>
          {cancelLabel}
        </Button>
        <Button intent={config.buttonIntent} onClick={handleConfirm} loading={isProcessing} disabled={isProcessing || (requireConfirmation && !isConfirmed)}>
          {confirmLabel}
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
};

/**
 * Alert Dialog Variant
 *
 * Vordefinierte Dialog-Variante für Benachrichtigungen
 */
Dialog.Alert = ({ isOpen, onClose, title, message, variant = 'info', icon }: AlertDialogProps) => {
  const variantConfig = {
    success: {
      icon: icon || PiCheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
    },
    error: {
      icon: icon || PiXCircle,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
    },
    warning: {
      icon: icon || PiWarning,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      borderColor: 'border-amber-200 dark:border-amber-800',
    },
    info: {
      icon: icon || PiInfo,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="sm">
      <Dialog.Title>
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', config.iconColor)} />
          <span>{title}</span>
        </div>
      </Dialog.Title>
      <Dialog.Body>
        <div className={cn('rounded-lg border p-4', config.bgColor, config.borderColor)}>
          {typeof message === 'string' ? <p className="text-gray-700 text-sm dark:text-gray-300">{message}</p> : message}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button intent="primary" onClick={onClose}>
          Verstanden
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
};

/**
 * SlideIn Dialog Variant
 *
 * Vordefinierte Dialog-Variante für Slide-In-Panels von der Seite
 */
Dialog.SlideIn = ({ isOpen, onClose, title, description, children, size = 'lg', position = 'right', showCloseButton = true, closeOnBackdropClick = true, className }: SlideInDialogProps) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full',
  };

  const positionClasses = position === 'right' ? 'right-0' : 'left-0';
  // Fuer v2 API: data-[closed] Klassen fuer die Slide-Animation
  const slideClosedClass = position === 'right' ? 'data-[closed]:translate-x-full' : 'data-[closed]:-translate-x-full';

  return (
    <HeadlessDialog open={isOpen} as="div" className="relative z-50" onClose={closeOnBackdropClick ? onClose : () => {}}>
      {/* Backdrop */}
      <DialogBackdrop transition className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm duration-300 ease-in-out data-[closed]:opacity-0" />

      {/* Panel */}
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className={cn('pointer-events-none fixed inset-y-0 flex', positionClasses, sizeClasses[size])}>
            <DialogPanel transition className={cn('pointer-events-auto relative w-screen transform', 'duration-300 ease-in-out', slideClosedClass, sizeClasses[size], className)}>
              <div className="flex h-full flex-col bg-white shadow-2xl dark:bg-gray-900">
                {/* Header */}
                <div className="border-gray-200 border-b px-6 py-4 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <DialogTitle className="font-semibold text-gray-900 text-xl leading-6 dark:text-white">{title}</DialogTitle>
                      {description && <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">{description}</p>}
                    </div>
                    {showCloseButton && <CloseButton onClick={onClose} size="lg" appearance="minimal" className="ml-4" />}
                  </div>
                </div>

                {/* Content */}
                <div className="relative flex-1 overflow-y-auto px-6 py-6">{children}</div>
              </div>
            </DialogPanel>
          </div>
        </div>
      </div>
    </HeadlessDialog>
  );
};
