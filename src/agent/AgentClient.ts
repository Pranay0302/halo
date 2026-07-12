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
    input.base.globalCss.trim() ? `CSS already applied to the page (do NOT repeat it — return ONLY the new change; previous changes are kept automatically): ${input.base.globalCss.slice(0, 800)}` : '',
    `User instruction: ${input.instruction}`,
  ].filter(Boolean).join('\n');
}

// Yield every top-level balanced {...} substring, ignoring braces inside JSON
// strings. This survives reasoning models that wrap the JSON in prose.
function balancedObjects(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { out.push(text.slice(i, j + 1)); i = j; break; }
      }
    }
  }
  return out;
}

export function parseAgentResponse(text: string): RestyleRuleSet {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;

  // Try each balanced JSON object until one is usable — robust to prose,
  // reasoning, or trailing text around the actual answer.
  for (const candidate of balancedObjects(raw)) {
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(candidate) as Record<string, unknown>; } catch { continue; }
    if (typeof obj.css === 'string') return { version: 1, ops: [], globalCss: obj.css };
    const res = validateRuleSet(obj);
    if (res.ok) return res.value!;
  }
  throw new Error('Agent response contained no usable CSS or rules');
}

export { MockClient } from './MockClient';
