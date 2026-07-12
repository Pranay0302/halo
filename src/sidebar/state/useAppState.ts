import { useCallback, useEffect, useRef, useState } from 'react';
import type { PageRep, PageRepNode, Preset, RestyleRuleSet, Template } from '../../shared/types';
import { PRESETS, getPreset } from '../../rules/presets';
import { listTemplates, saveTemplate, deleteTemplate as delTemplate, exportTemplates, importTemplates } from '../../storage/templates';
import { getStoredClient } from '../../agent/stored';
import { getActiveDomain, sendToTab, captureScreenshot } from './messaging';

export type Status = { kind: 'idle' | 'busy' | 'error' | 'info'; message?: string };
const EMPTY: RestyleRuleSet = { version: 1, ops: [], globalCss: '' };

function countNodes(node: PageRepNode): number {
  return 1 + (node.children?.reduce((sum, c) => sum + countNodes(c), 0) ?? 0);
}

// Stack a new change on top of the existing one. Appending CSS means a later
// rule wins over an earlier conflicting one (normal cascade), while unrelated
// earlier changes are preserved.
export function mergeRuleSets(base: RestyleRuleSet, delta: RestyleRuleSet): RestyleRuleSet {
  const css = [base.globalCss.trim(), delta.globalCss.trim()].filter(Boolean).join('\n');
  return { version: 1, ops: [...base.ops, ...delta.ops], globalCss: css };
}

