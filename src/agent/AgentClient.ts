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
    'You restyle web pages by returning CSS. The user names an element or region; produce CSS that changes ONLY that.',
    'Every node has a unique "hid". Target elements ONLY with the attribute selector [data-halo-id="<hid>"]. Do NOT write class or tag selectors — class names here are reused across unrelated elements, so a class selector can hide the whole page.',
    'Each node has a "rect" {x,y,w,h} in pixels. Use it (and the screenshot, if attached) to find the region the user means — a "left sidebar" is tall, narrow, near x=0; a "top bar" spans the width near y=0; the main content is the largest central area.',
    'Choose the single smallest element (or the few) that IS the named region. NEVER target the <body>, <html>, or a wrapper whose rect covers most of the viewport — that blanks the page.',
    'Use "display: none !important" to remove; use normal CSS to resize, recolor, or reorder.',
    'Respond with ONLY a JSON object of the form {"css": "<css rules>"} and nothing else.',
    input.screenshot ? 'A screenshot of the page is attached.' : '',
    `Page URL: ${input.pageRep.url}`,
    `DOM (each node: tag, hid, role, label, text, rect): ${JSON.stringify(input.pageRep.root).slice(0, 7000)}`,
    input.base.globalCss.trim() ? `Currently applied CSS (keep unless the instruction overrides it): ${input.base.globalCss.slice(0, 1000)}` : '',
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
