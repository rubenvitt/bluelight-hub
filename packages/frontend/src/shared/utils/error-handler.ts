import { logger } from '@/utils/logger';
import type { FetchError, ResponseError } from '@bluelight-hub/shared/client';
import { toast } from 'sonner';

// Track shown errors to prevent duplicates
const shownErrors = new WeakSet<Error>();

// Token refresh queue to prevent multiple simultaneous refreshes
class TokenRefreshQueue {
  private refreshPromise: Promise<boolean> | null = null;
  private isRefreshing = false;

  async startRefresh(refreshFn: () => Promise<boolean>): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = refreshFn().finally(() => {
      this.isRefreshing = false;
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  getIsRefreshing(): boolean {
    return this.isRefreshing;
  }

  reset(): void {
    this.isRefreshing = false;
    this.refreshPromise = null;
  }
}

const tokenRefreshQueue = new TokenRefreshQueue();

/**
 * Maps error types to user-friendly messages
 */
function getErrorMessage(error: unknown): string {
  // Handle ResponseError (API errors)
  if (error && typeof error === 'object' && 'response' in error) {
    const responseError = error as ResponseError;
    const status = responseError.response.status;

    // Don't show messages for 401 (handled separately)
    if (status === 401) {
      return '';
    }

    // Try to extract message from response body if available
    if (responseError.message) {
      return mapServerErrorMessage(responseError.message, status);
    }

    // Map status codes to user-friendly messages
    switch (status) {
      case 400:
        return 'Die Anfrage enthält ungültige Daten. Bitte überprüfen Sie Ihre Eingaben.';
      case 403:
        return 'Sie haben keine Berechtigung für diese Aktion.';
      case 404:
        return 'Die angeforderte Ressource wurde nicht gefunden.';
      case 409:
        return 'Es besteht ein Konflikt mit dem aktuellen Status. Bitte aktualisieren Sie die Seite.';
      case 422:
        return 'Die eingegebenen Daten konnten nicht verarbeitet werden.';
      case 429:
        return 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.';
      case 500:
        return 'Ein interner Serverfehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
      case 502:
      case 503:
      case 504:
        return 'Der Server ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut.';
      default:
        if (status >= 400 && status < 500) {
          return 'Ein Fehler ist aufgetreten. Bitte überprüfen Sie Ihre Eingaben.';
        }
        if (status >= 500) {
          return 'Ein Serverfehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
        }
        return 'Ein unerwarteter Fehler ist aufgetreten.';
    }
  }

  // Handle FetchError (network errors)
  if (error && typeof error === 'object' && 'cause' in error) {
    const fetchError = error as FetchError;
    const causeMessage = fetchError.cause.message;
    if (causeMessage.includes('NetworkError') || causeMessage.includes('Failed to fetch')) {
      return 'Netzwerkfehler: Bitte überprüfen Sie Ihre Internetverbindung.';
    }
    if (causeMessage.includes('timeout')) {
      return 'Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.';
    }
    return 'Verbindungsfehler: Der Server konnte nicht erreicht werden.';
  }

  // Handle generic Error objects
  if (error instanceof Error) {
    // Don't show technical error messages to users
    if (error.message.includes('Network')) {
      return 'Netzwerkfehler: Bitte überprüfen Sie Ihre Internetverbindung.';
    }
    if (error.message.includes('timeout')) {
      return 'Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.';
    }
  }

  return 'Ein unerwarteter Fehler ist aufgetreten.';
}

/**
 * Maps server error messages to user-friendly German messages
 */
function mapServerErrorMessage(message: string, status: number): string {
  const lowerMessage = message.toLowerCase();

  // Validation errors
  if (status === 400 || status === 422) {
    if (lowerMessage.includes('email')) {
      if (lowerMessage.includes('already') || lowerMessage.includes('exists')) {
        return 'Diese E-Mail-Adresse wird bereits verwendet.';
      }
      if (lowerMessage.includes('invalid') || lowerMessage.includes('format')) {
        return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
      }
    }
    if (lowerMessage.includes('password')) {
      if (lowerMessage.includes('short') || lowerMessage.includes('length')) {
        return 'Das Passwort muss mindestens 8 Zeichen lang sein.';
      }
      if (lowerMessage.includes('weak') || lowerMessage.includes('strong')) {
        return 'Das Passwort ist zu schwach. Bitte verwenden Sie Groß- und Kleinbuchstaben, Zahlen und Sonderzeichen.';
      }
      if (lowerMessage.includes('match')) {
        return 'Die Passwörter stimmen nicht überein.';
      }
    }
    if (lowerMessage.includes('required') || lowerMessage.includes('missing')) {
      return 'Bitte füllen Sie alle Pflichtfelder aus.';
    }
    if (lowerMessage.includes('invalid') || lowerMessage.includes('format')) {
      return 'Die eingegebenen Daten haben ein ungültiges Format.';
    }
  }

  // Authentication errors
  if (status === 401) {
    if (lowerMessage.includes('token') || lowerMessage.includes('expired')) {
      return 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.';
    }
    if (lowerMessage.includes('credentials') || lowerMessage.includes('invalid')) {
      return 'Ungültige Anmeldedaten. Bitte überprüfen Sie E-Mail und Passwort.';
    }
  }

  // Permission errors
  if (status === 403) {
    if (lowerMessage.includes('permission') || lowerMessage.includes('access')) {
      return 'Sie haben keine Berechtigung für diese Aktion.';
    }
    if (lowerMessage.includes('role')) {
      return 'Ihre Benutzerrolle erlaubt diese Aktion nicht.';
    }
  }

  // Resource errors
  if (status === 404) {
    if (lowerMessage.includes('user')) {
      return 'Der Benutzer wurde nicht gefunden.';
    }
    if (lowerMessage.includes('resource') || lowerMessage.includes('entity')) {
      return 'Die angeforderte Ressource wurde nicht gefunden.';
    }
  }

  // Conflict errors
  if (status === 409) {
    if (lowerMessage.includes('already exists')) {
      return 'Diese Ressource existiert bereits.';
    }
    if (lowerMessage.includes('conflict')) {
      return 'Es besteht ein Konflikt mit bestehenden Daten.';
    }
  }

  // If we can't map it, return the original message if it seems user-friendly
  // Otherwise return a generic message based on status
  if (message.length < 100 && !message.includes('Error:') && !message.includes('Exception')) {
    return message;
  }

  return getErrorMessage({ response: { status } } as ResponseError);
}

/**
 * Gets the error category for grouping similar errors
 */
function getErrorCategory(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as ResponseError).response.status;

    if (status === 401) return 'auth';
    if (status === 404) return 'not_found'; // 404 ist KEIN Validierungsfehler
    if (status === 400 || status === 422) return 'validation'; // Nur echte Validierungsfehler
    if (status >= 400 && status < 500) return 'client'; // Andere Client-Fehler
    if (status >= 500) return 'server';
  }

