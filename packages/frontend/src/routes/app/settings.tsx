import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/app/settings')({
  component: SettingsLayout,
});

/**
 * Settings Layout - Wrapper für alle Settings-Pages
 */
function SettingsLayout() {
  return <Outlet />;
}
