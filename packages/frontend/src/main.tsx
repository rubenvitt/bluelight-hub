import '@fontsource-variable/nunito/index.css';
import './index.tailwind.css';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { routeTree } from '@/routeTree.gen';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { cleanupExpiredTiles } from '@/shared/lib/storage/offline-cleanup';
import { QueryProvider } from '@/provider/query-client.provider';
import { logger } from '@/shared/lib/logger';
import { initializeNotificationSetup, requestNotificationPermission } from '@/features/reminders/services';
import { initSeenAssignmentsStore } from '@/features/reminders/stores';

// Initialize offline tile cleanup on app startup
cleanupExpiredTiles('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').catch((error) => {
  logger.error('[App-Startup] Offline-Cleanup fehlgeschlagen', { error });
});

// Initialize notification system (channels, action types) and request permission
// Runs async in background - errors are logged but don't block app startup
initializeNotificationSetup()
  .then(() => {
    logger.info('[App-Startup] Notification Setup initialisiert');
    // Request permission after setup is complete
    return requestNotificationPermission();
  })
  .then((status) => {
    logger.info('[App-Startup] Notification Permission Status:', status);
  })
  .catch((error) => {
    logger.error('[App-Startup] Notification Setup fehlgeschlagen', { error });
  });

// Initialize seen assignments store (Story 3.7) - Loads persisted data from Tauri Store
initSeenAssignmentsStore()
  .then(() => logger.info('[App-Startup] Seen Assignments Store initialisiert'))
  .catch((error) => logger.error('[App-Startup] Seen Assignments Store Init fehlgeschlagen', { error }));

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  <StrictMode>
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  </StrictMode>,
);
