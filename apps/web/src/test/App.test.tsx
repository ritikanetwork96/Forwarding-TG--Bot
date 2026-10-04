import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../components/Badge';

describe('Web Foundation Tests', () => {
  it('renders Badge component with text and default styling', () => {
    render(<Badge variant="brand">Phase 0: Foundation</Badge>);
    const badgeElement = screen.getByText('Phase 0: Foundation');
    expect(badgeElement).toBeInTheDocument();
  });

  it('renders Badge with different variants', () => {
    const { rerender } = render(<Badge variant="success">Online</Badge>);
    expect(screen.getByText('Online')).toBeInTheDocument();

    rerender(<Badge variant="error">Offline</Badge>);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
});
