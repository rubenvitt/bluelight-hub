import { logger } from '@/utils/logger';
import { ResponseError } from '@bluelight-hub/shared/client';

/**
 * Structured error response from the API
 */
interface ApiErrorResponse {
  message?: string;
  statusCode?: number;
  error?: string;
  code?: string; // Custom error code for specific business logic errors
}

/**
 * Context type for API error handling
 */
export type ApiErrorContext =
  | 'createUser'
  | 'deleteUser'
  | 'updateUser'
  | 'adminSetup'
  | 'adminLogin'
  | 'userLogin'
  | 'userRegister'
  | 'userAuth'
  | 'createEinsatz'
  | 'updateEinsatz'
  | 'archiveEinsatz'
  | 'createEtb'
  | 'updateEtb'
  | 'deleteEtb'
  | 'createEtbEintrag'
  | 'updateEtbEintrag'
  | 'deleteEtbEintrag';

/**
 * Error message mappings based on HTTP status codes and error codes
 */
const ERROR_MESSAGES: Record<number, Record<string, string>> = {
  400: {
    default: 'Ungültige Anfrage. Bitte überprüfen Sie Ihre Eingaben.',
    VALIDATION_ERROR: 'Die eingegebenen Daten sind ungültig.',
  },
  401: {
    default: 'Sie sind nicht authentifiziert. Bitte melden Sie sich erneut an.',
    TOKEN_EXPIRED: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
    REFRESH_FAILED: 'Die Sitzung konnte nicht verlängert werden. Bitte melden Sie sich erneut an.',
  },
  403: {
    default: 'Sie haben keine Berechtigung für diese Aktion.',
    SUPER_ADMIN_PROTECTED: 'Der letzte Super-Admin kann nicht gelöscht oder geändert werden.',
    CANNOT_MODIFY_SUPER_ADMIN: 'Super-Admin-Benutzer können nicht modifiziert werden.',
  },
  404: {
    default: 'Die angeforderte Ressource wurde nicht gefunden.',
    USER_NOT_FOUND: 'Der Benutzer wurde nicht gefunden.',
  },
  409: {
    default: 'Es besteht ein Konflikt mit dem aktuellen Status.',
    USER_EXISTS: 'Ein Benutzer mit diesem Namen existiert bereits.',
    DUPLICATE_ENTRY: 'Dieser Eintrag existiert bereits.',
  },
  422: {
    default: 'Die Daten konnten nicht verarbeitet werden.',
  },
  500: {
    default: 'Ein interner Serverfehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
  },
  502: {
    default: 'Der Server ist vorübergehend nicht erreichbar.',
  },
  503: {
    default: 'Der Dienst ist vorübergehend nicht verfügbar.',
  },
};

/**
 * Extracts and formats a user-friendly error message from an API error
 *
 * This utility provides status code-based error handling with fallback to
 * structured error codes from the API response body. It avoids fragile
 * string matching by using HTTP status codes and structured error codes.
 *
 * @param error - The error object (typically a ResponseError)
 * @param fallbackMessage - Default message if no specific mapping is found
 * @param context - Optional context for error-specific messages (e.g., 'createUser', 'deleteUser')
 * @returns Promise resolving to a user-friendly error message
 */
