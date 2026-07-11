import type { RestyleRuleSet, PageRep } from './types';

export type Message =
  | { type: 'EXTRACT_PAGE' }
  | { type: 'APPLY_RULESET'; ruleSet: RestyleRuleSet }
  | { type: 'RESET' }
  | { type: 'GENERATE'; instruction: string; base: RestyleRuleSet; pageRep: PageRep };

export interface Responses {
  EXTRACT_PAGE: { pageRep: PageRep };
  APPLY_RULESET: { unmatched: number };
  RESET: { ok: true };
  GENERATE: { ruleSet: RestyleRuleSet } | { error: string };
}

const TYPES = ['EXTRACT_PAGE', 'APPLY_RULESET', 'RESET', 'GENERATE'];

export function isMessage(x: unknown): x is Message {
  return typeof x === 'object' && x !== null && TYPES.includes((x as { type?: string }).type ?? '');
}
