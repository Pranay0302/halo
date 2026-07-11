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
    case 'PING':
      return { ok: true };
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
  }
}

// Register once per page, even if this script is injected again on demand
// (all of an extension's content scripts share one isolated world per page).
const win = window as unknown as { __hcoContentReady?: boolean };
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage && !win.__hcoContentReady) {
  win.__hcoContentReady = true;
  chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    if (!isMessage(raw)) return false;
    handleMessage(raw).then(sendResponse);
    return true;
  });
}
