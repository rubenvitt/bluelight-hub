import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDeepLinkRedirect } from '../hooks/use-deep-link-redirect';

/**
 * Tests für den Deep-Link-Redirect-Hook (F31).
 * Idempotenz pro `${action}|${patientId}`-Kombination.
 */
describe('useDeepLinkRedirect', () => {
  const validCuid = 'a' + 'b'.repeat(23);

  it('does not navigate when action is undefined', () => {
    const navigate = vi.fn();
    renderHook(() =>
      useDeepLinkRedirect({
        einsatzId: 'einsatz-1',
        action: undefined,
        patientId: undefined,
        navigate: navigate as never,
      }),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('navigates once on mount when action=detail with patientId', () => {
    const navigate = vi.fn();
    renderHook(() =>
      useDeepLinkRedirect({
        einsatzId: 'einsatz-1',
        action: 'detail',
        patientId: validCuid,
        navigate: navigate as never,
      }),
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      to: '/app/einsatz/$einsatzId/patienten/$patientId',
      params: { einsatzId: 'einsatz-1', patientId: validCuid },
      replace: true,
    });
  });

  it('does not navigate again on re-render with the same key', () => {
    const navigate = vi.fn();
    const { rerender } = renderHook(
      (props: { patientId: string }) =>
        useDeepLinkRedirect({
          einsatzId: 'einsatz-1',
          action: 'detail',
          patientId: props.patientId,
          navigate: navigate as never,
        }),
      { initialProps: { patientId: validCuid } },
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    rerender({ patientId: validCuid });
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('navigates again when patientId changes to a new value (F31)', () => {
    const navigate = vi.fn();
    const otherCuid = 'c' + 'd'.repeat(23);
    const { rerender } = renderHook(
      (props: { patientId: string }) =>
        useDeepLinkRedirect({
          einsatzId: 'einsatz-1',
          action: 'detail',
          patientId: props.patientId,
          navigate: navigate as never,
        }),
      { initialProps: { patientId: validCuid } },
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    rerender({ patientId: otherCuid });
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenLastCalledWith({
      to: '/app/einsatz/$einsatzId/patienten/$patientId',
      params: { einsatzId: 'einsatz-1', patientId: otherCuid },
      replace: true,
    });
  });

  it('does not navigate when action transitions to undefined', () => {
    const navigate = vi.fn();
    const { rerender } = renderHook(
      (props: { action: 'detail' | undefined }) =>
        useDeepLinkRedirect({
          einsatzId: 'einsatz-1',
          action: props.action,
          patientId: validCuid,
          navigate: navigate as never,
        }),
      { initialProps: { action: 'detail' as const } },
    );
    expect(navigate).toHaveBeenCalledTimes(1);
    rerender({ action: undefined });
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
