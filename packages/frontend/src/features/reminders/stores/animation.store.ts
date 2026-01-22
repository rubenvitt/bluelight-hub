/**
 * Animation Store
 *
 * Trackt welche Erinnerungen gerade eine Update-Animation zeigen sollen.
 * Genutzt fuer Real-time WebSocket Updates (Story 3.2).
 *
 * **Story 3.2 AC2:** Status-Aenderungsanimation bei WebSocket-Events
 * **Story 3.2 Task 2.1:** Animation-Utility fuer Updates
 */

import { Store, useStore } from '@tanstack/react-store';

/**
 * Animation-Typ fuer verschiedene Effekte
 */
export type AnimationType = 'update' | 'insert' | 'delete';

/**
 * Animation Entry mit Typ und Timestamp
 */
export interface AnimationEntry {
  type: AnimationType;
  timestamp: number;
}

/**
 * Animation Store State
 */
export interface AnimationStoreState {
  /** Map von erinnerungId zu Animation-Entry */
  animatedIds: Map<string, AnimationEntry>;
}

/**
 * Animation Dauer in Millisekunden
 * Nach dieser Zeit wird die Animation automatisch entfernt
 */
const ANIMATION_DURATION_MS = 1500;

/**
 * TanStack Store fuer Animation-State
 */
export const animationStore = new Store<AnimationStoreState>({
  animatedIds: new Map(),
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Fuegt eine Erinnerung zur Animation-Liste hinzu.
 * Entfernt automatisch nach ANIMATION_DURATION_MS.
 *
 * @param erinnerungId - ID der zu animierenden Erinnerung
 * @param type - Typ der Animation (update, insert, delete)
 */
export function addAnimatedId(erinnerungId: string, type: AnimationType = 'update'): void {
  animationStore.setState((state) => {
    const newMap = new Map(state.animatedIds);
    newMap.set(erinnerungId, {
      type,
      timestamp: Date.now(),
    });
    return { ...state, animatedIds: newMap };
  });

  // Auto-Cleanup nach Animation-Dauer
  setTimeout(() => {
    removeAnimatedId(erinnerungId);
  }, ANIMATION_DURATION_MS);
}

/**
 * Entfernt eine Erinnerung aus der Animation-Liste.
 *
 * @param erinnerungId - ID der Erinnerung
 */
export function removeAnimatedId(erinnerungId: string): void {
  animationStore.setState((state) => {
    const newMap = new Map(state.animatedIds);
    newMap.delete(erinnerungId);
    return { ...state, animatedIds: newMap };
  });
}

/**
 * Entfernt alle Animationen.
 */
export function clearAllAnimations(): void {
  animationStore.setState((state) => ({
    ...state,
    animatedIds: new Map(),
  }));
}

/**
 * Resettet den Animation-Store auf Initialzustand.
 */
export function resetAnimationStore(): void {
  animationStore.setState(() => ({
    animatedIds: new Map(),
  }));
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Prueft ob eine Erinnerung gerade animiert wird.
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns true wenn Animation aktiv
 */
export function isAnimated(erinnerungId: string): boolean {
  return animationStore.state.animatedIds.has(erinnerungId);
}

/**
 * Gibt den Animation-Typ fuer eine Erinnerung zurueck.
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns Animation-Entry oder undefined
 */
export function getAnimationEntry(erinnerungId: string): AnimationEntry | undefined {
  return animationStore.state.animatedIds.get(erinnerungId);
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook um zu pruefen ob eine Erinnerung animiert wird.
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns true wenn Animation aktiv
 */
export function useIsAnimated(erinnerungId: string): boolean {
  return useStore(animationStore, (state) => state.animatedIds.has(erinnerungId));
}

/**
 * Hook fuer den Animation-Typ einer Erinnerung.
 *
 * @param erinnerungId - ID der Erinnerung
 * @returns Animation-Entry oder undefined
 */
export function useAnimationEntry(erinnerungId: string): AnimationEntry | undefined {
  return useStore(animationStore, (state) => state.animatedIds.get(erinnerungId));
}

/**
 * Hook fuer den kompletten Animation-Store State (Debug/Testing).
 *
 * @returns Kompletter Store State
 */
export function useAnimationStoreState(): AnimationStoreState {
  return useStore(animationStore);
}
