import type { PageRep, RestyleRuleSet } from '../shared/types';
import { validateRuleSet, filterValidOps } from '../rules/schema';

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
    'You are a web-page restyling agent for the CURRENT page. Do whatever the user asks — you can change layout, position, size, spacing, alignment/centering, colors, backgrounds, typography, borders, shadows, rounded corners, visibility, and the overall look (e.g. "make it modern/pretty/minimal").',
    'Every node has a unique "hid". Target elements ONLY with the attribute selector [data-halo-id="<hid>"]. NEVER use class or tag selectors — class names here are reused across unrelated elements, so they can hit the whole page.',
    'Each node has a "rect" {x,y,w,h} in pixels; use it (and the screenshot, if attached) to locate what the user means. A "left sidebar" is tall/narrow near x=0; a "top bar" spans the width near y=0; the main content is the largest central area. A named section/card is the ancestor with the LARGER rect that groups a heading + its content — target that whole card, not the small heading/label.',
    'Prefer CSS for everything you can: center with margin/flex/grid or text-align; rearrange columns with flexbox/grid "order"; reposition with position/transform; resize, recolor, and restyle freely; use "display: none !important" to remove. When asked to "make it pretty/modern", apply cohesive spacing, readable typography, and a consistent palette.',
    'When the user says "keep only X", hide the OTHER sibling sections around X — never X itself.',
    "Do not use @import or external url() resources (they are stripped) — for typography use a system font stack like -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif. To center a block, give it a width and margin:auto, or make its parent display:flex with justify/align center.",
    'For a TRUE structural move that CSS cannot express (relocating a node into a different parent, or reordering siblings), use an "ops" entry instead of CSS.',
    'NEVER hide/clear <body>, <html>, or a wrapper whose rect covers most of the viewport — that blanks the page.',
    'Be CONCISE: return a SMALL, focused set of high-impact rules (typically under ~1200 characters of CSS) — do NOT write an exhaustive stylesheet for every element. A few well-chosen rules that clearly change the page beat a giant one that gets truncated.',
    'Respond with ONLY one JSON object: {"css":"<css rules or empty string>","ops":[<zero or more structural ops>]}. No prose, no markdown, no explanation.',
    'Op shapes: {"op":"move","selector":"[data-halo-id=\\"h5\\"]","target":"[data-halo-id=\\"h2\\"]","position":"before"|"after"|"prepend"|"append"} and {"op":"reorder","selector":"<container hid selector>","order":["<child hid selector>",...]}.',
    input.screenshot ? 'A screenshot of the current page is attached — use it to see the layout, then map to the matching hids/rects.' : '',
    `Page URL: ${input.pageRep.url}`,
    `DOM (each node: tag, hid, role, label, text, rect): ${JSON.stringify(input.pageRep.root).slice(0, 7000)}`,
    input.base.globalCss.trim() ? `CSS already applied (do NOT repeat it — return ONLY the new change; previous changes are kept automatically): ${input.base.globalCss.slice(0, 800)}` : '',
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

    // A full, already-valid RestyleRuleSet.
    const full = validateRuleSet(obj);
    if (full.ok) return full.value!;

    // The { css, ops } contract: CSS for styling, optional structural ops.
    // Accept when a css string is present (even empty) or at least one op is
    // valid; a malformed full ruleset (no css key, no valid ops) still throws.
    const hasCss = typeof obj.css === 'string';
    const ops = Array.isArray(obj.ops) ? filterValidOps(obj.ops as unknown[]) : [];
    if (hasCss || ops.length) {
      return { version: 1, ops, globalCss: hasCss ? (obj.css as string) : '' };
    }
  }

  // Salvage: the model ran long and its JSON was truncated mid-string (no
  // closing brace). Recover the partial "css" value — the browser ignores the
  // incomplete trailing rule and applies the rest, so the page still changes.
  const partial = raw.match(/"css"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (partial && partial[1].trim()) {
    let css = partial[1];
    try { css = JSON.parse(`"${css}"`); } catch { css = css.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\'); }
    if (css.trim()) return { version: 1, ops: [], globalCss: css };
  }

  throw new Error('Agent response contained no usable CSS or rules');
}

export { MockClient } from './MockClient';
