/**
 * Remove trailing slashes from a URL/base path to avoid double slashes
 * when concatenating with route fragments like '/api'.
 */
export function trimTrailingSlash(input: string | undefined | null): string {
  if (!input) return '';
  return input.replace(/\/+$/g, '');
}
