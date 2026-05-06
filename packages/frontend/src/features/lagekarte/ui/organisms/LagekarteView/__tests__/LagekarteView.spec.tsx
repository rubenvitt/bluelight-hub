/**
 * Unit Tests für LagekarteView Orchestrator
 *
 * Verifiziert Mode-basiertes Rendering und Hook-Orchestration:
 * - Standard/Fullscreen/Presentation Mode Rendering
 * - Permission-basiertes Toolbar-Rendering
 * - WebSocket-Status Badge
 * - Präsentationsmodus-Label
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LagekarteView } from '../LagekarteView';

// ============================================
// Mocks
// ============================================

// Capture für Map onClick-Handler (für handleCombinedClick-Tests)
let capturedMapOnClick: ((event: any) => void) | null = null;

// MapLibre + react-map-gl müssen vor dem Import gemockt werden
vi.mock('react-map-gl/maplibre', () => ({
  Map: vi.fn(({ children, onLoad, onClick, 'aria-label': ariaLabel }: any) => {
    // onClick-Handler für Tests zugänglich machen
    capturedMapOnClick = onClick;
    // Auto-fire onLoad für Tests
    setTimeout(() => onLoad?.(), 0);
    return (
      <div data-testid="mock-map" aria-label={ariaLabel}>
        {children}
      </div>
    );
  }),
  NavigationControl: () => <div data-testid="nav-control" />,
  Source: ({ children }: any) => <div data-testid="source">{children}</div>,
  Layer: () => <div data-testid="layer" />,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
}));

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));

vi.mock('@/features/lagekarte/utils/map-config', () => ({
  MAP_DEFAULTS: { longitude: 10, latitude: 50, zoom: 8 },
  getDwdWmsTileUrl: () => 'https://example.com/wms',
}));

vi.mock('@/features/lagekarte/hooks/use-map-layer', () => ({
  useMapLayer: () => ({
    resolvedStyle: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    selectedBaseLayer: 'osm',
    dwdOverlayEnabled: false,
    availableLayers: [],
    ninaOverlays: {},
  }),
}));

vi.mock('@/features/lagekarte/hooks/use-map-detail', () => ({
  useMapDetail: () => ({
    results: [],
    coordinate: null,
    panelIndex: 0,
    isPanelOpen: false,
    isLoading: false,
    handleMapClick: vi.fn(),
    openPanel: vi.fn(),
    navigatePanel: vi.fn(),
    closePanel: vi.fn(),
    clearSelection: vi.fn(),
  }),
}));

vi.mock('@/features/lagekarte/api/use-nina-map-data', () => ({
  useNinaMapData: () => ({ data: null }),
}));

const mockLagekarteData = vi.fn().mockReturnValue({ data: null });
vi.mock('@/features/lagekarte/api/use-lagekarte', () => ({
  useLagekarte: (...args: any[]) => mockLagekarteData(...args),
}));

const mockCanDraw = vi.fn().mockReturnValue(true);
vi.mock('@/features/lagekarte/hooks/use-lagekarte-permissions', () => ({
  useLagekartePermissions: () => ({ canDraw: mockCanDraw() }),
}));

const mockWsConnected = vi.fn().mockReturnValue(true);
vi.mock('@/features/lagekarte/api/use-lagekarte-websocket', () => ({
  useLagekarteWebSocketStatus: () => mockWsConnected(),
}));

vi.mock('@/features/lagekarte/hooks/use-draw-control', () => ({
  useDrawControl: () => ({
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    deleteSelected: vi.fn(),
    setMode: vi.fn(),
    drawRef: { current: null },
    scheduleAutoSave: vi.fn(),
  }),
}));

const mockSendDelta = vi.fn();
const mockLagekarteSync = vi.fn().mockReturnValue({
  wsStatus: 'connected',
  isConnected: true,
  sendDelta: mockSendDelta,
});
vi.mock('@/features/lagekarte/hooks/use-lagekarte-sync', () => ({
  useLagekarteSync: (...args: any[]) => mockLagekarteSync(...args),
}));

vi.mock('@/features/lagekarte/hooks/use-feature-measurement', () => ({
  useFeatureMeasurement: () => ({
    selectedMeasurement: undefined,
    liveMeasurement: undefined,
  }),
}));

vi.mock('@/features/lagekarte/hooks/use-osm-markierung', () => ({
  useOsmMarkierung: () => ({
    handleOsmClick: vi.fn(),
    pendingOsmMark: null,
    confirmOsmMark: vi.fn(),
    cancelOsmMark: vi.fn(),
  }),
}));

const mockGamsZonen = vi.fn().mockReturnValue({
  pendingGamsCenter: null,
  confirmiereGamsZonen: vi.fn(),
  abbrechenGamsZonen: vi.fn(),
});
vi.mock('@/features/lagekarte/hooks/use-gams-zonen', () => ({
  useGamsZonen: (...args: any[]) => mockGamsZonen(...args),
}));

vi.mock('@/features/lagekarte/hooks/use-snap-control', () => ({
  useSnapControl: vi.fn(),
}));

vi.mock('@/features/lagekarte/hooks/use-symbol-marker', () => ({
  useSymbolMarker: vi.fn(() => ({
    pendingSymbol: null,
    selectSymbol: vi.fn(),
    cancelSymbol: vi.fn(),
    isReady: true,
  })),
}));

vi.mock('@/features/lagekarte/stores/draw.store', () => ({
  drawStore: {
    state: {
      drawMode: 'idle',
      selectedFeatureIds: [],
      isDirectSelect: false,
      snapEnabled: false,
      isDrawToolbarVisible: false,
      featureGroups: [],
      isSymbolPanelVisible: false,
      isTemplatePanelVisible: false,
      isLocked: false,
      isZeichenSidebarVisible: false,
      zeichenSidebarTab: 'katalog',
      isGefahrenSidebarVisible: false,
      gefahrenSidebarTab: 'zone',
      pendingZeichenPlacement: null,
      selectedZeichenId: null,
    },
    subscribe: vi.fn((cb) => {
      cb();
      return () => {};
    }),
  },
  toggleSnapEnabled: vi.fn(),
  toggleDrawToolbar: vi.fn(),
  toggleLock: vi.fn(),
  toggleSymbolPanel: vi.fn(),
  toggleTemplatePanel: vi.fn(),
  toggleZeichenSidebar: vi.fn(),
  openZeichenSidebar: vi.fn(),
  setZeichenSidebarTab: vi.fn(),
  toggleGefahrenSidebar: vi.fn(),
  openGefahrenSidebar: vi.fn(),
  setGefahrenSidebarTab: vi.fn(),
  addFeatureGroup: vi.fn(),
  removeFeatureGroup: vi.fn(),
  setFeatureGroups: vi.fn(),
  setDrawMode: vi.fn(),
  setSelectedFeatures: vi.fn(),
  setDirectSelect: vi.fn(),
  clearPendingZeichenPlacement: vi.fn(),
  openZeichenDetail: vi.fn(),
  closeZeichenDetail: vi.fn(),
}));

let mockDrawStoreOverrides: Record<string, any> = {};

vi.mock('@tanstack/react-store', () => ({
  createStore: vi.fn((initialState: any) => ({
    state: initialState,
    subscribe: vi.fn(() => () => {}),
    setState: vi.fn(),
  })),
  useStore: vi.fn((_store: any, selector: any) => {
    const state = {
      drawMode: 'idle',
      selectedFeatureIds: [],
      isDirectSelect: false,
      snapEnabled: false,
      isDrawToolbarVisible: false,
      featureGroups: [],
      isSymbolPanelVisible: false,
      isTemplatePanelVisible: false,
      isLocked: false,
      isZeichenSidebarVisible: false,
      zeichenSidebarTab: 'katalog',
      pendingZeichenPlacement: null,
      selectedZeichenId: null,
      ...mockDrawStoreOverrides,
    };
    return selector(state);
  }),
}));

const mockCreateZeichen = vi.fn();
const mockPlaceZeichen = vi.fn();

vi.mock('@/features/taktische-zeichen', () => ({
  useEinsatzZeichen: () => ({ data: [], isLoading: false, isError: false }),
  useCreateZeichen: () => ({ mutate: mockCreateZeichen }),
  usePlaceZeichen: () => ({ mutate: mockPlaceZeichen }),
  useUpdateZeichen: () => ({ mutate: vi.fn() }),
  useRemoveZeichen: () => ({ mutate: vi.fn(), isPending: false }),
  ZeichenPreview: () => <div data-testid="zeichen-preview" />,
}));

vi.mock('@/features/lagekarte/hooks/use-zeichen-drag', () => ({
  useZeichenDrag: vi.fn(() => ({ isDragging: false, selectedZeichenId: null, deselectZeichen: vi.fn() })),
}));

vi.mock('@/features/lagekarte/drawing/types', () => ({
  DEFAULT_DRAWING_STYLE: { color: '#000', fillColor: '#fff', strokeWidth: 2, fillEnabled: false, fillOpacity: 0.3, strokeDasharray: '', hatch: { type: 'none', color: '', spacing: 8 } },
  DEFAULT_HATCH: { type: 'none', color: '', spacing: 8 },
}));

vi.mock('@/features/lagekarte/drawing/hatch-patterns', () => ({
  ensureHatchImage: vi.fn(),
  migrateLegacyFillPattern: vi.fn(),
  reregisterHatchImages: vi.fn(),
}));

vi.mock('@/features/lagekarte/drawing/draw-styles', () => ({
  EMPTY_PATTERN_IMAGE: '__empty_pattern__',
}));

vi.mock('@/shared/ui/atoms/spinner.atom', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('@/shared/ui/cn', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@turf/turf', () => ({
  bbox: vi.fn(() => [10, 50, 11, 51]),
}));

vi.mock('@/features/lagekarte/ui/atoms/ConnectionStatusBadge.atom', () => ({
  ConnectionStatusBadge: ({ status }: any) => <div data-testid="ws-badge">{status}</div>,
}));

vi.mock('@/features/lagekarte/ui/molecules/MapLayerSwitcher.molecule', () => ({
  MapLayerSwitcher: () => <div data-testid="layer-switcher" />,
}));

vi.mock('@/features/lagekarte/ui/molecules/MapDetailPopup.molecule', () => ({
  MapDetailPopup: () => <div data-testid="detail-popup" />,
}));

vi.mock('@/features/lagekarte/ui/molecules/MapDetailPanel.molecule', () => ({
  MapDetailPanel: () => <div data-testid="detail-panel" />,
}));

vi.mock('@/features/lagekarte/ui/molecules/DrawToolbar.molecule', () => ({
  DrawToolbar: () => <div data-testid="draw-toolbar" />,
}));

vi.mock('@/features/lagekarte/ui/molecules/DrawShortcutBar.molecule', () => ({
  DrawShortcutBar: () => <div data-testid="draw-shortcut-bar" />,
}));

vi.mock('@/features/lagekarte/ui/molecules/DrawStylePanel.molecule', () => ({
  DrawStylePanel: () => <div data-testid="draw-style-panel" />,
}));

vi.mock('@/features/lagekarte/ui/molecules/OsmMarkierungPopup.molecule', () => ({
  OsmMarkierungPopup: () => <div data-testid="osm-popup" />,
}));

vi.mock('@/features/lagekarte/ui/molecules/GamsZonenPanel.molecule', () => ({
  GamsZonenPanel: () => <div data-testid="gams-panel" />,
}));

vi.mock('@/features/lagekarte/ui/molecules/NinaGeoJsonLayer.molecule', () => ({
  NinaGeoJsonLayer: () => <div data-testid="nina-layer" />,
}));

vi.mock('@/features/lagekarte/ui/molecules/TaktischeZeichenLayer.molecule', () => ({
  TaktischeZeichenLayer: () => <div data-testid="taktische-zeichen-layer" />,
}));

vi.mock('@/features/eigenschutz', async () => {
  const actual = await vi.importActual<typeof import('@/features/eigenschutz')>('@/features/eigenschutz');
  return {
    ...actual,
    SecurityPostMapMarker: () => <div data-testid="security-post-map-marker-mock" />,
  };
});

vi.mock('@/features/lagekarte/ui/molecules/KartenZeichenSidebar.molecule', () => ({
  KartenZeichenSidebar: () => <div data-testid="karten-zeichen-sidebar" />,
}));

vi.mock('@/features/lagekarte/ui/molecules/ZeichenDetailPanel.molecule', () => ({
  ZeichenDetailPanel: () => <div data-testid="zeichen-detail-panel" />,
}));

vi.mock('@/features/lagekarte/ui/molecules/GhostZeichenMarker.molecule', () => ({
  GhostZeichenMarker: () => <div data-testid="ghost-zeichen-marker" />,
}));

vi.mock('@/features/lagekarte/ui/organisms/FullscreenCloseButton/FullscreenCloseButton', () => ({
  FullscreenCloseButton: () => <div data-testid="fullscreen-close" />,
}));

vi.mock('@/features/lagekarte/detail-providers', () => ({}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

vi.mock('../lagekarte-view.css', () => ({}));

vi.mock('@/shared/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ============================================
// Tests
// ============================================

describe('LagekarteView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedMapOnClick = null;
    mockDrawStoreOverrides = {};
    mockCanDraw.mockReturnValue(true);
    mockWsConnected.mockReturnValue(true);
    mockLagekarteData.mockReturnValue({ data: null });
    mockGamsZonen.mockReturnValue({
      pendingGamsCenter: null,
      confirmiereGamsZonen: vi.fn(),
      abbrechenGamsZonen: vi.fn(),
    });
    mockLagekarteSync.mockReturnValue({
      wsStatus: 'connected',
      isConnected: true,
      sendDelta: mockSendDelta,
    });
  });

  describe('Standard-Modus', () => {
    it('sollte Map mit aria-label rendern', () => {
      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(screen.getByTestId('mock-map')).toBeInTheDocument();
    });

    it('sollte WebSocket-Badge anzeigen', () => {
      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(screen.getByTestId('ws-badge')).toBeInTheDocument();
    });

    it('sollte Draw-Toolbar anzeigen wenn canDraw=true', () => {
      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(screen.getByTestId('draw-toolbar')).toBeInTheDocument();
    });

    it('sollte Draw-Toolbar NICHT anzeigen wenn canDraw=false', () => {
      mockCanDraw.mockReturnValue(false);

      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(screen.queryByTestId('draw-toolbar')).not.toBeInTheDocument();
    });

    it('sollte kein Fullscreen-Close-Button anzeigen', () => {
      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(screen.queryByTestId('fullscreen-close')).not.toBeInTheDocument();
    });

    it('sollte Layer-Switcher anzeigen', () => {
      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(screen.getByTestId('layer-switcher')).toBeInTheDocument();
    });

    it('sollte SecurityPostMapMarker rendern (Story 4.3, FR28)', () => {
      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(screen.getByTestId('security-post-map-marker-mock')).toBeInTheDocument();
    });
  });

  describe('Fullscreen-Modus', () => {
    it('sollte Fullscreen-Close-Button anzeigen', () => {
      render(<LagekarteView einsatzId="einsatz-1" mode="fullscreen" />);

      expect(screen.getByTestId('fullscreen-close')).toBeInTheDocument();
    });
  });

  describe('Präsentations-Modus', () => {
    it('sollte Präsentationsmodus-Label anzeigen', () => {
      render(<LagekarteView einsatzId="einsatz-1" mode="presentation" />);

      expect(screen.getByText('Präsentationsmodus')).toBeInTheDocument();
    });

    it('sollte WebSocket-Badge NICHT anzeigen', () => {
      render(<LagekarteView einsatzId="einsatz-1" mode="presentation" />);

      expect(screen.queryByTestId('ws-badge')).not.toBeInTheDocument();
    });

    it('sollte Draw-Toolbar NICHT anzeigen (auch mit Permission)', () => {
      mockCanDraw.mockReturnValue(true);

      render(<LagekarteView einsatzId="einsatz-1" mode="presentation" />);

      expect(screen.queryByTestId('draw-toolbar')).not.toBeInTheDocument();
    });

    it('sollte Layer-Switcher NICHT anzeigen', () => {
      render(<LagekarteView einsatzId="einsatz-1" mode="presentation" />);

      expect(screen.queryByTestId('layer-switcher')).not.toBeInTheDocument();
    });

    it('sollte Fullscreen-Close-Button anzeigen', () => {
      render(<LagekarteView einsatzId="einsatz-1" mode="presentation" />);

      expect(screen.getByTestId('fullscreen-close')).toBeInTheDocument();
    });
  });

  describe('GAMS-Zonen', () => {
    it('sollte GAMS-Panel anzeigen wenn pendingGamsCenter gesetzt', () => {
      mockGamsZonen.mockReturnValue({
        pendingGamsCenter: [10.5, 50.3],
        confirmiereGamsZonen: vi.fn(),
        abbrechenGamsZonen: vi.fn(),
      });

      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(screen.getByTestId('gams-panel')).toBeInTheDocument();
    });

    it('sollte GAMS-Panel NICHT anzeigen wenn kein pendingGamsCenter', () => {
      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(screen.queryByTestId('gams-panel')).not.toBeInTheDocument();
    });
  });

  describe('WebSocket-Sync', () => {
    it('sollte useLagekarteSync mit enabled=true im Standard-Modus aufrufen', () => {
      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(mockLagekarteSync).toHaveBeenCalledWith(
        expect.objectContaining({
          einsatzId: 'einsatz-1',
          enabled: true,
        }),
      );
    });

    it('sollte useLagekarteSync mit enabled=false im Präsentationsmodus aufrufen', () => {
      render(<LagekarteView einsatzId="einsatz-1" mode="presentation" />);

      expect(mockLagekarteSync).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        }),
      );
    });

    it('sollte ConnectionStatusBadge mit wsStatus rendern', () => {
      mockLagekarteSync.mockReturnValue({
        wsStatus: 'error',
        isConnected: false,
        sendDelta: mockSendDelta,
      });

      render(<LagekarteView einsatzId="einsatz-1" />);

      const badge = screen.getByTestId('ws-badge');
      expect(badge).toHaveTextContent('error');
    });
  });

  describe('Draw-Shortcut-Bar', () => {
    it('sollte DrawShortcutBar anzeigen wenn canDraw=true', () => {
      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(screen.getByTestId('draw-shortcut-bar')).toBeInTheDocument();
    });
  });

  describe('handleCombinedClick — Taktische Zeichen Platzierung', () => {
    const mockMapEvent = {
      lngLat: { lng: 10.5, lat: 50.3 },
      point: { x: 100, y: 200 },
      features: [],
    };

    it('sollte neues Zeichen erstellen + platzieren wenn pendingZeichenPlacement ohne existingZeichenId', () => {
      const definition = { grundzeichen: 'stelle', organisation: 'thw', fachaufgabe: undefined, einheit: undefined, verwaltungsstufe: undefined };

      mockDrawStoreOverrides = {
        pendingZeichenPlacement: { definition },
      };
      mockLagekarteData.mockReturnValue({ data: { id: 'lagekarte-42', state: null } });

      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(capturedMapOnClick).toBeDefined();
      capturedMapOnClick!(mockMapEvent);

      expect(mockCreateZeichen).toHaveBeenCalledWith(
        {
          zeichenDefinition: {
            grundzeichen: 'stelle',
            organisation: 'thw',
            fachaufgabe: undefined,
            einheit: undefined,
            verwaltungsstufe: undefined,
          },
          label: undefined,
          lagekarteId: 'lagekarte-42',
          lat: 50.3,
          lng: 10.5,
        },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
      expect(mockPlaceZeichen).not.toHaveBeenCalled();
    });

    it('sollte Label im createZeichen-DTO durchreichen', () => {
      const definition = { grundzeichen: 'stelle', organisation: 'thw', fachaufgabe: undefined, einheit: undefined, verwaltungsstufe: undefined };

      mockDrawStoreOverrides = {
        pendingZeichenPlacement: { definition, label: 'ELW-1' },
      };
      mockLagekarteData.mockReturnValue({ data: { id: 'lagekarte-42', state: null } });

      render(<LagekarteView einsatzId="einsatz-1" />);
      capturedMapOnClick!(mockMapEvent);

      expect(mockCreateZeichen).toHaveBeenCalledWith(expect.objectContaining({ label: 'ELW-1' }), expect.any(Object));
    });

    it('sollte toast.success zeigen bei erfolgreicher Erstellung', () => {
      const definition = { grundzeichen: 'stelle' };
      mockDrawStoreOverrides = { pendingZeichenPlacement: { definition } };
      mockLagekarteData.mockReturnValue({ data: { id: 'lagekarte-42', state: null } });

      render(<LagekarteView einsatzId="einsatz-1" />);
      capturedMapOnClick!(mockMapEvent);

      const callArgs = mockCreateZeichen.mock.calls[0][1];
      callArgs.onSuccess();

      expect(mockToastSuccess).toHaveBeenCalledWith('Zeichen platziert');
    });

    it('sollte toast.error zeigen bei fehlgeschlagener Erstellung', () => {
      const definition = { grundzeichen: 'stelle' };
      mockDrawStoreOverrides = { pendingZeichenPlacement: { definition } };
      mockLagekarteData.mockReturnValue({ data: { id: 'lagekarte-42', state: null } });

      render(<LagekarteView einsatzId="einsatz-1" />);
      capturedMapOnClick!(mockMapEvent);

      const callArgs = mockCreateZeichen.mock.calls[0][1];
      callArgs.onError();

      expect(mockToastError).toHaveBeenCalledWith('Fehler beim Platzieren des Zeichens');
    });

    it('sollte bestehendes Zeichen platzieren wenn pendingZeichenPlacement mit existingZeichenId', () => {
      mockDrawStoreOverrides = {
        pendingZeichenPlacement: {
          definition: { grundzeichen: 'fahrzeug' },
          existingZeichenId: 'z-existing-1',
        },
      };
      mockLagekarteData.mockReturnValue({ data: { id: 'lagekarte-42', state: null } });

      render(<LagekarteView einsatzId="einsatz-1" />);

      expect(capturedMapOnClick).toBeDefined();
      capturedMapOnClick!(mockMapEvent);

      expect(mockPlaceZeichen).toHaveBeenCalledWith(
        {
          zeichenId: 'z-existing-1',
          dto: { lagekarteId: 'lagekarte-42', lat: 50.3, lng: 10.5 },
        },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
      );
      expect(mockCreateZeichen).not.toHaveBeenCalled();
    });

    it('sollte toast.success zeigen bei erfolgreicher Platzierung eines bestehenden Zeichens', () => {
      mockDrawStoreOverrides = {
        pendingZeichenPlacement: {
          definition: { grundzeichen: 'fahrzeug' },
          existingZeichenId: 'z-existing-1',
        },
      };
      mockLagekarteData.mockReturnValue({ data: { id: 'lagekarte-42', state: null } });

      render(<LagekarteView einsatzId="einsatz-1" />);
      capturedMapOnClick!(mockMapEvent);

      const callArgs = mockPlaceZeichen.mock.calls[0][1];
      callArgs.onSuccess();

      expect(mockToastSuccess).toHaveBeenCalledWith('Zeichen platziert');
    });

    it('sollte toast.error zeigen wenn Lagekarte noch nicht geladen', () => {
      mockDrawStoreOverrides = {
        pendingZeichenPlacement: {
          definition: { grundzeichen: 'stelle' },
        },
      };
      mockLagekarteData.mockReturnValue({ data: null });

      render(<LagekarteView einsatzId="einsatz-1" />);

      capturedMapOnClick!(mockMapEvent);

      expect(mockCreateZeichen).not.toHaveBeenCalled();
      expect(mockPlaceZeichen).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith('Lagekarte noch nicht geladen — bitte einen Moment warten');
    });
  });
});
