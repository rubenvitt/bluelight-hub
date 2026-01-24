import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AudioSettingsPage } from '@/features/settings';

export const Route = createFileRoute('/app/settings/audio')({
  component: AudioSettingsRoute,
});

/**
 * Audio Settings Route - Story 2.7
 *
 * Route: /app/settings/audio
 */
function AudioSettingsRoute() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate({ to: '/app/einsaetze' });
  };

  return <AudioSettingsPage onBack={handleBack} />;
}
