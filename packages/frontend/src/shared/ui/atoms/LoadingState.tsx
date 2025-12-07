import { cn } from '@/utils/cn';
import { PiSpinner } from 'react-icons/pi';

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingState({ message = 'Lade Daten...', fullScreen = true }: LoadingStateProps) {
  return (
    <div className={cn('flex items-center justify-center', fullScreen ? 'h-screen' : 'h-96')}>
      <div className="text-center">
        <PiSpinner className="mx-auto h-12 w-12 animate-spin text-blue-600" />
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
}
