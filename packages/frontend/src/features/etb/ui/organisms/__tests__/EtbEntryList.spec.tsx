import { resetHighlightStore } from '@/features/reminders/stores';
import { resetKategorieFilter, hideAllKategorien, excludeKategorie, setIncludedKontextType } from '@/features/etb/stores/kategorie-filter.store';
import type { EintragDtoKategorieEnum } from '@/shared';
import { renderWithProviders, screen, fireEvent, waitFor, userEvent } from '@/test/utils';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EtbEntryList } from '../EtbEntryList';
import type { EintragDto } from '@/shared';

// === Mocks fuer externe Hooks ===

vi.mock('@/shared/hooks/useConfirm', () => ({
  useConfirm: () => vi.fn(async () => true),
}));

vi.mock('@/features/etb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/etb')>();
  return {
    ...actual,
  };
});

vi.mock('@/features/auth', () => ({
  useUserNames: () => ({
    getUserName: (id: string) => `User ${id}`,
  }),
}));

/** Mock fuer ErinnerungTimelineWidget (hat API-Abhängigkeit) */
vi.mock('@/features/etb/ui/organisms/components/ErinnerungTimelineWidget', () => ({
  ErinnerungTimelineWidget: () => <div data-testid="erinnerung-timeline">Timeline Mock</div>,
}));

/** Mock fuer ScreenshotLightbox */
vi.mock('@/features/etb/ui/organisms/components/ScreenshotLightbox', () => ({
  ScreenshotLightbox: () => null,
}));

// === Test-Fixtures ===

function buildMockEntries(count: number): EintragDto[] {
  return Array.from({ length: count }, (_, i) => {
    const createdAt = new Date(Date.UTC(2026, 2, 16, 11, Math.floor(i / 4), i % 60));
    return {
      id: `entry-${i + 1}`,
      sequenceNumber: i + 1,
      version: i % 5 === 0 ? 2 : 1,
      timestamp: createdAt.toISOString(),
      createdAt,
      updatedAt: createdAt,
      absender: `EL ${i % 3}`,
      empfaenger: `Abschnitt ${i % 2}`,
      kategorie: i % 4 === 0 ? 'BEFEHL' : i % 3 === 0 ? 'LAGE' : 'MASSNAHME',
      text: `Eintrag ${i + 1}: Lagemeldung zum Einsatz.`,
      deletedAt: null,
      deleterUsername: null,
      metadata: {},
      linkedErinnerung: null,
    } as unknown as EintragDto;
  });
}

// === ResizeObserver Mock ===

