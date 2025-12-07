import { Store } from '@tanstack/react-store';

/**
 * Auth Store State Interface
 *
 * Speichert UI-relevante Auth-State (nicht für Token-Management!).
 * Token werden server-seitig via Cookies verwaltet.
 */
interface AuthStoreState {
  /**
   * Letzter bekannter Auth-Status (für optimistic UI updates)
   */
  lastKnownAuthStatus: 'authenticated' | 'unauthenticated' | 'checking';

  /**
   * Zeigt Modal für Re-Authentication an
   */
  showReauthModal: boolean;

  /**
   * Redirect-URL nach erfolgreichem Login
   */
  redirectAfterLogin?: string;
}

/**
 * Initial Store State
 */
const initialState: AuthStoreState = {
  lastKnownAuthStatus: 'checking',
  showReauthModal: false,
  redirectAfterLogin: undefined,
};

/**
 * Auth Store
 *
 * Verwaltet UI-State für Authentication.
 * NICHT für Token-Storage (wird via HTTP-Only Cookies gehandhabt).
 *
 * @example
 * ```tsx
 * import { authStore } from '@/features/auth/stores';
 *
 * // Auth-Status setzen
 * authStore.setState((state) => ({
 *   ...state,
 *   lastKnownAuthStatus: 'authenticated',
 * }));
 *
 * // Re-Auth Modal anzeigen
 * authStore.setState((state) => ({
 *   ...state,
 *   showReauthModal: true,
 * }));
 * ```
 */
export const authStore = new Store<AuthStoreState>(initialState);

/**
 * Helper: Auth-Status setzen
 */
export const setAuthStatus = (status: AuthStoreState['lastKnownAuthStatus']) => {
  authStore.setState((state) => ({
    ...state,
    lastKnownAuthStatus: status,
  }));
};

/**
 * Helper: Re-Auth Modal anzeigen/verstecken
 */
export const setShowReauthModal = (show: boolean) => {
  authStore.setState((state) => ({
    ...state,
    showReauthModal: show,
  }));
};

/**
 * Helper: Redirect-URL setzen
 */
export const setRedirectAfterLogin = (url?: string) => {
  authStore.setState((state) => ({
    ...state,
    redirectAfterLogin: url,
  }));
};

/**
 * Helper: Store zurücksetzen (z.B. bei Logout)
 */
export const resetAuthStore = () => {
  authStore.setState(initialState);
};
