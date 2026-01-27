import { useCurrentUser, useAdminLogout } from '@/features/auth';
import { logger } from '@/shared/lib/logger';
import { Button } from '@/shared/ui/atoms/button.atom';
import { Heading } from '@/shared/ui/atoms/heading.atom';
import { Text } from '@/shared/ui/atoms/text.atom';
import { cn } from '@/shared/ui/cn';
import { useNavigate } from '@tanstack/react-router';
import { isTauri } from '@tauri-apps/api/core';
import { AdminDashboardLayout } from '@/shared/ui/templates/AdminDashboardLayout';
import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { PiCertificate, PiIdentificationBadge, PiSignOut, PiUsers, PiTruck, PiUserList, PiPlugsConnected, PiTicket, PiKey, PiCaretRight, PiBell } from 'react-icons/pi';

/**
 * Navigation-Card für Admin-Dashboard
 *
 * Klickbare Card mit Icon, Titel und Beschreibung für die Navigation
 * zu verschiedenen Admin-Bereichen.
 */
function NavCard({
  icon,
  title,
  description,
  onClick,
  accentColor = 'blue',
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  accentColor?: 'blue' | 'emerald' | 'violet' | 'amber';
}) {
  const accentStyles = {
    blue: 'group-hover:bg-blue-500/10 group-hover:text-blue-400 dark:group-hover:bg-blue-500/20',
    emerald: 'group-hover:bg-emerald-500/10 group-hover:text-emerald-400 dark:group-hover:bg-emerald-500/20',
    violet: 'group-hover:bg-violet-500/10 group-hover:text-violet-400 dark:group-hover:bg-violet-500/20',
    amber: 'group-hover:bg-amber-500/10 group-hover:text-amber-400 dark:group-hover:bg-amber-500/20',
  };

  const iconBgStyles = {
    blue: 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400',
    violet: 'bg-violet-500/10 text-violet-500 dark:bg-violet-500/20 dark:text-violet-400',
    amber: 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full cursor-pointer items-center gap-4 rounded-xl p-4 text-left transition-all duration-200',
        'bg-gray-50 dark:bg-gray-800/50',
        'hover:bg-gray-100 dark:hover:bg-gray-700/50',
        'border border-transparent hover:border-gray-200 dark:hover:border-gray-600',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900',
      )}
    >
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors duration-200', iconBgStyles[accentColor], accentStyles[accentColor])}>{icon}</div>
      <div className="min-w-0 flex-1">
        <Text as="span" className="block font-medium text-gray-900 dark:text-white">
          {title}
        </Text>
        <Text as="span" size="sm" color="muted" className="mt-0.5 block truncate">
          {description}
        </Text>
      </div>
      <PiCaretRight className="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300" />
    </button>
  );
}

/**
 * Sektion-Header für Admin-Dashboard
 */
function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <Text className="font-semibold text-gray-900 text-lg dark:text-white">{title}</Text>
      <Text size="sm" color="muted" className="mt-1">
        {description}
      </Text>
    </div>
  );
}

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

  return (
    <AdminDashboardLayout maxWidth="full">
      {/* Dashboard Header */}
      <div className="mb-2">
        <Heading size="xl" className="mb-1">
          Admin-Dashboard
        </Heading>
        <Text color="muted">
          Willkommen im Admin-Bereich, <span className="font-medium text-gray-700 dark:text-gray-300">{user?.username}</span>
        </Text>
      </div>

      {/* Admin-Funktionen */}
      <section>
        <SectionHeader title="Admin-Funktionen" description="Benutzer verwalten, Einstellungen konfigurieren und mehr" />
        <div className="grid gap-4 sm:grid-cols-2">
          <NavCard icon={<PiUsers className="h-6 w-6" />} title="Benutzerverwaltung" description="Benutzerkonten verwalten" onClick={() => navigate({ to: '/admin/users' })} accentColor="blue" />
          <NavCard
            icon={<PiCertificate className="h-6 w-6" />}
            title="Qualifikationen"
            description="Qualifikationen definieren"
            onClick={() => navigate({ to: '/admin/kraefte/qualifikationen' })}
            accentColor="blue"
          />
          <NavCard
            icon={<PiIdentificationBadge className="h-6 w-6" />}
            title="Rollen-Definitionen"
            description="Einsatzrollen konfigurieren"
            onClick={() => navigate({ to: '/admin/kraefte/rollen-definitionen' })}
            accentColor="blue"
          />
          <NavCard icon={<PiTicket className="h-6 w-6" />} title="Invite-Codes" description="Einladungen verwalten" onClick={() => navigate({ to: '/admin/invites' })} accentColor="blue" />
          <NavCard icon={<PiKey className="h-6 w-6" />} title="Access-Tokens" description="API-Zugriff verwalten" onClick={() => navigate({ to: '/admin/tokens' })} accentColor="blue" />
          <NavCard
            icon={<PiBell className="h-6 w-6" />}
            title="Erinnerungen"
            description="Timeouts & globale Einstellungen"
            onClick={() => navigate({ to: '/admin/erinnerungen' })}
            accentColor="blue"
          />
        </div>
      </section>

      {/* Stammdaten */}
      <section>
        <SectionHeader title="Stammdaten" description="Fahrzeuge und Personal Ihrer Organisation verwalten" />
        <div className="grid gap-4 sm:grid-cols-2">
          <NavCard
            icon={<PiTruck className="h-6 w-6" />}
            title="Stamm-Fahrzeuge"
            description="Fahrzeugflotte verwalten"
            onClick={() => navigate({ to: '/admin/stammdaten/fahrzeuge' })}
            accentColor="emerald"
          />
          <NavCard
            icon={<PiUserList className="h-6 w-6" />}
            title="Stamm-Personen"
            description="Personal verwalten"
            onClick={() => navigate({ to: '/admin/stammdaten/personen' })}
            accentColor="emerald"
          />
        </div>
      </section>

      {/* Integrationen */}
      <section>
        <SectionHeader title="Integrationen" description="Externe Systeme für den Datenimport verbinden" />
        <div className="grid gap-4 sm:grid-cols-2">
          <NavCard
            icon={<PiPlugsConnected className="h-6 w-6" />}
            title="HiOrg-Server"
            description="HiOrg-Server Anbindung"
            onClick={() => navigate({ to: '/admin/integrations/hiorg' })}
            accentColor="violet"
          />
        </div>
      </section>

      {/* Logout Section */}
      <div className="border-gray-200 border-t pt-4 dark:border-gray-700">
        <Button appearance="ghost" intent="danger" size="sm" onClick={handleLogout}>
          <PiSignOut className="mr-2" />
          Admin-Bereich verlassen
        </Button>
      </div>
    </AdminDashboardLayout>
  );
}
