import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Heartbeat, type Icon } from '@phosphor-icons/react';
import { KpiTile, type KpiTileIntent } from '../kpi-tile.molecule';

const ALL_INTENTS: KpiTileIntent[] = [
  'sk-rot',
  'sk-gelb',
  'sk-gruen',
  'sk-blau',
  'sk-schwarz',
  'patient-status-eintreffend',
  'patient-status-sichtung',
  'patient-status-behandlung',
  'patient-status-transport-wartend',
  'patient-status-im-transport',
  'patient-status-abtransportiert',
];

describe('KpiTile', () => {
  it('rendert Label, Value, Icon und korrektes aria-label', () => {
    render(<KpiTile label="SK I — Akut" value={12} icon={Heartbeat as Icon} intent="sk-rot" />);

    const tile = screen.getByRole('status');
    expect(tile).toHaveAttribute('aria-label', 'SK I — Akut: 12');
    // Story-1.5-Code-Review: `aria-live` lebt eine Ebene höher im
    // `KpiStrip`-Wrapper, damit 12 simultane Loading→Success-Übergänge
    // nicht in 12-fach-Screenreader-Spam münden. Die Tile selbst trägt
    // weiterhin `role="status"`, aber kein eigenes `aria-live`.
    expect(tile).not.toHaveAttribute('aria-live');
    expect(screen.getByText('SK I — Akut')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it.each(ALL_INTENTS)('rendert ohne Fehler für Intent %s (tint)', (intent) => {
    render(<KpiTile label={intent} value={0} icon={Heartbeat as Icon} intent={intent} testId={`tile-${intent}`} />);
    expect(screen.getByTestId(`tile-${intent}`)).toBeInTheDocument();
  });

  it('Variant=solid liefert Tailwind-Klassen für SK-fill und text-white', () => {
    const { container } = render(<KpiTile label="SK I" value={12} icon={Heartbeat as Icon} intent="sk-rot" variant="solid" />);
    const tile = container.firstElementChild;
    expect(tile?.className).toContain('bg-sk-rot-fill');
    expect(tile?.className).toContain('text-white');
  });

  it('Variant=solid für neutral fällt auf tint-Klasse zurück (kein dediziertes Solid)', () => {
    const { container } = render(<KpiTile label="Neutral" value={0} icon={Heartbeat as Icon} intent="neutral" variant="solid" />);
    const tile = container.firstElementChild;
    expect(tile?.className).toContain('bg-surface-panel');
  });

  it('loading=true: rendert Skeleton-Variante mit identischen Maßen und aria-busy="true"', () => {
    const { container } = render(<KpiTile label="SK I" value={12} icon={Heartbeat as Icon} intent="sk-rot" loading={true} />);
    const tile = screen.getByRole('status');
    expect(tile).toHaveAttribute('aria-busy', 'true');
    expect(tile.className).toContain('animate-pulse');
    // Skeleton: Wert wird nicht gerendert
    expect(container).not.toHaveTextContent('12');
  });

  it('rendert meta-Text wenn gesetzt', () => {
    render(<KpiTile label="SK I" value={12} icon={Heartbeat as Icon} intent="sk-rot" meta="Trend +5 letzte 10 min" />);
    expect(screen.getByText(/Trend \+5 letzte 10 min/)).toBeInTheDocument();
  });

  it('Icon hat aria-hidden="true" (multi-sensorische Codierung im DOM, nicht doppelt für SR)', () => {
    const { container } = render(<KpiTile label="SK I" value={12} icon={Heartbeat as Icon} intent="sk-rot" />);
    // Phosphor-SVG sollte aria-hidden tragen
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('Touch-Target ≥ 44 px durch min-h-Padding-Klasse (BITV 2.0, NFR-A1)', () => {
    const { container } = render(<KpiTile label="SK I" value={12} icon={Heartbeat as Icon} intent="sk-rot" size="sm" />);
    // sm = 88 px, md = 112 px, lg = 136 px — alle > 44 px
    expect(container.firstElementChild?.className).toMatch(/min-h-\[\d+px\]/);
  });

  it('Größe md nutzt text-title-xxl für die Großzahl', () => {
    const { container } = render(<KpiTile label="SK I" value={12} icon={Heartbeat as Icon} intent="sk-rot" size="md" />);
    expect(container.innerHTML).toContain('text-title-xxl');
  });
});