export function useAppState() {
  const [domain, setDomain] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [apiKeySet, setApiKeySet] = useState(false);
  const [activity, setActivity] = useState<string[]>([]);
  const [agentOutput, setAgentOutput] = useState('');
  const current = useRef<RestyleRuleSet>(EMPTY);
  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await getActiveDomain();
      setDomain(d);
      setTemplates(await listTemplates(d));
      const { apiKey } = await chrome.storage.local.get('apiKey');
      setApiKeySet(Boolean(apiKey));
    } catch {
      // Transient (e.g. no active tab yet) — keep the current state.
    }
  }, []);

  // Re-sync whenever the active tab changes, navigates, or the window refocuses,
  // so the panel always reflects the page currently in front of the user.
  useEffect(() => {
    void refresh();

    const onActivated = () => refresh();
    const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (tab.active && changeInfo.url) return refresh();
    };
    const onFocusChanged = (windowId: number) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) return refresh();
    };

    chrome.tabs?.onActivated?.addListener(onActivated);
    chrome.tabs?.onUpdated?.addListener(onUpdated);
    chrome.windows?.onFocusChanged?.addListener(onFocusChanged);

    return () => {
      chrome.tabs?.onActivated?.removeListener(onActivated);
      chrome.tabs?.onUpdated?.removeListener(onUpdated);
      chrome.windows?.onFocusChanged?.removeListener(onFocusChanged);
    };
  }, [refresh]);

  // `merge` stacks the new change on top of what's already applied, so an
  // earlier command persists when a later one runs. Presets/templates replace.
  const applyRuleSet = useCallback(async (rs: RestyleRuleSet, merge = false): Promise<boolean> => {
    const target = merge ? mergeRuleSets(current.current, rs) : rs;
    const res = await sendToTab<{ unmatched: number; blanked?: boolean }>({ type: 'APPLY_RULESET', ruleSet: target });
    if (res.blanked) {
      setStatus({ kind: 'error', message: 'That change would have hidden the whole page, so I reverted it. Try naming the specific element (e.g. "the left navigation").' });
      return false;
    }
    current.current = target;
    setStatus(res.unmatched > 0
      ? { kind: 'info', message: `${res.unmatched} rule(s) didn't match — the page may have changed.` }
      : { kind: 'idle' });
    return true;
  }, []);

  const applyPreset = useCallback(async (id: string) => {
    const preset = getPreset(id);
    if (!preset) return;
    await applyRuleSet(preset.ruleSet);
  }, [applyRuleSet]);

  const generate = useCallback(async (instruction: string) => {
    // Cancel any request still in flight so a new question isn't queued behind it.
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;

    setActivity([]);
    setAgentOutput('');
    const log = (line: string) => {
      console.log('[layout-overlay]', line);
      setActivity((a) => [...a, line]);
    };

    setStatus({ kind: 'busy', message: 'Reading the page…' });
    try {
      // Fast-path: resolve common layout commands deterministically in the page —
      // instant, no network, no rate limit. Only novel requests hit the agent.
      const quick = await sendToTab<{ ruleSet: RestyleRuleSet | null }>({ type: 'QUICK_STYLE', instruction });
      if (quick.ruleSet) {
        log('Recognized a common command — applying instantly (no agent needed).');
        log(await applyRuleSet(quick.ruleSet, true) ? 'Applied.' : 'Reverted — the change would have blanked the page.');
        return;
      }

      const client = await getStoredClient();
      log(`Reading the DOM of ${domain || 'this page'}…`);
      // Novel requests need visual grounding to locate a named section, so send
      // a small screenshot alongside the DOM (best-effort; DOM-only if it fails).
      const [{ pageRep }, screenshot] = await Promise.all([
        sendToTab<{ pageRep: PageRep }>({ type: 'EXTRACT_PAGE' }),
        captureScreenshot(),
      ]);
      log(`Captured ${countNodes(pageRep.root)} elements${screenshot ? ' + screenshot' : ''}. Sending to the agent…`);

      // Tick a live elapsed counter while waiting for the first token, so a slow
      // response is visibly progressing instead of looking frozen.
      const started = Date.now();
      let streaming = false;
      const ticker = setInterval(() => {
        if (!streaming) {
          const secs = Math.round((Date.now() - started) / 1000);
          setStatus({ kind: 'busy', message: `Asking the agent… (${secs}s)` });
        }
      }, 1000);

      try {
        const ruleSet = await client.generate(
          { pageRep, base: current.current, instruction, screenshot },
          (progress) => {
            streaming = true;
            setAgentOutput(progress.text);
            const label = progress.phase === 'thinking' ? 'Thinking' : 'Writing changes';
            setStatus({ kind: 'busy', message: `${label}… (${progress.chars} chars)` });
          },
          controller.signal,
        );

        log(`Agent returned ${ruleSet.ops.length} op(s)${ruleSet.globalCss.trim() ? ' + CSS' : ''}. Applying…`);
        log(await applyRuleSet(ruleSet, true) ? 'Applied.' : 'Reverted — the change would have blanked the page.');
      } finally {
        clearInterval(ticker);
      }
    } catch (e) {
      // A newer request superseded this one — leave its status alone.
      if ((e as Error).name === 'AbortError') return;
      log(`Error: ${(e as Error).message}`);
      setStatus({ kind: 'error', message: (e as Error).message });
    } finally {
      if (inflight.current === controller) inflight.current = null;
    }
  }, [applyRuleSet, domain]);

  const saveCurrent = useCallback(async (name: string) => {
    const now = Date.now();
    // Convert data-halo-id references to durable selectors so the template
    // re-matches on future visits (hids are reassigned on every page load).
    let ruleSet = current.current;
    try {
      const res = await sendToTab<{ ruleSet?: RestyleRuleSet }>({ type: 'GENERALIZE_RULESET', ruleSet });
      if (res?.ruleSet) ruleSet = res.ruleSet;
    } catch {
      // Content script unavailable — fall back to saving as-is.
    }
    await saveTemplate({
      id: `${domain}:${now}`, name, domain, presetBase: null,
      instructionHistory: [], ruleSet, createdAt: now, updatedAt: now,
    });
    setTemplates(await listTemplates(domain));
    setStatus({ kind: 'info', message: 'Template saved.' });
  }, [domain]);

  const applyTemplate = useCallback(async (t: Template) => { await applyRuleSet(t.ruleSet); }, [applyRuleSet]);

  const deleteTemplate = useCallback(async (id: string) => {
    await delTemplate(id);
    setTemplates(await listTemplates(domain));
  }, [domain]);

  const reset = useCallback(async () => {
    current.current = EMPTY;
    await sendToTab({ type: 'RESET' });
    setStatus({ kind: 'idle' });
  }, []);

  const exportAll = useCallback(() => exportTemplates(), []);

  const importAll = useCallback(async (json: string) => {
    const res = await importTemplates(json);
    setTemplates(await listTemplates(domain));
    setStatus({
      kind: 'info',
      message: `Imported ${res.imported} template(s)${res.skipped ? `, skipped ${res.skipped}` : ''}.`,
    });
  }, [domain]);

  const presets: Preset[] = PRESETS;
  return { domain, presets, templates, status, apiKeySet, activity, agentOutput, applyPreset, generate, saveCurrent, applyTemplate, deleteTemplate, reset, exportAll, importAll, refresh };
}
