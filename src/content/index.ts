import type { Message, Responses } from '../shared/messages';
import { isMessage } from '../shared/messages';
import { applyRuleSet, type ApplyResult } from '../rules/engine';
import { extractPageRep } from './pageExtract';

let currentApply: ApplyResult | null = null;

function resetCurrent(): void {
  if (currentApply) { currentApply.reverse(); currentApply = null; }
}

export async function handleMessage(msg: Message): Promise<Responses[keyof Responses]> {
  switch (msg.type) {
    case 'EXTRACT_PAGE':
      return { pageRep: extractPageRep(document) };
    case 'APPLY_RULESET': {
      resetCurrent();
      currentApply = applyRuleSet(document, msg.ruleSet);
      return { unmatched: currentApply.unmatched };
    }
    case 'RESET':
      resetCurrent();
      return { ok: true };
    case 'GENERATE':
      // Agent calls run in the background worker, not the content script.
      return { error: 'GENERATE not handled in content script' };
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    if (!isMessage(raw)) return false;
    handleMessage(raw).then(sendResponse);
    return true;
  });
}
