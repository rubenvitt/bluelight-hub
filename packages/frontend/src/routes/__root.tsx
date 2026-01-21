import { Provider } from '@/shared/ui/headless/provider';
import { ConfirmProvider } from '@/shared/hooks/useConfirm';
import { useWindowOrientation } from '@/shared/hooks/useWindowOrientation';
import { handleQueryError } from '@/shared/lib/errors/error-handler';
import { setSetupRedirectInProgress } from '@/shared/lib/server-access-token';
import { useDeepLinkEffect } from '@/features/server/hooks/useDeepLinkEffect';
import { useLoadServers } from '@/features/server/hooks';
import { urlParamsSchema } from '@/features/server/schemas/url-params.schema';
import { useNotificationNavigation } from '@/features/reminders/hooks';

// Reset Setup-Redirect-Flag beim App-Start - ABER NICHT wenn wir auf /server/setup sind!
// Grund: Nach einem Full-Page-Redirect zu /server/setup (via window.location.href) wird die App
// komplett neu geladen. Wenn wir das Flag hier bedingungslos zuruecksetzen, ist es false
// BEVOR der /server/setup Route beforeLoad laufen kann. Background-Requests (React Query) koennten
// dann erneut 503 bekommen und handleServerNotSetup() triggern - was einen neuen Redirect
// startet obwohl wir gerade auf dem Weg zu /server/setup sind → Endlos-Loop.
//
// Loesung: Nur zuruecksetzen wenn wir NICHT auf /server/setup sind. Die /server/setup Route selbst
// setzt das Flag nach ihrem beforeLoad Check zurueck.
if (!window.location.pathname.startsWith('/server/setup')) {
  setSetupRedirectInProgress(false);
}
import { TanStackDevtools } from '@tanstack/react-devtools';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { Toaster } from 'sonner';

interface RootContext {
  pageTitle?: string;
}

export const Route = createRootRouteWithContext<RootContext>()({
  validateSearch: urlParamsSchema,
  component: RootComponent,
});

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: async (error, query) => {
      // Handle all query errors globally (with query context for 401 handling)
      await handleQueryError(error, query);

      // If it was a 401 error and token refresh was successful, retry the query
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        // Small delay to ensure cookies are updated
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: query.queryKey });
        }, 100);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: async (error) => {
      // Handle all mutation errors globally
      await handleQueryError(error);
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Try to get status from error if it's a ResponseError
        const response = (error as { response?: { status?: number; url: string } })?.response;
        const status = response?.status;

        // Check if this is an auth-related query with robust path boundary detection
        const isAuthQuery = !!response?.url && /\/auth(\/|$)/i.test(response.url);

        // Never retry auth-related queries
        if (isAuthQuery) {
          return false;
        }

        // Allow one retry for 401 errors (after token refresh) for non-auth queries
        if (status === 401) {
          return failureCount < 1;
        }
        // Don't retry on other 4xx client errors
        if (status && status >= 400 && status < 500) {
          return false;
        }
        // Don't retry on 503 - this is SERVER_NOT_SETUP, retrying won't help
        // fetchWithRefresh handles the redirect to /setup
        if (status === 503) {
          return false;
        }
        // Retry up to 2 times for other errors (502, 504, network errors)
        return failureCount < 2;
      },
      // Don't throw errors globally (we handle them in onError)
      throwOnError: false,
    },
    mutations: {
      retry: false,
      // Don't throw errors globally (we handle them in onError)
      throwOnError: false,
    },
  },
});

function RootComponent() {
  // Server Store Hydration - lädt Server-Konfiguration aus localStorage
  // MUSS vor anderen Server-abhängigen Hooks aufgerufen werden!
  useLoadServers();

  // Automatisches Fenster-Resizing basierend auf Route (nur in Tauri)
  useWindowOrientation();

  // Deep Link Integration für Desktop App
  useDeepLinkEffect();

  // Notification Navigation - registriert Callback für Deep Links bei Notification-Klick
  useNotificationNavigation();

  return (
    <Provider>
      <QueryClientProvider client={queryClient}>
        <ConfirmProvider>
          <Outlet />
          <div className="absolute">
            <TanStackDevtools
              plugins={[
                {
                  name: 'Tanstack Query',
                  render: <ReactQueryDevtoolsPanel />,
                },
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          </div>
          <Toaster duration={4000} position="bottom-right" closeButton theme="system" richColors />
        </ConfirmProvider>
      </QueryClientProvider>
    </Provider>
  );
}
