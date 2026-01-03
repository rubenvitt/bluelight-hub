import { useCurrentUser, useAdminLogout } from '@/features/auth';
import { logger } from '@/shared/lib/logger';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Card } from '@/shared/ui/atoms/card.atom';
import { Heading } from '@/shared/ui/atoms/heading.atom';
import { Text } from '@/shared/ui/atoms/text.atom';
import { useNavigate } from '@tanstack/react-router';
import { isTauri } from '@tauri-apps/api/core';
import { AdminDashboardLayout } from '@/shared/ui/templates/AdminDashboardLayout';
import { useCallback } from 'react';
import { PiCertificate, PiIdentificationBadge, PiPlugsConnected, PiSignOut, PiUsers, PiTruck, PiUserList } from 'react-icons/pi';

/**
 * Admin-Dashboard Seite
 *
 * Zentrale Verwaltungsseite für Administratoren mit Zugriff auf
 * Benutzerverwaltung und andere administrative Funktionen.
 * Nutzt das DashboardLayout für konsistente Darstellung.
 */
export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const logoutAdmin = useAdminLogout();

  const handleLogout = useCallback(async () => {
    await logoutAdmin.mutateAsync();

    // In Tauri: Fenster schließen
    if (isTauri()) {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const currentWindow = getCurrentWebviewWindow();
        await currentWindow.close();
      } catch (error) {
        logger.error('Fehler beim Schließen des Admin-Fensters:', error);
        // Fallback: zur Startseite navigieren
        await navigate({ to: '/' });
      }
    } else {
      // Im Browser: zur Startseite navigieren
      await navigate({ to: '/' });
    }
  }, [logoutAdmin, navigate]);

  const handleNavigateToUsers = useCallback(async () => {
    await navigate({ to: '/admin/users' });
  }, [navigate]);

  const handleNavigateToQualifikationen = useCallback(async () => {
    await navigate({ to: '/admin/kraefte/qualifikationen' });
  }, [navigate]);

  const handleNavigateToRollenDefinitionen = useCallback(async () => {
    await navigate({ to: '/admin/kraefte/rollen-definitionen' });
  }, [navigate]);

  const handleNavigateToStammFahrzeuge = useCallback(async () => {
    await navigate({ to: '/admin/stammdaten/fahrzeuge' });
  }, [navigate]);

  const handleNavigateToStammPersonen = useCallback(async () => {
    await navigate({ to: '/admin/stammdaten/personen' });
  }, [navigate]);

  const handleNavigateToHiOrgIntegration = useCallback(async () => {
    await navigate({ to: '/admin/integrations/hiorg' });
  }, [navigate]);

  return (
    <AdminDashboardLayout maxWidth="lg">
      {/* Dashboard Header */}
      <div>
        <Heading size="xl" className="mb-2">
          Admin-Dashboard
        </Heading>
        <Text color="muted">Willkommen im Admin-Bereich, {user?.username}</Text>
      </div>

      {/* Admin Functions Card */}
      <Card padding="md">
        <div className="flex flex-col items-start gap-4">
          <div>
            <Text className="font-semibold text-lg">Admin-Funktionen</Text>
            <Text size="sm" color="muted" className="mt-1">
              Hier können Sie Benutzer verwalten, Einstellungen konfigurieren und mehr.
            </Text>
          </div>

          <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
            <Button intent="primary" size="md" onClick={handleNavigateToUsers} fullWidth>
              <PiUsers className="mr-2" />
              Benutzerverwaltung
            </Button>
            <Button intent="primary" size="md" onClick={handleNavigateToQualifikationen} fullWidth>
              <PiCertificate className="mr-2" />
              Qualifikationen
            </Button>
            <Button intent="primary" size="md" onClick={handleNavigateToRollenDefinitionen} fullWidth>
              <PiIdentificationBadge className="mr-2" />
              Rollen-Definitionen
            </Button>
          </div>
        </div>
      </Card>

      {/* Stammdaten Card */}
      <Card padding="md">
        <div className="flex flex-col items-start gap-4">
          <div>
            <Text className="font-semibold text-lg">Stammdaten</Text>
            <Text size="sm" color="muted" className="mt-1">
              Verwalten Sie Fahrzeuge und Personen Ihrer Organisation.
            </Text>
          </div>

          <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <Button intent="primary" size="md" onClick={handleNavigateToStammFahrzeuge} fullWidth>
              <PiTruck className="mr-2" />
              Stamm-Fahrzeuge
            </Button>
            <Button intent="primary" size="md" onClick={handleNavigateToStammPersonen} fullWidth>
              <PiUserList className="mr-2" />
              Stamm-Personen
            </Button>
          </div>
        </div>
      </Card>

      {/* Integrationen Card */}
      <Card padding="md">
        <div className="flex flex-col items-start gap-4">
          <div>
            <Text className="font-semibold text-lg">Integrationen</Text>
            <Text size="sm" color="muted" className="mt-1">
              Verbinden Sie externe Systeme wie HiOrg-Server.
            </Text>
          </div>

          <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <Button intent="primary" size="md" onClick={handleNavigateToHiOrgIntegration} fullWidth>
              <PiPlugsConnected className="mr-2" />
              HiOrg-Server
            </Button>
          </div>
        </div>
      </Card>

      {/* Logout Section */}
      <div>
        <Button appearance="ghost" intent="danger" size="sm" onClick={handleLogout}>
          <PiSignOut className="mr-2" />
          Admin-Bereich verlassen
        </Button>
      </div>
    </AdminDashboardLayout>
  );
}
