import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityLog } from '../../src/sidebar/components/ActivityLog';

describe('ActivityLog', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<ActivityLog steps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders short status steps only (never the raw agent output)', () => {
    render(<ActivityLog steps={['Reading the page…', 'Applying changes…', 'Done ✓']} />);
    expect(screen.getByText('Reading the page…')).toBeTruthy();
    expect(screen.getByText('Done ✓')).toBeTruthy();
  });
});
