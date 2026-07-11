import type { PageRep, RestyleRuleSet } from '../shared/types';
import { validateRuleSet } from '../rules/schema';

export interface AgentInput {
  pageRep: PageRep;
  base: RestyleRuleSet;
  instruction: string;
  /** Optional page screenshot (data URL) for multimodal grounding. */
  screenshot?: string;
}

export interface AgentProgress {
  phase: 'thinking' | 'answering';
  text: string;
  chars: number;
}

export interface AgentClient {
  generate(
    input: AgentInput,
    onProgress?: (progress: AgentProgress) => void,
    signal?: AbortSignal,
  ): Promise<RestyleRuleSet>;
}

export function buildPrompt(input: AgentInput): string {
  return [
    'You restyle web pages with CSS. Given the page and a user instruction, produce CSS that achieves it.',
    'Respond with ONLY a JSON object of the form {"css": "<css rules>"} and nothing else.',
    'Use "display: none !important" to hide/remove elements; use standard CSS to resize, recolor, reorder (flex/grid order), or rearrange.',
    'Prefer robust selectors: semantic tags, ARIA roles, aria-labels, ids, and structural selectors like :nth-child. Avoid relying on auto-generated class names when a stable selector exists.',
    input.screenshot ? 'A screenshot of the page is attached — use it to locate the elements the instruction refers to.' : '',
    `Page URL: ${input.pageRep.url}`,
    `Page DOM (truncated): ${JSON.stringify(input.pageRep.root).slice(0, 6000)}`,
    input.base.globalCss.trim() ? `Currently applied CSS (keep unless the instruction overrides it): ${input.base.globalCss.slice(0, 1500)}` : '',
    `User instruction: ${input.instruction}`,
  ].filter(Boolean).join('\n');
}

export function parseAgentResponse(text: string): RestyleRuleSet {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in agent response');

  let obj: Record<string, unknown>;
  try { obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>; }
  catch (e) { throw new Error(`Agent response is not valid JSON: ${(e as Error).message}`); }

  // Primary contract: { css: "..." } → a single scoped CSS block.
  if (typeof obj.css === 'string') {
    return { version: 1, ops: [], globalCss: obj.css };
  }
  // Backward-compatible: a full structured RestyleRuleSet.
  const res = validateRuleSet(obj);
  if (res.ok) return res.value!;
  throw new Error(`Agent response was not usable CSS or rules: ${res.errors.join('; ')}`);
}

export { MockClient } from './MockClient';
