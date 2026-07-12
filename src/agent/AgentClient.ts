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

const DESIGN_TOKENS = [
  'DESIGN TOKENS (use ONLY these values, for a cohesive on-system look):',
  '- radius: 12px on cards, 8px on buttons/inputs.',
  '- shadow: 0 1px 2px rgba(0,0,0,0.06) (sm) or 0 4px 12px rgba(0,0,0,0.08) (md).',
  '- type scale: 13 / 15 / 20 / 28px; line-height 1.5; headings font-weight 600, letter-spacing -0.01em.',
  "- font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif.",
  '- keep the page\'s EXISTING accent and background colors; match the current light/dark theme from the screenshot.',
].join('\n');

const SAFE_POLISH = [
  'SAFE POLISH MODE (broad aesthetic request): make it look cleaner WITHOUT breaking the layout.',
  '- Set ONLY these additive properties: border-radius, box-shadow, border, background (a SUBTLE tint that matches the current theme), color (only to fix readability), font-family, font-size, font-weight, line-height, letter-spacing, text-align, opacity, transition.',
  '- NEVER set layout properties on the site\'s elements: no display, position, float, width, height, min/max-width, min/max-height, margin, padding, gap, top/right/bottom/left, flex, grid, transform, overflow. Those break the page.',
  '- Apply the tokens consistently to the main CONTENT CARDS (the section/card ancestors) only — never to <body>/<html> or large wrappers.',
  '- Match the theme from the screenshot: on a LIGHT page use white/near-white card backgrounds; on a DARK page use a subtle elevated tint like rgba(255,255,255,0.05) — NEVER a solid white card on a dark page.',
  '- No full-page backgrounds, no gradients, no clashing colors. Fewer, consistent rules beat a sweeping repaint.',
].join('\n');

export function isAestheticRequest(instruction: string): boolean {
  const t = instruction.toLowerCase();
  return /\b(pretty|prettier|nice|nicer|clean|cleaner|modern|beautiful|aesthetic|polish|stylish|sleek|elegant|gorgeous|professional|look good|looks good|look nice|nicely|design)\b/.test(t);
}

export function buildPrompt(input: AgentInput): string {
  const aesthetic = isAestheticRequest(input.instruction);
  return [
    'You are a web-page restyling agent for the CURRENT page. For a SPECIFIC request (center X, move Y, make Z wider, recolor W, hide V) do exactly that — layout changes are allowed. For a BROAD aesthetic request ("make it pretty/cleaner/nicer/modern") use SAFE POLISH MODE below and do NOT change layout.',
    'Every node has a unique "hid". Target elements ONLY with the attribute selector [data-halo-id="<hid>"]. NEVER use class or tag selectors — class names here are reused across unrelated elements, so they can hit the whole page.',
    'Each node has a "rect" {x,y,w,h} in pixels; use it (and the screenshot, if attached) to locate what the user means. A "left sidebar" is tall/narrow near x=0; a "top bar" spans the width near y=0; the main content is the largest central area. A named section/card is the ancestor with the LARGER rect that groups a heading + its content — target that whole card, not the small heading/label.',
    'For a specific request, prefer CSS: center with margin/flex/grid or text-align; rearrange columns with flexbox/grid "order"; reposition with position/transform; resize, recolor, restyle freely; use "display: none !important" to remove.',
    DESIGN_TOKENS,
    aesthetic ? SAFE_POLISH : '',
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
