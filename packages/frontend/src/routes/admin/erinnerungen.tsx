import { createFileRoute } from '@tanstack/react-router';
import { ErinnerungSettingsPage } from '@/features/reminders/ui/pages/erinnerung-settings.page';

export const Route = createFileRoute('/admin/erinnerungen')({
  component: ErinnerungSettingsPage,
  meta: () => [{ title: 'Erinnerungs-Konfiguration' }],
});
