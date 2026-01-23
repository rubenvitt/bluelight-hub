/**
 * Startseite der Anwendung.
 *
 * Zeigt die Begrüßung und den Color-Mode-Button.
 *
 * @returns Die Index-Page-Komponente
 */
import { isAdmin, useCurrentUser, useLogout } from '@/features/auth';
import { EinsatzDashboard } from '@/features/einsatz/ui/organisms/EinsatzDashboard';
import { useActiveServer } from '@/features/server/hooks';
import { ServerNameBadge } from '@/features/server/ui/atoms';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Heading } from '@/shared/ui/atoms/heading.atom';
import { Spinner } from '@/shared/ui/atoms/spinner.atom';
import { Text } from '@/shared/ui/atoms/text.atom';
import { ColorModeMenu } from '@/shared/ui/molecules/color-mode-menu.molecule';
import { Link, useRouter } from '@tanstack/react-router';
import { PiGear, PiShieldCheck, PiSignIn } from 'react-icons/pi';

export function IndexPage() {
  const { isLoading, user, adminStatus } = useCurrentUser();
  const logout = useLogout();
  const { navigate } = useRouter();
  const activeServer = useActiveServer();

  // Admin-Fenster öffnen Handler
  const handleOpenAdminWindow = async () => {
    const { openAdminWindow } = await import('@/services/windowService');
    await openAdminWindow();
  };

  // WICHTIG: Warte immer auf den initialen Auth-Check bevor wir weiterleiten
  // Dies verhindert Race Conditions beim Page Reload
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Spinner size="lg" className="text-red-500" />
        <Text color="muted">Authentifizierung wird geladen...</Text>
      </div>
    );
  }

  // Nach dem Loading: Prüfe, ob der User vorhanden ist.
  // Nur weiterleiten, wenn wirklich kein User da ist nach dem Auth-Check
  if (!user) {
    void navigate({
      to: '/auth',
    });
    return null;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <Heading size="2xl" as="h1">
                Willkommen bei BlueLight Hub
              </Heading>
              <Text color="muted">Sie sind angemeldet als: {user.username}</Text>
            </div>
            {activeServer && <ServerNameBadge name={activeServer.name} />}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:grid lg:gap-6">
          <div className="flex h-full min-h-0 flex-col overflow-hidden lg:col-span-2">
            <EinsatzDashboard />
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center justify-between pt-4">
          <div className="flex items-center gap-4">
            <Button appearance="outline" intent="danger" size="sm" onClick={() => logout.mutateAsync()}>
              Abmelden
            </Button>
            <ColorModeMenu placement="top" />
            <Link to="/app/settings/audio">
              <Button appearance="ghost" size="sm" title="Audio-Einstellungen">
                <PiGear className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="flex gap-2">
            {/* Admin Setup Link - nur anzeigen wenn adminSetupAvailable true ist */}
            {adminStatus?.adminSetupAvailable && (
              <Button intent="primary" size="sm" onClick={handleOpenAdminWindow}>
                <PiShieldCheck className="mr-2" />
                Admin-Setup
              </Button>
            )}

            {/* Admin-Bereich Button für berechtigte Benutzer */}
            {isAdmin(user.role) && !adminStatus?.adminSetupAvailable && (
              <Button appearance="outline" intent="secondary" size="sm" onClick={handleOpenAdminWindow} title="Admin-Dashboard in separatem Fenster öffnen">
                <PiSignIn className="mr-2" />
                Admin-Bereich
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
