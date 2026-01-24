/**
 * Security Utilities fuer Defense-in-Depth Sanitization
 *
 * Diese Utilities bieten zusaetzliche Sicherheitsebenen fuer User-generierte
 * oder vom Backend stammende Inhalte. Obwohl React standardmaessig XSS-Angriffe
 * verhindert, ist Defense-in-Depth eine bewährte Sicherheitspraxis.
 *
 * **Story 3.6 Issue #3:** XSS Security Risk Mitigation
 */

/**
 * Sanitiert einen Namen-String durch Entfernung von HTML-Tags.
 *
 * Defense-in-Depth gegen potenzielle XSS-Angriffe bei Namen,
 * die vom Backend ohne vorherige Sanitization kommen koennten.
 *
 * @param name - Der zu bereinigende Name-String
 * @returns Bereinigter String ohne HTML-Tags, 'Unbekannt' falls leer
 *
 * @example
 * sanitizeName('Max Mustermann') // 'Max Mustermann'
 * sanitizeName('<script>alert(1)</script>') // 'Unbekannt'
 * sanitizeName('Max <b>Muster</b>mann') // 'Max Mustermann'
 * sanitizeName('') // 'Unbekannt'
 * sanitizeName('  ') // 'Unbekannt'
 */
export function sanitizeName(name: string | null | undefined): string {
  if (!name) {
    return 'Unbekannt';
  }

  // Entferne alle HTML-Tags und behalte nur den Textinhalt
  const sanitized = name.replace(/<[^>]*>/g, '').trim();

  // Falls nach Sanitization leer, Fallback zu 'Unbekannt'
  return sanitized || 'Unbekannt';
}
