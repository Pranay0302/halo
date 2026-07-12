import type { Message, Responses } from '../shared/messages';
import { isMessage } from '../shared/messages';
import { applyRuleSet, isCatastrophicHide, type ApplyResult } from '../rules/engine';
import { extractPageRep } from './pageExtract';
import { generalizeRuleSet } from './durableSelector';

let currentApply: ApplyResult | null = null;

function resetCurrent(): void {
  if (currentApply) { currentApply.reverse(); currentApply = null; }
}

// Count elements that actually render a box, so we can tell if a change blanked
// the page. Capped for performance on very large documents.
function countVisible(cap = 4000): number {
  const all = document.body?.querySelectorAll('*');
  if (!all) return 0;
  let n = 0;
  const limit = Math.min(all.length, cap);
  for (let i = 0; i < limit; i++) {
    const el = all[i] as HTMLElement;
    if (el.getClientRects().length > 0) n++;
  }
  return n;
}

export async function handleMessage(msg: Message): Promise<Responses[keyof Responses]> {
  switch (msg.type) {
    case 'PING':
      return { ok: true };
    case 'EXTRACT_PAGE':
      return { pageRep: extractPageRep(document) };
    case 'APPLY_RULESET': {
      resetCurrent();
      // Ensure elements carry data-halo-id (needed for [data-halo-id="…"] selectors,
      // including when replaying a saved template on a freshly loaded page).
      extractPageRep(document);

      const before = countVisible();
      const apply = applyRuleSet(document, msg.ruleSet);
      if (isCatastrophicHide(before, countVisible())) {
        apply.reverse();
        return { unmatched: apply.unmatched, blanked: true };
      }
      currentApply = apply;
      return { unmatched: apply.unmatched };
    }
    case 'GENERALIZE_RULESET':
      // Convert data-halo-id references into durable selectors so a saved
      // template re-matches on later visits. Re-tag first so the ids resolve.
      extractPageRep(document);
      return { ruleSet: generalizeRuleSet(document, msg.ruleSet) };
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
