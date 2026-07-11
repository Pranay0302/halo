import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityLog } from '../../src/sidebar/components/ActivityLog';

describe('ActivityLog', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<ActivityLog steps={[]} output="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders steps and the raw agent output', () => {
    render(<ActivityLog steps={['Reading the DOM…', 'Applied.']} output='{"version":1}' />);
    expect(screen.getByText('Reading the DOM…')).toBeTruthy();
    expect(screen.getByText('Applied.')).toBeTruthy();
    expect(screen.getByText('{"version":1}')).toBeTruthy();
  });
});
