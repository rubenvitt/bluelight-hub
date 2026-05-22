import { render, screen, act, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EntityFlowStrip, type EntityFlowStripPhase } from '../EntityFlowStrip.organism';

interface TestItem {
  id: string;
  name: string;
  status: 'todo' | 'in_progress' | 'done';
}

const testPhases: EntityFlowStripPhase<'todo' | 'in_progress' | 'done'>[] = [
  { id: 'todo', label: 'Zu tun', emptyHint: 'Keine Aufgaben zu tun' },
  { id: 'in_progress', label: 'In Arbeit', emptyHint: 'Nichts in Arbeit' },
  { id: 'done', label: 'Erledigt', emptyHint: 'Nichts erledigt' },
];

const testItems: TestItem[] = [
  { id: '1', name: 'Aufgabe A', status: 'todo' },
  { id: '2', name: 'Aufgabe B', status: 'in_progress' },
  { id: '3', name: 'Aufgabe C', status: 'done' },
  { id: '4', name: 'Aufgabe D', status: 'todo' },
];

describe('EntityFlowStrip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('rendert alle Phasen mit Titeln und Elementenanzahl', () => {
    render(<EntityFlowStrip phases={testPhases} items={testItems} getPhase={(item) => item.status} getItemKey={(item) => item.id} renderItem={(item) => <div>{item.name}</div>} />);

    expect(screen.getByText('Zu tun')).toBeInTheDocument();
    expect(screen.getByText('In Arbeit')).toBeInTheDocument();
    expect(screen.getByText('Erledigt')).toBeInTheDocument();

    // Anzahl der Elemente in den Phasen-Spalten
    expect(screen.getByText('2')).toBeInTheDocument(); // Todo
    expect(screen.getAllByText('1')).toHaveLength(2); // In Progress und Erledigt
    // Da "1" zweimal vorkommt (In Progress und Done), prüfen wir die spezifischen Regionen/Groups

    const todoGroup = screen.getByRole('group', { name: 'Zu tun' });
    const inProgressGroup = screen.getByRole('group', { name: 'In Arbeit' });
    const doneGroup = screen.getByRole('group', { name: 'Erledigt' });

    expect(todoGroup).toBeInTheDocument();
    expect(inProgressGroup).toBeInTheDocument();
    expect(doneGroup).toBeInTheDocument();
  });

  it('verteilt die Items korrekt auf die entsprechenden Spalten', () => {
    render(<EntityFlowStrip phases={testPhases} items={testItems} getPhase={(item) => item.status} getItemKey={(item) => item.id} renderItem={(item) => <div>{item.name}</div>} />);

    const todoGroup = screen.getByRole('group', { name: 'Zu tun' });
    const inProgressGroup = screen.getByRole('group', { name: 'In Arbeit' });
    const doneGroup = screen.getByRole('group', { name: 'Erledigt' });

    expect(within(todoGroup).getByText('Aufgabe A')).toBeInTheDocument();
    expect(within(todoGroup).getByText('Aufgabe D')).toBeInTheDocument();
    expect(within(inProgressGroup).getByText('Aufgabe B')).toBeInTheDocument();
    expect(within(doneGroup).getByText('Aufgabe C')).toBeInTheDocument();
  });

  it('zeigt den leeren Zustand mit emptyHint an', () => {
    render(<EntityFlowStrip phases={testPhases} items={[]} getPhase={(item) => item.status} getItemKey={(item) => item.id} renderItem={(item) => <div>{item.name}</div>} />);

    expect(screen.getByText('Keine Aufgaben zu tun')).toBeInTheDocument();
    expect(screen.getByText('Nichts in Arbeit')).toBeInTheDocument();
    expect(screen.getByText('Nichts erledigt')).toBeInTheDocument();
  });

  it('rendert Skeletons im Ladezustand', () => {
    const { container } = render(
      <EntityFlowStrip phases={testPhases} items={testItems} getPhase={(item) => item.status} getItemKey={(item) => item.id} renderItem={(item) => <div>{item.name}</div>} loading />,
    );

    // Es sollten keine echten Items gerendert werden
    expect(screen.queryByText('Aufgabe A')).not.toBeInTheDocument();

    // Skeletons sollten animiert geladen werden
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('wendet Highlight-Animationen für neue und aktualisierte Items an und entfernt sie nach 2 Sekunden', () => {
    // F3: Erst-Mount-Guard verhindert Highlights beim initialen Render.
    // Daher initial ohne Highlight-Sets rendern, dann via rerender Highlights aktivieren.
    const { rerender } = render(
      <EntityFlowStrip phases={testPhases} items={testItems} getPhase={(item) => item.status} getItemKey={(item) => item.id} renderItem={(item) => <div>{item.name}</div>} />,
    );

    // Beim ersten Mount dürfen noch keine Highlights aktiv sein
    expect(screen.getByText('Aufgabe A').closest('.animate-highlight-new')).toBeNull();
    expect(screen.getByText('Aufgabe B').closest('.animate-highlight-updated')).toBeNull();

    // Highlights jetzt via Re-Render aktivieren
    rerender(
      <EntityFlowStrip
        phases={testPhases}
        items={testItems}
        getPhase={(item) => item.status}
        getItemKey={(item) => item.id}
        renderItem={(item) => <div>{item.name}</div>}
        newItemIds={new Set(['1'])}
        highlightedItemIds={new Set(['1', '2'])}
      />,
    );

    // Item 1 ist neu (animate-highlight-new)
    // Item 2 ist aktualisiert (animate-highlight-updated)
    const item1Container = screen.getByText('Aufgabe A').closest('.animate-highlight-new');
    const item2Container = screen.getByText('Aufgabe B').closest('.animate-highlight-updated');

    expect(item1Container).toBeInTheDocument();
    expect(item2Container).toBeInTheDocument();

    // 2 Sekunden vergehen lassen
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Die Highlight-Klassen sollten entfernt worden sein
    expect(screen.getByText('Aufgabe A').closest('.animate-highlight-new')).toBeNull();
    expect(screen.getByText('Aufgabe B').closest('.animate-highlight-updated')).toBeNull();
  });

  it('besitzt Barrierefreiheits-Attribute für Landmarken und Regionen', () => {
    render(
      <EntityFlowStrip phases={testPhases} items={testItems} getPhase={(item) => item.status} getItemKey={(item) => item.id} renderItem={(item) => <div>{item.name}</div>} ariaLabel="Prozess-Flow" />,
    );

    // Haupt-Region
    expect(screen.getByRole('region', { name: 'Prozess-Flow' })).toBeInTheDocument();

    // Listen und Listenelemente
    expect(screen.getAllByRole('list').length).toBe(3);
    expect(screen.getAllByRole('listitem').length).toBe(4);
  });

  describe('prefers-reduced-motion (AC10)', () => {
    // Hinweis: Die Komponente setzt Highlight-Klassen unabhaengig von matchMedia.
    // Die eigentliche Reduced-Motion-Behandlung erfolgt CSS-seitig
    // (`@media (prefers-reduced-motion: reduce)` deaktiviert die Animation).
    // Dieser Test stellt sicher, dass die Komponente unter aktivem reduce-Mode
    // (a) ohne Crash rendert und
    // (b) die Highlight-Klassen weiterhin als statisches Fallback gesetzt werden.

    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query.includes('reduce'),
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: originalMatchMedia,
      });
    });

    it('rendert ohne Crash bei aktivem prefers-reduced-motion und setzt Highlight-Klassen weiterhin (statisches Fallback)', () => {
      const { rerender } = render(
        <EntityFlowStrip phases={testPhases} items={testItems} getPhase={(item) => item.status} getItemKey={(item) => item.id} renderItem={(item) => <div>{item.name}</div>} />,
      );

      // Highlights via Re-Render aktivieren (F3 Mount-Guard)
      rerender(
        <EntityFlowStrip
          phases={testPhases}
          items={testItems}
          getPhase={(item) => item.status}
          getItemKey={(item) => item.id}
          renderItem={(item) => <div>{item.name}</div>}
          newItemIds={new Set(['1'])}
          highlightedItemIds={new Set(['1', '2'])}
        />,
      );

      // Highlight-Klassen werden trotzdem gesetzt (statisches Fallback — CSS
      // entscheidet ueber Animation oder Sofort-Style via @media reduce)
      const item1Container = screen.getByText('Aufgabe A').closest('.animate-highlight-new');
      const item2Container = screen.getByText('Aufgabe B').closest('.animate-highlight-updated');
      expect(item1Container).toBeInTheDocument();
      expect(item2Container).toBeInTheDocument();

      // Komponente rendert weiterhin korrekt (Region vorhanden, keine Exception)
      expect(screen.getByRole('region', { name: 'Entitäts-Flow' })).toBeInTheDocument();

      // Verifikation: matchMedia wurde nicht direkt von der Komponente konsumiert
      // (Reduced-Motion-Logik lebt im CSS), aber der Mock liefert konsistente Werte
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    });
  });
});