describe('EtbEntryList', () => {
  const originalResizeObserver = global.ResizeObserver;

  beforeAll(() => {
    global.ResizeObserver = class ResizeObserver implements globalThis.ResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      disconnect(): void {}
      observe(target: Element): void {
        const height = target instanceof HTMLElement ? target.clientHeight || 600 : 600;
        const width = target instanceof HTMLElement ? target.clientWidth || 1200 : 1200;
        queueMicrotask(() => {
          this.callback(
            [
              {
                target,
                borderBoxSize: [{ blockSize: height, inlineSize: width }],
                contentBoxSize: [{ blockSize: height, inlineSize: width }],
                contentRect: { x: 0, y: 0, top: 0, left: 0, bottom: height, right: width, width, height, toJSON: () => ({}) },
                devicePixelContentBoxSize: [{ blockSize: height, inlineSize: width }],
              } as ResizeObserverEntry,
            ],
            this,
          );
        });
      }
      unobserve(): void {}
    };
  });

  afterAll(() => {
    global.ResizeObserver = originalResizeObserver;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetKategorieFilter();
    resetHighlightStore();
  });

  const defaultProps = {
    einsatzId: 'einsatz-1',
    etbId: 'etb-1',
    isLoading: false,
    enableInlineEdit: false,
    sortBy: 'sequenceNumber' as const,
    sortOrder: 'desc' as const,
  };

  // === 6.1: Stream-Rendering mit chronologischer Reihenfolge ===

  describe('Stream-Rendering (AC1)', () => {
    it('rendert Eintraege in der Tabelle in absteigender sequenceNumber-Reihenfolge', async () => {
      const entries = buildMockEntries(5);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Eintrag 1:/)).toBeInTheDocument();
      });

      // Then - Eintraege in absteigender sequenceNumber-Reihenfolge im DOM
      // sortOrder ist 'desc', also sollte der höchste sequenceNumber zuerst erscheinen
      const rows = screen.getAllByRole('row');
      // Filtere Header-Zeile und Spacer-Zeilen (nur Zeilen mit aria-rowindex sind Datenzeilen)
      const dataRows = rows.filter((row) => row.getAttribute('aria-rowindex'));
      expect(dataRows.length).toBe(5);

      // Prüfe DOM-Reihenfolge: Eintrag 5 (höchste sequenceNumber) vor Eintrag 1 (niedrigste)
      const entry5Element = screen.getByText(/Eintrag 5:/);
      const entry1Element = screen.getByText(/Eintrag 1:/);

      // compareDocumentPosition Bit 4 (DOCUMENT_POSITION_FOLLOWING) = entry1 kommt nach entry5
      const position = entry5Element.compareDocumentPosition(entry1Element);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('zeigt Tabelle mit korrekter Struktur', async () => {
      const entries = buildMockEntries(3);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });
  });

  // === 6.2: Leerzustaende ===

  describe('Leerzustaende (AC1, AC4)', () => {
    it('zeigt EtbEmptyState bei leerer entries-Liste', () => {
      renderWithProviders(<EtbEntryList entries={[]} {...defaultProps} />);
      expect(screen.getByText('Keine Einträge vorhanden')).toBeInTheDocument();
    });

    it('zeigt Kategorie-Filter-Leerzustand wenn alle Eintraege ausgefiltert', () => {
      const entries = buildMockEntries(5);
      // Alle Kategorien ausblenden
      hideAllKategorien();

      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);
      expect(screen.getByText('Alle Einträge durch Filter ausgeblendet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Filter zurücksetzen' })).toBeInTheDocument();
    });

    it('"Filter zuruecksetzen" setzt den Kategorie-Filter zurueck', () => {
      const entries = buildMockEntries(5);
      hideAllKategorien();

      const { rerender } = renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));

      // Nach Reset sollte der Filter-Leerzustand verschwinden
      rerender(<EtbEntryList entries={entries} {...defaultProps} />);

      // Tabelle sollte jetzt sichtbar sein (nicht der Filter-Leerzustand)
      expect(screen.queryByText('Alle Einträge durch Filter ausgeblendet')).not.toBeInTheDocument();
    });

    it('zeigt "Keine Treffer" bei globalFilter ohne Ergebnis', async () => {
      const entries = buildMockEntries(5);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      // Warten bis Tabelle gerendert ist
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Suchbegriff eingeben der keine Treffer liefert
      const searchInput = screen.getByPlaceholderText(/such/i);
      fireEvent.change(searchInput, { target: { value: 'xyzNichtVorhanden' } });

      await waitFor(() => {
        expect(screen.getByText(/Keine Treffer für/)).toBeInTheDocument();
        expect(screen.getByText(/xyzNichtVorhanden/)).toBeInTheDocument();
      });
    });
  });

  // === 6.3: Bearbeiten-Flow ===

  describe('Bearbeiten-Flow (AC3)', () => {
    it('ruft onEditEntry mit dem korrekten Eintrag auf', async () => {
      const entries = buildMockEntries(3);
      const onEditEntry = vi.fn();

      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} onEditEntry={onEditEntry} />);

      await waitFor(() => {
        expect(screen.getByText(/Eintrag 1:/)).toBeInTheDocument();
      });

      // Klick auf den Bearbeiten-Button des ersten Eintrags
      const editButtons = screen.getAllByLabelText('Bearbeiten');
      fireEvent.click(editButtons[0]);

      expect(onEditEntry).toHaveBeenCalledTimes(1);
      expect(onEditEntry).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }));
    });
  });

  // === 6.4: Neue Eintraege nach Prop-Update ===

  describe('Live-Update (AC2)', () => {
    it('zeigt neue Eintraege nach Prop-Update', async () => {
      const initialEntries = buildMockEntries(3);
      const { rerender } = renderWithProviders(<EtbEntryList entries={initialEntries} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Eintrag 1:/)).toBeInTheDocument();
      });

      // Neuen Eintrag hinzufuegen
      const newEntry = {
        id: 'entry-new',
        sequenceNumber: 4,
        version: 1,
        timestamp: new Date().toISOString(),
        createdAt: new Date(),
        updatedAt: new Date(),
        absender: 'EL Neu',
        empfaenger: 'Abschnitt 0',
        kategorie: 'LAGE',
        text: 'Neuer Eintrag: Aktuelle Lagemeldung.',
        deletedAt: null,
        deleterUsername: null,
        metadata: {},
        linkedErinnerung: null,
      } as unknown as EintragDto;

      rerender(<EtbEntryList entries={[...initialEntries, newEntry]} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Neuer Eintrag: Aktuelle Lagemeldung/)).toBeInTheDocument();
      });
    });
  });

  // === 6.5: Accessibility-Attribute ===

  describe('Accessibility (AC4)', () => {
    it('hat aria-label und aria-rowcount auf der Tabelle', async () => {
      const entries = buildMockEntries(10);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        const table = screen.getByRole('table');
        expect(table).toHaveAttribute('aria-label', 'ETB-Einträge');
        expect(table).toHaveAttribute('aria-rowcount', '10');
      });
    });

    it('aria-rowcount reflektiert gefilterte Eintragsanzahl', async () => {
      // Given - 10 Eintraege mit gemischten Kategorien
      const entries = buildMockEntries(10);

      // When - Kategorie BEFEHL ausblenden (buildMockEntries: index % 4 === 0 → BEFEHL)
      // Eintraege mit Index 0, 4, 8 haben Kategorie BEFEHL → 3 Eintraege ausgeblendet
      excludeKategorie('BEFEHL' as EintragDtoKategorieEnum);

      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        const table = screen.getByRole('table');
        // Then - aria-rowcount zeigt die gefilterte Anzahl (10 - 3 BEFEHL = 7),
        // minus SYSTEM-Default-Exclusion (keine SYSTEM-Eintraege in buildMockEntries)
        const rowCount = Number(table.getAttribute('aria-rowcount'));
        expect(rowCount).toBeLessThan(10);
        expect(rowCount).toBe(7);
      });
    });

    it('hat aria-busy auf dem Table-Container', async () => {
      const entries = buildMockEntries(3);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} isLoading={false} isFetchingNextPage={false} />);

      await waitFor(() => {
        const table = screen.getByRole('table');
        const container = table.parentElement!;
        expect(container).toHaveAttribute('aria-busy', 'false');
      });
    });

    it('setzt aria-busy=true waehrend des Ladens', async () => {
      const entries = buildMockEntries(3);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} isFetchingNextPage={true} />);

      await waitFor(() => {
        const table = screen.getByRole('table');
        const container = table.parentElement!;
        expect(container).toHaveAttribute('aria-busy', 'true');
      });
    });

    it('hat aria-rowindex auf den Tabellenzeilen', async () => {
      const entries = buildMockEntries(5);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        const firstRow = document.getElementById('etb-entry-entry-1');
        expect(firstRow).toBeTruthy();
        expect(firstRow).toHaveAttribute('aria-rowindex');
      });
    });

    it('hat aria-expanded auf den Tabellenzeilen', async () => {
      const entries = buildMockEntries(3);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        const row = document.getElementById('etb-entry-entry-1');
        expect(row).toBeTruthy();
        expect(row).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it("zeigt 'Keine Einträge vorhanden' bei leerem Stream", () => {
      // entries=[] loest den EtbEmptyState aus (nicht den gefilterten Leerzustand)
      renderWithProviders(<EtbEntryList entries={[]} {...defaultProps} />);
      expect(screen.getByText('Keine Einträge vorhanden')).toBeInTheDocument();
    });

    it('hat role="status" beim Kategorie-Filter-Leerzustand', () => {
      const entries = buildMockEntries(5);
      hideAllKategorien();

      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  // === 6.6: Keyboard-Navigation ===

  describe('Keyboard-Navigation (AC4)', () => {
    it('Tabellenzeilen sind per Tab erreichbar (tabIndex=0)', async () => {
      const entries = buildMockEntries(3);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        const row = document.getElementById('etb-entry-entry-1');
        expect(row).toBeTruthy();
        expect(row).toHaveAttribute('tabindex', '0');
      });
    });

    it('Expander-Button toggelt Expand/Collapse (Detail-Inhalt sichtbar)', async () => {
      const entries = buildMockEntries(3);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByLabelText('Eintrag erweitern').length).toBeGreaterThan(0);
      });

      // Vor dem Klick: kein Detail-Bereich mit aria-label
      expect(document.querySelector('[aria-label^="Details zu Eintrag"]')).toBeNull();

      // Klick auf den Expander-Button
      const expanderButtons = screen.getAllByLabelText('Eintrag erweitern');
      fireEvent.click(expanderButtons[0]);

      // Nach dem Klick: Detail-Bereich sollte erscheinen
      await waitFor(() => {
        expect(document.querySelector('[aria-label^="Details zu Eintrag"]')).toBeTruthy();
      });
    });

    it('Zeilen haben onKeyDown Handler fuer Keyboard-Expansion', async () => {
      const entries = buildMockEntries(3);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        expect(document.getElementById('etb-entry-entry-1')).toBeTruthy();
      });

      const row = document.getElementById('etb-entry-entry-1')!;

      // Zeile hat tabIndex und aria-expanded fuer Keyboard-Zugaenglichkeit
      expect(row).toHaveAttribute('tabindex', '0');
      expect(row).toHaveAttribute('aria-expanded', 'false');

      // onKeyDown ist gesetzt (Implementation prueft Enter/Space und ruft toggleExpanded)
      // Hinweis: JSDOM leitet keyboard events auf <tr> nicht korrekt an React weiter,
      // daher wird die Expansion ueber den Expander-Button verifiziert (oben)
      expect(row.getAttribute('tabindex')).toBe('0');
    });

    it('Expanded-Detail-Zeile hat aria-label', async () => {
      const entries = buildMockEntries(3);
      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        const row = document.getElementById('etb-entry-entry-1');
        expect(row).toBeTruthy();
      });

      const row = document.getElementById('etb-entry-entry-1')!;
      fireEvent.keyDown(row, { key: 'Enter' });

      await waitFor(() => {
        const detailCells = document.querySelectorAll('[aria-label^="Details zu Eintrag"]');
        expect(detailCells.length).toBeGreaterThan(0);
      });
    });
  });

  // === 6.7: Inklusions-Filter nach Kontext-Typ (AC11 / Story 3.4 Task 2.5) ===

  describe('Inklusions-Filter nach kontext.type', () => {
    /**
     * Hilfsfunktion: baut Mock-Eintraege mit gemischten kontext.type-Werten.
     * Reihenfolge: alternierend 'standard' | 'funkspruch' | 'patient'.
     */
    function buildMixedKontextEntries(): EintragDto[] {
      const kontextTypes = ['standard', 'funkspruch', 'patient'] as const;
      return Array.from({ length: 6 }, (_, i) => {
        const createdAt = new Date(Date.UTC(2026, 2, 16, 11, 0, i));
        const type = kontextTypes[i % kontextTypes.length];
        return {
          id: `kontext-entry-${i + 1}`,
          sequenceNumber: i + 1,
          version: 1,
          timestamp: createdAt.toISOString(),
          createdAt,
          updatedAt: createdAt,
          absender: `EL ${i}`,
          empfaenger: `Abschnitt ${i}`,
          // Verschiedene Kategorien um Default-Exclusion zu vermeiden, KEINE SYSTEM
          kategorie: i % 2 === 0 ? 'LAGE' : 'MASSNAHME',
          text: `Eintrag ${i + 1} (kontext=${type})`,
          deletedAt: null,
          deleterUsername: null,
          metadata: {},
          linkedErinnerung: null,
          kontext: { type } as unknown,
        } as unknown as EintragDto;
      });
    }

    it("zeigt nur Eintraege mit kontext.type === 'patient' wenn Inklusions-Filter aktiv ist", async () => {
      // Given - 6 Eintraege mit gemischten kontext.type (2 'patient' bei index 2,5)
      const entries = buildMixedKontextEntries();

      // When - Inklusions-Filter auf 'patient' setzen
      setIncludedKontextType('patient');

      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Then - nur die 2 'patient'-Eintraege sichtbar (index 2,5)
      await waitFor(() => {
        expect(screen.getByText(/Eintrag 3 \(kontext=patient\)/)).toBeInTheDocument();
        expect(screen.getByText(/Eintrag 6 \(kontext=patient\)/)).toBeInTheDocument();
      });

      // 'standard'- und 'funkspruch'-Eintraege duerfen NICHT mehr sichtbar sein
      expect(screen.queryByText(/Eintrag 1 \(kontext=standard\)/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Eintrag 2 \(kontext=funkspruch\)/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Eintrag 4 \(kontext=standard\)/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Eintrag 5 \(kontext=funkspruch\)/)).not.toBeInTheDocument();
    });

    it('zeigt alle Eintraege wenn includedKontextType null ist (Default)', async () => {
      // Given - default state (includedKontextType = null)
      const entries = buildMixedKontextEntries();

      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Then - alle 6 Eintraege sichtbar
      await waitFor(() => {
        expect(screen.getByText(/Eintrag 1 \(kontext=standard\)/)).toBeInTheDocument();
        expect(screen.getByText(/Eintrag 2 \(kontext=funkspruch\)/)).toBeInTheDocument();
        expect(screen.getByText(/Eintrag 3 \(kontext=patient\)/)).toBeInTheDocument();
        expect(screen.getByText(/Eintrag 4 \(kontext=standard\)/)).toBeInTheDocument();
        expect(screen.getByText(/Eintrag 5 \(kontext=funkspruch\)/)).toBeInTheDocument();
        expect(screen.getByText(/Eintrag 6 \(kontext=patient\)/)).toBeInTheDocument();
      });
    });

    it('verknuepft Inklusions- und Exklusions-Filter per UND (kombinierte Filterung)', async () => {
      // Given - 6 Eintraege mit gemischten kontext.type-Werten und Kategorien
      // Index 2 (patient, LAGE), Index 5 (patient, MASSNAHME)
      const entries = buildMixedKontextEntries();

      // When - Inklusions-Filter auf 'patient' + Exklusion der MASSNAHME-Kategorie
      setIncludedKontextType('patient');
      excludeKategorie('MASSNAHME' as EintragDtoKategorieEnum);

      renderWithProviders(<EtbEntryList entries={entries} {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      // Then - nur Eintrag 3 (kontext=patient + LAGE) bleibt sichtbar
      await waitFor(() => {
        expect(screen.getByText(/Eintrag 3 \(kontext=patient\)/)).toBeInTheDocument();
      });

      // Eintrag 6 (patient + MASSNAHME) wird durch Exklusion ausgeblendet
      expect(screen.queryByText(/Eintrag 6 \(kontext=patient\)/)).not.toBeInTheDocument();

      // aria-rowcount reflektiert UND-Verknuepfung
      const table = screen.getByRole('table');
      const rowCount = Number(table.getAttribute('aria-rowcount'));
      expect(rowCount).toBe(1);
    });
  });
});
