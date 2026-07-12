import type { RestyleRuleSet, PageRep } from './types';

export type Message =
  | { type: 'PING' }
  | { type: 'EXTRACT_PAGE' }
  | { type: 'APPLY_RULESET'; ruleSet: RestyleRuleSet }
  | { type: 'GENERALIZE_RULESET'; ruleSet: RestyleRuleSet }
  | { type: 'QUICK_STYLE'; instruction: string }
  | { type: 'RESET' };

export interface Responses {
  PING: { ok: true };
  EXTRACT_PAGE: { pageRep: PageRep };
  APPLY_RULESET: { unmatched: number; blanked?: boolean };
  GENERALIZE_RULESET: { ruleSet: RestyleRuleSet };
  QUICK_STYLE: { ruleSet: RestyleRuleSet | null };
  RESET: { ok: true };
}

const TYPES = ['PING', 'EXTRACT_PAGE', 'APPLY_RULESET', 'GENERALIZE_RULESET', 'QUICK_STYLE', 'RESET'];

export function isMessage(x: unknown): x is Message {
  return typeof x === 'object' && x !== null && TYPES.includes((x as { type?: string }).type ?? '');
}
