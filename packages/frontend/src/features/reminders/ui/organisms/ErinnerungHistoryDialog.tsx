import { Dialog, Transition } from '@headlessui/react';
import type { ErinnerungResponseDto } from '@/shared';
import { Button } from '@/shared/ui/atoms/button.atom';
import { cn } from '@/shared/ui/cn';
import { format } from 'date-fns';
import { Fragment } from 'react';
import { PiCheck, PiClock, PiWarning, PiX } from 'react-icons/pi';

// TODO: Remove this extension once backend restart + generate-api works
interface ExtendedErinnerungResponseDto extends ErinnerungResponseDto {
  escalatedAt?: string | null;
  previousAssigneeName?: string | null;
  eskalationsPersonName?: string | null;
  ausgeloestAm?: string | null;
}

interface ErinnerungHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  erinnerung: ErinnerungResponseDto;
}

interface TimelineEvent {
  date: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  color: 'blue' | 'yellow' | 'red' | 'green' | 'gray';
  user?: string;
}

export function ErinnerungHistoryDialog({ isOpen, onClose, erinnerung }: ErinnerungHistoryDialogProps) {
  // Construct timeline from reminder state
  const events: TimelineEvent[] = [];

  // Created
  events.push({
    date: erinnerung.createdAt,
    title: 'Erstellt',
    description: `Status: GEPLANT`,
    icon: PiClock,
    color: 'blue',
    user: erinnerung.erstellerName || 'Unbekannt',
  });

  // Triggered (Ausgelöst)
  if (['AUSGELOEST', 'ACKNOWLEDGED', 'SNOOZED', 'ESKALIERT', 'ERLEDIGT'].includes(erinnerung.status)) {
    const extended = erinnerung as unknown as ExtendedErinnerungResponseDto;
    const triggerDate = extended.ausgeloestAm || erinnerung.faelligAm;

    // Check if intensified (trigger date > due date + 60s tolerance)
    const isIntensified = new Date(triggerDate).getTime() > new Date(erinnerung.faelligAm).getTime() + 60000;

    events.push({
      date: triggerDate,
      title: isIntensified ? 'Ausgelöst (Intensiviert)' : 'Ausgelöst',
      description: isIntensified ? 'Erinnerung erneut intensiviert (Keine Eskalation möglich)' : 'Erinnerungszeitpunkt erreicht',
      icon: PiWarning,
      color: 'red',
    });
  }

  // Escalated
  const extendedErinnerung = erinnerung as unknown as ExtendedErinnerungResponseDto;
  if (extendedErinnerung.escalatedAt) {
    events.push({
      date: extendedErinnerung.escalatedAt,
      title: 'Eskaliert',
      description: `Von ${extendedErinnerung.previousAssigneeName || 'Unbekannt'} an ${extendedErinnerung.eskalationsPersonName || 'Eskalationsperson'}`,
      icon: PiWarning,
      color: 'red',
      user: 'System', // Oder der User der eskaliert hat (via trigger/timeout)
    });
  }

  // Erledigt
  if (erinnerung.erledigtAm) {
    events.push({
      date: erinnerung.erledigtAm as string,
      title: 'Erledigt',
      description: erinnerung.erledigungsNotiz || undefined,
      icon: PiCheck,
      color: 'green',
      user: erinnerung.erledigtBy || undefined, // TODO: Name resolve via UserCache/Store or additional DTO field
    });
  }

  // Sort by date desc
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-800">
                <div className="flex items-center justify-between border-b pb-4 dark:border-gray-700">
                  <Dialog.Title as="h3" className="font-medium text-gray-900 text-lg leading-6 dark:text-white">
                    Verlauf
                  </Dialog.Title>
                  <Button appearance="ghost" size="sm" onClick={onClose} className="-mr-2 h-8 w-8 p-0">
                    <PiX className="h-5 w-5" />
                  </Button>
                </div>

                <div className="mt-4 flow-root">
                  <ul className="-mb-8">
                    {events.map((event, eventIdx) => (
                      <li key={`${event.date}-${eventIdx}`}>
                        <div className="relative pb-8">
                          {eventIdx !== events.length - 1 ? <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700" aria-hidden="true" /> : null}
                          <div className="relative flex space-x-3">
                            <div>
                              <span
                                className={cn(
                                  'flex h-8 w-8 items-center justify-center rounded-full ring-8 ring-white dark:ring-gray-800',
                                  event.color === 'blue' && 'bg-blue-500',
                                  event.color === 'red' && 'bg-red-500',
                                  event.color === 'green' && 'bg-green-500',
                                  event.color === 'yellow' && 'bg-yellow-500',
                                  event.color === 'gray' && 'bg-gray-500',
                                )}
                              >
                                <event.icon className="h-5 w-5 text-white" aria-hidden="true" />
                              </span>
                            </div>
                            <div className="flex min-w-0 flex-1 justify-between space-x-4">
                              <div>
                                <p className="font-medium text-gray-900 text-sm dark:text-gray-100">
                                  {event.title} {event.user && <span className="font-normal text-gray-500 dark:text-gray-400">durch {event.user}</span>}
                                </p>
                                {event.description && <p className="mt-0.5 text-gray-500 text-sm dark:text-gray-400">{event.description}</p>}
                              </div>
                              <div className="whitespace-nowrap text-right text-gray-500 text-sm dark:text-gray-400">
                                <time dateTime={event.date}>{format(new Date(event.date), 'HH:mm')}</time>
                                <div className="text-xs">{format(new Date(event.date), 'dd.MM.')}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 flex justify-end">
                  <Button appearance="outline" onClick={onClose}>
                    Schließen
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
