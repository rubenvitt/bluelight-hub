import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NewBadge } from '../NewBadge';

describe('NewBadge', () => {
  it('should render successfully', () => {
    render(<NewBadge />);
    expect(screen.getByText('NEU')).toBeInTheDocument();
  });

  it('should have animation class when reduced motion is false', () => {
    // Default mock is usually false, or we can explicitely pass prop
    const { container } = render(<NewBadge reducedMotion={false} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('animate-pulse');
  });

  it('should NOT have animation class when reduced motion is true', () => {
    const { container } = render(<NewBadge reducedMotion={true} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).not.toContain('animate-pulse');
  });
});