  if (error && typeof error === 'object' && 'cause' in error) {
    return 'network';
  }

  return 'unknown';
}

/**
 * Global error handler for React Query
 */
export async function handleQueryError(error: unknown, _query?: unknown): Promise<void> {
  // Skip if error was already shown
  if (error instanceof Error && shownErrors.has(error)) {
    return;
  }

  // Handle 401 errors with token refresh
  if (error && typeof error === 'object' && 'response' in error) {
    const responseError = error as ResponseError;
    const status = responseError.response.status;
    if (status === 401) {
      // Check if we're already on the auth page to prevent redirect loops
      const isOnAuthPage = window.location.pathname.startsWith('/auth');

      // Get the URL from the error response to check if it's an auth endpoint
      const errorUrl = responseError.response.url || '';
      const isAuthEndpoint = errorUrl.includes('/auth/refresh');

      if (isAuthEndpoint) {
        logger.warn('Auth endpoint failed with 401, not attempting refresh', { errorUrl });
        // Only redirect to login if we're not already there
        if (!isOnAuthPage) {
          // Delay redirect to avoid race conditions with other failing queries
          setTimeout(() => {
            if (!tokenRefreshQueue.getIsRefreshing()) {
              window.location.href = '/auth';
            }
          }, 100);
        }
        return;
      }

      // Don't attempt refresh if we're on the auth page
      if (isOnAuthPage) {
        logger.debug('On auth page, skipping token refresh attempt');
        return;
      }

      logger.warn('Token refresh failed, redirecting to login');
      tokenRefreshQueue.reset();

      // Show a toast before redirecting
      toast.warning('Sitzung abgelaufen', {
        description: 'Ihre Sitzung ist abgelaufen. Sie werden zur Anmeldung weitergeleitet.',
        duration: 3000,
      });

      // Small delay to let the toast show
      setTimeout(() => {
        window.location.href = '/auth';
      }, 500);
      return;
    }
  }

  const message = getErrorMessage(error);
  if (!message) return;

  const category = getErrorCategory(error);

  // Mark error as shown
  if (error instanceof Error) {
    shownErrors.add(error);
  }

  // Show toast based on category
  switch (category) {
    case 'not_found':
      // 404 Fehler werden NICHT als Toast gezeigt - sie sind oft erwartet
      // (z.B. ETB existiert noch nicht, Lagekarte existiert noch nicht)
      logger.debug('Resource not found (404) - kein Toast', { message });
      return; // KEIN Toast!

    case 'validation':
      toast.warning('Validierungsfehler', {
        description: message,
        duration: 6000,
      });
      break;
    case 'client':
      toast.warning('Anfragefehler', {
        description: message,
        duration: 6000,
      });
      break;
    case 'server':
      toast.error('Serverfehler', {
        description: message,
        duration: 8000,
        action: {
          label: 'Erneut versuchen',
          onClick: () => window.location.reload(),
        },
      });
      break;
    case 'network':
      toast.error('Verbindungsfehler', {
        description: message,
        duration: 8000,
        action: {
          label: 'Erneut versuchen',
          onClick: () => window.location.reload(),
        },
      });
      break;
    default:
      toast.error('Fehler', {
        description: message,
        duration: 6000,
      });
  }
}

/**
 * Reset token refresh handler (call on logout)
 */
export function resetTokenRefreshHandler(): void {
  tokenRefreshQueue.reset();
}
