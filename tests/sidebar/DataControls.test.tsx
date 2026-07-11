import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DataControls } from '../../src/sidebar/components/DataControls';

beforeEach(() => {
  (URL as any).createObjectURL = vi.fn(() => 'blob:x');
  (URL as any).revokeObjectURL = vi.fn();
});

describe('DataControls', () => {
  it('exports through onExport', async () => {
    // The component clicks a generated <a download>; stub it so jsdom does not
    // attempt (unsupported) navigation and pollute the test output.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const onExport = vi.fn(async () => '[]');
    render(<DataControls onExport={onExport} onImport={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => expect(onExport).toHaveBeenCalled());
    clickSpy.mockRestore();
  });

  it('imports the selected file through onImport', async () => {
    const onImport = vi.fn(async () => {});
    const { container } = render(<DataControls onExport={vi.fn(async () => '[]')} onImport={onImport} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['[{"id":"t1"}]'], 'templates.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onImport).toHaveBeenCalledWith('[{"id":"t1"}]'));
  });
});