export async function getApiErrorMessage(error: unknown, fallbackMessage: string, context?: ApiErrorContext): Promise<string> {
  // Handle non-ResponseError cases
  if (!(error instanceof ResponseError)) {
    if (error instanceof Error) {
      logger.warn('Non-ResponseError encountered', { error: error.message });
      return error.message;
    }
    return fallbackMessage;
  }

  try {
    const status = error.response.status;
    let errorData: ApiErrorResponse | undefined;

    // Try to parse the response body for structured error information
    try {
      const clonedResponse = error.response.clone();
      errorData = await clonedResponse.json();
    } catch (parseError) {
      logger.warn('Failed to parse error response body', { parseError });
    }

    // Check for context-specific messages first
    if (context && errorData) {
      const contextMessage = getContextSpecificMessage(status, errorData, context);
      if (contextMessage) {
        return contextMessage;
      }
    }

    // Look up message by status code and error code
    const statusMessages = ERROR_MESSAGES[status];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (statusMessages) {
      // Try to find a message for the specific error code
      if (errorData?.code && statusMessages[errorData.code]) {
        return statusMessages[errorData.code];
      }

      // Check for specific patterns in the error message for backward compatibility
      // but using status code as the primary discriminator
      if (errorData?.message) {
        const lowerMessage = errorData.message.toLowerCase();

        if (status === 409) {
          if (lowerMessage.includes('duplicate') || lowerMessage.includes('unique') || lowerMessage.includes('exists')) {
            return statusMessages.USER_EXISTS || statusMessages.DUPLICATE_ENTRY || statusMessages.default;
          }
        }

        if (status === 403) {
          if (lowerMessage.includes('super-admin') || lowerMessage.includes('super admin')) {
            return statusMessages.SUPER_ADMIN_PROTECTED || statusMessages.default;
          }
        }
      }

      // Fall back to default message for this status code
      return statusMessages.default;
    }

    // If we have a parsed message from the API, use it
    if (errorData?.message) {
      return errorData.message;
    }

    // Last resort: use the fallback message
    return fallbackMessage;
  } catch (err) {
    logger.error('Error in getApiErrorMessage', err);
    return fallbackMessage;
  }
}

/**
 * Gets context-specific error messages based on the operation being performed
 */
