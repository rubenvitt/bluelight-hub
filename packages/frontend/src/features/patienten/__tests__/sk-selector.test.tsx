import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkSelector } from '../ui/sk-selector';

describe('SkSelector', () => {
  it('rendert alle 5 SK-Pills', () => {
    render(<SkSelector value={undefined} onChange={vi.fn()} />);
    expect(screen.getByTestId('sk-selector-pill-SK_I')).toBeInTheDocument();
    expect(screen.getByTestId('sk-selector-pill-SK_II')).toBeInTheDocument();
    expect(screen.getByTestId('sk-selector-pill-SK_III')).toBeInTheDocument();
    expect(screen.getByTestId('sk-selector-pill-SK_IV')).toBeInTheDocument();
    expect(screen.getByTestId('sk-selector-pill-TOT')).toBeInTheDocument();
  });

  it('markiert die ausgewählte SK mit aria-checked=true', () => {
    render(<SkSelector value="SK_II" onChange={vi.fn()} />);
    expect(screen.getByTestId('sk-selector-pill-SK_II')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('sk-selector-pill-SK_I')).toHaveAttribute('aria-checked', 'false');
  });

  it('ruft onChange beim Klick auf eine Pill', () => {
    const onChange = vi.fn();
    render(<SkSelector value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('sk-selector-pill-SK_IV'));
    expect(onChange).toHaveBeenCalledWith('SK_IV');
  });

  it('blockt Klicks im Disabled-State', () => {
    const onChange = vi.fn();
    render(<SkSelector value="SK_I" onChange={onChange} disabled />);
    fireEvent.click(screen.getByTestId('sk-selector-pill-SK_II'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('navigiert mit Pfeiltasten', () => {
    const onChange = vi.fn();
    render(<SkSelector value="SK_II" onChange={onChange} />);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('SK_III');
  });

  it('liefert verbindliches SK_IV-Label „SK IV — Abwartend"', () => {
    render(<SkSelector value={undefined} onChange={vi.fn()} />);
    expect(screen.getByTestId('sk-selector-pill-SK_IV')).toHaveAttribute('aria-label', 'SK IV — Abwartend');
  });
});
