import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { __resetChromeStore } from '../setup';
import { useAppState } from '../../src/sidebar/state/useAppState';

beforeEach(() => {
  __resetChromeStore();
  (chrome.tabs.query as any) = vi.fn(async () => [{ id: 1, url: 'https://mail.google.com/' }]);
  (chrome.tabs as any).sendMessage = vi.fn(async () => ({ unmatched: 0, ok: true, pageRep: { url: 'x', root: { tag: 'body' } } }));
  (chrome.runtime.sendMessage as any) = vi.fn(async () => ({ ruleSet: { version: 1, ops: [{ op: 'hide', selector: '.ad' }], globalCss: '' } }));
});

describe('useAppState', () => {
  it('loads domain and presets', async () => {
    const { result } = renderHook(() => useAppState());
    await waitFor(() => expect(result.current.domain).toBe('mail.google.com'));
    expect(result.current.presets.length).toBeGreaterThan(0);
  });

  it('applyPreset sends APPLY_RULESET to the tab', async () => {
    const { result } = renderHook(() => useAppState());
    await waitFor(() => expect(result.current.domain).toBe('mail.google.com'));
    await act(async () => { await result.current.applyPreset('dark'); });
    expect(chrome.tabs.sendMessage).toHaveBeenCalled();
  });

  it('re-syncs the active domain when the tab changes', async () => {
    const { result } = renderHook(() => useAppState());
    await waitFor(() => expect(result.current.domain).toBe('mail.google.com'));

    // The user switches to a different site.
    (chrome.tabs.query as any) = vi.fn(async () => [{ id: 2, url: 'https://www.linkedin.com/feed/' }]);
    const calls = (chrome.tabs.onActivated.addListener as any).mock.calls;
    const onActivated = calls[calls.length - 1][0];
    await act(async () => { await onActivated({ tabId: 2, windowId: 1 }); });

    await waitFor(() => expect(result.current.domain).toBe('www.linkedin.com'));
  });

  it('saveCurrent persists a template listed for the domain', async () => {
    const { result } = renderHook(() => useAppState());
    await waitFor(() => expect(result.current.domain).toBe('mail.google.com'));
    await act(async () => { await result.current.applyPreset('minimal'); });
    await act(async () => { await result.current.saveCurrent('My Gmail'); });
    await waitFor(() => expect(result.current.templates.map((t) => t.name)).toContain('My Gmail'));
  });
});
