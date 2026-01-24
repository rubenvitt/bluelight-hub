/**
 * Tests fuer sanitizeName Utility
 *
 * Story 3.6 Issue #3: XSS Security Risk Mitigation
 */

import { describe, expect, it } from 'vitest';
import { sanitizeName } from '../sanitize';

describe('sanitizeName', () => {
  describe('basic sanitization', () => {
    it('should return the name unchanged for plain text', () => {
      expect(sanitizeName('Max Mustermann')).toBe('Max Mustermann');
    });

    it('should trim whitespace from the name', () => {
      expect(sanitizeName('  Max Mustermann  ')).toBe('Max Mustermann');
    });

    it('should handle names with special characters', () => {
      expect(sanitizeName("Max O'Brien")).toBe("Max O'Brien");
      expect(sanitizeName('Max Müller')).toBe('Max Müller');
      expect(sanitizeName('Jean-Pierre')).toBe('Jean-Pierre');
    });
  });

  describe('XSS prevention', () => {
    it('should remove script tags but keep text inside', () => {
      // Note: The regex removes tags but keeps inner text content
      // React's JSX would still escape this text, so this is Defense-in-Depth
      expect(sanitizeName('<script>alert("xss")</script>')).toBe('alert("xss")');
    });

    it('should remove script tags and keep surrounding text', () => {
      expect(sanitizeName('Max<script>alert(1)</script>Muster')).toBe('Maxalert(1)Muster');
    });

    it('should remove HTML tags and keep text content', () => {
      expect(sanitizeName('Max <b>Muster</b>mann')).toBe('Max Mustermann');
    });

    it('should remove img tags with onerror handlers', () => {
      expect(sanitizeName('<img src=x onerror=alert(1)>')).toBe('Unbekannt');
    });

    it('should remove iframe tags', () => {
      expect(sanitizeName('<iframe src="evil.com"></iframe>Max')).toBe('Max');
    });

    it('should handle nested tags', () => {
      expect(sanitizeName('<div><span>Max</span></div>')).toBe('Max');
    });

    it('should handle self-closing tags', () => {
      expect(sanitizeName('Max<br/>Muster')).toBe('MaxMuster');
    });

    it('should handle event handler attributes', () => {
      expect(sanitizeName('<a onclick="alert(1)">Click</a>')).toBe('Click');
    });
  });

  describe('null/undefined/empty handling', () => {
    it('should return "Unbekannt" for null', () => {
      expect(sanitizeName(null)).toBe('Unbekannt');
    });

    it('should return "Unbekannt" for undefined', () => {
      expect(sanitizeName(undefined)).toBe('Unbekannt');
    });

    it('should return "Unbekannt" for empty string', () => {
      expect(sanitizeName('')).toBe('Unbekannt');
    });

    it('should return "Unbekannt" for whitespace-only string', () => {
      expect(sanitizeName('   ')).toBe('Unbekannt');
    });

    it('should return "Unbekannt" when sanitization results in empty string', () => {
      expect(sanitizeName('<script></script>')).toBe('Unbekannt');
    });
  });

  describe('edge cases', () => {
    it('should handle multiple consecutive tags', () => {
      expect(sanitizeName('<b></b><i></i>Max')).toBe('Max');
    });

    it('should handle malformed tags', () => {
      // Unclosed tags should still be removed
      expect(sanitizeName('<script>alert(1)')).toBe('alert(1)');
      expect(sanitizeName('Max<b>bold')).toBe('Maxbold');
    });

    it('should handle angle brackets that are not tags', () => {
      // Mathematical expressions like "5 < 10" would be affected
      // but this is acceptable for name sanitization
      expect(sanitizeName('A > B')).toBe('A > B');
    });

    it('should handle encoded entities', () => {
      // HTML entities are not decoded, just passed through
      expect(sanitizeName('&lt;script&gt;')).toBe('&lt;script&gt;');
    });
  });
});
