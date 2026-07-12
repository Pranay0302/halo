import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { __resetChromeStore } from '../setup';
import { useAppState, mergeRuleSets } from '../../src/sidebar/state/useAppState';

describe('mergeRuleSets', () => {
  it('stacks a later change on top of an earlier one (both persist)', () => {
    const a = { version: 1, ops: [], globalCss: '[data-halo-id="h3"]{display:none}' };
    const b = { version: 1, ops: [], globalCss: '[data-halo-id="h2"]{display:none}' };
    const merged = mergeRuleSets(a, b);
    expect(merged.globalCss).toContain('h3');
    expect(merged.globalCss).toContain('h2');
    // later change comes after the earlier one, so it wins on the cascade
    expect(merged.globalCss.indexOf('h2')).toBeGreaterThan(merged.globalCss.indexOf('h3'));
  });

  it('ignores empty sides', () => {
    const empty = { version: 1, ops: [], globalCss: '' };
    const b = { version: 1, ops: [], globalCss: 'body{color:red}' };
    expect(mergeRuleSets(empty, b).globalCss).toBe('body{color:red}');
  });
});

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
