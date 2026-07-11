import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { __resetChromeStore } from '../setup';
import { App } from '../../src/sidebar/App';

beforeEach(() => {
  __resetChromeStore();
  (chrome.tabs.query as any) = vi.fn(async () => [{ id: 1, url: 'https://mail.google.com/' }]);
  (chrome.tabs as any).sendMessage = vi.fn(async () => ({ unmatched: 0 }));
});

describe('App', () => {
  it('renders the domain and presets, and applies a preset on click', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText(/mail\.google\.com/)).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /minimal/i }));
    await waitFor(() => expect(chrome.tabs.sendMessage).toHaveBeenCalled());
  });
});
