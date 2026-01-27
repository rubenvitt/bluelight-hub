import { milliseconds } from 'date-fns';
import type { Response } from 'express';

/**
 * Cookie-Konfigurationsoptionen für Authentifizierungs-Cookies
 */
export interface AuthCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  path: string;
}

/**
 * Gibt die Standard-Cookie-Optionen für Access-Tokens zurück
 *
 * @param isProduction - Ob die Anwendung in Produktion läuft
 * @param isHttps - Ob HTTPS aktiviert ist (z.B. auch in Dev)
 * @returns Cookie-Optionen für Access-Tokens
 */
export function getAccessTokenCookieOptions(isProduction: boolean, isHttps: boolean): AuthCookieOptions {
  const isSecure = isProduction || isHttps;
  // Wenn secure (HTTPS), dann 'none' um Cross-Site (z.B. Tauri/Localhost-Ports) zu erlauben.
  // Sonst 'lax' (Standard für HTTP).
  const sameSite = isSecure ? 'none' : 'lax';

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: sameSite,
    maxAge: milliseconds({ minutes: 15 }),
    path: '/',
  };
}

/**
 * Gibt die Standard-Cookie-Optionen für Refresh-Tokens zurück
 *
 * @param isProduction - Ob die Anwendung in Produktion läuft
 * @param isHttps - Ob HTTPS aktiviert ist (z.B. auch in Dev)
 * @returns Cookie-Optionen für Refresh-Tokens
 */
export function getRefreshTokenCookieOptions(isProduction: boolean, isHttps: boolean): AuthCookieOptions {
  const isSecure = isProduction || isHttps;
  const sameSite = isSecure ? 'none' : 'lax';

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: sameSite,
    maxAge: milliseconds({ days: 7 }),
    path: '/',
  };
}

/**
 * Setzt Authentifizierungs-Cookies in der Response
 *
 * @param res - Express Response-Objekt
 * @param accessToken - Das Access-Token
 * @param refreshToken - Das Refresh-Token
 * @param isProduction - Ob die Anwendung in Produktion läuft
 * @param isHttps - Ob HTTPS aktiviert ist
 */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string, isProduction: boolean = false, isHttps: boolean = false): void {
  res.cookie('accessToken', accessToken, getAccessTokenCookieOptions(isProduction, isHttps));
  res.cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions(isProduction, isHttps));
}

/**
 * Löscht Authentifizierungs-Cookies aus der Response
 *
 * @param res - Express Response-Objekt
 * @param isProduction - Ob die Anwendung in Produktion läuft
 * @param isHttps - Ob HTTPS aktiviert ist
 */
export function clearAuthCookies(res: Response, isProduction: boolean = false, isHttps: boolean = false): void {
  res.clearCookie('accessToken', {
    ...getAccessTokenCookieOptions(isProduction, isHttps),
  });
  res.clearCookie('refreshToken', {
    ...getRefreshTokenCookieOptions(isProduction, isHttps),
  });
  res.clearCookie('adminToken', {
    ...getAdminTokenCookieOptions(isProduction, isHttps),
  });
}

/**
 * Gibt die Standard-Cookie-Optionen für Admin-Tokens zurück
 *
 * @param isProduction - Ob die Anwendung in Produktion läuft
 * @param isHttps - Ob HTTPS aktiviert ist
 * @returns Cookie-Optionen für Admin-Tokens
 */
function getAdminTokenCookieOptions(isProduction: boolean, isHttps: boolean): AuthCookieOptions {
  const isSecure = isProduction || isHttps;
  const sameSite = isSecure ? 'none' : 'lax';

  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: sameSite,
    maxAge: milliseconds({ minutes: 15 }), // 15 Minuten - Sicherheitsfeature
    path: '/',
  };
}

/**
 * Setzt ein Admin-Token als HttpOnly-Cookie
 *
 * @param res - Express Response-Objekt
 * @param adminToken - Das Admin-Token
 * @param isProduction - Ob die Anwendung in Produktion läuft
 * @param isHttps - Ob HTTPS aktiviert ist
 */
export function setAdminCookie(res: Response, adminToken: string, isProduction: boolean = false, isHttps: boolean = false): void {
  res.cookie('adminToken', adminToken, getAdminTokenCookieOptions(isProduction, isHttps));
}

/**
 * Löscht das Admin-Token-Cookie aus der Response
 *
 * @param res - Express Response-Objekt
 * @param isProduction - Ob die Anwendung in Produktion läuft
 * @param isHttps - Ob HTTPS aktiviert ist
 */
export function clearAdminCookie(res: Response, isProduction: boolean = false, isHttps: boolean = false): void {
  res.clearCookie('adminToken', {
    ...getAdminTokenCookieOptions(isProduction, isHttps),
  });
}
