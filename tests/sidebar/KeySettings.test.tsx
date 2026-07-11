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
});
