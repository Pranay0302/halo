import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { __resetChromeStore } from '../setup';
import { KeySettings } from '../../src/sidebar/components/KeySettings';

beforeEach(() => __resetChromeStore());

describe('KeySettings', () => {
  it('saves the key and notifies parent', async () => {
    const onChange = vi.fn();
    render(<KeySettings onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'k-999' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    const { apiKey } = await chrome.storage.local.get('apiKey');
    expect(apiKey).toBe('k-999');
  });

  it('loads a previously saved key so it persists across opens', async () => {
    await chrome.storage.local.set({ apiKey: 'k-persisted' });
    render(<KeySettings onChange={vi.fn()} />);
    await waitFor(() =>
      expect((screen.getByLabelText(/api key/i) as HTMLInputElement).value).toBe('k-persisted'),
    );
  });

  it('does not overwrite the stored key when the field is emptied', async () => {
    await chrome.storage.local.set({ apiKey: 'keep-me' });
    render(<KeySettings onChange={vi.fn()} />);
    await waitFor(() =>
      expect((screen.getByLabelText(/api key/i) as HTMLInputElement).value).toBe('keep-me'),
    );

    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: '' } });
    expect((screen.getByRole('button', { name: /save/i }) as HTMLButtonElement).disabled).toBe(true);
    const { apiKey } = await chrome.storage.local.get('apiKey');
    expect(apiKey).toBe('keep-me');
  });
});
