import { Button } from '@atoms/button.atom';
import { Link } from '@tanstack/react-router';
import { PiArrowLeft, PiWarningCircle } from 'react-icons/pi';

interface ErrorStateProps {
  title?: string;
  description?: string;
  backLink?: string;
  backLinkText?: string;
}

export function ErrorState({ title = 'Fehler aufgetreten', description = 'Die angeforderten Daten konnten nicht geladen werden.', backLink = '/app', backLinkText = 'Zurück' }: ErrorStateProps) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <PiWarningCircle className="mx-auto h-16 w-16 text-red-500" />
        <p className="mt-4 font-medium text-gray-900 text-xl">{title}</p>
        <p className="mt-2 text-gray-600">{description}</p>
        <Link to={backLink} className="mt-6 inline-block">
          <Button>
            <PiArrowLeft className="mr-2 h-5 w-5" />
            {backLinkText}
          </Button>
        </Link>
      </div>
    </div>
  );
}