function getContextSpecificMessage(status: number, errorData: ApiErrorResponse, context: ApiErrorContext): string | null {
  switch (context) {
    case 'createUser':
      if (status === 409) {
        return 'Ein Benutzer mit diesem Namen existiert bereits.';
      }
      break;

    case 'deleteUser':
      if (status === 403 && errorData.code === 'SUPER_ADMIN_PROTECTED') {
        return 'Der letzte Super-Admin kann nicht gelöscht werden.';
      }
      if (status === 404) {
        return 'Der zu löschende Benutzer wurde nicht gefunden.';
      }
      break;

    case 'updateUser':
      if (status === 403) {
        return 'Sie haben keine Berechtigung, diesen Benutzer zu bearbeiten.';
      }
      if (status === 404) {
        return 'Der zu bearbeitende Benutzer wurde nicht gefunden.';
      }
      break;

    case 'adminSetup':
      if (status === 409) {
        return 'Ein Administrator wurde bereits eingerichtet. Bitte melden Sie sich mit dem bestehenden Admin-Konto an.';
      }
      if (status === 401) {
        return 'Sie sind nicht angemeldet. Bitte melden Sie sich zuerst an.';
      }
      if (status === 403) {
        return 'Sie haben keine Berechtigung, einen Admin-Account einzurichten.';
      }
      break;

    case 'adminLogin':
      if (status === 401 || status === 400) {
        return 'Ungültiges Administrator-Passwort.';
      }
      if (status === 403) {
        return 'Sie haben keine Administratorrechte.';
      }
      break;

    case 'userLogin':
      if (status === 404) {
        return 'Benutzer nicht gefunden. Bitte überprüfen Sie den Benutzernamen.';
      }
      if (status === 401) {
        return 'Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.';
      }
      break;

    case 'userRegister':
      if (status === 409) {
        return 'Dieser Benutzername ist bereits vergeben. Bitte wählen Sie einen anderen.';
      }
      if (status === 400) {
        return 'Ungültige Eingabe. Bitte überprüfen Sie den Benutzernamen.';
      }
      break;

    case 'userAuth':
      // Unified authentication endpoint that handles both login and registration
      if (status === 401) {
        // Bevorzuge spezifische Backend-Messages (z.B. Sperrgrund bei gesperrten Accounts)
        if (errorData.message?.includes('gesperrt')) {
          return errorData.message;
        }
        return 'Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Eingaben.';
      }
      if (status === 409) {
        return 'Der Benutzername ist bereits vergeben. Bitte wählen Sie einen anderen.';
      }
      if (status === 400) {
        return 'Ungültige Eingabe. Bitte überprüfen Sie Ihren Benutzernamen.';
      }
      if (status === 403) {
        return 'Sie haben keine Berechtigung für diese Aktion.';
      }
      if (status === 500) {
        return 'Ein Serverfehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
      }
      break;

    case 'createEinsatz':
      if (status === 400) {
        return 'Beim Erstellen des Einsatzes ist ein Validierungsfehler aufgetreten.';
      }
      break;

    case 'updateEinsatz':
      if (status === 400) {
        return 'Beim Aktualisieren des Einsatzes ist ein Validierungsfehler aufgetreten.';
      }
      break;

    case 'archiveEinsatz':
      if (status === 400) {
        return 'Beim Archivieren des Einsatzes ist ein Validierungsfehler aufgetreten.';
      }
      break;

    case 'createEtb':
      if (status === 400) {
        return 'Beim Erstellen des Einsatztagebuchs ist ein Validierungsfehler aufgetreten.';
      }
      if (status === 409) {
        return 'Ein Einsatztagebuch existiert bereits für diesen Einsatz.';
      }
      break;

    case 'updateEtb':
      if (status === 400) {
        return 'Beim Aktualisieren des Einsatztagebuchs ist ein Validierungsfehler aufgetreten.';
      }
      if (status === 404) {
        return 'Das Einsatztagebuch wurde nicht gefunden.';
      }
      break;

    case 'deleteEtb':
      if (status === 404) {
        return 'Das zu löschende Einsatztagebuch wurde nicht gefunden.';
      }
      if (status === 403) {
        return 'Sie haben keine Berechtigung, dieses Einsatztagebuch zu löschen.';
      }
      break;

    case 'createEtbEintrag':
      if (status === 400) {
        return 'Beim Erstellen des ETB-Eintrags ist ein Validierungsfehler aufgetreten.';
      }
      if (status === 404) {
        return 'Das zugehörige Einsatztagebuch wurde nicht gefunden.';
      }
      break;

    case 'updateEtbEintrag':
      if (status === 400) {
        return 'Beim Aktualisieren des ETB-Eintrags ist ein Validierungsfehler aufgetreten.';
      }
      if (status === 404) {
        return 'Der ETB-Eintrag wurde nicht gefunden.';
      }
      break;

    case 'deleteEtbEintrag':
      if (status === 404) {
        return 'Der zu löschende ETB-Eintrag wurde nicht gefunden.';
      }
      if (status === 403) {
        return 'Sie haben keine Berechtigung, diesen ETB-Eintrag zu löschen.';
      }
  }

  return null;
}

/**
 * Checks if an error is a specific type based on status code
 */
export function isErrorType(error: unknown, statusCode: number): boolean {
  return error instanceof ResponseError && error.response.status === statusCode;
}

/**
 * Prüft ob ein Fehler ein Token-Refresh-Fehler ist
 */
export function isTokenRefreshError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message === 'Token refresh failed' || error.message === 'Authentication failed after refresh';
}

/**
 * Common error type checks for convenience
 */
export const errorChecks = {
  isConflict: (error: unknown) => isErrorType(error, 409),
  isForbidden: (error: unknown) => isErrorType(error, 403),
  isNotFound: (error: unknown) => isErrorType(error, 404),
  isUnauthorized: (error: unknown) => isErrorType(error, 401),
  isBadRequest: (error: unknown) => isErrorType(error, 400),
  isServerError: (error: unknown) => {
    if (!(error instanceof ResponseError)) return false;
    return error.response.status >= 500;
  },
  isTokenRefreshError,
};
