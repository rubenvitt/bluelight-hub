import { cn } from '@/shared/ui/cn';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useState } from 'react';
import { PiWarning, PiX } from 'react-icons/pi';

interface EinsatzIncompleteAlertProps {
  isOpen: boolean;
  onClose: () => void;
  missingFields: string[];
  onComplete?: () => void;
  onIgnore?: () => void;
  title?: string;
  message?: string;
  completeButtonText?: string;
  ignoreButtonText?: string;
  className?: string;
}

/**
 * EinsatzIncompleteAlert-Komponente für unvollständige Einsätze
 *
 * Zeigt einen Dialog mit Headless UI für unvollständige Einsätze mit Aktions-Buttons.
 */
export function EinsatzIncompleteAlert({
  isOpen,
  onClose,
  missingFields,
  onComplete,
  onIgnore,
  title = 'Unvollständiger Einsatz',
  message = 'Dieser Einsatz ist noch nicht vollständig ausgefüllt.',
  completeButtonText = 'Jetzt vervollständigen',
  ignoreButtonText = 'Trotzdem fortfahren',
  className,
}: EinsatzIncompleteAlertProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  const handleComplete = () => {
    handleClose();
    onComplete?.();
  };

  const handleIgnore = () => {
    handleClose();
    onIgnore?.();
  };

  return (
    <Dialog open={isOpen && !isClosing} as="div" className="relative z-50" onClose={handleClose}>
      <DialogBackdrop transition className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm duration-300 ease-out data-[closed]:opacity-0" />

      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <DialogPanel
            transition
            className={cn(
              'relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800',
              'px-4 pt-5 pb-4 text-left shadow-xl',
              'sm:my-8 sm:w-full sm:max-w-lg sm:p-6',
              'duration-300 ease-out',
              'data-[closed]:translate-y-4 data-[closed]:opacity-0 sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95',
              className,
            )}
          >
            <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
              <Button
                appearance="minimal"
                size="icon"
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-gray-800 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800 dark:hover:text-gray-300"
                onClick={handleClose}
              >
                <span className="sr-only">Schließen</span>
                <PiX className="h-6 w-6" aria-hidden="true" />
              </Button>
            </div>

            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-yellow-900/30">
                <PiWarning className="h-6 w-6 text-yellow-600 dark:text-yellow-500" aria-hidden="true" />
              </div>

              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <DialogTitle as="h3" className="font-semibold text-base text-gray-900 leading-6 dark:text-gray-100">
                  {title}
                </DialogTitle>

                <div className="mt-2">
                  <Description className="text-gray-500 text-sm dark:text-gray-400">{message}</Description>

                  {missingFields.length > 0 && (
                    <div className="mt-3">
                      <p className="font-medium text-gray-700 text-sm dark:text-gray-300">Fehlende Felder:</p>
                      <ul className="mt-1 list-inside list-disc text-gray-600 text-sm dark:text-gray-400">
                        {missingFields.map((field) => (
                          <li key={field}>{field}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              {onComplete && (
                <Button type="button" onClick={handleComplete} className="w-full sm:ml-3 sm:w-auto">
                  {completeButtonText}
                </Button>
              )}

              {onIgnore && (
                <Button type="button" intent="secondary" onClick={handleIgnore} className="mt-3 w-full sm:mt-0 sm:w-auto">
                  {ignoreButtonText}
                </Button>
              )}

              {!onComplete && !onIgnore && (
                <Button type="button" intent="secondary" onClick={handleClose} className="w-full sm:w-auto">
                  Schließen
                </Button>
              )}
            </div>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
